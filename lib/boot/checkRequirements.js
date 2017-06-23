const fs = require('fs-extra');
const chalk = require('chalk');
const Webiny = require('./../webiny');
const _ = require('lodash');

function getOsRequirements() {
    const requirements = {
        satisfied: true,
        deps: {
            php: {
                name: 'PHP 7',
                satisfied: false,
                cmd: 'php -v',
                reqVersion: '7.'
            },
            mongo: {
                name: 'MongoDB',
                satisfied: false,
                cmd: 'mongo --version',
                reqVersion: '3.'
            },
            composer: {
                name: 'Composer',
                satisfied: false,
                cmd: 'composer --version',
                alternateCmd: 'php ' + fs.realpathSync(process.env.PWD) + '/composer.phar --version'
            },
            wkhtmltopdf: {
                name: 'wkhtmltopdf',
                satisfied: false,
                cmd: 'wkhtmltopdf --version'
            },
            yarn: {
                name: 'Yarn',
                satisfied: false,
                cmd: () => {
                    let output, data;
                    // Check if Yarn exists as local module
                    try {
                        output = Webiny.shellExecute('npm ls yarn --json', {stdio: 'pipe'}).toString();
                        data = JSON.parse(output);
                    } catch (err) {
                        if (err.stdout) {
                            data = JSON.parse(err.stdout);
                        }
                    } finally {
                        if (!_.has(data, 'dependencies.yarn')) {
                            // Check if Yarn exists as a global module
                            output = Webiny.shellExecute('npm ls yarn --json --global', {stdio: 'pipe'}).toString();
                            data = JSON.parse(output);
                        }
                    }

                    return _.has(data, 'dependencies.yarn') ? _.get(data, 'dependencies.yarn.version') : null;
                }
            }
        }
    };

    const grep = " | grep -Eo '[0-9]{1,3}\.[0-9]{1,3}[\.|-][0-9a-z]{1,4}'";

    _.each(requirements.deps, function (config, key) {
        if (typeof config.cmd === 'function') {
            config.version = config.cmd();
            if (!config.version) {
                requirements.satisfied = false;
            } else {
                config.satisfied = true;
            }
            return;
        }

        try {
            config.version = Webiny.shellExecute(config.cmd + grep, {stdio: 'pipe'}).toString().split("\n")[0];
            config.satisfied = !config.reqVersion || config.version.startsWith(config.reqVersion);
        } catch (err) {
            if (key === 'mongo' && _.includes(err.message, 'Failed global initialization')) {
                Webiny.failure('\nFailed to check MongoDB version: ' + Webiny.chalk.cyan(err.message.split('\n')[1]) + '\n');
            }
            if (config.alternateCmd) {
                try {
                    config.version = Webiny.shellExecute(config.alternateCmd + grep, {stdio: 'pipe'}).toString().split("\n")[0];
                    config.satisfied = !config.reqVersion || config.version.startsWith(config.reqVersion);
                    return;
                } catch (err) {
                    // Do nothing
                }
            }

            requirements.satisfied = false;
        }
    });

    return requirements;
}


module.exports = {
    firstRun: function () {
        return !Webiny.folderExists(Webiny.projectRoot('Apps')) || !Webiny.folderExists(Webiny.projectRoot('Configs'));
    },
    getRequirements: getOsRequirements,
    requirements: function () {
        const isWin = /^win/.test(process.platform);

        if (isWin) {
            throw new Error('Sorry, we do not support Windows at the moment!');
        }

        const req = getOsRequirements();
        Webiny.log('-------------------------------------------------');
        _.each(req.deps, function (config, key) {
            const msg = config.version ? config.name + ' (installed version: ' + chalk.cyan(config.version) + ')' : config.name;
            if (config.satisfied) {
                Webiny.success(msg);
            } else {
                Webiny.failure(msg);
            }
        });
        Webiny.log('-------------------------------------------------');

        if (!req.satisfied) {
            throw new Error('Please install the missing dependencies and run Webiny again!');
        }

        return true;
    }
};