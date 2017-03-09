const inquirer = require('inquirer');
const moment = require('moment');
const chalk = require('chalk');
const fs = require('fs-extra');
const _ = require('lodash');
const utils = require('./../utils');

class Deploy {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        const lastRun = this.Webiny.getRunLog();
        let steps = [{
            type: 'input',
            name: 'host',
            message: 'Enter SSH connection string (e.g. username@server.com:port):',
            default: lastRun.host || null,
            validate: (value) => {
                if (value.length < 1) {
                    return 'Please enter a target host';
                }
                return true;
            }
        }, {
            type: 'input',
            name: 'domain',
            message: 'Enter the domain of the website you are deploying:',
            validate: utils.validate.url,
            default: lastRun.domain || null
        }, {
            type: 'input',
            name: 'basicAuth',
            message: 'Enter Basic Authentication credentials to access your website (leave blank if not required):'
        }];

        if (!this.config.release) {
            // Prepend a new step with release archives selection
            const options = {cwd: fs.realpathSync(process.env.PWD), env: process.env, stdio: 'pipe'};
            const res = utils.shellExecute('ls -1 ' + utils.projectRoot('releases') + '/*.zip', options);

            const list = res.toString();
            const choices = [];
            _.trimEnd(list, '\n').split('\n').map(function (line) {
                choices.push('releases/' + _.trimEnd(line, '/').split('/').pop());
            });

            steps.unshift({
                type: 'list',
                choices: choices,
                name: 'release',
                message: 'Select a release to deploy:'
            });
        }

        return inquirer.prompt(steps).then((answers) => {
            _.merge(this.config, answers);
            lastRun.host = answers.host;
            lastRun.domain = answers.domain;

            this.Webiny.saveRunLog(lastRun);
            const Deploy = require('./../scripts/deploy');
            const deploy = new Deploy(this.Webiny, this.config);
            return deploy.run();
        }).catch(err => {
            console.log(err);
        });
    }
}

module.exports = Deploy;