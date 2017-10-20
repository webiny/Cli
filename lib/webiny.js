const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const yaml = require('js-yaml');
const program = require('commander');
const execSync = require('child_process').execSync;
const App = require('./app');
const Dispatcher = require('./dispatcher');
const {Command} = program;

function getFolders(dir) {
    try {
        return fs.readdirSync(dir).filter(file => {
            return fs.statSync(path.join(dir, file)).isDirectory() && file !== '.git';
        });
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


class Webiny extends Dispatcher {
    constructor() {
        super();
        this.plugins = {};
        this.apps = [];
        this.config = null;
        this.runTask = this.runTask.bind(this);
        this.findFileDepth = 0;

        this.validate = {
            email(value) {
                const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                if (!re.test(value)) {
                    return 'Please enter a valid e-mail';
                }
                return true;
            },
            domain(value) {
                const regex = /^https?:\/\/[\w+-]+(\.\w+)+(:[0-9]+)?$/;
                if (regex.test(value)) {
                    return true;
                }

                if (value.includes('localhost')) {
                    return 'Sorry, localhost is not a valid domain.';
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
        };
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

        let files;
        try {
            files = this.findFiles(this.projectRoot('Apps'), 'webiny.json');
        } catch (err) {
            files = [];
        }

        this.plugins = {};

        // Sort files so that Webiny app file comes on top of the list
        files.sort((a, b) => {
            const w = `Webiny${path.sep}webiny.json`;
            if (!a.endsWith(w) && b.endsWith(w)) {
                return 1;
            }

            if (a.endsWith(w) && !b.endsWith(w)) {
                return -1;
            }

            return 0;
        });

        files.map(file => {
            const wjson = JSON.parse(this.readFile(file));
            if (_.has(wjson, 'cli.plugins') && _.isArray(wjson.cli.plugins)) {
                wjson.cli.plugins.forEach(plPath => {
                    if (plPath.startsWith('./')) {
                        const pluginFile = path.normalize(file.replace('webiny.json', plPath));
                        try {
                            const pluginClass = require(pluginFile);
                            this.plugins[pluginClass.task] = pluginClass;
                        } catch (e) {
                            console.log(e);
                        }
                    }
                });
            }

            if (_.has(wjson, 'cli.hooks') && _.isPlainObject(wjson.cli.hooks)) {
                _.each(wjson.cli.hooks, (scripts, hook) => {
                    scripts.forEach(script => {
                        if (script.startsWith('./')) {
                            script = path.normalize(file.replace('webiny.json', script));
                            this.on(hook, require(script));
                        }
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

    /**
     * Read platform apps
     * @returns {Array}
     */
    getApps() {
        if (this.apps.length > 0) {
            return this.apps;
        }
        this.loadApps();
        return this.apps;
    }

    loadApps() {
        this.apps = [];
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
    }

    projectRoot(p) {
        if (!p) {
            return process.cwd();
        }

        return path.join(process.cwd(), p);
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
            this.info('---------------- ERROR DETAILS ---------------');
            this.log(extra);
            this.info('----------------------------------------------');
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

    findFiles(dir, filter) {
        let found = [];

        const files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            const filename = path.join(dir, files[i]);
            const stat = fs.lstatSync(filename);
            if (stat.isDirectory() && this.findFileDepth < 1) {
                this.findFileDepth++;
                Array.prototype.push.apply(found, this.findFiles(filename, filter));
                this.findFileDepth--;
            } else if (filename.indexOf(filter) >= 0) {
                found.push(filename);
            }
        }

        return found;
    };

    shellExecute(cmd, options) {
        options = options || {cwd: fs.realpathSync(process.cwd()), env: process.env, stdio: 'inherit'};
        return execSync(cmd, options);
    }

    renderMenu() {
        return require('./navigation').render();
    }

    runTask(task, config = {}, taskOptions = {}) {
        const Navigation = require('./navigation');
        if (Navigation.prompt) {
            Navigation.prompt.ui.close();
            Navigation.prompt = null;
        }

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
            return this.dispatch('beforeTask', {task, config}).then(() => {
                return plugin.runTask(config)
                    .then(res => this.dispatch('afterTask', {task, config, data: res}).then(() => {
                        if (!taskOptions.api) {
                            process.exit(res);
                        }
                        _.get(res, 'menu', true) !== false ? this.renderMenu() : null;
                    }))
                    .catch(err => {
                        return this.dispatch('afterTask', {task, config, err}.then(() => {
                            this.log();
                            this.failure('Task execution was aborted due to an error. See details below.', err.stack);
                            if (!taskOptions.api) {
                                process.exit(err.message);
                            }
                            this.renderMenu();
                        }));
                    })
            });
        }

        this.failure(`Plugin "${task}" was not found!`);
        process.exit(1);
    }
}

module.exports = new Webiny;