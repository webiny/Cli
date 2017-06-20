class Plugin {
    constructor(program) {
        this.task = null;
        this.selectApps = true;
    }

    getTask() {
        return this.task;
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
}

module.exports = Plugin;