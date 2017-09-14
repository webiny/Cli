const Webiny = require('./../webiny');

// Create project structure
const composer = {
    "require": {
        "webiny/webiny": "dev-master"
    },
    "minimum-stability": "dev",
    "prefer-stable": true
};

module.exports = function (env = 'default') {
    if (env === 'docker') {
        return new Promise(resolve => {
            // 1. Copy initial composer.json into the root of the project. We do this first, so it's ready for installed docker containers.
            Webiny.writeFile(Webiny.projectRoot('composer.json'), JSON.stringify(composer, null, 4));

            // 2. Let's install all PHP dependencies via 'composer' Docker container
            Webiny.shellExecute('docker run --rm --interactive --tty --volume $PWD:/app composer install --ignore-platform-reqs --no-scripts');

            // 3. Almost there, let's install Webiny JS dependencies
            Webiny.shellExecute('cd ' + Webiny.projectRoot('Apps/Webiny') + ' && yarn install');

            // 4. Copy necessary root folders and files
            Webiny.copy(Webiny.projectRoot('Apps/Webiny/Setup/.'), Webiny.projectRoot());

            return Webiny.getPlugins(true)['setup'].runWizard({env}, resolve);
        });
    }

    // Default installation process
    return new Promise(resolve => {
        Webiny.writeFile(Webiny.projectRoot('composer.json'), JSON.stringify(composer, null, 4));
        Webiny.log('Running composer to install PHP dependencies...');
        Webiny.shellExecute('composer install');
        Webiny.success('Composer installation completed!');

        Webiny.log('Installing JS dependencies...');
        Webiny.shellExecute('cd ' + Webiny.projectRoot('Apps/Webiny') + ' && yarn install');

        Webiny.copy(Webiny.projectRoot('Apps/Webiny/Setup/.'), Webiny.projectRoot());

        return Webiny.getPlugins(true)['setup'].runWizard({env}, resolve);
    });
};