const inquirer = require('inquirer');
const chalk = require('chalk');
const _ = require('lodash');
const Webiny = require('./webiny');

class Menu {
    constructor() {
        this.plugins = Webiny.getPlugins();
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
        const choices = [];
        const menus = [];

        _.each(this.plugins, (plugin, name) => {
            const menu = plugin.getMenu();
            if (menu) {
                menus.push({menu, name});
            }
        });

        menus.sort((a, b) => b.menu.order - a.menu.order).map(({menu, name}) => {
            if (menu.getLineBefore()) {
                choices.push(new inquirer.Separator());
            }

            choices.push({name: menu.getTitle(), value: name});

            if (menu.getLineAfter()) {
                choices.push(new inquirer.Separator());
            }
        });

        // Output a blank line
        Webiny.log('');
        this.prompt = inquirer.prompt([{
            type: 'list',
            name: 'task',
            message: 'What would you like to do?',
            choices,
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
                const plugin = _.find(this.plugins, (pl, name) => name === answers.task);
                if (!plugin) {
                    return false;
                }
                return plugin.getSelectApps();
            },
            validate: answer => {
                if (answer.length < 1) {
                    return 'You must choose at least one option';
                }

                return true;
            }
        }]);

        return this.prompt.then(answers => {
            const task = answers.task;
            const config = {};
            config.apps = this.normalizeApps(answers, config);

            this.lastRun.apps = _.map(config.apps, app => app.getName());
            Webiny.saveConfig(_.assign(this.webinyConfig, {lastRun: this.lastRun}));

            return this.runTask(task, config);
        }).catch(err => {
            if (_.isString(err)) {
                Webiny.failure(err);
            } else {
                Webiny.failure(err.message, err.stack);
            }
            this.render();
        });
    }

    runTask(task, config) {
        return this.plugins[task].runWizard(config).then(res => _.get(res, 'menu', true) && this.render());
    }
}


module.exports = new Menu();