var inquirer = require('inquirer');
var chalk = require('chalk');
var _ = require('lodash');
var moment = require('moment');
var utils = require('./utils');

class Menu {
    constructor(Webiny) {
        this.Webiny = Webiny;
        this.lastRun = Webiny.getRunLog();
        this.apps = Webiny.getApps();
        this.appChoices = [
            {name: 'All', value: 'all'}
        ];

        if (_.get(this.lastRun, 'apps.length', 0) > 0) {
            this.appChoices.push({
                name: 'Last selection: ' + chalk.cyan(this.lastRun.apps.join(', ')),
                value: 'last'
            });
        }

        this.appChoices.push(new inquirer.Separator());
        this.apps.map(app => {
            this.appChoices.push({
                name: app.name,
                value: app
            });
        });
    }

    normalizeApps(answers, config) {
        if (_.has(answers, 'apps')) {
            config.apps = [];

            // If more than 1 option is selected - remove 'all' from the selected options
            if (answers.apps.length > 1) {
                _.remove(answers.apps, function (a) {
                    return a === 'all';
                });
            }

            if (answers.apps[0] === 'all') {
                config.apps = this.apps;
            } else {
                // Combine 'Last selection' (if selected) with other selected apps
                _.map(answers.apps, a => {
                    if (a === 'last') {
                        // Select last selected apps but skip those not present in the project
                        _.merge(config.apps, _.map(this.lastRun.apps, app => {
                            var found = _.find(this.apps, {name: app});
                            if (found) {
                                config.apps.push(found);
                            }
                        }));
                    } else {
                        config.apps.push(a);
                    }
                });
            }
        }

        return config.apps;
    }

    render() {
        // Output a blank line
        utils.log('');
        try {
            inquirer.prompt([{
                type: 'list',
                name: 'task',
                message: 'What would you like to do?',
                choices: [
                    {name: 'Develop! (watches for file changes and rebuilds apps for you)', value: 'develop'},
                    {name: 'Build', value: 'build'},
                    {name: 'Run tests', value: 'run-tests'},
                    new inquirer.Separator(),
                    {name: 'Create release archive', value: 'release'},
                    {name: 'Switch release', value: 'revert'},
                    new inquirer.Separator(),
                    {name: 'Install apps', value: 'install-apps'},
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
                choices: this.appChoices,
                default: ['all'],
                when: function (answers) {
                    return ['build', 'develop', 'run-tests', 'deploy'].indexOf(answers.task) > -1;
                },
                validate: function (answer) {
                    if (answer.length < 1) {
                        return 'You must choose at least one option';
                    }

                    return true;
                }
            }]).then(answers => {
                var task = answers.task;
                var config = {};
                config.production = process.env.production = _.get(answers, 'production', false);
                config.esLint = true;
                config.buildDir = utils.projectRoot('public_html/build/' + (config.production ? 'production' : 'development'));
                config.apps = this.normalizeApps(answers, config);

                this.lastRun.apps = _.map(config.apps, 'name');
                this.Webiny.saveRunLog(this.lastRun);

                try {
                    var taskProcess = null;
                    switch (task) {
                        case 'install-apps':
                            const InstallApps = require('./wizards/installApps');
                            const installApps = new InstallApps(this.Webiny);
                            taskProcess = installApps.run();
                            break;
                        case 'develop':
                            const Develop = require('./wizards/develop');
                            const develop = new Develop(this.Webiny, config);
                            taskProcess = develop.run();
                            break;
                        case 'release':
                            const Release = require('./wizards/release');
                            const release = new Release(this.Webiny, config);
                            taskProcess = release.run();
                            break;
                        default:
                            process.exit(1);
                    }

                    // Render menu again if the task is not a watch
                    if (task !== 'develop') {
                        taskProcess.then(() => {
                            this.render();
                        });
                    }
                } catch (err) {
                    console.log(err)
                    utils.failure(err.message, err.stack);
                }
            });
        } catch (e) {
            console.log(e);
        }
    }
}


module.exports = Menu;