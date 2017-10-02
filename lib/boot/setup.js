const Webiny = require('webiny-cli/lib/webiny');

// Create project structure
const composer = {
    "require": {
        "webiny/webiny": "dev-master"
    },
    "minimum-stability": "dev",
    "prefer-stable": true
};

module.exports = (env) => {
    Webiny.writeFile(Webiny.projectRoot('composer.json'), JSON.stringify(composer, null, 4));
    if (env === 'docker') {
        const homeDir = require('os').homedir();
        Webiny.shellExecute('docker run --rm --interactive --tty -v ' + Webiny.projectRoot() + ':/app -v ' + homeDir + '/.composer/cache:/tmp composer install --ignore-platform-reqs --no-scripts');
    } else {
        Webiny.shellExecute('composer install');
    }

    Webiny.log('Installing JS dependencies...');
    Webiny.shellExecute('cd ' + Webiny.projectRoot('Apps/Webiny') + ' && yarn install');
    Webiny.copy(Webiny.projectRoot('Apps/Webiny/Setup/.'), Webiny.projectRoot());
    return Webiny.getPlugins(true)['setup'].runWizard({env});
};
