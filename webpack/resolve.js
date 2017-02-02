const path = require('path');
const utils = require('../lib/utils');

module.exports = (app) => {
    return {
        alias: {
            Webiny: utils.projectRoot('Apps/Core/Js/Webiny/Webiny')
        },
        extensions: ['.jsx', '.js', '.css', '.scss'],
        modules: [
            // We can resolve using app root (eg: Apps/YourApp/node_modules)
            path.resolve(utils.projectRoot(), 'Apps', app.rootAppName, 'node_modules'),
            // We can resolve using JS app root (eg: Apps/YourApp/Js/Backend)
            path.resolve(utils.projectRoot(), app.sourceFolder),
            // We can resolve using Core.Webiny (which is the core of the system)
            path.resolve(utils.projectRoot(), 'Apps/Core/node_modules'),
            // We can resolve using our project root
            path.resolve(utils.projectRoot(), './node_modules')
        ]
    }
};