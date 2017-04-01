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
        new ExtractTextPlugin('app-[contenthash].css'),
        new AssetsPlugin(),
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
                        }
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
                            localIdentName: '[name]__[local]___[hash:base64:5]'
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
                // This is for rare occasions when we need to include a path to file in TPL template
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
 