const inquirer = require('inquirer');
const chalk = require('chalk');
const _ = require('lodash');
const moment = require('moment');
const Webiny = require('./webiny');

class Menu {
    constructor(plugins) {
        this.plugins = plugins;
        this.webinyConfig = Webiny.getConfig();
        this.lastRun = this.webinyConfig.lastRun;
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
                name: app.getName(),
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
                        _.merge(config.apps, _.map(this.lastRun.apps, appName => {
                            const found = _.find(this.apps, app => app.getName() === appName);
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
        Webiny.log('');
        try {
            inquirer.prompt([{
                type: 'list',
                name: 'task',
                message: 'What would you like to do?',
                choices: this.plugins.map(plugin => {
                    return {name: plugin.getTitle(), value: plugin.getTask()};
                }),
                filter: function (val) {
                    return val.toLowerCase();
                }
            }, {
                type: 'checkbox',
                name: 'apps',
                message: 'Select apps',
                choices: this.appChoices,
                default: ['all'],
                when: answers => {
                    const plugin = _.find(this.plugins, pl => pl.getTask() === answers.task);
                    return plugin.getSelectApps();
                },
                validate: answer => {
                    if (answer.length < 1) {
                        return 'You must choose at least one option';
                    }

                    return true;
                }
            }]).then(answers => {
                const task = answers.task;
                const config = {};
                config.apps = this.normalizeApps(answers, config);

                this.lastRun.apps = _.map(config.apps, app => app.getName());
                Webiny.saveConfig(_.assign(this.webinyConfig, {lastRun: this.lastRun}));

                try {
                    return this.runTask(task, config);
                } catch (err) {
                    Webiny.failure(err.message, err.stack);
                }
            });
        } catch (e) {
            console.log(e);
        }
    }

    runTask(task, config) {
        this.plugins.map(plugin => {
            if (plugin.getTask() === task) {
                return plugin.runWizard(config, () => this.render(), (task, config) => this.runTask(task, config));
            }
        });

        return Promise.resolve();
    }
}


module.exports = Menu;