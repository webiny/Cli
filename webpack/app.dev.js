/**
 === NOTES ===
 - in development mode your bundles will be significantly larger in size due to hot-reload code being appended to them
 */

const path = require('path');
const webpack = require('webpack');
const chalk = require('chalk');
const utils = require('./../lib/utils');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const AssetsPlugin = require('./assets.plugin');
const Visualizer = require('webpack-visualizer-plugin');
let externals = require('./externals');

module.exports = function (app) {
    const sharedResolve = require('./resolve')(app);
    const name = app.name;
    const context = utils.projectRoot(app.sourceFolder);
    const outputPath = path.resolve(utils.projectRoot(), 'public_html/build/development', app.path);


    const plugins = [
        new webpack.DefinePlugin({
            'DEVELOPMENT': true,
            'PRODUCTION': false,
            'process.env': {
                'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            }
        }),
        new webpack.HotModuleReplacementPlugin(),
        new ExtractTextPlugin('app.css'),
        new AssetsPlugin(),
        new Visualizer({filename: 'stats.html'})
    ];

    // Check if app has vendor DLL defined
    const dllPath = path.resolve(utils.projectRoot(), 'public_html/build/development', app.path, 'vendor.manifest.json');
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
                manifest: utils.projectRoot('public_html/build/development') + '/Core_Webiny/vendor.manifest.json'
            })
        );
    }

    const fileExtensionRegex = /\.(png|jpg|gif|jpeg|mp4|mp3|woff2?|ttf|otf|eot|svg|ico)$/;

    return {
        name: name,
        cache: true,
        watch: false,
        context,
        entry: {
            app: [
                'react-hot-loader/patch',
                'webpack-hot-middleware/client?name=' + name + '&path=http://localhost:3000/__webpack_hmr&quiet=true&overlay=false&reload=false',
                'webpack/hot/only-dev-server',
                './App.js'
            ]
        },
        output: {
            path: outputPath,
            filename: '[name].js',
            publicPath: 'http://localhost:3000/build/development/' + app.path + '/'
        },
        externals: name === 'Core.Webiny' ? {} : externals,
        plugins: plugins,
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
                                "presets": [
                                    "es2015",
                                    "react"
                                ],
                                "plugins": [
                                    "react-hot-loader/babel",
                                    ["transform-object-rest-spread", {"useBuiltIns": true}],
                                    ["babel-plugin-transform-builtin-extend", {
                                        globals: ["Error"]
                                    }]
                                ]
                            }
                        },
                        'hot-accept-loader'
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
                    use: ExtractTextPlugin.extract({
                        fallback: 'style-loader',
                        use: ['css-loader']
                    })
                },
                {
                    test: /node_modules/,
                    include: fileExtensionRegex,
                    loader: 'file-loader',
                    options: {
                        context: path.resolve(utils.projectRoot(), 'Apps', app.rootAppName, 'node_modules'),
                        name: 'external/[path][name].[ext]'
                    }
                },
                {
                    test: fileExtensionRegex,
                    exclude: /node_modules/,
                    loader: 'file-loader',
                    options: {
                        context: path.resolve(utils.projectRoot(), app.sourceFolder, 'Assets'),
                        name: '[path][name].[ext]'
                    }
                }
            ]
        },
        resolve: sharedResolve,
        resolveLoader: {
            modules: [__dirname + '/loaders', 'node_modules']
        }
    }
};
 