const inquirer = require('inquirer');
const utils = require('./../utils');

class Revert {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        const lastRun = this.Webiny.getRunLog();
        return inquirer.prompt([{
            type: 'input',
            name: 'host',
            message: 'Enter SSH connection string (e.g. username@server.com:port):',
            default: lastRun.host || null
        }, {
            type: 'input',
            name: 'domain',
            message: 'Enter the domain of the website you are reverting:',
            validate: utils.validate.url,
            default: lastRun.domain || null
        }, {
            type: 'input',
            name: 'basicAuth',
            message: 'Enter Basic Authentication credentials to access your website (leave blank if not required):'
        }]).then(answers => {
            this.config.host = lastRun.host = answers.host;
            this.config.basicAuth = answers.basicAuth;
            this.Webiny.saveRunLog(lastRun);
            
            const Revert = require('./../scripts/revert');
            const revert = new Revert(this.Webiny, this.config);
            return revert.run();
        });
    }
}

module.exports = Revert;