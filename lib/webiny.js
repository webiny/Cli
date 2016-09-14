/* eslint-disable */
var fs = require('fs');
var path = require('path');
var utils = require('./utils');
var _ = require('lodash');
var chalk = require('chalk');
var yaml = require('js-yaml');
var Table = require('cli-table');

function AssetsConfig(config) {
    this.getStyles = function () {
        if (this.isLess()) {
            return _.get(config, 'Assets.App.Styles.Less', '*.nostyle');
        }

        if (this.isSass()) {
            return _.get(config, 'Assets.App.Styles.Sass', '*.nostyle');
        }

        return 'styles/css/**/*.css';
    };

    this.getStylesOrder = function () {
        return _.get(config, 'Assets.App.Styles.Css', []);
    };

    this.getStylesReplacements = function () {
        var replacements = _.get(config, 'Assets.App.Styles.Replace', {});
        var patterns = [];
        _.each(replacements, function (replacement, match) {
            patterns.push({
                match: match,
                replacement: replacement
            });
        });
        return patterns;
    };

    this.isLess = function () {
        return _.has(config, 'Assets.App.Styles.Less');
    };

    this.isSass = function () {
        return _.has(config, 'Assets.App.Styles.Sass');
    };

    this.getVendors = function () {
        return config.Assets && config.Assets.Vendors || [];
    };
}

module.exports = function (config) {
    var assetsConfigs = {};
    var cyan = chalk.cyan;
    var red = chalk.red;

    var appsTable = new Table({
        head: [cyan('JS App'), cyan('Version'), cyan('Root directory'), cyan('Modules'), cyan('Notes')],
        colWidths: [35, 10, 50, 10, 30],
        colAligns: ['left', 'middle', 'left', 'middle']
    });

    function logInvalidApp(app, dir, note) {
        appsTable.push([
            red(app),
            red('-'),
            red(dir),
            red('-'),
            red(note || '')
        ]);
    }

    function getFolders(dir) {
        try {
            return fs.readdirSync(dir).filter(function (file) {
                return fs.statSync(path.join(dir, file)).isDirectory() && file !== '.git';
            });
        } catch (e) {
            return [];
        }
    }

    function readJsApps(app, jsApp, dir, version) {
        var jsApps = [];
        getFolders(dir).map(function (jsAppFolder) {
            if (jsApp && jsApp != jsAppFolder) {
                return;
            }

            // Do not allow building of apps with missing App.js file
            if (!fs.existsSync(dir + '/' + jsAppFolder + '/App.js')) {
                logInvalidApp(app + '.' + jsAppFolder, dir + '/' + jsAppFolder, 'Missing App.js');
                return;
            }

            var modules = [];
            getFolders(dir + '/' + jsAppFolder + '/Modules').map(function (moduleFolder) {
                modules.push({
                    name: moduleFolder,
                    scripts: dir + '/' + jsAppFolder + '/Modules/' + moduleFolder + '/**/*.{js,jsx}'
                });
            });

            var appMeta = {
                key: app + '.' + jsAppFolder + (version ? '.' + version : ''),
                name: app + '.' + jsAppFolder,
                path: app + '/' + (version ? version + '/' : '') + jsAppFolder,
                buildDir: function (path) {
                    var buildRoot = 'public_html/build/' + (process.env.production === 'false' ? 'development' : 'production');
                    var buildDir = buildRoot + '/' + app + '/' + jsAppFolder;
                    if (version) {
                        buildDir = buildRoot + '/' + app + '/' + version + '/' + jsAppFolder;
                    }

                    return buildDir + (path || '');
                },
                sourceDir: _.trimStart(dir.replace(utils.projectRoot(), '') + '/' + jsAppFolder, '/'),
                modules: modules
            };

            appMeta.assets = webiny.readAssetsConfig(appMeta);
            appMeta.reloadAssetsConfig = function () {
                appMeta.assets = webiny.readAssetsConfig(appMeta, true);
            };

            if (version) {
                appMeta.version = version;
            }

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
                // See if subfolder itself is an app (without version subfolder)
                var versionsDir = utils.projectRoot('Apps/' + appSubfolder);
                if (fs.existsSync(versionsDir + '/App.yaml')) {
                    // We have an app without version
                    var dir = versionsDir + '/Js';
                    // Read JS apps from given dir
                    readJsApps(appSubfolder, jsApp, dir, null).map(function (appObj) {
                        jsApps.push(appObj);
                    });
                } else {
                    // We may have a versioned app and we now need to read all version folders and make sure they are not Js or Php folders
                    var folders = getFolders(versionsDir);
                    // If it contains Js or Php folder it means it is not a versioned app, and it's missing an App.yaml file
                    if (!folders.length || folders.indexOf('Js') > -1 || folders.indexOf('Php') > -1) {
                        logInvalidApp(appSubfolder, versionsDir, 'Missing App.yaml');
                        return;
                    }

                    // Read JS apps from each version subfolder
                    folders.map(function (version) {
                        // Do not attempt to read apps with missing App.yaml
                        if (!fs.existsSync(versionsDir + '/' + version + '/App.yaml')) {
                            logInvalidApp(appSubfolder, versionsDir + '/' + version, 'Missing App.yaml');
                            return;
                        }

                        var dir = versionsDir + '/' + version + '/Js';
                        readJsApps(appSubfolder, jsApp, dir, version).map(function (appObj) {
                            jsApps.push(appObj);
                        });
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
        },

        readAssetsConfig: function (appObj, force) {
            if (!assetsConfigs[appObj.name] || force) {
                try {
                    assetsConfigs[appObj.name] = yaml.safeLoad(utils.readFile(appObj.sourceDir + '/Assets/Assets.yaml'));
                } catch (e) {
                    return new AssetsConfig({});
                }
            }

            return new AssetsConfig(assetsConfigs[appObj.name]);
        },

        showAppsReport: function (apps) {
            apps.map(function (a) {
                appsTable.push([
                    a.name,
                    chalk.magenta(a.version || '-'),
                    a.sourceDir,
                    a.modules.length,
                    ''
                ]);
            });

            console.log(appsTable.toString());
        }
    };

    return webiny;
};