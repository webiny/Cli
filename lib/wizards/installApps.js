const utils = require('./../utils');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fetch = require('node-fetch');
const _ = require('lodash');

const fallback = [
    {
        "name": "Demo",
        "description": "This is a demo app showing how to create your own backend app. It showcases different types of views and components with lots of examples to get you started.",
        "version": "dev-master",
        "repository": "https://github.com/Webiny/Demo.git",
        "packagist": "webiny/demo"
    },
    {
        "name": "CronManager",
        "description": "Manage your cron jobs using simple and intuitive UI with in-depth stats.",
        "version": "dev-master",
        "repository": "https://github.com/Webiny/CronManager.git",
        "packagist": "webiny/cron-manager"
    },
    {
        "name": "NotificationManager",
        "description": "Manage your email notifications with ease using email and layout templates, delivery stats and more.",
        "version": "dev-master",
        "repository": "https://github.com/Webiny/NotificationManager.git",
        "packagist": "webiny/notification-manager"
    },
    {
        "name": "BackupApp",
        "description": "Easily set up your system backup to Amazon S3 with just a few clicks.",
        "version": "dev-master",
        "repository": "https://github.com/Webiny/BackupApp.git",
        "packagist": "webiny/backup-app"
    },
    {
        "name": "SystemMonitor",
        "description": "Monitor all of your system resources (server performance, API and DB) on one or multiple servers.",
        "version": "dev-master",
        "repository": "https://github.com/Webiny/SystemMonitor.git",
        "packagist": "webiny/system-monitor"
    }
];

class InstallApps {
    constructor(Webiny) {
        this.Webiny = Webiny;
    }

    run() {
        const appsSource = 'http://www.webiny.com/api/services/the-hub/marketplace/apps';
        utils.info('Fetching list of available apps...');
        return fetch(appsSource).then(function (res) {
            return res.json().then(json => {
                return this.renderWizard(json.data);
            });
        }).catch(() => {
            return this.renderWizard(fallback);
        });
    }

    renderWizard(options) {
        return inquirer.prompt([
            {
                type: 'checkbox',
                name: 'apps',
                message: 'Select Webiny apps to install',
                choices: options.map(o => {
                    return {
                        name: chalk.cyan(o.name) + ' (' + chalk.magenta(o.version) + '): ' + o.description,
                        value: o.name,
                        disabled: utils.folderExists(utils.projectRoot('Apps/' + o.name)) ? chalk.green('Installed') : false
                    };
                }),
                validate: function (answer) {
                    if (answer.length < 1) {
                        return 'You must choose at least one option';
                    }

                    return true;
                }
            }
        ]).then(answers => {
            const InstallApps = require('./../scripts/installApps');
            return Promise.all(answers.apps.map(a => {
                const app = _.find(options, {name: a});
                const installer = new InstallApps(this.Webiny, _.pick(app, ['name', 'packagist', 'repository']));
                return installer.run();
            }));
        });
    }
}

module.exports = InstallApps;