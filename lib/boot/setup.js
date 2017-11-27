const Webiny = require('./../webiny');

// Create project structure
const composer = {
    "require": {
        "webiny/webiny": "~1"
    },
    "minimum-stability": "dev",
    "prefer-stable": true
};

module.exports = (interactive = true, config = {}) => {
    Webiny.writeFile(Webiny.projectRoot('composer.json'), JSON.stringify(composer, null, 4));
    Webiny.execSync('composer install 2>&1');

    Webiny.log('Installing JS dependencies...');
    let yarnCmd = 'yarn install --no-bin-links';
    if (!interactive) {
        yarnCmd += ' > /dev/null 2>&1';
    }
    Webiny.execSync('cd ' + Webiny.projectRoot('Apps/Webiny') + ` && ${yarnCmd}`);
    Webiny.copy(Webiny.projectRoot('Apps/Webiny/Setup/.'), Webiny.projectRoot());
    if (!interactive) {
        const plugins = Webiny.getPlugins(true);
        return plugins['setup'].runTask(config);
    }
    return Webiny.getPlugins(true)['setup'].runWizard();
};
