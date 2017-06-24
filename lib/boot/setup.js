const Webiny = require('./../webiny');

module.exports = function (program) {
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
        try {
            Webiny.log('Running composer to install PHP dependencies...');
            Webiny.shellExecute('composer install');
            Webiny.success('Composer installation completed!');

            Webiny.log('Installing JS dependencies...');
            Webiny.shellExecute('cd ' + Webiny.projectRoot('Apps/Webiny') + ' && yarn install');

            Webiny.copy(Webiny.projectRoot('Apps/Webiny/Setup/.'), Webiny.projectRoot());

            Webiny.getPlugins(true).map(pluginClass => {
                const plugin = new pluginClass(program);
                if (plugin.getTask() === 'setup') {
                    return plugin.runWizard({}, resolve);
                }
            });
        } catch (err) {
            Webiny.failure('Setup failed with the following error:');
            console.log(err);
            process.exit(1);
        }
    });
};