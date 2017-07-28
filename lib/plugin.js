function collectApps(val, collection) {
    collection.push(val);
    return collection;
}

class Plugin {
    constructor(program) {
        this.selectApps = true;
    }

    getMenu() {
        return null;
    }

    getSelectApps() {
        return this.selectApps;
    }

    addAppOptions(command) {
        command.option('-a, --app [name]', 'App to execute task on (specify multiple times for multiple apps).', collectApps, [])
        command.option('--all', 'Select all apps.')
    }

    runTask(config, onFinish) {
        // Override to implement
    }

    runWizard(config, onFinish) {
        return this.runTask(config, onFinish);
    }

    processHook(hook, params) {
        const Webiny = require('webiny-cli/lib/webiny');
        let chain = Promise.resolve(params);
        Webiny.getHooks(hook).map(script => {
            chain = chain.then(() => Promise.resolve(require(script)(params)));
        });
        return chain;
    }
}

module.exports = Plugin;