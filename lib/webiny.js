/* eslint-disable */
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const yaml = require('js-yaml');
const execSync = require('child_process').execSync;
const App = require('./app');

const folders = {};

function getFolders(dir, force) {
    if (!force && folders[dir]) {
        return folders[dir];
    }

    try {
        folders[dir] = fs.readdirSync(dir).filter(file => {
            return fs.statSync(path.join(dir, file)).isDirectory() && file !== '.git';
        });
        return folders[dir];
    } catch (e) {
        console.log('[WARNING] Could not read subfolders of "' + dir + '"');
        folders[dir] = [];
        return [];
    }
}

function readJsApps(app, dir, Webiny) {
    const jsApps = [];
    getFolders(dir).map(jsApp => {
        jsApps.push(
            new App(app, jsApp, _.trimStart(dir.replace(Webiny.projectRoot(), '') + '/' + jsApp, '/'))
        );
    });

    return jsApps;
}


class Webiny {
    constructor() {
        this.plugins = null;
        this.apps = null;
        this.config = null;

        this.validate = {
            email(value) {
                const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                if (!re.test(value)) {
                    return 'Please enter a valid e-mail';
                }
                return true;
            },
            url(value) {
                const regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
                if (regex.test(value)) {
                    return true;
                }

                return 'Please enter a valid domain (e.g. http://domain.app:8001)';
            },
            writable(path) {
                const error = 'Given path is not writable! Please check your permissions or specify a different file path.';
                try {
                    // Check if file exists
                    fs.statSync(path).isFile();
                    try {
                        fs.accessSync(path, fs.W_OK);
                        return true;
                    } catch (err) {
                        return error;
                    }
                } catch (err) {
                    // If file does not exist - try creating it, and remove it on success
                    try {
                        fs.ensureFileSync(path);
                        fs.removeSync(path);
                    } catch (err) {
                        return error;
                    }
                }
                return true;
            }
        }
    }

    getConfig() {
        if (this.config) {
            return this.config;
        }

        try {
            this.config = JSON.parse(this.readFile(this.projectRoot('webiny.json')));
        } catch (e) {
            this.config = {
                lastRun: {
                    apps: [],
                    host: ''
                }
            };
        }
        return this.config;
    }

    saveConfig(config) {
        this.writeFile(this.projectRoot('webiny.json'), JSON.stringify(config, null, 4));
        this.config = config;
    }

    getPlugins(force = false) {
        if (!force && this.plugins) {
            return this.plugins;
        }

        const dir = this.projectRoot('Apps');
        this.plugins = [];
        getFolders(dir, force).map(appDir => {
            const webinyJson = this.projectRoot('Apps/' + appDir + '/webiny.json');
            if (fs.existsSync(webinyJson)) {
                const wjson = JSON.parse(this.readFile(webinyJson));
                if (_.isArray(wjson.cliPlugins)) {
                    wjson.cliPlugins.map(plPath => {
                        if (plPath.startsWith('./')) {
                            const pluginClass = require(this.projectRoot('Apps/' + appDir + '/' + plPath));
                            this.plugins.push(pluginClass);
                        }
                    });
                }
            }
        });
        return this.plugins;
    }

    /**
     * Read platform apps
     * @param app
     * @param jsApp
     * @returns {Array}
     */
    getApps() {
        if (!this.apps) {
            this.apps = [];
        }
        const dir = this.projectRoot('Apps');
        getFolders(dir).map(appSubfolder => {
            const appDir = this.projectRoot('Apps/' + appSubfolder);
            if (fs.existsSync(appDir + '/App.yaml')) {
                const dir = appDir + '/Js';
                // Read JS apps from given dir
                readJsApps(appSubfolder, dir, this).map(appObj => {
                    this.apps.push(appObj);
                });
            }
        });

        return this.apps;
    }

    projectRoot(path) {
        if (!path) {
            return fs.realpathSync(process.env.PWD);
        }

        return fs.realpathSync(process.env.PWD) + '/' + path;
    }

    success(msg) {
        let prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }
        this.log(prefix + chalk.green('\u2713') + ' ' + msg);
    }

    exclamation(msg) {
        let prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }

        this.log(prefix + chalk.red('\u2757') + ' ' + msg);
    }

    failure(msg, extra = null) {
        let prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }

        this.log(prefix + chalk.red('\u2718') + ' ' + msg);
        if (extra) {
            this.log(extra);
        }
    }

    log(msg) {
        console.log(msg);
    }

    warning(msg) {
        console.log('[' + chalk.red('WARNING') + ']: ' + msg);
    }

    info(msg) {
        let prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }

        this.log(prefix + chalk.blue('>') + ' ' + msg);
    }

    projectRoot(path) {
        if (!path) {
            return fs.realpathSync(process.env.PWD);
        }

        return fs.realpathSync(process.env.PWD) + '/' + path;
    }

    fileExists(path) {
        try {
            return fs.statSync(path).isFile();
        } catch (err) {
            return false;
        }
    }

    isSymbolicLink(path) {
        try {
            return fs.lstatSync(path).isSymbolicLink();
        } catch (err) {
            return false;
        }
    }

    folderExists(path) {
        try {
            return fs.statSync(path).isDirectory();
        } catch (err) {
            return false;
        }
    }

    copy(from, to) {
        try {
            fs.copySync(from, to);
            return true;
        } catch (err) {
            console.log(err);
            return false;
        }
    }

    readFile(path) {
        return fs.readFileSync(path, 'utf8');
    }

    writeFile(file, data) {
        fs.outputFileSync(file, data);
    }

    deleteFile(file) {
        fs.unlinkSync(file);
    }

    shellExecute(cmd, options) {
        options = options || {cwd: fs.realpathSync(process.env.PWD), env: process.env, stdio: 'inherit'};
        return execSync(cmd, options);
    }
}

module.exports = new Webiny;