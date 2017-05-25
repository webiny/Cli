/* eslint-disable */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const yaml = require('js-yaml');
const utils = require('./utils');


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
        const jsApps = [];
        getFolders(dir).map(function (jsAppFolder) {
            if (jsApp && jsApp !== jsAppFolder) {
                return;
            }

            const path = app + '_' + jsAppFolder;
            const appMeta = {
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

    const webiny = {
        getApps: function (app, jsApp) {
            // Read all apps
            const dir = utils.projectRoot('Apps');
            const jsApps = [];
            getFolders(dir).map(function (appSubfolder) {
                const appDir = utils.projectRoot('Apps/' + appSubfolder);
                if (fs.existsSync(appDir + '/App.yaml')) {
                    // We have an app without version
                    const dir = appDir + '/Js';
                    // Read JS apps from given dir
                    readJsApps(appSubfolder, jsApp, dir, null).map(function (appObj) {
                        jsApps.push(appObj);
                    });
                }
            });

            // Filter apps if necessary
            if (app) {
                return _.filter(jsApps, function (a) {
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