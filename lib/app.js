const _ = require('lodash');

class App {
    constructor(app, jsApp, sourceDir) {
        this.app = app;
        this.jsApp = jsApp;
        this.sourceDir = sourceDir;
    }

    getName() {
        return this.app + '.' + this.jsApp;
    }

    getAppName() {
        return this.app;
    }

    getPath() {
        return this.app + '_' + this.jsApp;
    }

    getSourceDir() {
        return this.sourceDir;
    }
}

module.exports = App;