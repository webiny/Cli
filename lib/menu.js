var inquirer = require('./../node_modules/inquirer');
var utils = require('./utils');
var config = require('./gulp/config');
var webiny = require('./webiny')(config);

module.exports = function () {
    var apps = webiny.getApps();
    var appChoices = [
        {name: 'All', value: 'all'},
        new inquirer.Separator()
    ];
    apps.map(function (app) {
        appChoices.push({
            name: app.name,
            value: app
        });
    });

    inquirer.prompt([{
        type: 'list',
        name: 'task',
        message: 'What would you like to do?',
        choices: [
            {name: 'Build for production', value: 'build'},
            {name: 'Build and watch (for development)', value: 'watch'},
            {name: 'Run tests', value: 'run-tests'},
            new inquirer.Separator(),
            {name: 'Deploy to remote server', value: 'deploy'},
            {name: 'Revert to previous release', value: 'revert'}
        ],
        filter: function (val) {
            return val.toLowerCase();
        }
    }, {
        type: 'checkbox',
        name: 'apps',
        message: 'Select apps',
        choices: appChoices,
        when: function (answers) {
            return ['build', 'watch', 'run-tests', 'deploy'].indexOf(answers.task) > -1;
        }
    }]).then(function (answers) {
        config.production = false;
        config.buildDir = utils.projectRoot('public_html/build/development');
        config.esLint = true;
        config.apps = answers.apps.length === 1 && answers.apps[0] === 'all' ? apps : answers.apps;

        switch (answers.task) {
            case 'build':
                config.production = true;
                config.buildDir = utils.projectRoot('public_html/build/production');
                break;
            case 'run-tests':
                // TODO: run tests
                break;
            case 'deploy':
                // TODO: run wizard for more input...
                break;
            case 'revert':
                // TODO: connect to remote server and fetch list of possible versions to revert to
                break;
            default:
                // TODO: run watch
                break;
        }
        require('./runner')(answers.task, config);
    });
};