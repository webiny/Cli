var utils = require('./utils');
var inquirer = require('inquirer');
var yaml = require('js-yaml');

var configs = {
    configSets: utils.projectRoot('Configs/ConfigSets.yaml'),
    production: {
        application: utils.projectRoot('Configs/Production/Application.yaml'),
        database: utils.projectRoot('Configs/Production/Database.yaml')
    }
};

function setupVirtualHost(answers, callback) {
    // Create host file
    var hostFile = utils.readFile(__dirname + '/host.cfg');
    var server = answers.domain.replace('http://', '').replace('https://', '').split(':')[0];
    hostFile = hostFile.replace('{DOMAIN_HOST}', server);
    hostFile = hostFile.replace('{ABS_PATH}', process.env.PWD);
    hostFile = hostFile.replace('{ERROR_LOG}', answers.errorLogFile);

    try {
        var target = '/etc/nginx/sites-enabled/' + server;
        if (utils.fileExists(target)) {
            if (utils.isSymbolicLink(target)) {
                utils.shellExecute('sudo unlink ' + target);
            } else {
                utils.shellExecute('sudo rm /etc/nginx/sites-enabled/' + server);
            }
        }
        utils.writeFile(answers.hostFile, hostFile);
        if (answers !== target) {
            utils.shellExecute('sudo ln -s ' + answers.hostFile + ' ' + target);
        }
        utils.shellExecute('sudo service nginx reload');
        utils.success('Host file created successfully!');
        callback(answers);
    } catch (err) {
        utils.failure(err);
    }
}

module.exports = function (callback) {
    // Copy project structure
    if (utils.copy(__dirname + '/../setup/.', utils.projectRoot())) {
        utils.success('Project structure created successfully!');

        try {
            utils.log('Running composer to install PHP dependencies...');
            utils.shellExecute('composer install');
            utils.success('Composer installation completed!');

            utils.log("\nNow we need to create a platform configuration and your first user:\n");

            var questions = [
                {
                    type: 'input',
                    name: 'domain',
                    message: 'What\'s your development domain (e.g. http://domain.app:8001)?',
                    validate: utils.validate.url
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
                    validate: utils.validate.email
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
                    var config = yaml.safeLoad(utils.readFile(configs.configSets));
                    config.ConfigSets.Development = answers.domain;
                    utils.writeFile(configs.configSets, yaml.safeDump(config, {indent: 4}));

                    // Populate Production/Application.yaml
                    config = yaml.safeLoad(utils.readFile(configs.production.application));
                    config.Application.WebPath = answers.domain;
                    config.Application.ApiPath = answers.domain + '/api';
                    utils.writeFile(configs.production.application, yaml.safeDump(config, {indent: 4}));

                    // Populate Production/Database.yaml
                    config = yaml.safeLoad(utils.readFile(configs.production.database));
                    config.Mongo.Services.Webiny.Calls[0][1] = [answers.database];
                    utils.writeFile(configs.production.database, yaml.safeDump(config, {indent: 4, flowLevel: 5}));

                    utils.success('Configuration files written successfully!');
                } catch (err) {
                    console.log(err);
                    return;
                }

                // Create admin user
                var params = [answers.domain, answers.user, answers.password].join(' ');
                try {
                    var output = utils.shellExecute('php Apps/Core/Php/Cli/admin.php ' + params, {stdio: 'pipe'});
                    if (output == 'created') {
                        utils.success('Admin user created successfully!');
                    }

                    if (output == 'exists') {
                        utils.exclamation('Admin user already exists!');
                    }
                } catch (err) {
                    utils.failure(err.message);
                }

                // Virtual host wizard
                var hostAnswers = {
                    domain: answers.domain
                };

                var createHost = function () {
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

                var hostFile = function () {
                    inquirer.prompt({
                        type: 'input',
                        name: 'hostFile',
                        message: 'Where do you want to place your virtual host file (including file name)?',
                        default: function () {
                            var server = answers.domain.replace('http://', '').replace('https://', '').split(':')[0];
                            return '/etc/nginx/sites-available/' + server
                        },
                        validate: utils.validate.writable
                    }).then(function (a) {
                        hostAnswers.hostFile = a.hostFile;
                        if (utils.fileExists(a.hostFile)) {
                            hostExists();
                        } else {
                            errorLogFile();
                        }
                    });
                };

                var hostExists = function () {
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

                var errorLogFile = function () {
                    inquirer.prompt({
                        type: 'input',
                        name: 'errorLogFile',
                        message: 'Where do you want to place your error log file (including file name)?',
                        default: function () {
                            var server = answers.domain.replace('http://', '').replace('https://', '').split(':')[0];
                            return '/var/log/nginx/' + server + '-error.log';
                        },
                        validate: utils.validate.writable
                    }).then(function (a) {
                        hostAnswers.errorLogFile = a.errorLogFile;
                        setupVirtualHost(hostAnswers, callback);
                    });
                };

                try {
                    utils.shellExecute('nginx -v', {stdio: 'pipe'});
                    createHost();
                } catch (err) {
                    // Skip host prompts
                }
            });

        } catch (err) {
            console.log(err);
            process.exit(1);
        }
    }
};