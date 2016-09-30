var utils = require('./../utils');
var inquirer = require('inquirer');
var moment = require('moment');

module.exports = function(config, runner, lastRun){
    return inquirer.prompt([
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
        return runner('release', config).then(function () {
            return inquirer.prompt([{
                type: 'confirm',
                name: 'deploy',
                message: 'Do you want to deploy this release to remote server?',
                default: true
            }, {
                type: 'input',
                name: 'host',
                message: 'Enter SSH connection string (e.g. username@server.com:port):',
                default: lastRun.host || null,
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

                config.host = lastRun.host = answers.host;
                utils.writeFile(utils.projectRoot('webiny.json'), JSON.stringify(lastRun));

                config.folder = answers.folder;
                return runner('deploy', config);
            });
        });
    });
};

