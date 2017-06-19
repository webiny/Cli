const Webiny = require('./../webiny');
const inquirer = require('inquirer');
const yaml = require('js-yaml');
const generatePassword = require('password-generator');

const configs = {
    configSets: Webiny.projectRoot('Configs/ConfigSets.yaml'),
    base: {
        application: Webiny.projectRoot('Configs/Base/Application.yaml'),
        database: Webiny.projectRoot('Configs/Base/Database.yaml'),
        security: Webiny.projectRoot('Configs/Base/Security.yaml')
    },
    local: {
        application: Webiny.projectRoot('Configs/Local/Application.yaml')
    }
};

function setupVirtualHost(answers, callback) {
    // Create host file
    let hostFile = Webiny.readFile(__dirname + '/host.cfg');
    let server = answers.domain.replace('http://', '').replace('https://', '').split(':')[0];
    hostFile = hostFile.replace('{DOMAIN_HOST}', server);
    hostFile = hostFile.replace('{ABS_PATH}', Webiny.projectRoot());
    hostFile = hostFile.replace('{ERROR_LOG}', answers.errorLogFile);

    try {
        const target = '/etc/nginx/sites-enabled/' + server;
        if (Webiny.fileExists(target)) {
            if (Webiny.isSymbolicLink(target)) {
                Webiny.shellExecute('sudo unlink ' + target);
            } else {
                Webiny.shellExecute('sudo rm /etc/nginx/sites-enabled/' + server);
            }
        }
        Webiny.writeFile(answers.hostFile, hostFile);
        if (answers.hostFile !== target) {
            Webiny.shellExecute('sudo ln -s ' + answers.hostFile + ' ' + target);
        }
        Webiny.shellExecute('sudo service nginx reload');
        Webiny.success('Host file created successfully!');
        callback(answers);
    } catch (err) {
        Webiny.failure(err);
    }
}

