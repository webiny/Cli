const path = require('path');
const chalk = require('chalk');
const SshClient = require('node-sshclient');
const _ = require('lodash');
const utils = require('./../utils');

class Deploy {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        const folder = 'production';
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


        const file = path.parse(this.config.release);

        return new Promise((resolve, reject) => {
            const sshConfig = {
                hostname: domain,
                user: user,
                port: parseInt(port)
            };

            try {
                const ssh = new SshClient.SSH(sshConfig);
                utils.info('\nVerifying folder structure on remote server...');
                const structure = 'mkdir -p ~/www/{files,releases,logs,active}';
                ssh.command(structure, () => {
                    utils.info('Uploading release archive to remote server...');
                    const rsync = 'rsync --progress -e \'ssh -p ' + port + '\' ' + this.config.release + ' ' + domain + ':~/www/releases';
                    utils.shellExecute(rsync);
                    utils.success('Done! Release archive uploaded to ' + chalk.magenta('~/www/releases/' + file.base));

                    const unzip = [
                        'cd ~/www/releases',
                        'rm -rf ~/www/releases/' + file.name,
                        'unzip -qu ' + file.base + ' -d ' + file.name,
                        'rm ' + file.base
                    ].join(' && ');

                    ssh.command(unzip, res => {
                        utils.info('Activating release...');
                        const activate = [
                            'rm -f ~/www/active/' + folder,
                            'ln -s ~/www/releases/' + file.name + ' ~/www/active/' + folder,
                            'mkdir -m 0775 -p ~/www/files/' + folder + '/{Uploads,Temp}',
                            'ln -s ~/www/files/' + folder + '/Uploads ~/www/active/' + folder + '/public_html/uploads',
                            'ln -s ~/www/files/' + folder + '/Temp ~/www/active/' + folder + '/Temp',
                            'mkdir -m 0775 ~/www/active/' + folder + '/Cache'
                        ].join(' && ');
                        ssh.command(activate, res => {
                            if (res.stderr) {
                                utils.failure('\nRelease activation failed!');
                                console.error(res);
                                return reject();
                            }
                            utils.info('Clearing cache for ' + chalk.magenta(this.config.domain) + '...');
                            ssh.command(this.flushCache(), res => {
                                const commandOut = res.stdout || '{}';
                                if (res.exitCode !== 0 || _.get(JSON.parse(commandOut), 'flushed') !== true) {
                                    utils.info('Nothing to flush (either OpCache is disabled or the cache is empty).');
                                    utils.log(res.stderr);
                                }

                                utils.info('Executing post-deploy scripts...');
                                const postDeploy = [
                                    'cd ~/www/active/' + folder + ' && php Apps/Webiny/Php/Cli/release.php ' + this.config.domain
                                ].join(' && ');
                                ssh.command(postDeploy, res => {
                                    utils.log(res.stdout);
                                    utils.success('Done! Deploy process finished successfully.');
                                    resolve();
                                });
                            });
                        });
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
module.exports = Deploy;