var inquirer = require('./../node_modules/inquirer');
var _ = require('./../node_modules/lodash');
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
            {name: 'Develop! (watches for file changes and re-builds apps for you)', value: 'watch'},
            {name: 'Build', value: 'build'},
            {name: 'Run tests', value: 'run-tests'},
            new inquirer.Separator(),
            {name: 'Create release archive', value: 'release'},
            {name: 'Revert to previous release', value: 'revert'}
        ],
        filter: function (val) {
            return val.toLowerCase();
        }
    }, {
        type: 'confirm',
        name: 'production',
        message: 'Is it a production build?',
        default: function () {
            return false;
        },
        when: function (answers) {
            return answers.task === 'build';
        }
    }, {
        type: 'checkbox',
        name: 'apps',
        message: 'Select apps',
        choices: appChoices,
        when: function (answers) {
            return ['build', 'watch', 'run-tests', 'deploy'].indexOf(answers.task) > -1;
        },
        validate: function (answer) {
            if (answer.length < 1) {
                return 'You must choose at least one option';
            }
            return true;
        }
    }]).then(function (answers) {
        var task = answers.task;
        config.production = _.get(answers, 'production', false);
        config.esLint = true;
        config.buildDir = utils.projectRoot('public_html/build/development');
        if (_.has(answers, 'apps')) {
            config.apps = answers.apps.length === 1 && answers.apps[0] === 'all' ? apps : answers.apps;
        }

        try {
            var runner = require('./runner');
            switch (answers.task) {
                case 'build':
                    config.production = true;
                    config.buildDir = utils.projectRoot('public_html/build/production');
                    runner(task, config);
                    break;
                case 'release':
                    inquirer.prompt([
                        {
                            type: 'input',
                            name: 'releasePath',
                            // TODO: add auto-generated file name (add extra question)
                            message: 'Where do you want to store the release archive (include file name)?',
                            validate: utils.validate.writable,
                            default: function () {
                                return '/Users/paveldenisjuk/webiny/projects-php7/webiny-cli/test/releases/release.zip';
                            }
                        },
                        {
                            type: 'list',
                            name: 'production',
                            message: 'Select build type',
                            choices: [
                                {name: 'Production', value: true},
                                {name: 'Development', value: false}
                            ]
                        }
                    ]).then(function (answers) {
                        config.releasePath = answers.releasePath;
                        config.production = answers.production;
                        runner(task, config).then(function () {
                            utils.info('TODO: add deploy steps...');
                        });
                    });
                    break;
                case 'revert':
                    // TODO: connect to remote server and fetch list of possible versions to revert to
                    break;
                case 'run-tests':
                default:
                    runner(task, config).then(function () {
                        utils.success('ALL TASKS FINISHED!');
                    });
                    break;
            }
        } catch (err) {
            utils.failure(err.message);
        }
    });
};