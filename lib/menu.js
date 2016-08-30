var inquirer = require('inquirer');
var _ = require('lodash');
var moment = require('moment');
var utils = require('./utils');
var config = require('./gulp/config');
var webiny = require('./webiny')(config);
var lastRun = {
    apps: [],
    host: ''
};

var webinyLog = utils.projectRoot('webiny.json');

try {
    lastRun = JSON.parse(utils.readFile(webinyLog));
} catch (e) {
    // Ignore
}

module.exports = function () {
    var apps = webiny.getApps();
    var appChoices = [
        {name: 'All', value: 'all'}
    ];

    if (lastRun.apps.length > 0) {
        appChoices.push({
            name: 'Last selection: ' + utils.chalk.cyan(lastRun.apps.join(', ')),
            value: 'last'
        });
    }

    appChoices.push(new inquirer.Separator());
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
            {name: 'Develop! (watches for file changes and rebuilds apps for you)', value: 'watch'},
            {name: 'Build', value: 'build'},
            {name: 'Run tests', value: 'run-tests'},
            new inquirer.Separator(),
            {name: 'Create release archive', value: 'release'},
            {name: 'Switch release', value: 'revert'},
            new inquirer.Separator(),
            {name: 'Install apps', value: 'install-apps'},
            {name: 'View server setup overview', value: 'server-setup'}
        ],
        filter: function (val) {
            return val.toLowerCase();
        }
    }, {
        type: 'confirm',
        name: 'production',
        message: 'Is it a production build?',
        default: false,
        when: function (answers) {
            return answers.task === 'build';
        }
    }, {
        type: 'checkbox',
        name: 'apps',
        message: 'Select apps',
        choices: appChoices,
        default: ['all'],
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
        config.production = process.env.production = _.get(answers, 'production', false);
        config.esLint = true;
        config.buildDir = utils.projectRoot('public_html/build/' + (config.production ? 'production' : 'development'));
        if (_.has(answers, 'apps')) {
            config.apps = [];

            // If more than 1 option is selected - remove 'all' from the selected options
            if (answers.apps.length > 1) {
                _.remove(answers.apps, function (a) {
                    return a === 'all';
                });
            }

            if (answers.apps[0] === 'all') {
                config.apps = apps;
            } else {
                // Combine 'Last selection' (if selected) with other selected apps
                _.map(answers.apps, function (a) {
                    if (a === 'last') {
                        // Select last selected apps but skip those not present in the project
                        _.merge(config.apps, _.map(lastRun.apps, function (app) {
                            var found = _.find(apps, {name: app});
                            if (found) {
                                config.apps.push(found);
                            }
                        }));
                    } else {
                        config.apps.push(a);
                    }
                });
            }
        }

        lastRun.apps = _.map(config.apps, 'name');
        utils.writeFile(webinyLog, JSON.stringify(lastRun));

        try {
            var runner = require('./runner');
            switch (answers.task) {
                case 'install-apps':
                    require('./actions/installApps')();
                    break;
                case 'release':
                    require('./actions/release')(config, runner, lastRun);
                    break;
                case 'revert':
                    require('./actions/revert')(config, runner, lastRun);
                    break;
                case 'server-setup':
                    require('./actions/serverHelp')();
                    break;
                case 'run-tests':
                default:
                    runner(task, config);
                    break;
            }
        } catch (err) {
            utils.failure(err.message);
        }
    });
};