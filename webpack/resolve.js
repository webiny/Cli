const path = require('path');
const utils = require('../lib/utils');

module.exports = (app) => {
    const aliases = {
        'Webiny': utils.projectRoot('Apps/Core/Js/Webiny/Webiny')
    };

    // Add an alias to Core (must always be available)
    aliases['Core'] = path.resolve(utils.projectRoot(), 'Apps/Core/Js');
    // Add an alias for the app being built so we can easily point to the desired folders
    aliases[app.rootAppName] = path.resolve(utils.projectRoot(), 'Apps', app.rootAppName, 'Js');

    return {
        alias: aliases,
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