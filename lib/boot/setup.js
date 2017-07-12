const Webiny = require('./../webiny');

module.exports = function () {
    return new Promise(resolve => {
        // Create project structure
        const composer = {
            "require": {
                "webiny/webiny": "dev-master"
            },
            "minimum-stability": "dev",
            "prefer-stable": true
        };

        Webiny.writeFile(Webiny.projectRoot('composer.json'), JSON.stringify(composer, null, 4));
        Webiny.log('Running composer to install PHP dependencies...');
        Webiny.shellExecute('composer install');
        Webiny.success('Composer installation completed!');

        Webiny.log('Installing JS dependencies...');
        Webiny.shellExecute('cd ' + Webiny.projectRoot('Apps/Webiny') + ' && yarn install');

        Webiny.copy(Webiny.projectRoot('Apps/Webiny/Setup/.'), Webiny.projectRoot());

        return Webiny.getPlugins(true)['setup'].runWizard({}, resolve);
    });
};