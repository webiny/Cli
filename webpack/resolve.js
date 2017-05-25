const path = require('path');
const utils = require('../lib/utils');

module.exports = (app) => {
    const aliases = {
        'Webiny/Core': path.resolve(utils.projectRoot(), 'Apps/Webiny/Js/Core'),
        'Webiny/Backend': path.resolve(utils.projectRoot(), 'Apps/Webiny/Js/Backend'),
        'Webiny/Skeleton': path.resolve(utils.projectRoot(), 'Apps/Webiny/Js/Skeleton'),
        'Webiny': path.resolve(utils.projectRoot(), 'Apps/Webiny/Js/Core/Webiny.js')
    };

    // Add an alias for the app being built so we can easily point to the desired folders
    if (app.rootAppName !== 'Webiny') {
        aliases[app.rootAppName] = path.resolve(utils.projectRoot(), 'Apps', app.rootAppName, 'Js');
    }

    return {
        alias: aliases,
        extensions: ['.jsx', '.js', '.css', '.scss'],
        modules: [
            // We can resolve using app root (eg: Apps/YourApp/node_modules)
            path.resolve(utils.projectRoot(), 'Apps', app.rootAppName, 'node_modules'),
            // We can resolve using JS app root (eg: Apps/YourApp/Js/Backend)
            path.resolve(utils.projectRoot(), app.sourceFolder),
            // We can resolve using Webiny.Core (which is the core of the system)
            path.resolve(utils.projectRoot(), 'Apps/Webiny/node_modules'),
            // We can resolve using our project root
            path.resolve(utils.projectRoot(), './node_modules')
        ]
    }
};