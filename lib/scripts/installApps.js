const utils = require('./../utils');
const chalk = require('chalk');
const yaml = require('js-yaml');
const _ = require('lodash');

class InstallApps {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        return new Promise(resolve => {
            const config = this.config;
            try {
                utils.info('Installing ' + chalk.cyan(config.name) + '...');
                if (config.packagist && config.packagist !== '') {
                    utils.shellExecute('composer require ' + config.packagist);
                } else {
                    utils.shellExecute('cd ' + utils.projectRoot('Apps') + ' && git clone ' + config.repository);
                }
                // Activate app in Application.yaml
                const applicationConfig = utils.projectRoot('Configs/Base/Application.yaml');
                const appConfig = yaml.safeLoad(utils.readFile(applicationConfig));
                const apps = _.get(appConfig, 'Apps', {});
                apps[config.name] = true;
                appConfig.Apps = apps;
                utils.writeFile(applicationConfig, yaml.safeDump(appConfig, {indent: 4}));
                // Execute an app installer to install demo data, indexes, etc.
                utils.shellExecute('php ' + utils.projectRoot('Apps/Webiny/Php/Cli/install.php') + ' ' + config.name);
                utils.success(chalk.cyan(config.name) + ' installation finished!');
                resolve(config.name);
            } catch (e) {
                utils.failure('Failed to install ' + chalk.cyan(config.name) + '!');
                console.log(e);
                resolve();
            }
        });
    }
}

module.exports = InstallApps;