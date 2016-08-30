var utils = require('./../utils');
var inquirer = require('inquirer');

module.exports = function (config, runner, lastRun) {
    inquirer.prompt([{
        type: 'input',
        name: 'host',
        message: 'Enter SSH connection string (e.g. username@server.com:port):',
        default: lastRun.host || null
    }]).then(function (answers) {
        config.host = lastRun.host = answers.host;
        utils.writeFile(utils.projectRoot('webiny.json'), JSON.stringify(lastRun));
        runner('revert', config);
    });
};