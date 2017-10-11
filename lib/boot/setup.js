const Webiny = require('./../webiny');

// Create project structure
const composer = {
    "require": {
        "webiny/webiny": "dev-installer"
    },
    "minimum-stability": "dev",
    "prefer-stable": true
};

module.exports = (interactive = true, config = {}) => {
    Webiny.writeFile(Webiny.projectRoot('composer.json'), JSON.stringify(composer, null, 4));
    Webiny.shellExecute('composer install');

    Webiny.log('Installing JS dependencies...');
    Webiny.shellExecute('cd ' + Webiny.projectRoot('Apps/Webiny') + ' && yarn install --no-bin-links');
    Webiny.copy(Webiny.projectRoot('Apps/Webiny/Setup/.'), Webiny.projectRoot());
    if (!interactive) {
        const plugins = Webiny.getPlugins(true);
        return plugins['setup'].runTask(config);
    }
    return Webiny.getPlugins(true)['setup'].runWizard();
};
