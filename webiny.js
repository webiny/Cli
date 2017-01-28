#! /usr/local/bin/node
const program = require('commander');
const fs = require('fs-extra');
const _ = require('lodash');
const utils = require('./lib/utils');
const chalk = require('chalk');
const checkUpdates = require('./lib/scripts/checkUpdates');
const setup = require('./lib/wizards/setup');
const Menu = require('./lib/menu');
const webiny = require('./lib/webiny');

class Webiny {
    constructor() {
        this.version = JSON.parse(utils.readFile(__dirname + '/package.json')).version;
        this.apps = [];
        this.lastRun = null;

        program
            .version(this.version)
            .arguments('<cmd>')
            .option('-p, --production', 'Production mode')
            .option('-t, --task [name]', 'Task to execute (renders menu if not specified)', 'menu')
            .option('-a, --app [name]', 'App to execute task on (specify multiple times for multiple apps)', this.collectApps, [])
            .option('--domain [domain]', 'Target domain')
            .option('--build-vendors', 'Build vendors')
            .option('--server [server]', 'Target server')
            .option('--folder [folder]', 'Target folder')
            .action(function (cmd = 'menu') {
                program.task = cmd;
            });

        program.parse(process.argv);

        if (program.production) {
            //program.buildVendors = true;
        }

        if (program.task === 'develop' && program.production) {
            program.production = false;
        }

        process.env.NODE_ENV = program.production ? 'production' : 'development';
    }

    collectApps(val, collection) {
        collection.push(val);
        return collection;
    }

    run() {
        if (program.task === 'menu') {
            const config = {};
            checkUpdates(this.version).then(() => {
                utils.log('---------------------------------------------');
                utils.info('Webiny CLI ' + chalk.cyan('v' + this.version));
                utils.log('---------------------------------------------');
                const checkRequirements = require('./lib/scripts/checkRequirements');
                if (!checkRequirements.firstRun()) {
                    this.menu = new Menu(this);
                    return this.renderMenu();
                }

                // First run will check the system requirements and setup the platform
                try {
                    utils.log('Checking requirements...');
                    checkRequirements.requirements();
                    utils.success("Great, all the requirements are in order!");
                    utils.log("\nSetting up the platform...");
                    setup(answers => {
                        utils.log('-------------------------------------');
                        utils.success('Platform setup is now completed!');
                        utils.log('-------------------------------------');
                        utils.info('\nRunning your first development build to get you ready for development...');
                        // Run first build
                        const runner = require('./lib/runner');
                        const webiny = require('./lib/webiny')();

                        config.production = process.env.production = false;
                        config.buildDir = utils.projectRoot('public_html/build/development');
                        config.apps = webiny.getApps();
                    });
                } catch (err) {
                    utils.exclamation(err.message);
                    process.exit(1);
                }
            });
        } else {
            switch (program.task) {
                case 'develop':
                    const config = {
                        buildVendors: program.buildVendors,
                        apps: _.filter(this.getApps(), a => program.app.indexOf(a.name) > -1)
                    };

                    const Develop = require('./lib/scripts/develop');
                    const develop = new Develop(this, config);
                    develop.run();
                    break;
                case 'build':
                    const buildConfig = {
                        buildVendors: program.buildVendors,
                        apps: _.filter(this.getApps(), a => program.app.indexOf(a.name) > -1)
                    };

                    // Remove all files from build folder
                    buildConfig.apps.map(app => {
                        fs.removeSync(utils.projectRoot('public_html') + '/build/' + process.env.NODE_ENV + '/' + app.path);
                    });

                    const Build = require('./lib/scripts/build');
                    const build = new Build(this, buildConfig);
                    build.run();
                    break;
                default:
                    process.exit(1);
            }
        }
    }

    getApps() {
        if (!this.apps.length) {
            this.apps = webiny.getApps();
        }
        return this.apps;
    }

    getRunLog() {
        if (this.lastRun) {
            return this.lastRun;
        }

        try {
            this.lastRun = JSON.parse(utils.readFile(utils.projectRoot('webiny.json')));
        } catch (e) {
            this.lastRun = {
                apps: [],
                host: ''
            };
        }
        return this.lastRun;
    }

    saveRunLog(log) {
        utils.writeFile(utils.projectRoot('webiny.json'), JSON.stringify(log));
    }

    renderMenu() {
        return this.menu.render();
    }
}

module.exports = Webiny;