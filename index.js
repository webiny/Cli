#! /usr/local/bin/node

// Require packages
var Q = require('q');
var utils = require('./lib/utils');
var check = require('./lib/check');
var setup = require('./lib/setup');
var menu = require('./lib/menu');
var version = JSON.parse(utils.readFile(__dirname + '/package.json')).version;

module.exports = {
    run: function () {
        utils.log('-----------------------');
        utils.info('Webiny CLI ' + utils.chalk.cyan('v' + version));
        utils.log('-----------------------');
        if (check.firstRun()) {
            utils.log('Checking requirements...');
            return Q.fcall(check.requirements).then(function () {
                utils.success("Great, all the requirements are in order!");
                utils.log("\nSetting up the platform...");
                setup(function (answers) {
                    utils.log('-------------------------------------');
                    utils.success('Platform setup is now completed!');
                    utils.log('-------------------------------------');
                    utils.info('\nRunning your first development build to get you ready for development...');
                    // Run first build
                    var runner = require('./lib/runner');
                    var config = require('./lib/gulp/config');
                    var webiny = require('./lib/webiny')(config);

                    config.production = process.env.production = false;
                    config.esLint = true;
                    config.buildDir = utils.projectRoot('public_html/build/development');
                    config.apps = webiny.getApps();
                    runner('watch', config).then(function () {
                        utils.success('\nYou are ready to develop! Navigate to the following URL using your favorite browser: ' + utils.chalk.cyan(answers.domain + '/admin'));
                    });

                });
            }).fail(function (err) {
                utils.exclamation(err.message);
            });
        }

        menu();
    }
};