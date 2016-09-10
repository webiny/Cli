var utils = require('./../utils');
var inquirer = require('inquirer');
var fetch = require('node-fetch');
var _ = require('lodash');
var yaml = require('js-yaml');

var fallback = [
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
    }
];

module.exports = function () {
    var appsSource = 'http://www.webiny.com/api/services/the-hub/marketplace/apps';
    utils.info('Fetching list of available apps...');
    return fetch(appsSource).then(function (res) {
        return res.json().then(function (json) {
            return selectApps(json.data);
        });
    }).catch(function () {
        return selectApps(fallback);
    });

    function selectApps(options) {
        return inquirer.prompt([
            {
                type: 'checkbox',
                name: 'apps',
                message: 'Select Webiny apps to install',
                choices: _.map(options, function (o) {
                    return {
                        name: utils.chalk.cyan(o.name) + ' (' + utils.chalk.magenta(o.version) + '): ' + o.description,
                        value: o.name,
                        disabled: utils.folderExists(utils.projectRoot('Apps/' + o.name)) ? utils.chalk.green('Installed') : false
                    };
                }),
                validate: function (answer) {
                    if (answer.length < 1) {
                        return 'You must choose at least one option';
                    }

                    return true;
                }
            }
        ]).then(function (answers) {
            return Promise.all(answers.apps.map(function (a) {
                return new Promise(function (resolve, reject) {
                    var app = _.find(options, {name: a});
                    try {
                        utils.info('Installing ' + utils.chalk.cyan(a) + '...');
                        if (app.packagist && app.packagist !== '') {
                            utils.shellExecute('composer require ' + app.packagist);
                        } else {
                            utils.shellExecute('cd ' + utils.projectRoot('Apps') + ' && git clone ' + app.repository);
                        }
                        // Activate app in Application.yaml
                        var applicationConfig = utils.projectRoot('Configs/Production/Application.yaml');
                        var config = yaml.safeLoad(utils.readFile(applicationConfig));
                        var apps = _.get(config, 'Apps', {});
                        apps[app.name] = true;
                        config.Apps = apps;
                        utils.writeFile(applicationConfig, yaml.safeDump(config, {indent: 4}));
                        // Execute an app installer to install demo data, indexes, etc.
                        utils.shellExecute('php ' + utils.projectRoot('Apps/Core/Php/Cli/install.php') + ' ' + app.name);
                        utils.success(utils.chalk.cyan(app.name) + ' installation finished!');
                        resolve(app.name);
                    } catch (e) {
                        utils.failure('Failed to install ' + utils.chalk.cyan(app.name) + '!');
                        reject();
                    }
                });
            }));
        });
    }
};