module.exports = function (callback) {
    // Create project structure
    const composer = {
        "require": {
            "webiny/webiny": "dev-master"
        },
        "minimum-stability": "dev",
        "prefer-stable": true
    };

    Webiny.writeFile(Webiny.projectRoot('composer.json'), JSON.stringify(composer, null, 4));
    try {
        Webiny.log('Running composer to install PHP dependencies...');
        Webiny.shellExecute('composer install');
        Webiny.success('Composer installation completed!');

        Webiny.log('Installing npm dependencies...');
        Webiny.shellExecute('cd ' + Webiny.projectRoot('Apps/Webiny') + ' && npm install');

        Webiny.copy(Webiny.projectRoot('Apps/Webiny/Setup/.'), Webiny.projectRoot());

        Webiny.log("\nNow we need to create a platform configuration and your first user:\n");

        const questions = [
            {
                type: 'input',
                name: 'domain',
                message: 'What\'s your local domain (e.g. http://domain.app:8001)?',
                validate: Webiny.validate.url
            },
            {
                type: 'input',
                name: 'database',
                message: 'What\'s your database name?',
                default: function () {
                    return 'Webiny';
                }
            },
            {
                type: 'input',
                name: 'user',
                message: 'Enter your admin user email:',
                validate: Webiny.validate.email
            },
            {
                type: 'password',
                name: 'password',
                message: 'Enter your admin user password:',
                validate: function (value) {
                    if (value !== 'dev' && value !== 'admin' && value.length < 3) {
                        return 'Please enter at least 3 characters!';
                    }

                    return true;
                }
            }
        ];

        inquirer.prompt(questions).then(function (answers) {
            try {
                // Populate ConfigSets.yaml
                let config = yaml.safeLoad(Webiny.readFile(configs.configSets));
                config.ConfigSets.Local = answers.domain;
                Webiny.writeFile(configs.configSets, yaml.safeDump(config, {indent: 4}));

                // Populate Base/Application.yaml
                config = yaml.safeLoad(Webiny.readFile(configs.base.application));
                config.Application.Acl.Token = generatePassword(40, false, /[\dA-Za-z#_\$]/);
                Webiny.writeFile(configs.base.application, yaml.safeDump(config, {indent: 4}));

                // Populate Base/Database.yaml
                config = yaml.safeLoad(Webiny.readFile(configs.base.database));
                config.Mongo.Services.Webiny.Calls[0][1] = [answers.database];
                Webiny.writeFile(configs.base.database, yaml.safeDump(config, {indent: 4, flowLevel: 5}));

                // Populate Base/Security.yaml
                config = yaml.safeLoad(Webiny.readFile(configs.base.security));
                config.Security.Tokens.Webiny.SecurityKey = generatePassword(30, false, /[\dA-Za-z#_\$:\?#]/);
                Webiny.writeFile(configs.base.security, yaml.safeDump(config, {indent: 4, flowLevel: 5}));

                // Populate Local/Application.yaml
                config = yaml.safeLoad(Webiny.readFile(configs.local.application));
                config.Application.WebPath = answers.domain;
                config.Application.ApiPath = answers.domain + '/api';
                Webiny.writeFile(configs.local.application, yaml.safeDump(config, {indent: 4}));

                Webiny.success('Configuration files written successfully!');
            } catch (err) {
                console.log(err);
                return;
            }

            // Run Webiny installation procedure
            Webiny.shellExecute('php Apps/Webiny/Php/Cli/install.php Webiny', {stdio: 'pipe'});

            // Create admin user
            const params = [answers.domain, answers.user, answers.password].join(' ');
            try {
                let output = Webiny.shellExecute('php Apps/Webiny/Php/Cli/admin.php ' + params, {stdio: 'pipe'});
                output = JSON.parse(output);
                if (output.status === 'created') {
                    Webiny.success('Admin user created successfully!');
                }

                if (output.status === 'exists') {
                    Webiny.exclamation('Admin user already exists!');
                }
            } catch (err) {
                Webiny.failure(err.message);
            }

            // Virtual host wizard
            const hostAnswers = {
                domain: answers.domain
            };

            const createHost = function () {
                inquirer.prompt({
                    type: 'confirm',
                    name: 'createHost',
                    message: 'Would you like us to create a new nginx virtual host for you?',
                    default: true
                }).then(function (a) {
                    if (a.createHost) {
                        hostAnswers.createHost = true;
                        return hostFile();
                    }
                    callback(answers);
                });
            };

            const hostFile = function () {
                inquirer.prompt({
                    type: 'input',
                    name: 'hostFile',
                    message: 'Where do you want to place your virtual host file (including file name)?',
                    default: function () {
                        const server = answers.domain.replace('http://', '').replace('https://', '').split(':')[0];
                        return '/etc/nginx/sites-available/' + server
                    },
                    validate: Webiny.validate.writable
                }).then(function (a) {
                    hostAnswers.hostFile = a.hostFile;
                    if (Webiny.fileExists(a.hostFile)) {
                        hostExists();
                    } else {
                        errorLogFile();
                    }
                });
            };

            const hostExists = function () {
                inquirer.prompt({
                    type: 'list',
                    name: 'action',
                    message: 'Specified host file already exists. What do you want to do?',
                    choices: [
                        {name: 'Specify a different file path', value: 'new-path'},
                        {name: 'Overwrite existing file', value: 'overwrite'},
                        {name: 'Use existing file and finish host setup', value: 'skip'}
                    ]
                }).then(function (a) {
                    if (a.action === 'new-path') {
                        return hostFile();
                    }

                    hostAnswers.action = a.action;
                    if (a.action === 'overwrite') {
                        return errorLogFile();
                    }

                    setupVirtualHost(hostAnswers, callback);
                });
            };

            const errorLogFile = function () {
                inquirer.prompt({
                    type: 'input',
                    name: 'errorLogFile',
                    message: 'Where do you want to place your error log file (including file name)?',
                    default: function () {
                        const server = answers.domain.replace('http://', '').replace('https://', '').split(':')[0];
                        return '/var/log/nginx/' + server + '-error.log';
                    },
                    validate: Webiny.validate.writable
                }).then(function (a) {
                    hostAnswers.errorLogFile = a.errorLogFile;
                    setupVirtualHost(hostAnswers, callback);
                });
            };

            try {
                Webiny.shellExecute('nginx -v', {stdio: 'pipe'});
                createHost();
            } catch (err) {
                // Skip host prompts
            }
        });

    } catch (err) {
        Webiny.failure(err);
        process.exit(1);
    }
};