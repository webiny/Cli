var inquirer = require('./../node_modules/inquirer');
var _ = require('./../node_modules/lodash');
var moment = require('./../node_modules/moment');
var utils = require('./utils');
var config = require('./gulp/config');
var webiny = require('./webiny')(config);

module.exports = function () {
    var apps = webiny.getApps();
    var appChoices = [
        {name: 'All', value: 'all'},
        new inquirer.Separator()
    ];
    apps.map(function (app) {
        appChoices.push({
            name: app.name,
            value: app
        });
    });

    inquirer.prompt([{
        type: 'list',
        name: 'task',
        message: 'What would you like to do?',
        choices: [
            {name: 'Develop! (watches for file changes and re-builds apps for you)', value: 'watch'},
            {name: 'Build', value: 'build'},
            {name: 'Run tests', value: 'run-tests'},
            new inquirer.Separator(),
            {name: 'Create release archive', value: 'release'},
            {name: 'Switch release', value: 'revert'},
            new inquirer.Separator(),
            {name: 'View server setup overview', value: 'server-setup'}
        ],
        filter: function (val) {
            return val.toLowerCase();
        }
    }, {
        type: 'confirm',
        name: 'production',
        message: 'Is it a production build?',
        default: false,
        when: function (answers) {
            return answers.task === 'build';
        }
    }, {
        type: 'checkbox',
        name: 'apps',
        message: 'Select apps',
        choices: appChoices,
        when: function (answers) {
            return ['build', 'watch', 'run-tests', 'deploy'].indexOf(answers.task) > -1;
        },
        validate: function (answer) {
            if (answer.length < 1) {
                return 'You must choose at least one option';
            }
            return true;
        }
    }]).then(function (answers) {
        var task = answers.task;
        config.production = process.env.production = _.get(answers, 'production', false);
        config.esLint = true;
        config.buildDir = utils.projectRoot('public_html/build/' + (config.production ? 'production' : 'development'));
        if (_.has(answers, 'apps')) {
            config.apps = answers.apps.length === 1 && answers.apps[0] === 'all' ? apps : answers.apps;
        }

        try {
            var runner = require('./runner');
            switch (answers.task) {
                case 'release':
                    inquirer.prompt([
                        {
                            type: 'list',
                            name: 'production',
                            message: 'Select build type',
                            choices: [
                                {name: 'Production', value: true},
                                {name: 'Development', value: false}
                            ]
                        },
                        {
                            type: 'input',
                            name: 'releasePath',
                            message: 'Where do you want to store the release archive (including file name)?',
                            validate: function (value) {
                                var writable = utils.validate.writable(value);
                                if (writable !== true) {
                                    return writable;
                                }

                                if (!value.endsWith('.zip')) {
                                    return 'Please include a file name for your archive!';
                                }
                                return true;
                            },
                            default: function (answers) {
                                var prefix = answers.production ? 'production' : 'development';
                                var zipName = prefix + '-' + moment().format('YYYYMMDD-HHmmss') + '.zip';
                                return 'releases/' + zipName;
                            }
                        }
                    ]).then(function (answers) {
                        config.releasePath = answers.releasePath;
                        config.production = answers.production;
                        runner(task, config).then(function () {
                            inquirer.prompt([{
                                type: 'confirm',
                                name: 'deploy',
                                message: 'Do you want to deploy this release to remote server?',
                                default: true
                            }, {
                                type: 'input',
                                name: 'host',
                                message: 'Enter SSH connection string (e.g. username@server.com:port):',
                                when: function (answers) {
                                    return answers.deploy;
                                }
                            }, {
                                type: 'input',
                                name: 'folder',
                                message: 'Enter the name of the environment folder for this release:',
                                default: config.production ? 'production' : 'development',
                                when: function (answers) {
                                    return answers.deploy;
                                }
                            }]).then(function (answers) {
                                if (!answers.deploy) {
                                    return;
                                }

                                config.host = answers.host;
                                config.folder = answers.folder;
                                runner('deploy', config);
                            });
                        });
                    });
                    break;
                case 'revert':
                    inquirer.prompt([{
                        type: 'input',
                        name: 'host',
                        message: 'Enter SSH connection string (e.g. username@server.com:port):'
                    }]).then(function (answers) {
                        config.host = answers.host;
                        runner('revert', config);
                    });
                    break;
                case 'server-setup':
                    require(__dirname + '/serverHelp');
                    break;
                case 'run-tests':
                default:
                    runner(task, config);
                    break;
            }
        } catch (err) {
            utils.failure(err.message);
        }
    });
};