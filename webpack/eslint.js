const utils = require('../lib/utils');

module.exports = {
    // If this will not be enough we will create eslint-config-webiny package and other apps will extend it.
    // For now let's just work with one core .eslintrc file
    test: /\.(js|jsx)$/,
    exclude: /node_modules/,
    include: utils.projectRoot(),
    enforce: 'pre',
    use: [{
        loader: 'eslint-loader',
        options: {
            configFile: utils.projectRoot('Apps/Webiny/Js/Core/.eslintrc')
        }
    }]
};