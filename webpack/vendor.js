const path = require('path');
const webpack = require('webpack');
const utils = require('../lib/utils');
let externals = require('./externals');

module.exports = function (app) {
    const sharedResolve = require('./resolve')(app);
    const name = app.name;
    const bundleName = app.name.replace('.', '_');
    const context = utils.projectRoot(app.sourceFolder);
    const outputPath = path.resolve(utils.projectRoot(), 'public_html/build/' + process.env.NODE_ENV, app.path);

    const plugins = [
        new webpack.DefinePlugin({
            'DEVELOPMENT': process.env.NODE_ENV === 'development',
            'PRODUCTION': process.env.NODE_ENV === 'production',
            'process.env': {
                'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            }
        }),
        new webpack.DllPlugin({
            path: outputPath + '/[name].manifest.json',
            name: 'Webiny_' + bundleName + '_Vendor'
        }),
        new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)
    ];

    if (process.env.NODE_ENV === 'production') {
        plugins.push(
            new webpack.optimize.UglifyJsPlugin()
        );
    }

    if (app.name === 'Core.Webiny') {
        externals = {};
    }

    return {
        name: app.name,
        context,
        entry: {},
        output: {
            path: outputPath,
            filename: process.env.NODE_ENV === 'production' ? '[name]-[chunkhash].js' : '[name].js',
            library: 'Webiny_' + bundleName + '_Vendor'
        },
        plugins: plugins,
        externals: externals,
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    ['es2015', {modules: false}],
                                    'stage-0',
                                    'react'
                                ]
                            }
                        }
                    ]
                }
            ]
        },
        resolve: sharedResolve
    };
};