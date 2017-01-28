const path = require('path');
const webpack = require('webpack');
const utils = require('../lib/utils');

module.exports = function (app) {
    const name = app.name;
    const bundleName = app.name.replace('.', '_');
    const context = utils.projectRoot(app.sourceFolder);
    const outputPath = path.resolve(utils.projectRoot(), 'public_html/build/' + process.env.NODE_ENV, app.path);

    let externals = {
        'react': 'React',
        'react-dom': 'ReactDOM',
        'jquery': '$',
        'lodash': '_'
    };

    const plugins = [
        new webpack.DefinePlugin({
            'process.env':{
                'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            }
        }),
        new webpack.DllPlugin({
            path: outputPath + '/[name].manifest.json',
            name: 'Webiny_' + bundleName + '_Vendor'
        })
    ];

    if (process.env.NODE_ENV === 'production') {
        plugins.push(
            new webpack.optimize.UglifyJsPlugin()
        );
    }

    if (app.name == 'Core.Webiny') {
        externals = {};
    }

    return {
        name: app.name,
        context,
        entry: {},
        output: {
            path: outputPath,
            filename: '[name].js',
            library: 'Webiny_' + bundleName + '_Vendor'
        },
        plugins: plugins,
        externals: externals,
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader',
                    options: {
                        "presets": [
                            ["es2015", {"modules": false}],
                            "stage-0",
                            "react"
                        ]
                    }
                }
            ]
        },
        resolve: {
            modules: [
                path.resolve(utils.projectRoot(), app.sourceFolder, './Assets/node_modules/'),
                path.resolve(utils.projectRoot(), app.sourceFolder)
            ]
        }
    };
};