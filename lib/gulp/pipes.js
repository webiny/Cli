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
var through = require('through2');
var _ = require('lodash');
var glob = require('glob-all');
var babel = require('babel-core');

var notModified = utils.chalk.green('not modified');

module.exports = function (config, $) {
    // Read .eslintrc files from Core.Webiny and all apps selected for build
    var eslintConfig = JSON.parse(utils.readFile(utils.projectRoot('/Apps/Core/Js/Webiny/Assets/.eslintrc')));
    config.apps && config.apps.forEach(function (app) {
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
     * @param appObj
     * @param type
     * @param asStream
     * @returns {Array|*}
     */
    var getAssets = function (appObj, type, asStream) {
        asStream = asStream || false;
        var assets = [];
        var replacements = {};
        appObj.assets.getVendors()[type].forEach(function (path) {
            // Specifying a path in form of an object is only allowed for styles
            var replace = null;
            if (!_.isString(path) && type !== 'Styles') {
                return;
            } else if (_.isPlainObject(path) && type === 'Styles') {
                var obj = _.toPairs(path).pop();
                replace = obj[1].Replace;
                path = obj[0];
            }

            // Check if asset is marked for development or production only
            var assetPath = '';
            var prefix = appObj.sourceDir + '/Assets/';
            if (path.startsWith('D:') && !config.production) {
                assetPath = prefix + _.trimStart(path, 'D:');
            } else if (path.startsWith('P:') && config.production) {
                assetPath = prefix + _.trimStart(path, 'P:');
            } else if (!path.startsWith('D:') && !path.startsWith('P:')) {
                assetPath = prefix + path;
            }

            if (!assetPath) {
                return;
            }

            // Glob patterns are only allowed for images and fonts
            if (['Fonts', 'Images'].indexOf(type) > -1 && assetPath.indexOf('*') > -1) {
                assets = assets.concat(glob.sync(assetPath, {nodir: true}));
            } else if (assetPath.indexOf('*') === -1) {
                if (replace) {
                    replacements[assetPath] = replace;
                }
                assets.push(assetPath);
            }
        });

        if (asStream) {
            var root = utils.projectRoot();
            return gulp.src(assets).pipe(through.obj(function (file, encoding, callback) {
                var key = file.path.replace(root + '/', '');
                if (_.has(replacements, key)) {
                    var fileContent = file.contents.toString();
                    _.each(replacements[key], function (replace, find) {
                        fileContent = fileContent.replace(new RegExp(find, 'g'), replace);
                    });
                    file.contents = new Buffer(fileContent);
                }
                callback(null, file);
            }));
        }

        return assets;
    };

    var pipes = {};

    pipes.babelProcess = function (appObj, moduleName) {
        return through.obj(function (file, enc, cb) {
            if (file.isNull()) {
                cb(null, file);
                return;
            }

            try {
                var fileOpts = {
                    filename: file.path,
                    filenameRelative: file.relative,
                    sourceMap: Boolean(file.sourceMap),
                    sourceFileName: file.relative,
                    sourceMapTarget: file.relative,
                    moduleIds: true,
                    compact: false,
                    plugins: [
                        "transform-es2015-modules-systemjs",
                        ["transform-object-rest-spread", {"useBuiltIns": true}],
                        ["babel-plugin-transform-builtin-extend", {
                            globals: ["Error"]
                        }]
                    ],
                    presets: ["es2015", "react"],
                    getModuleId: function (moduleName) {
                        return $.webinyBuild.getModuleId(appObj, moduleName);
                    },
                    resolveModuleSource: function (source, filename) {
                        return $.webinyBuild.resolveModuleSource(appObj, source, filename);
                    }
                };

                if (config.production) {
                    fileOpts.plugins.push("transform-remove-console");
                }

                if (moduleName) {
                    fileOpts['moduleRoot'] = 'Modules/' + moduleName;
                }

                var res = babel.transform(file.contents.toString(), fileOpts);

                if (!res.ignored) {
                    var code = res.code.replace(new RegExp('throw new TypeError("Cannot call a class as a function")', 'g'), '');
                    code = code.replace(new RegExp("throw new TypeError('Cannot call a class as a function')", 'g'), '');
                    file.contents = new Buffer(code);
                }
            } catch (err) {
                var msg = err.message + ' on line ' + _.get(err, 'loc.line', '__unknown__');
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
            }

            cb(null, file);
        });
    };

    /**
     * This pipe is used only in development
     */
    pipes.buildModuleScripts = function (appObj, moduleObj) {
        if (!$.webinyBuild.moduleChanged(appObj, moduleObj)) {
            utils.info('Skipping module ' + utils.chalk.cyan(moduleObj.name) + ' (' + notModified + ')');
            // We still need to execute this short pipeline to generate proper meta.json and log.json files
            return gulp.src(moduleObj.scripts)
                .pipe($.webinyBuild.module(appObj))
                .pipe($.concat('__MARK__/scripts/' + moduleObj.name + '.js'))
                .pipe($.webinyBuild.add(appObj));
        }

        return gulp.src(moduleObj.scripts)
            .pipe($.webinyBuild.module(appObj))
            .pipe(eslint())
            .pipe(eslintFormat())
            .pipe($.duration(utils.chalk.cyan(moduleObj.name) + ' module'))
            .pipe(pipes.babelProcess(appObj, moduleObj.name))
            .pipe($.concat(moduleObj.name + '.js'))
            .pipe(jsRev())
            .pipe(gulp.dest(appObj.buildDir('/scripts')))
            .pipe($.webinyBuild.add(appObj));
    };

    /**
     * This pipe is used only in development
     */
    pipes.buildRemainingAppScripts = function (appObj) {
        var patterns = config.paths.scriptsDev(appObj.sourceDir);
        if (!$.webinyBuild.appScriptsChanged(appObj, patterns)) {
            utils.info('Skipping app scripts (' + notModified + ')');
            // We still need to execute this short pipeline to generate proper meta.json and log.json files
            return gulp.src(patterns).pipe($.concat('__MARK__/scripts/app.js')).pipe($.webinyBuild.add(appObj));
        }

        return gulp.src(patterns)
            .pipe(eslint())
            .pipe(eslintFormat())
            .pipe($.duration('app scripts'))
            .pipe(pipes.babelProcess(appObj))
            .pipe($.concat('app.js'))
            .pipe(jsRev())
            .pipe(gulp.dest(appObj.buildDir('/scripts')))
            .pipe($.webinyBuild.add(appObj));
    };

    pipes.buildAppScripts = function (appObj) {
        if (config.production) {
            // If in production mode - will build entire app directory into app.js
            return gulp.src(config.paths.scripts(appObj.sourceDir))
                .pipe(eslint())
                .pipe(eslintFormat())
                .pipe($.duration('app scripts'))
                .pipe($.webinyBuild.module(appObj))
                .pipe($.sourcemaps.init())
                .pipe(pipes.babelProcess(appObj))
                .pipe($.concat('app.js'))
                .pipe(uglify())
                .pipe(jsRev())
                .pipe($.sourcemaps.write('.'))
                .pipe(gulp.dest(appObj.buildDir('/scripts')))
                .pipe($.webinyBuild.add(appObj));
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
        var fontFilter = $.filter(['*.eot', '*.svg', '*.ttf', '*.woff', '*.woff2']);

        // Copy system-polyfills - it will be required on-demand by old browsers and Google bot
        gulp.src(appObj.sourceDir + '/Assets/webiny/polyfills/system-polyfills.js').pipe(gulp.dest(appObj.buildDir('/scripts')));

        var assets = appObj.assets.getVendors();
        var vendorsPipes = [];
        if (_.has(assets, 'Js')) {
            var jsFiles = getAssets(appObj, 'Js');
            if (!$.webinyBuild.vendorAssetsChanged(appObj, jsFiles, 'Js')) {
                utils.info('Skipping vendor scripts (' + notModified + ')');
                // We need this pipe to update meta.json even though no JS processing is done
                vendorsPipes.push(gulp.src(jsFiles).pipe($.concat('__MARK__/scripts/vendors.js')).pipe($.webinyBuild.add(appObj)));
            } else {
                vendorsPipes.push(
                    gulp.src(jsFiles)
                        .pipe($.duration('vendor scripts'))
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
                        .pipe($.concat('vendors.js'))
                        .pipe(jsRev())
                        .pipe(gulp.dest(appObj.buildDir('/scripts')))
                        .pipe($.webinyBuild.add(appObj))
                        .pipe(jsFilter.restore())
                );
            }
        }

        if (_.has(assets, 'Styles')) {
            var styleFiles = getAssets(appObj, 'Styles', false);
            if (!$.webinyBuild.vendorAssetsChanged(appObj, styleFiles, 'Styles')) {
                utils.info('Skipping vendor styles (' + notModified + ')');
                // We need this pipe to update meta.json even though no styles processing is done
                vendorsPipes.push(gulp.src(styleFiles).pipe($.concat('__MARK__/css/vendors.css')).pipe($.webinyBuild.add(appObj)));
            } else {
                vendorsPipes.push(
                    getAssets(appObj, 'Styles', true)
                        .pipe($.duration('vendor styles'))
                        .pipe(lessFilter)
                        .pipe($.sourcemaps.init())
                        .pipe($.less())
                        .pipe(lessFilter.restore())
                        .pipe(scssFilter)
                        .pipe($.sass().on('error', $.sass.logError))
                        .pipe(scssFilter.restore())
                        .pipe(cssFilter)
                        .pipe($.replaceTask({
                            patterns: appObj.assets.getStylesReplacements(),
                            usePrefix: false
                        }))
                        .pipe($.concat('vendors.css'))
                        .pipe(cleanCss())
                        .pipe(cssRev())
                        .pipe($.sourcemaps.write())
                        .pipe(gulp.dest(appObj.buildDir('/css')))
                        .pipe($.webinyBuild.add(appObj))
                        .pipe(cssFilter.restore())
                );
            }
        }

        if (_.has(assets, 'Fonts')) {
            var fontFiles = getAssets(appObj, 'Fonts');
            if (!$.webinyBuild.vendorAssetsChanged(appObj, fontFiles, 'Fonts')) {
                utils.info('Skipping vendor fonts (' + notModified + ')');
            } else {
                vendorsPipes.push(
                    gulp.src(getAssets(appObj, 'Fonts'))
                        .pipe($.duration('vendor fonts'))
                        .pipe(fontFilter)
                        .pipe(gulp.dest(appObj.buildDir('/fonts')))
                        .pipe(fontFilter.restore())
                );
            }
        }

        if (_.has(assets, 'Images')) {
            var imageFiles = getAssets(appObj, 'Images');
            if (!$.webinyBuild.vendorAssetsChanged(appObj, imageFiles, 'Images')) {
                utils.info('Skipping vendor fonts (' + notModified + ')');
            } else {
                vendorsPipes.push(
                    gulp.src(imageFiles)
                        .pipe($.duration('vendor images'))
                        .pipe(imageFilter)
                        .pipe(through.obj(function (file, encoding, callback) {
                            var imagePath = file.path;
                            // We only handle vendor images from bower or npm
                            if (imagePath.indexOf('/node_modules/') > -1) {
                                imagePath = imagePath.split('/node_modules/').pop();
                            } else if (imagePath.indexOf('/bower_components/') > -1) {
                                imagePath = imagePath.split('/bower_components/').pop();
                            } else {
                                // All other images are ignored
                                return callback();
                            }
                            // copy image to /images folder starting from package manager root folder
                            utils.copy(file.path, utils.projectRoot(appObj.buildDir('/images/' + imagePath)));
                            callback();
                        }).on('data', _.noop))
                );
            }
        }

        return $.es.concat.apply(null, vendorsPipes);
    };

    pipes.buildStyles = function (appObj) {
        return gulp.src(config.paths.styles(appObj))
            .pipe($.duration('app styles'))
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
            .pipe($.webinyBuild.add(appObj));
    };

    pipes.buildFonts = function (appObj) {
        return gulp.src(config.paths.fonts(appObj.sourceDir))
            .pipe($.duration('app fonts'))
            .pipe($.flatten())
            .pipe(gulp.dest(appObj.buildDir('/fonts')));
    };

    pipes.buildImages = function (appObj) {
        return gulp.src(config.paths.images(appObj.sourceDir))
            .pipe($.duration('app images'))
            .pipe(gulp.dest(appObj.buildDir('/images/')));
    };

    pipes.buildOther = function (appObj) {
        return gulp.src(config.paths.other(appObj))
            .pipe($.duration('other app files'))
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

    pipes.buildApp = function (appObj) {
        try {
            $.webinyBuild.app(appObj);
            return new Promise(function (resolve) {
                buildJsApp(appObj).then(function () {
                    $.webinyBuild.write(appObj, resolve);
                });
            });
        } catch (err) {
            utils.failure('Failed to build ' + appObj.name);
            utils.log(err.message);
        }
    };

    function buildJsApp(appObj) {
        var appPipes = [
            pipes.buildVendorScripts,
            pipes.buildAppScripts,
            pipes.buildStyles,
            pipes.buildImages,
            pipes.buildFonts,
            pipes.buildOther
        ];

        return appPipes.reduce(function (sequence, pipe) {
            return sequence.then(function () {
                return new Promise(function (resolve) {
                    pipe(appObj).on('end', resolve);
                });
            })
        }, Promise.resolve()).catch(function (e) {
            utils.failure("\n" + e.message);
        });
    }

    return pipes;
};