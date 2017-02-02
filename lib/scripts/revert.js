const path = require('path');
const inquirer = require('inquirer');
const SshClient = require('node-sshclient');
const chalk = require('chalk');
const _ = require('lodash');
const utils = require('./../utils');

class Revert {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        let port = 22;
        let host = this.config.host;
        let user = null;
        let domain = null;

        if (host.indexOf(':') > -1) {
            const parts = host.split(':');
            host = parts[0];
            port = parts[1];
        }

        const hostParts = host.split('@');
        if (hostParts.length === 2) {
            user = hostParts[0];
            domain = hostParts[1];
        } else {
            domain = hostParts[0];
        }

        var sshConfig = {
            hostname: domain,
            user: user,
            port: port
        };

        const ssh = new SshClient.SSH(sshConfig);

        return new Promise((resolve) => {
            try {
                const activate = [
                    'rm -f ~/www/active/production',
                    'ln -s ~/www/releases/' + this.config.release + ' ~/www/active/production'
                ].join('&&');
                ssh.command(activate, () => {
                    utils.info('Clearing cache for ' + chalk.magenta(this.config.domain) + '...');
                    ssh.command(this.flushCache(), res => {
                        const commandOut = res.stdout || '{}';
                        if (res.exitCode !== 0 || _.get(JSON.parse(commandOut), 'flushed') !== true) {
                            utils.info('Nothing to flush (either OpCache is disabled or the cache is empty).');
                            utils.log(res.stderr);
                        }

                        utils.success('Done! Release ' + chalk.magenta(this.config.release) + ' is now active!');
                        resolve();
                    });
                });
            } catch (e) {
                utils.failure(e.message);
                resolve();
            }
        });
    }

    flushCache() {
        let basicAuth = '';
        if (this.config.basicAuth && this.config.basicAuth.length > 0) {
            const credentials = this.config.basicAuth.split(':');
            basicAuth = ' --user ' + credentials[0] + ' --password ' + (credentials[1] || '');
        }
        return 'wget ' + basicAuth + ' --no-check-certificate -qO- ' + this.config.domain + '/__clear-cache__';
    };
}
module.exports = Revert;