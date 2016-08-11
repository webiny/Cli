var utils = require('./utils');
var _ = require('lodash');

function getOsRequirements() {
    var requirements = {
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
                alternateCmd: 'php ' + process.env.PWD + '/composer.phar --version'
            },
            bower: {
                name: 'Bower',
                satisfied: false,
                cmd: 'bower --version'
            }
        }
    };
    var grep = " | grep -Eo '[0-9]{1,3}\.[0-9]{1,3}[\.|-][0-9a-z]{1,4}'";

    _.each(requirements.deps, function (config, key) {
        try {
            config.version = utils.shellExecute(config.cmd + grep, {stdio: 'pipe'}).toString().split("\n")[0];
            config.satisfied = !config.reqVersion || config.version.startsWith(config.reqVersion);
        } catch (err) {
            if (key == 'mongo' && _.includes(err.message, 'Failed global initialization')) {
                utils.failure('\nFailed to check MongoDB version: ' + utils.chalk.cyan(err.message.split('\n')[1]) + '\n');
            }
            if (config.alternateCmd) {
                try {
                    config.version = utils.shellExecute(config.alternateCmd + grep, {stdio: 'pipe'}).toString().split("\n")[0];
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
        return !utils.folderExists(utils.projectRoot('Apps')) || !utils.folderExists(utils.projectRoot('Configs'));
    },
    getRequirements: getOsRequirements,
    requirements: function () {
        var isWin = /^win/.test(process.platform);

        if (isWin) {
            throw new Error('Sorry, we do not support Windows at the moment!');
        }

        var req = getOsRequirements();
        utils.log('-------------------------------------------------');
        _.each(req.deps, function (config, key) {
            var msg = config.version ? config.name + ' (installed version: ' + utils.chalk.cyan(config.version) + ')' : config.name;
            if (config.satisfied) {
                utils.success(msg);
            } else {
                utils.failure(msg);
            }
        });
        utils.log('-------------------------------------------------');

        if (!req.satisfied) {
            throw new Error('Please install the missing dependencies and run Webiny again!');
        }

        return true;
    }
};