#! /usr/local/bin/node
const program = require('commander');
const fs = require('fs-extra');
const _ = require('lodash');
const chalk = require('chalk');
const moment = require('moment');
const checkUpdates = require('./lib/boot/checkUpdates');
const setup = require('./lib/boot/setup');
const Menu = require('./lib/menu');
const Webiny = require('./lib/webiny');

class WebinyCli {
    constructor() {
        this.version = JSON.parse(Webiny.readFile(__dirname + '/package.json')).version;
        this.webinyConfig = null;

        program
            .version(this.version)
            .arguments('<cmd>')
            .option('-t, --task [name]', 'Task to execute (renders menu if not specified).', 'menu')
            .option('-a, --app [name]', 'App to execute task on (specify multiple times for multiple apps).', this.collectApps, [])
            .option('--all', 'Select all apps.')
            .action(function (cmd = 'menu') {
                program.task = cmd;
            });

        this.plugins = Webiny.getPlugins().map(plClass => new plClass(program));

        program.parse(process.argv);
    }

    collectApps(val, collection) {
        collection.push(val);
        return collection;
    }

    run() {
        if (program.task === 'menu') {
            checkUpdates(this.version).then(() => {
                Webiny.log('---------------------------------------------');
                Webiny.info('Webiny CLI ' + chalk.cyan('v' + this.version));
                Webiny.log('---------------------------------------------');
                const checkRequirements = require('./lib/boot/checkRequirements');
                if (!checkRequirements.firstRun()) {
                    this.menu = new Menu(this.plugins);
                    return this.renderMenu();
                }

                // First run will check the system requirements and setup the platform
                try {
                    Webiny.log('Checking requirements...');
                    checkRequirements.requirements();
                    Webiny.success("Great, all the requirements are in order!");
                    Webiny.log("\nSetting up the platform...");
                    setup(() => {
                        Webiny.log('-------------------------------------');
                        Webiny.success('Platform setup is now completed!');
                        Webiny.info(`You are now ready to run your first development build! Select "Develop!" from the menu and hit ENTER.`);
                        Webiny.log('-------------------------------------');
                        const plugins = Webiny.getPlugins(true).map(plClass => new plClass(program));
                        this.menu = new Menu(plugins);
                        return this.renderMenu();
                    });
                } catch (err) {
                    Webiny.exclamation(err.message);
                    process.exit(1);
                }
            });
        } else {
            const apps = Webiny.getApps();
            const plugins = Webiny.getPlugins().map(plClass => new plClass(program));
            const plugin = _.find(plugins, pl => pl.getTask() === program.task);
            program.apps = program.all ? apps : _.filter(apps, a => program.app.indexOf(a.getName()) > -1);

            plugin.runTask(program);
        }
    }

    renderMenu() {
        return this.menu.render();
    }
}

module.exports = WebinyCli;