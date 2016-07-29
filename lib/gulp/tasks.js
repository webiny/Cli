/* eslint-disable */
var utils = require('./../utils');
module.exports = function (gulp, config, $, pipes) {
    var events = ['add', 'change', 'unlink'];

    function watchApp(appObj) {
        if (config.production) {
            $.watch(config.paths.scripts(appObj.sourceDir), {read: false, events: events}, function () {
                $.util.log('Re-building ' + appObj.name + ' app scripts...');
                return pipes.buildAppScripts(appObj).pipe($.livereload());
            });
        } else {
            // Watch each module separately
            appObj.modules.map(function (moduleObj) {
                $.watch(moduleObj.scripts, {read: false, events: events}, function () {
                    $.util.log('Re-building ' + moduleObj.name + ' module...');
                    return pipes.buildModuleScripts(appObj, moduleObj).pipe($.webinyAssets.update(appObj)).pipe($.livereload());
                });
            });

            // Watch remaining scripts
            $.watch(config.paths.scriptsDev(appObj.sourceDir), {read: false, events: events}, function () {
                $.util.log('Re-building ' + appObj.name + ' app scripts...');
                return pipes.buildRemainingAppScripts(appObj).pipe($.livereload());
            });
        }

        $.watch(config.paths.watchAssets(appObj), {read: false, events: events}, function (file) {
            if ((/\.(css|scss|less)$/i).test(file.path)) {
                return pipes.buildStyles(appObj).pipe($.webinyAssets.update(appObj)).pipe($.livereload());
            }

            if ($._.endsWith(file.path, '/bower.json') || $._.endsWith(file.path, '.js')) {
                return pipes.buildVendorScripts(appObj).pipe($.webinyAssets.update(appObj)).pipe($.livereload());
            }

            if ($._.includes(file.path, '/images/')) {
                $.del(appObj.buildDir('/images'));
                return pipes.buildImages(appObj);
            }

            if ($._.endsWith(file.path, 'Assets.yaml')) {
                appObj.reloadAssetsConfig();
            }

            return pipes.buildAssets(appObj).pipe($.webinyAssets.update(appObj)).pipe($.livereload());
        });
    }

    /**
     * @params config.apps
     */
    gulp.task('clean', function () {
        return Promise.all(config.apps.map(function (app) {
            var deferred = $.q.defer();
            $.del(app.buildDir(), function () {
                deferred.resolve();
            });
            return deferred.promise;
        }));
    });

    /**
     * @param config.buildDir
     */
    gulp.task('clean-all', function () {
        var deferred = $.q.defer();
        $.del(config.buildDir, function () {
            deferred.resolve();
        });
        return deferred.promise;
    });

    /**
     * @param config.apps
     */
    gulp.task('build', ['clean'], function () {
        $.webiny.showAppsReport(config.apps);
        return Promise.all(config.apps.map(function (app) {
            return pipes.buildApp(app);
        }));

    });

    /**
     * @param config.apps
     */
    gulp.task('build-all', ['clean-all'], function () {
        $.webiny.showAppsReport(config.apps);
        return Promise.all(config.apps.map(function (app) {
            return pipes.buildApp(app);
        }));
    });

    /**
     * @param config.apps
     */
    gulp.task('watch-all', ['build-all'], function () {
        $.livereload.listen(35729);
        config.apps.map(watchApp);
    });

    /**
     * @param config.apps
     */
    gulp.task('watch', ['build'], function () {
        $.livereload.listen(35729);
        config.apps.map(watchApp);
    });

    /**
     * @param config.production
     * @param config.folder
     * @param config.host
     */
    gulp.task('release', function () {
        var env = config.production ? 'production' : 'development';
        var folder = config.folder ? config.folder : 'development';
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

        var zipName = env + '-' + $.moment().format('YYYYMMDD-HHmmss');
        var shell = config.host ? $.shell([
            'bash gulp/deploy.sh <%= file.path %> ' + config.host + ' ' + folder,
            'rm <%= file.path %>'
        ]) : $.util.noop();

        return gulp.src(paths, {base: '.'})
            .pipe($.count('## files added to archive'))
            .pipe($.zip(zipName + '.zip'))
            .pipe(gulp.dest('releases'))
            .pipe($.print(function (filepath) {
                return 'Created release archive: ' + filepath;
            }))
            .pipe(shell);
    });

    /**
     * @param config.host
     * @param config.folder
     */
    gulp.task('revert', $.shell.task([
        'bash gulp/revert.sh ' + config.host + ' ' + (config.folder ? config.folder : 'development')
    ]));

    /**
     * @param config.apps
     */
    gulp.task('run-tests', function () {
        return Promise.all(config.apps.map(function (appObj) {
            return new Promise(function (resolve, reject) {
                $.glob(appObj.sourceDir + '/Tests/*.js', function (er, files) {
                    if (files.length < 1) {
                        return reject();
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
                        .on('end', resolve).on('error', reject);
                });
            });
        }));
    });
};

