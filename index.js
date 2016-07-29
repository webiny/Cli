#! /usr/local/bin/node
// uglifyjs -c --mangle=toplevel -o webiny.min.js webiny.js

// Require packages
var Q = require('q');
var utils = require('./lib/utils');
var check = require('./lib/check');
var setup = require('./lib/setup');
var menu = require('./lib/menu');

module.exports = {
    run: function () {
        if (check.firstRun()) {
            utils.log('Checking requirements...');
            return Q.fcall(check.requirements).then(function () {
                utils.success("Great, all the requirements are in order!");
                utils.log("\nSetting up the platform...");
                setup(function () {
                    menu();
                });
            }).fail(function (err) {
                utils.exclamation(err.message);
            });
        }

        menu();
    }
};