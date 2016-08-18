/* eslint-disable */
/**
 * To add typescript transpiling, install 'gulp-typescript' and add the following pipes into app/module build steps.
 *
 * <code>
 *     .pipe($.typescript({
 *          target: 'es6',
 *          jsx: 'react'
 *     }))
 *     .pipe($.rename(function (path) {
 *          path.extname = '.js';
 *     }))
 * </code>
 */
var utils = require('./../utils');
var gulp = require('gulp');
var _ = require('lodash');

module.exports = function (config, $) {
    // Read .eslintrc files from Core.Webiny and all apps selected for build
    var eslintConfig = JSON.parse(utils.readFile(utils.projectRoot('/Apps/Core/Js/Webiny/Assets/.eslintrc')));
    config.apps.forEach(function (app) {
        if (app.name === 'Core.Webiny') {
            return;
        }

        try {
            _.merge(eslintConfig, JSON.parse(utils.readFile(utils.projectRoot(app.sourceDir + '/Assets/.eslintrc'))));
        } catch (e) {
            // .eslintrc file does not exist
        }
    });

    var eslint = function () {
        return config.esLint ? $.eslint(eslintConfig) : $.util.noop()
    };
    var eslintFormat = function () {
        return config.esLint ? $.eslint.format() : $.util.noop();
    };
    var jsRev = function () {
        return config.production || config.jsRev ? $.rev() : $.util.noop();
    };
    var cssRev = function () {
        return config.production || config.cssRev ? $.rev() : $.util.noop();
    };
    var uglify = function () {
        return config.production ? $.uglify({mangle: false}) : $.util.noop();
    };
    var cleanCss = function () {
        return config.production ? $.cleanCss() : $.util.noop();
    };
    var less = function (appObj) {
        return appObj.assets.isLess() ? $.less() : $.util.noop();
    };
    var sass = function (appObj) {
        return appObj.assets.isSass() ? $.sass().on('error', $.sass.logError) : $.util.noop();
    };

    /**
     * In production we use a production build of React
     * @param appObj
     * @returns {Array|*}
     */
    var getBowerFiles = function (appObj) {
        return $.mainBowerFiles({paths: appObj.sourceDir + '/Assets'}).map(function (file) {
            if (config.production) {
                var replace = {
                    '/bower_components/react/react.js': '/bower_components/react/react.min.js',
                    '/bower_components/react/react-with-addons.js': '/bower_components/react/react-with-addons.min.js',
                    '/bower_components/react/react-dom.js': '/bower_components/react/react-dom.min.js',
                    '/bower_components/react/react-dom-server.js': '/bower_components/react/react-dom-server.min.js'
                };
                $._.each(replace, function (replace, search) {
                    if (file.endsWith(search)) {
                        file = file.replace(search, replace);
                    }
                });
            }
            return file;
        });
    };

    var pipes = {};

    pipes.babelProcess = function (appObj, moduleName) {
        return $.lazypipe()
            .pipe(function () {
                var babelOpts = {
                    moduleIds: true,
                    compact: false,
                    plugins: [
                        "transform-es2015-modules-systemjs",
                        ["babel-plugin-transform-builtin-extend", {
                            globals: ["Error"]
                        }]
                    ],
                    presets: ["es2015", "react"],
                    getModuleId: function (moduleName) {
                        return $.webinyAssets.getModuleId(appObj, moduleName);
                    },
                    resolveModuleSource: function (source, filename) {
                        return $.webinyAssets.resolveModuleSource(appObj, source, filename);
                    }
                };

                if (config.production) {
                    babelOpts.plugins.push("transform-remove-console");
                }

                if (moduleName) {
                    babelOpts['moduleRoot'] = 'Modules/' + moduleName
                }

                return $.babel(babelOpts);
            })
            .pipe(function () {
                return $.replace('throw new TypeError("Cannot call a class as a function")', '')
            })
            .pipe(function () {
                return $.replace("throw new TypeError('Cannot call a class as a function')", '')
            })()
            .on('error', function (e) {
                var msg = e.message + ' on line ' + e.loc.line;
                var line = Array(msg.length + 1).join('=');
                console.log(
                    "\n\n",
                    $.util.colors.red(line),
                    "\n",
                    $.util.colors.red(msg),
                    "\n",
                    $.util.colors.red(line),
                    "\n\n"
                );
                this.emit('end');
            });
    };

    pipes.orderedVendorScripts = function (appObj) {
        return $.order(appObj.assets.getVendors(), {base: appObj.sourceDir + '/Assets'});
    };

    pipes.orderedStyles = function (appObj) {
        return $.order(appObj.assets.getStylesOrder(), {base: appObj.sourceDir + '/Assets'});
    };

    /**
     * This pipe is used only in development
     */
    pipes.buildModuleScripts = function (appObj, moduleObj) {
        return gulp.src(moduleObj.scripts)
            .pipe($.webinyAssets.module(appObj))
            .pipe(eslint())
            .pipe(eslintFormat())
            .pipe($.duration(moduleObj.name + ' module'))
            .pipe(pipes.babelProcess(appObj, moduleObj.name))
            .pipe($.concat(moduleObj.name + '.js'))
            .pipe(jsRev())
            .pipe(gulp.dest(appObj.buildDir('/scripts')))
            .pipe($.webinyAssets.add(appObj));
    };

    /**
     * This pipe is used only in development
     */
    pipes.buildRemainingAppScripts = function (appObj) {
        return gulp.src(config.paths.scriptsDev(appObj.sourceDir))
            .pipe(eslint())
            .pipe(eslintFormat())
            .pipe($.duration('App scripts'))
            .pipe(pipes.babelProcess(appObj))
            .pipe($.concat('app.js'))
            .pipe(jsRev())
            .pipe(gulp.dest(appObj.buildDir('/scripts')))
            .pipe($.webinyAssets.add(appObj));
    };

    pipes.buildAppScripts = function (appObj) {
        if (config.production) {
            // If in production mode - will build entire app directory into app.js
            return gulp.src(config.paths.scripts(appObj.sourceDir))
                .pipe(eslint())
                .pipe(eslintFormat())
                .pipe($.duration('App scripts'))
                .pipe($.webinyAssets.module(appObj))
                .pipe($.sourcemaps.init())
                .pipe(pipes.babelProcess(appObj))
                .pipe($.concat('app.js'))
                .pipe(uglify())
                .pipe(jsRev())
                .pipe($.sourcemaps.write('.'))
                .pipe(gulp.dest(appObj.buildDir('/scripts')))
                .pipe($.webinyAssets.add(appObj));
        } else {
            // If in development mode - will build each module separately and remaining app scripts into app.js

            var modules = [];
            appObj.modules.map(function (moduleObj) {
                modules.push(pipes.buildModuleScripts(appObj, moduleObj));
            });
            modules.push(pipes.buildRemainingAppScripts(appObj));
            return $.es.concat.apply(null, modules);
        }
    };

    pipes.buildVendorScripts = function (appObj) {
        var cssFilter = $.filter(['**/*.css', '**/*.less', '**/*.scss']);
        var lessFilter = $.filter('**/*.less');
        var scssFilter = $.filter('**/*.scss');
        var jsFilter = $.filter('**/*.js');
        var es6Filter = $.filter('**/*.es6.js');
        var nonMinified = $.filter(['**/*.js', '!**/*.min.js']);
        var imageFilter = $.filter(['*.gif', '*.png', '*.svg', '*.jpg', '*.jpeg']);

        var merge = [];
        try {
            var bowerPipe = gulp.src(getBowerFiles(appObj));
            merge.push(bowerPipe);
        } catch (e) {
            // Catch if bower.json does not exist
        }

        var customPipe = gulp.src([appObj.sourceDir + '/Assets/custom_components/**/*.js', '!**/system-polyfills.js']);
        merge.push(customPipe);

        // Copy system-polyfills - it will be required on-demand by old browsers and Google bot
        gulp.src(appObj.sourceDir + '/Assets/custom_components/system-polyfills.js').pipe(gulp.dest(appObj.buildDir('/scripts')));

        // Process assets
        return $.es.merge(merge)
            .pipe($.duration('Vendor scripts'))
            // ES6
            .pipe(es6Filter)
            .pipe(eslint())
            .pipe(eslintFormat())
            .pipe($.rename(function (path) {
                path.basename = path.basename.replace('.es6', '');
            }))
            .pipe(pipes.babelProcess(appObj))
            .pipe(es6Filter.restore())
            // JS
            .pipe(nonMinified)
            .pipe(uglify())
            .pipe(nonMinified.restore())
            .pipe(jsFilter)
            .pipe(pipes.orderedVendorScripts(appObj))
            .pipe($.concat('vendors.js'))
            .pipe(jsRev())
            .pipe(gulp.dest(appObj.buildDir('/scripts')))
            .pipe($.webinyAssets.add(appObj))
            .pipe(jsFilter.restore())

            // CSS/LESS
            .pipe(lessFilter)
            .pipe($.sourcemaps.init())
            .pipe($.less())
            .pipe(lessFilter.restore())
            .pipe(scssFilter)
            .pipe($.sass().on('error', $.sass.logError))
            .pipe(scssFilter.restore())
            .pipe(cssFilter)
            .pipe(pipes.orderedVendorScripts(appObj))
            .pipe($.concat('vendors.css'))
            .pipe(cleanCss())
            .pipe(cssRev())
            .pipe($.sourcemaps.write())
            .pipe(gulp.dest(appObj.buildDir('/css')))
            .pipe($.webinyAssets.add(appObj))
            .pipe(cssFilter.restore())

            // IMAGES
            .pipe(imageFilter)
            .pipe($.flatten())
            .pipe(gulp.dest(appObj.buildDir('/images')))
            .pipe(imageFilter.restore())
    };

    pipes.buildStyles = function (appObj) {
        return gulp.src(config.paths.styles(appObj))
            .pipe($.duration('Styles'))
            .pipe(pipes.orderedStyles(appObj))
            .pipe(less(appObj))
            .pipe(sass(appObj))
            .pipe($.cssImport().on('error', $.util.log))
            .pipe($.replaceTask({
                patterns: appObj.assets.getStylesReplacements(),
                usePrefix: false
            }))
            .pipe($.concat('styles.css'))
            .pipe(cleanCss())
            .pipe(cssRev())
            .pipe(gulp.dest(appObj.buildDir('/css')))
            .pipe($.webinyAssets.add(appObj));
    };

    pipes.buildFonts = function (appObj) {
        return gulp.src(config.paths.fonts(appObj.sourceDir))
            .pipe($.duration('Fonts'))
            .pipe($.flatten())
            .pipe(gulp.dest(appObj.buildDir('/fonts')));
    };

    pipes.buildImages = function (appObj) {
        return gulp.src(config.paths.images(appObj.sourceDir))
            .pipe($.duration('Images'))
            .pipe(gulp.dest(appObj.buildDir('/images/')));
    };

    pipes.buildOther = function (appObj) {
        return gulp.src(config.paths.other(appObj))
            .pipe($.duration('Other'))
            .pipe(gulp.dest(appObj.buildDir('/other')));
    };

    pipes.buildAssets = function (appObj) {
        return $.es.concat.apply(null, [
            pipes.buildFonts(appObj),
            pipes.buildImages(appObj),
            pipes.buildStyles(appObj),
            pipes.buildOther(appObj)
        ]);
    };

    pipes.buildJsApp = function (appObj) {
        try {
            return $.es.concat.apply(null, [
                pipes.buildVendorScripts(appObj),
                pipes.buildAppScripts(appObj),
                pipes.buildAssets(appObj)
            ]);
        } catch (err) {
            utils.failure(err.message);
        }
    };

    pipes.buildApp = function (appObj) {
        try {
            $.webinyAssets.app(appObj);
            return new Promise(function (resolve, reject) {
                pipes.buildJsApp(appObj).on('end', function () {
                    $.webinyAssets.write(appObj, resolve);
                });
            });
        } catch (err) {
            utils.failure('Failed to build ' + appObj.name);
            utils.log(err.message);
        }
    };

    return pipes;
};