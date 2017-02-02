const path = require('path');
const webpack = require('webpack');
const chalk = require('chalk');
const utils = require('./../lib/utils');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const AssetsPlugin = require('./assets.plugin');
let externals = require('./externals');

module.exports = function (app) {
    const sharedResolve = require('./resolve')(app);
    const name = app.name;
    const context = utils.projectRoot(app.sourceFolder);
    const outputPath = path.resolve(utils.projectRoot(), 'public_html/build/production', app.path);

    let plugins = [
        new webpack.DefinePlugin({
            'DEVELOPMENT': false,
            'PRODUCTION': true,
            'process.env': {
                'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            }
        }),
        new ExtractTextPlugin('app-[hash].css'),
        new AssetsPlugin(),
        new webpack.optimize.UglifyJsPlugin({mangle: false, sourceMap: false}),
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
            filename: '[name]-[hash].js',
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
                                    ['transform-object-rest-spread', {'useBuiltIns': true}],
                                    ['babel-plugin-transform-builtin-extend', {
                                        globals: ['Error']
                                    }]
                                ]
                            }
                        }
                    ]
                },
                {
                    test: /\.woff2?$|\.ttf$|\.eot$|\.svg$/,
                    loader: 'file-loader',
                    options: {
                        name: '[path][name]-[hash].[ext]'
                    }
                },
                {
                    test: /\.scss$/,
                    loader: ExtractTextPlugin.extract({
                        fallbackLoader: 'style-loader',
                        loader: ['css-loader', 'resolve-url-loader', 'sass-loader?sourceMap']
                    })
                },
                {
                    test: /\.css$/,
                    loader: ExtractTextPlugin.extract({
                        fallbackLoader: 'style-loader',
                        loader: 'css-loader'
                    })
                },
                {
                    test: /\.(png|jpg|gif|jpeg)$/,
                    loader: 'file-loader',
                    options: {
                        name: '[path][name]-[hash].[ext]'
                    }
                },
                {
                    test: /\.(mp4|mp3)$/,
                    loader: 'file-loader',
                    options: {
                        name: '[path][name]-[hash].[ext]'
                    }
                }
            ]
        },
        resolve: sharedResolve,
        resolveLoader: {
            modules: ['webpack/loaders', 'node_modules']
        }
    };
};
 