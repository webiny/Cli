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

    runTask(config, onFinish) {
        // Override to implement
    }

    runWizard(config, onFinish) {
        return this.runTask(config, onFinish);
    }

    processHook(hook, params) {
        const Webiny = require('webiny/lib/webiny');
        let chain = Promise.resolve(params);
        Webiny.getHooks(hook).map(script => {
            chain = chain.then(() => Promise.resolve(require(script)(params)));
        });
        return chain;
    }
}

module.exports = Plugin;