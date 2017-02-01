const inquirer = require('inquirer');
const _ = require('lodash');
const moment = require('moment');
const utils = require('./../utils');

class Release {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        return inquirer.prompt([{
            type: 'input',
            name: 'release',
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
            default: function () {
                var zipName = 'release-' + moment().format('YYYYMMDD-HHmmss') + '.zip';
                return 'releases/' + zipName;
            }
        }]).then(answers => {
            _.merge(this.config, answers);
            const Release = require('./../scripts/release');
            const release = new Release(this.Webiny, this.config);
            return release.run();
        });
    }
}

module.exports = Release;