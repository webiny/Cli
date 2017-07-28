#! /usr/bin/env node
const program = require('commander');
const _ = require('lodash');
const chalk = require('chalk');
const checkUpdates = require('./lib/boot/checkUpdates');
const setup = require('./lib/boot/setup');
const Menu = require('./lib/navigation');
const Webiny = require('./lib/webiny');

class WebinyCli {
    constructor() {
        this.version = JSON.parse(Webiny.readFile(__dirname + '/package.json')).version;

        program
            .version(this.version)
            .description([
                'Webiny CLI tool will help you manage your project from development to deployment.',
                'It supports plugins so you are welcome to develop new plugins for your project and connect to the existing plugins using hooks.',
                'Run without arguments to enter GUI mode.',
                '',
                'Visit https://www.webiny.com/ for tutorials and documentarion.'
            ].join('\n  '))
            .option('--show-timestamps [format]', 'Show timestamps next to each console message');

        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        process.stdin.write('Loading plugins...');
        Webiny.getPlugins();
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
    }

    run() {
        program.parse(process.argv);

        if (program.showTimestamps) {
            require('console-stamp')(console, _.isString(program.showTimestamps) ? program.showTimestamps : 'HH:MM:ss.l');
        }

        if (program.args.length === 0) {
            checkUpdates(this.version).then(() => {
                Webiny.log('---------------------------------------------');
                Webiny.info('Webiny CLI ' + chalk.cyan('v' + this.version));
                Webiny.log('---------------------------------------------');
                const checkRequirements = require('./lib/boot/checkRequirements');
                if (!checkRequirements.firstRun()) {
                    const menu = new Menu();
                    return menu.render();
                }

                try {
                    // First run will check the system requirements and setup the platform
                    Webiny.log('Checking requirements...');
                    checkRequirements.requirements();
                    Webiny.success("Great, all the requirements are in order!");
                    Webiny.log("\nSetting up the platform...");
                    setup().then(answers => {
                        Webiny.log(`\n-------------------------------------`);
                        Webiny.success('Platform setup is now completed!');
                        Webiny.info(`You are now ready to run your first development build! Select "Develop!" from the menu and hit ENTER.\nAfter the development build is completed, navigate to ` + chalk.magenta(answers.domain + '/admin') + ` to see your brand new administration system!`);
                        Webiny.log('-------------------------------------');
                        const menu = new Menu();
                        menu.render();
                    });
                } catch (err) {
                    Webiny.exclamation('Setup failed with the following problem:', err);
                    process.exit(1);
                }
            });
        }
    }
}

module.exports = WebinyCli;