/* eslint-disable */
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const yaml = require('js-yaml');
const program = require('commander');
const {Command} = require('commander');
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
        this.plugins = {};
        this.hooks = {};
        this.apps = [];
        this.config = null;
        this.runTask = this.runTask.bind(this);

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
        if (_.has(config, 'lastRun.apps')) {
            config.lastRun.apps = _.uniq(config.lastRun.apps);
        }
        this.writeFile(this.projectRoot('webiny.json'), JSON.stringify(config, null, 4));
        this.config = config;
    }

    getPlugins(force = false) {
        if (!force && Object.keys(this.plugins).length) {
            return this.plugins;
        }

        const dir = this.projectRoot('Apps');
        let files;
        try {
            files = this.shellExecute(`cd  ${dir} && find . -maxdepth 2 -name "webiny.json"`, {stdio: 'pipe'});
        } catch (err) {
            return [];
        }

        this.plugins = {};
        files = files.toString().split("\n").filter(line => line !== '');

        // Sort files so that Webiny app file comes on top of the list
        files.sort((a, b) => {
            const w = './Webiny';
            if (!a.startsWith(w) && b.startsWith(w)) {
                return 1;
            }

            if (a.startsWith(w) && !b.startsWith(w)) {
                return -1;
            }

            return 0;
        });

        files.map(file => {
            const webinyJson = this.projectRoot('Apps/' + file);
            const wjson = JSON.parse(this.readFile(webinyJson));
            if (_.has(wjson, 'cli.plugins') && _.isArray(wjson.cli.plugins)) {
                wjson.cli.plugins.forEach(plPath => {
                    if (plPath.startsWith('./')) {
                        try {
                            const pluginClass = require(this.projectRoot('Apps/' + file.replace('webiny.json', plPath)));
                            this.plugins[pluginClass.task] = pluginClass;
                        } catch (e) {
                            // Ignore this file
                        }
                    }
                });
            }

            if (_.has(wjson, 'cli.hooks') && _.isPlainObject(wjson.cli.hooks)) {
                _.each(wjson.cli.hooks, (scripts, hook) => {
                    this.hooks[hook] = this.hooks[hook] || [];
                    scripts.forEach(script => {
                        if (script.startsWith('./')) {
                            script = this.projectRoot('Apps/' + file.replace('webiny.json', script))
                        }

                        this.hooks[hook].push(script);
                    });
                });
            }
        });

        // Instantiate plugins
        _.each(this.plugins, (pluginClass, name) => {
            this.plugins[name] = new pluginClass(program);
        });

        return this.plugins;
    }

    getHooks(hook) {
        return this.hooks[hook] || [];
    }

    processHook(hook, params) {
        let chain = Promise.resolve(params);
        this.getHooks(hook).map(script => {
            chain = chain.then(() => Promise.resolve(require(script)(params)));
        });
        return chain;
    }

    /**
     * Read platform apps
     * @returns {Array}
     */
    getApps() {
        if (this.apps.length > 0) {
            return this.apps;
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

    success(msg = '') {
        let prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }
        this.log(prefix + chalk.green('\u2713') + ' ' + msg);
    }

    exclamation(msg = '', extra = null) {
        let prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }

        this.log(prefix + chalk.red('\u2757') + ' ' + msg);

        if (extra) {
            this.log(extra);
        }
    }

    failure(msg = '', extra = null) {
        let prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }

        this.log(prefix + chalk.red('\u2718') + ' ' + msg);
        if (extra) {
            this.log('\n');
            this.info('---------------- ERROR DETAILS ---------------')
            this.log(extra);
            this.info('----------------------------------------------')
        }
    }

    log(msg = '\n') {
        console.log(msg);
    }

    warning(msg = '') {
        console.log('[' + chalk.red('WARNING') + ']: ' + msg);
    }

    info(msg = '') {
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

    runTask(task, config = {}) {
        if (task instanceof Command) {
            // Build config from top level program opts and given task opts
            config = _.assign({}, task.parent.opts(), task.opts());
            task = task.name();
        }

        if (config.app || config.all) {
            const apps = this.getApps();
            config.apps = config.all ? apps : _.filter(apps, a => config.app.indexOf(a.getName()) > -1);
        }

        const plugin = this.getPlugins()[task];
        if (plugin) {
            return plugin.runTask(config)
                .then((res = 0) => process.exit(res))
                .catch(err => {
                    this.log();
                    this.failure('Task execution was aborted due to an error. See details below.', err.stack);
                    process.exit(err.message);
                });
        }

        this.failure(`Plugin "${task}" was not found!`);
        process.exit(1);
    }
}

module.exports = new Webiny;