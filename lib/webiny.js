/* eslint-disable */
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var _ = require('lodash');
var yaml = require('js-yaml');
var utils = require('./utils');


module.exports = function () {

    function getFolders(dir) {
        try {
            return fs.readdirSync(dir).filter(function (file) {
                return fs.statSync(path.join(dir, file)).isDirectory() && file !== '.git';
            });
        } catch (e) {
            return [];
        }
    }

    function readJsApps(app, jsApp, dir) {
        var jsApps = [];
        getFolders(dir).map(function (jsAppFolder) {
            if (jsApp && jsApp !== jsAppFolder) {
                return;
            }

            const path = app + '_' + jsAppFolder;
            var appMeta = {
                key: app + '.' + jsAppFolder,
                name: app + '.' + jsAppFolder,
                rootAppName: app,
                path,
                sourceFolder: _.trimStart(dir.replace(utils.projectRoot(), '') + '/' + jsAppFolder, '/')
            };

            jsApps.push(appMeta);
        });

        return jsApps;
    }

    var webiny = {
        getApps: function (app, jsApp) {
            // Read all apps
            var dir = utils.projectRoot('Apps');
            var jsApps = [];
            getFolders(dir).map(function (appSubfolder) {
                var appDir = utils.projectRoot('Apps/' + appSubfolder);
                if (fs.existsSync(appDir + '/App.yaml')) {
                    // We have an app without version
                    var dir = appDir + '/Js';
                    // Read JS apps from given dir
                    readJsApps(appSubfolder, jsApp, dir, null).map(function (appObj) {
                        jsApps.push(appObj);
                    });
                }
            });

            // Filter apps if necessary
            if (app) {
                jsApps = _.filter(jsApps, function (a) {
                    if (app && jsApp) {
                        return a.name === app + '.' + jsApp;
                    }

                    return _.startsWith(a.name, app + '.');
                });
            }

            return jsApps;
        }
    };

    return webiny;
}();