var utils = require('./../utils');
var inquirer = require('inquirer');

module.exports = function (config, runner, lastRun) {
    return inquirer.prompt([{
        type: 'input',
        name: 'host',
        message: 'Enter SSH connection string (e.g. username@server.com:port):',
        default: lastRun.host || null
    }, {
        type: 'input',
        name: 'domain',
        message: 'Enter the domain of the website you are deploying:',
        validate: utils.validate.url,
        default: lastRun.domain || null,
        when: function (answers) {
            return answers.deploy;
        }
    }, {
        type: 'input',
        name: 'basicAuth',
        message: 'Enter Basic Authentication credentials to access your website (leave blank if not required):',
        when: function (answers) {
            return answers.deploy;
        }
    }]).then(function (answers) {
        config.host = lastRun.host = answers.host;
        config.basicAuth = answers.basicAuth;
        utils.writeFile(utils.projectRoot('webiny.json'), JSON.stringify(lastRun));
        return runner('revert', config);
    });
};