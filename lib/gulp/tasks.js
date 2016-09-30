/* eslint-disable */
var path = require('path');
var os = require('os');
var fsExtra = require('fs-extra');
var utils = require('./../utils');
var gulp = require('gulp');
var _ = require('lodash');
var inquirer = require('inquirer');
var SshClient = require('node-sshclient');
var glob = require('glob-all');
var through = require('through2');

var chokidar = require('chokidar');

var reloadPhpFpm = 'sudo /usr/sbin/service php7.0-fpm reload';
var line = '------------------------------------------------';

var chokidarOptions = {
    ignored: /[\/\\]\./,
    ignoreInitial: true,
    persistent: true,
    read: false
};

var events = ['add', 'change', 'unlink'];

module.exports = function (config, $, pipes) {

    function watchModule(appObj, moduleObj) {
        return chokidar.watch(moduleObj.scripts, chokidarOptions).on('all', function (event) {
            if (events.indexOf(event) > -1) {
                utils.info('Rebuilding ' + moduleObj.name + ' module...');
                pipes.buildModuleScripts(appObj, moduleObj).on('end', function(){
                    $.webinyBuild.write(appObj);
                    $.livereload.reload(moduleObj.name);
                });
            }
        });
    }

    function watchApp(appObj) {
        // Watch each module separately
        var watchers = {};
        appObj.modules.map(function (moduleObj) {
            // Store references to module watchers to be able to add/close watchers later on
            watchers[moduleObj.name] = watchModule(appObj, moduleObj);
        });

        // Watch remaining scripts
        chokidar.watch(config.paths.scriptsDev(appObj.sourceDir), chokidarOptions).on('all', function (event) {
            if (events.indexOf(event) > -1) {
                utils.info('Rebuilding ' + appObj.name + ' app scripts...');
                return pipes.buildRemainingAppScripts(appObj).on('end', function(){
                    $.livereload.reload(appObj.name);
                });
            }
        });

        // Watch assets
        chokidar.watch(config.paths.watchAssets(appObj), chokidarOptions).on('all', function (event, file) {
            if (events.indexOf(event) > -1) {
                if ((/\.(css|scss|less)$/i).test(file)) {
                    return pipes.buildStyles(appObj).pipe($.webinyBuild.update(appObj)).pipe($.livereload());
                }

                if (_.endsWith(file, '.js')) {
                    return pipes.buildVendorScripts(appObj).pipe($.webinyBuild.update(appObj)).pipe($.livereload());
                }

                if (_.includes(file, '/images/')) {
                    fsExtra.emptyDirSync(appObj.buildDir('/images'));
                    return pipes.buildImages(appObj);
                }

                if (_.endsWith(file, 'Assets.yaml')) {
                    appObj.reloadAssetsConfig();
                }

                return pipes.buildAssets(appObj).pipe($.webinyBuild.update(appObj)).pipe($.livereload());
            }
        });

        // Watch app modules directories to detect when new modules are created or deleted
        chokidar.watch(utils.projectRoot(appObj.sourceDir), chokidarOptions).on('addDir', function (path) {
            var paths = path.split('/Modules/');
            var moduleName = paths[1];
            if (moduleName.indexOf('/') === -1) {
                var moduleObj = {
                    name: moduleName,
                    scripts: paths[0] + '/Modules/' + moduleName + '/**/*.{js,jsx}'
                };
                utils.info('\nBuilding new module ' + utils.chalk.magenta(moduleName) + '...\n' + line);
                return pipes.buildModuleScripts(appObj, moduleObj).on('end', function () {
                    $.webinyBuild.write(appObj);
                    // Start watching new module folder
                    watchers[moduleName] = watchModule(appObj, moduleObj);
                });
            }
        }).on('unlinkDir', function (path) {
            var moduleName = path.split(appObj.sourceDir + '/Modules/')[1];
            if (moduleName.indexOf('/') === -1) {
                // Stop watching module folder
                watchers[moduleName].close();
                delete watchers[moduleName];
                $.webinyBuild.deleteModule(appObj, moduleName);
            }
        });
    }

    return {
        /**
         * Clean build directory (removes files only if building for production)
         * @params config.apps
         */
        clean: function () {
            if (!config.production) {
                return Promise.resolve();
            }

            return Promise.all(config.apps.map(function (app) {
                return new Promise(function (resolve) {
                    fsExtra.emptyDir(app.buildDir(), function () {
                        utils.info('Cleaned up build directory ' + utils.chalk.magenta(app.buildDir().replace(utils.projectRoot(), '')));
                        resolve();
                    });
                });
            }));
        },

        /**
         * @param config.apps
         */
        build: function () {
            return this.clean().then(function () {
                var started = new Date().getTime();
                $.webiny.showAppsReport(config.apps);

                // Create a chain of promises. Each chain link will build 1 app at a time.
                var chain = config.apps.reduce(function (sequence, app) {
                    return sequence.then(function () {
                        utils.info('\nBuilding ' + utils.chalk.magenta(app.name) + '...\n' + line);
                        var appStarted = new Date().getTime();
                        return pipes.buildApp(app).then(function () {
                            var duration = new Date().getTime() - appStarted;
                            utils.log(line);
                            utils.success(utils.chalk.magenta(app.name) + ' built in ' + utils.chalk.magenta(utils.humanizer(duration, {round: true})));
                            utils.log(line);
                        });
                    });
                }, Promise.resolve());

                return chain.then(function () {
                    var duration = new Date().getTime() - started;
                    utils.success('\nFinished build in ' + utils.chalk.magenta(utils.humanizer(duration, {round: true})));
                });
            });
        },

        /**
         * @param config.apps
         */
        watch: function () {
            return this.build().then(function () {
                $.livereload.listen(35729);
                config.apps.map(watchApp);
                utils.info('Started LiveReload listener on port 35729... (' + utils.chalk.magenta('Ctrl+C') + ' to abort)');
            });
        },

        /**
         * @param config.production
         * @param config.releasePath
         */
        release: function () {
            utils.info('\nCreating release archive...');
            var env = config.production ? 'production' : 'development';
            var paths = [
                'Apps/**/*',
                '!Apps/**/Js/**/*',
                '!Apps/**/*.git',
                'Configs/**/*.yaml',
                'public_html/build/' + env + '/**/*',
                'public_html/index.{php,html}',
                'vendor/**/*.{php,crt}',
                '!vendor/**/[tT]est*/**/*',
                '!vendor/**/*.git'
            ];

            var parts = path.parse(config.releasePath);
            if (!parts.dir.startsWith('/') && !parts.dir.startsWith('~/')) {
                parts.dir = utils.projectRoot(parts.dir);
            }

            if (parts.dir.startsWith('~/')) {
                parts.dir = parts.dir.replace('~/', os.homedir() + '/');
            }

            parts.dir = path.resolve(parts.dir);

            return new Promise(function (resolve, reject) {
                gulp.src(paths, {base: '.'})
                    .pipe($.zip(parts.name + '.zip'))
                    .pipe(gulp.dest(parts.dir))
                    .pipe($.print(function () {
                        utils.success('Done! Archive saved to ' + utils.chalk.magenta(config.releasePath) + '\n');
                    })).on('end', resolve).on('error', reject);
            });
        },

        /**
         * @param config.folder
         * @param config.host
         */
        deploy: function () {
            var folder = config.folder;
            var port = 22;
            var host = config.host;

            if (host.indexOf(':') > -1) {
                var parts = host.split(':');
                host = parts[0];
                port = parts[1];
            }

            var hostParts = host.split('@');
            var user = hostParts[0];
            var domain = hostParts[1];

            var file = path.parse(config.releasePath);

            return new Promise(function (resolve, reject) {
                var sshConfig = {
                    hostname: domain,
                    user: user,
                    port: port
                };

                var scp = new SshClient.SCP(sshConfig);
                var ssh = new SshClient.SSH(sshConfig);

                utils.info('\nVerifying folder structure on remote server...');
                var structure = 'mkdir -p ~/www/{files,releases,logs,active}';
                ssh.command(structure, function () {
                    utils.info('Uploading release archive to remote server...');
                    scp.upload(config.releasePath, '~/www/releases/', function (procResult) {
                        if (procResult.exitCode === 0) {
                            utils.success('Done! Release archive uploaded to ' + utils.chalk.magenta('~/www/releases/' + file.base));
                        }
                        var unzip = [
                            'cd ~/www/releases',
                            'unzip -qu ' + file.base + ' -d ' + file.name,
                            'rm ' + file.base
                        ].join('&&');
                        ssh.command(unzip, function () {
                            utils.info('Activating release...');
                            var activate = [
                                'rm -f ~/www/active/' + folder,
                                'ln -s ~/www/releases/' + file.name + ' ~/www/active/' + folder,
                                'mkdir -m 0775 -p ~/www/files/' + folder + '/{Uploads,Temp}',
                                'ln -s ~/www/files/' + folder + '/Uploads ~/www/active/' + folder + '/public_html/uploads',
                                'ln -s ~/www/files/' + folder + '/Temp ~/www/active/' + folder + '/Temp',
                                'mkdir -m 0775 ~/www/active/' + folder + '/Cache'
                            ].join('&&');
                            ssh.command(activate, function (res) {
                                if (res.stderr) {
                                    utils.failure('\nRelease activation failed!');
                                    console.error(res);
                                    return reject();
                                }
                                utils.info('Attempting to reload php-fpm service...');
                                ssh.command(reloadPhpFpm, function (res) {
                                    if (res.exitCode !== 0) {
                                        utils.failure('Could not reload php-fpm service!');
                                        utils.log(res.stderr);
                                    }

                                    utils.info('Executing post-deploy scripts...');
                                    var postDeploy = [
                                        'cd ~/www/active/' + folder + ' && php Apps/Core/Php/Cli/release.php ' + domain
                                    ].join('&&');
                                    ssh.command(postDeploy, function (res) {
                                        utils.log(res.stdout);
                                        utils.success('Done! Deploy process finished successfully.');
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        },

        /**
         * @param config.host
         * @param config.folder
         */
        revert: function () {
            var port = 22;
            var host = config.host;

            if (host.indexOf(':') > -1) {
                var parts = host.split(':');
                host = parts[0];
                port = parts[1];
            }

            var hostParts = host.split('@');
            var user = hostParts[0];
            var domain = hostParts[1];

            var sshConfig = {
                hostname: domain,
                user: user,
                port: port
            };

            var ssh = new SshClient.SSH(sshConfig);

            return new Promise(function (resolve) {
                ssh.command('ls -1d ~/www/active/*/', function (res) {
                    var list = res.stdout;
                    var choices = [];
                    _.trimEnd(list, '\n').split('\n').map(function (line) {
                        choices.push(_.trimEnd(line, '/').split('/').pop());
                    });

                    inquirer.prompt({
                        type: 'list',
                        choices: choices,
                        name: 'folder',
                        message: 'Select an environment to switch'
                    }).then(function (answers) {
                        var folder = answers.folder;
                        ssh.command('ls -1d ~/www/releases/*/', function (res) {
                            var list = res.stdout;
                            var choices = [];
                            _.trimEnd(list, '\n').split('\n').map(function (line) {
                                choices.push(_.trimEnd(line, '/').split('/').pop());
                            });

                            inquirer.prompt({
                                type: 'list',
                                choices: choices,
                                name: 'release',
                                message: 'Select a release to activate for ' + utils.chalk.magenta(folder) + ' environment:'
                            }).then(function (answers) {
                                var activate = [
                                    'rm -f ~/www/active/' + folder,
                                    'ln -s ~/www/releases/' + answers.release + ' ~/www/active/' + folder
                                ].join('&&');
                                ssh.command(activate, function () {
                                    utils.info('Attempting to reload php-fpm service...');
                                    ssh.command(reloadPhpFpm, function (res) {
                                        if (res.exitCode !== 0) {
                                            utils.failure('Could not reload php-fpm service!');
                                            utils.log(res.stderr);
                                        }

                                        utils.success('Done! Release ' + utils.chalk.magenta(answers.release) + ' is now active for ' + utils.chalk.magenta(folder));
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        },

        /**
         * @param config.apps
         */
        'run-tests': function () {
            return Promise.all(config.apps.map(function (appObj) {
                return new Promise(function (resolve) {
                    glob(appObj.sourceDir + '/Tests/*.js', function (er, files) {
                        if (files.length < 1) {
                            return resolve();
                        }

                        return gulp.src(files)
                            .pipe($.count('Running ## test(s) for ' + $.util.colors.magenta(appObj.name)))
                            .pipe($.mocha({
                                reporter: 'spec',
                                compilers: {
                                    js: $.babelRegister({
                                        "presets": ["es2015"],
                                        resolveModuleSource: function (source) {
                                            if (source === 'Webiny/TestSuite') {
                                                return utils.projectRoot('Apps/Core/Js/Webiny/Modules/Core/TestLib/TestSuite');
                                            }
                                            return source;
                                        }
                                    })
                                }
                            }))
                            .on('end', resolve).on('error', function(e){
                                utils.failure(e.message);
                            });
                    });
                });
            }));
        }
    };
};

