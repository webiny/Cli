const inquirer = require('inquirer');
const _ = require('lodash');

class Develop {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        const Develop = require('./../scripts/develop');
        const develop = new Develop(this.Webiny, this.config);
        return develop.run();
    }
}

module.exports = Develop;