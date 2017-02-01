#! /usr/local/bin/node
const program = require('commander');
const fs = require('fs-extra');
const _ = require('lodash');
const utils = require('./lib/utils');
const chalk = require('chalk');
const moment = require('moment');
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
            .option('-t, --task [name]', 'Task to execute (renders menu if not specified).', 'menu')
            .option('-a, --app [name]', 'App to execute task on (specify multiple times for multiple apps).', this.collectApps, [])
            .option('--all', 'Select all apps.')
            .option('-h, --host [host]', 'Connection string for your target server.')
            .option('-w --website [website]', 'Target server domain.') // https://github.com/tj/commander.js/issues/370
            .option('-b, --basic-auth [basicAuth]', 'Basic Authentication string for your target server.')
            .option('-r, --release [release]', 'Location of release archive to use. Can be an absolute path or a path relative to project root.')
            .action(function (cmd = 'menu') {
                program.task = cmd;
            });

        program.parse(process.argv);
    }

    collectApps(val, collection) {
        collection.push(val);
        return collection;
    }

    run() {
        if (program.task === 'menu') {
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
                    setup(() => {
                        utils.log('-------------------------------------');
                        utils.success('Platform setup is now completed!');
                        utils.info(`If you ran the setup process on a VM, now is the time to exit the VM console and run webiny on your host machine, 
                        otherwise you will have to setup port forwarding to get your browser requests to the development server.`);
                        utils.log('-------------------------------------');
                    });
                } catch (err) {
                    utils.exclamation(err.message);
                    process.exit(1);
                }
            });
        } else {
            switch (program.task) {
                case 'develop':
                    process.env.NODE_ENV = 'development';
                    const config = {
                        apps: program.all ? this.getApps() : _.filter(this.getApps(), a => program.app.indexOf(a.name) > -1)
                    };

                    const Develop = require('./lib/scripts/develop');
                    const develop = new Develop(this, config);
                    develop.run();
                    break;
                case 'build':
                    process.env.NODE_ENV = 'production';
                    const buildConfig = {
                        apps: program.all ? this.getApps() : _.filter(this.getApps(), a => program.app.indexOf(a.name) > -1)
                    };

                    const Build = require('./lib/scripts/build');
                    const build = new Build(this, buildConfig);
                    build.run();
                    break;
                case 'server-help':
                    const ServerHelp = require('./lib/scripts/serverHelp');
                    const serverHelp = new ServerHelp(this);
                    serverHelp.run();
                    break;
                case 'deploy':
                    const deployConfig = _.pick(program, ['host', 'basicAuth', 'release', 'website']);
                    deployConfig['domain'] = program.website;
                    const Deploy = require('./lib/scripts/deploy');
                    const deploy = new Deploy(this, deployConfig);
                    deploy.run();
                    break;
                case 'revert':
                    const revertConfig = _.pick(program, ['host', 'basicAuth', 'release', 'website']);
                    revertConfig['domain'] = program.website;
                    const Revert = require('./lib/scripts/revert');
                    const revert = new Revert(this, revertConfig);
                    revert.run();
                    break;
                case 'release':
                    const releaseConfig = {
                        release: program.release || 'releases/release-' + moment().format('YYYYMMDD-HHmmss') + '.zip'
                    };
                    const Release = require('./lib/scripts/release');
                    const release = new Release(this, releaseConfig);
                    release.run();
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
        this.lastRun = log;
    }

    renderMenu() {
        return this.menu.render();
    }
}

module.exports = Webiny;