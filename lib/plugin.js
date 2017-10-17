function collectApps(val, collection) {
    collection.push(val);
    return collection;
}

class Plugin {
    constructor(program) {
        this.selectApps = false;
    }

    getMenu() {
        return null;
    }

    getSelectApps() {
        return this.selectApps;
    }

    addAppOptions(command) {
        command.option('-a, --app [name]', 'App to execute task on (specify multiple times for multiple apps).', collectApps, []);
        command.option('--all', 'Select all apps.')
    }

    runTask(config) {
        // Override to implement
    }

    runWizard(config) {
        return this.runTask(config);
    }
}

module.exports = Plugin;