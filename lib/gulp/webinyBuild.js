var through = require('through2');
var glob = require('glob-all');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var _ = require('lodash');
var utils = require('./../utils');

function fileExists(file, cb) {
    try {
        fs.statSync(file);
        return cb();
    }
    catch (e) {
        return false;
    }
}

function readModule(name, dir) {
    var config = {
        name: name,
        folders: [],
        module: false
    };

    var systemFolders = ['Components', 'Views'];
    var systemFiles = ['Module.js'];

    // Read folders
    systemFolders.map(function (folder) {
        fileExists(dir + '/' + folder + '/' + folder + '.js', function () {
            config.folders.push(folder);
        });
    });

    systemFiles.map(function (file) {
        fileExists(dir + '/' + file, function () {
            var key = file.replace('.js', '').toLowerCase();
            config[key] = true;
        });
    });

    return config;
}


module.exports = function (config, $) {
    var assets = {};
    var logs = {};
    var deleted = [];

    // Load log file which holds app hash strings to optimize builds
    function loadAppLog(appObj) {
        if (!_.has(logs, appObj.name)) {
            // Read logs file
            var logFile = utils.projectRoot(appObj.buildDir('/log.json'));
            if (utils.fileExists(logFile)) {
                logs[appObj.name] = JSON.parse(utils.readFile(logFile));
                deleted[appObj.name] = _.keys(logs[appObj.name]['Modules']);
            } else {
                logs[appObj.name] = {Modules: {}};
            }
        }
        return logs[appObj.name];
    }

    var build = {
        // Register app meta
        app: function (appObj) {
            var assetsPath = config.production ? '/build/production/' : '/build/development/';
            var appPath = appObj.version ? appObj.name.replace('.', '/' + appObj.version + '/') : appObj.name.replace('.', '/');

            assets[appObj.key] = {
                name: appObj.name,
                version: appObj.version || null,
                assets: {
                    path: assetsPath + appPath,
                    js: [],
                    css: []
                },
                modules: {}
            };

            if (!appObj.version) {
                delete assets[appObj.key].version;
            }
        },

        // Add module to app meta
        module: function (appObj) {
            return through.obj(function (file, encoding, callback) {
                if (file.path.indexOf('/Modules/') > -1) {
                    var paths = file.path.split('/Modules/');
                    var moduleParts = paths.pop().split('/');
                    if (!_.has(assets[appObj.key].modules, moduleParts[0])) {
                        // We have our module name
                        var modulePath = paths[0] + '/Modules/' + moduleParts[0];
                        assets[appObj.key].modules[moduleParts[0]] = readModule(moduleParts[0], modulePath);
                        deleted[appObj.key] = _.pull(deleted[appObj.key], moduleParts[0]);
                    }
                }
                callback(null, file);
            }).on('data', _.noop);
        },

        // Add JS and CSS assets to app meta
        add: function (appObj) {
            return through.obj(function (file, encoding, callback) {
                var type = file.path.split('.').pop();

                // Validate extension
                if (['js', 'css'].indexOf(type) > -1) {
                    // Delimiter depends on whether assets were rebuilt or not.
                    // If assets were not modified, file path will contain a __MARK__ string
                    var delimiter = file.path.indexOf('__MARK__') === -1 ? appObj.path : '__MARK__';
                    // Add asset to meta
                    var buildPath = config.production ? '/build/production/' : '/build/development/';
                    var asset = file.path.split(delimiter).pop();
                    var assetPath = buildPath + appObj.path + asset;
                    if (assets[appObj.key].assets[type].indexOf(assetPath) === -1) {
                        assets[appObj.key].assets[type].push(assetPath);
                    }
                }

                // Continue with pipe...
                callback(null, file);
            }).on('data', _.noop);
        },

        // Delete module entry from log file
        deleteModule: function (appObj, moduleName) {
            deleted[appObj.key].push(moduleName);
            delete assets[appObj.key].modules[moduleName];
            var scriptIndex = _.findIndex(assets[appObj.key].assets.js, function (s) {
                return s.endsWith('/' + moduleName + '.js');
            });
            if (scriptIndex > -1) {
                assets[appObj.key].assets.js.splice(scriptIndex, 1);
            }
            build.write(appObj);
        },

        // Write log file and make sure deleted modules are removed from the log
        writeLog: function (appObj) {
            var deletedModules = deleted[appObj.key];
            var logsFile = appObj.buildDir('/log.json');
            if (_.isArray(deletedModules) && deletedModules.length > 0) {
                // Remove deleted modules from the log
                logs[appObj.key].Modules = _.omit(logs[appObj.key].Modules, deletedModules);
                // Delete old module files from scripts folder
                deletedModules.forEach(function (m) {
                    var moduleFile = appObj.buildDir('/scripts/' + m + '.js');
                    if (utils.fileExists(moduleFile)) {
                        utils.deleteFile(moduleFile);
                    }
                });
            }
            // Write log file with module hashes to optimize build
            utils.writeFile(logsFile, JSON.stringify(logs[appObj.name], null, 4));
        },

        // Write meta file
        write: function (appObj, then) {
            var path = appObj.buildDir('/meta.json');
            var data = assets[appObj.key];
            utils.writeFile(path, JSON.stringify(data, null, 4));
            if (!config.production) {
                build.writeLog(appObj);
            }
            _.isFunction(then) && then();
        },

        // Update meta file
        update: function (appObj) {
            return through.obj(function (file, encoding, callback) {
                if (file.path.indexOf('__MARK__') > -1) {
                    callback(null, file);
                    return;
                }
                var type = file.path.split('.').pop();

                // Validate extension
                if (['js', 'css'].indexOf(type) > -1) {
                    // Generate asset path
                    var buildPath = config.production ? '/build/production/' : '/build/development/';
                    var asset = file.path.split(appObj.path).pop();
                    var assetPath = buildPath + appObj.path + asset;

                    // Remove old file from assets
                    var meta = assets[appObj.key];
                    _.each(meta.assets[type], function (existing, index) {
                        if (_.isEmpty(existing)) {
                            return;
                        }
                        var moduleName = existing.split('/').pop().split('-').shift();
                        if (moduleName === assetPath.split('/').pop().split('-').shift()) {
                            meta.assets[type].splice(index, 1);
                        }
                    });

                    // Add asset to meta
                    meta.assets[type].push(assetPath);

                    // Cleanup array of falsy values
                    meta.assets[type] = _.uniq(_.compact(meta.assets[type]));

                    // Write meta and continue with pipe
                    $.webinyBuild.write(appObj, function () {
                        callback(null, file);
                    });
                } else {
                    callback(null, file);
                }
            }).on('data', _.noop);
        },

        // Check of module has changed
        moduleChanged: function (appObj, moduleObj) {
            var appLog = loadAppLog(appObj);
            var files = glob.sync(moduleObj.scripts);
            var content = '';
            _.each(files, function (f) {
                content += f;
                content += utils.readFile(f);
            });
            files = null;
            var hash = crypto.createHash('md5').update(content).digest('hex');
            content = null;
            var lastHash = appLog['Modules'][moduleObj.name] || null;
            if (!lastHash || lastHash != hash) {
                logs[appObj.name]['Modules'][moduleObj.name] = hash;
                return true;
            }
            return false;
        },

        // Check of app scripts have changed
        appScriptsChanged: function (appObj, patterns) {
            var appLog = loadAppLog(appObj);
            var files = glob.sync(patterns);

            var content = '';
            _.each(files, function (f) {
                content += utils.readFile(f);
            });
            files = null;
            var hash = crypto.createHash('md5').update(content).digest('hex');
            content = null;
            var lastHash = appLog['App'] || null;
            if (!lastHash || lastHash != hash) {
                logs[appObj.name]['App'] = hash;
                return true;
            }
            return false;
        },

        // Check if vendor scripts have changed
        vendorAssetsChanged(appObj, files, type){
            var appLog = loadAppLog(appObj);
            var content = '';
            _.each(files, function (f) {
                content += utils.readFile(f);
            });
            var hash = crypto.createHash('md5').update(content).digest('hex');
            content = null;
            var lastHash = _.get(appLog, 'Vendors.' + type);
            if (!lastHash || lastHash != hash) {
                _.set(logs[appObj.name], 'Vendors.' + type, hash);
                return true;
            }
            return false;
        },

        /**
         * Get proper SystemJS module id
         *
         * @param appObj
         * @param moduleName
         * @returns {*}
         */
        getModuleId: function (appObj, moduleName) {
            // Apps entry points must be named with their logical names, ex: Core.Backend
            if (moduleName == 'App') {
                return appObj.name;
            }

            var appPrefix = appObj.name.replace('.', '/') + '/';

            // Modules must be named like this: Core/Backend/Modules/Components
            if (_.startsWith(moduleName, 'Modules/') && _.endsWith(moduleName, 'Module') && moduleName.split('/').length === 3) {
                return appPrefix + moduleName.substring(0, moduleName.lastIndexOf('/Module'));
            }

            // All other files should just be prefixed with app name, ex: Cms/Backend/{moduleName}
            return (appPrefix + moduleName).replace('//', '/');
        },

        /**
         * Resolve import statements sources
         *
         * @param appObj
         * @param source
         * @param filename
         * @returns {*}
         */
        resolveModuleSource: function (appObj, source, filename) {
            // Relative sources should be resolved to the appropriate absolute paths
            if (source.indexOf('./') === 0) {
                var appPrefix = appObj.name.replace('.', '/');
                var parts = appObj.key.split('.');

                var delim = '';

                // If app key consists of 2 parts it means there is no app version in its path
                if (parts.length === 2) {
                    // part[0] = App name
                    // part[1] = JS app name
                    delim = parts[0] + '/Js/' + parts[1];
                } else {
                    // part[0] = App name
                    // part[1] = JS app name
                    // part[2] = version number (ie: v1.1)
                    delim = parts[0] + '/' + parts[2] + '/Js/' + parts[1];
                }

                var dir = path.dirname(filename.split(delim).pop());
                return (appPrefix + dir + source.replace('./', '/')).replace('//', '/');
            }

            // Webiny is a collection of core tools and needs to be easily accessible from everywhere
            // import Webiny from 'Webiny';
            if (source === 'Webiny') {
                return 'Core/Webiny/Webiny';
            }

            return source;
        }
    };

    return build;
};