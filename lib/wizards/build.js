const inquirer = require('inquirer');
const yaml = require('js-yaml');
const _ = require('lodash');
const utils = require('./../utils');

class Build {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        const config = yaml.safeLoad(utils.readFile(utils.projectRoot('Configs/ConfigSets.yaml')));
        const choices = Object.keys(config.ConfigSets);

        return inquirer.prompt([{
            type: 'list',
            name: 'configSet',
            message: 'Select a config set to build',
            choices
        }]).then(answers => {
            _.merge(this.config, answers);
            const Build = require('./../scripts/build');
            const develop = new Build(this.Webiny, this.config);
            return develop.run();
        });
    }
}

module.exports = Build;