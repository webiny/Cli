const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackChunkHash = require('webpack-chunk-hash');

// Custom libs
const AssetsPlugin = require('./plugins/Assets');
const i18nPlugin = require('./plugins/i18n');
const ChunkIdsPlugin = require('./plugins/ChunkIds');
const utils = require('./../lib/utils');
let externals = require('./externals');

module.exports = function (app) {
    const sharedResolve = require('./resolve')(app);
    const name = app.name;
    const context = utils.projectRoot(app.sourceFolder);
    const outputPath = path.resolve(utils.projectRoot(), 'public_html/build/production', app.path);

    const i18nPluginInstance = new i18nPlugin();
    let plugins = [
        // Generate custom chunk ids and names
        new ChunkIdsPlugin(),
        // Define environment and other constants
        new webpack.DefinePlugin({
            'DEVELOPMENT': false,
            'PRODUCTION': true,
            'process.env': {
                'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            }
        }),
        // To generate module ids that are preserved between builds
        new webpack.HashedModuleIdsPlugin(),
        // This is required to base the file hashes on file contents (to allow long term caching)
        new WebpackChunkHash(),
        new ExtractTextPlugin('app-[contenthash].css'),
        // Parse i18n strings and generate external file with translations
        i18nPluginInstance,
        // Generate meta.json to use for app bootstrap based on generated assets
        new AssetsPlugin({
            manifestVariable: 'window["webinyMeta"]["' + name + '"].chunks'
        }),
        new webpack.optimize.UglifyJsPlugin({mangle: true, sourceMap: false}),
        new webpack.optimize.OccurrenceOrderPlugin()
    ];

    // Check if app has vendor DLL defined
    const dllPath = path.resolve(utils.projectRoot(), 'public_html/build/production', app.path, 'vendor.manifest.json');
    if (utils.fileExists(dllPath)) {
        plugins.push(
            new webpack.DllReferencePlugin({
                context,
                manifest: require(dllPath)
            })
        );
    }

    if (name !== 'Core.Webiny') {
        plugins.push(
            new webpack.DllReferencePlugin({
                context: utils.projectRoot('Apps/Core/Js/Webiny'),
                manifest: utils.projectRoot('public_html/build/production') + '/Core_Webiny/vendor.manifest.json'
            })
        );
    }

    const fileExtensionRegex = /\.(png|jpg|gif|jpeg|mp4|mp3|woff2?|ttf|otf|eot|svg|ico)$/;

    return {
        name: name,
        cache: true,
        watch: false,
        devtool: 'cheap-module-source-map',
        context,
        entry: {
            app: ['./App.js']
        },
        output: {
            path: outputPath,
            filename: '[name]-[chunkhash].js',
            chunkFilename: 'chunks/[chunkhash].js',
            publicPath: '/build/production/' + app.path + '/'
        },
        externals: name === 'Core.Webiny' ? {} : externals,
        plugins,
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    include: utils.projectRoot(),
                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    'es2015',
                                    'react'
                                ],
                                plugins: [
                                    'transform-async-to-generator',
                                    ['transform-object-rest-spread', {'useBuiltIns': true}],
                                    ['babel-plugin-syntax-dynamic-import'],
                                    ['babel-plugin-transform-builtin-extend', {
                                        globals: ['Error']
                                    }]
                                ]
                            }
                        },
                        i18nPluginInstance.getLoader()
                    ]
                },
                {
                    test: /\.scss$/,
                    use: ExtractTextPlugin.extract({
                        fallback: 'style-loader',
                        use: ['css-loader', 'resolve-url-loader', 'sass-loader?sourceMap']
                    })
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', {
                        loader: 'css-loader',
                        options: {
                            modules: true,
                            localIdentName: app.path + '_[folder]_[local]'
                        }
                    }]
                },
                {
                    test: /node_modules/,
                    include: fileExtensionRegex,
                    loader: 'file-loader',
                    options: {
                        context: path.resolve(utils.projectRoot(), 'Apps', app.rootAppName, 'node_modules'),
                        name: 'external/[path][name]-[hash].[ext]'
                    }
                },
                // Files containing /public/ should not include [hash]
                // This is for rare occasions when we need to include a path to the file in TPL template
                {
                    test: fileExtensionRegex,
                    exclude: /node_modules/,
                    include: /\/public\//,
                    loader: 'file-loader',
                    options: {
                        context: path.resolve(utils.projectRoot(), app.sourceFolder, 'Assets'),
                        name: '[path][name].[ext]'
                    }
                },
                {
                    test: fileExtensionRegex,
                    exclude: [
                        /node_modules/,
                        /\/public\//
                    ],
                    loader: 'file-loader',
                    options: {
                        context: path.resolve(utils.projectRoot(), app.sourceFolder, 'Assets'),
                        name: '[path][name]-[hash].[ext]'
                    }
                }
            ]
        },
        resolve: sharedResolve,
        resolveLoader: {
            modules: [__dirname + '/loaders', 'node_modules']
        }
    };
};
 