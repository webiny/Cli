var fs = require('fs');
var chalk = require('chalk');
var _ = require('lodash');
var fsExtra = require('fs-extra');
var execSync = require('child_process').execSync;

module.exports = {
    chalk: chalk,

    success: function (msg) {
        var prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }
        this.log(prefix + chalk.green('\u2713') + ' ' + msg);
    },

    exclamation: function (msg) {
        var prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }

        this.log(prefix + chalk.red('\u2757') + ' ' + msg);
    },

    failure: function (msg) {
        var prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }

        this.log(prefix + chalk.red('\u2718') + ' ' + msg);
    },

    log: function (msg) {
        console.log(msg);
    },

    warning: function (msg) {
        console.log('[' + chalk.red('WARNING') + ']: ' + msg);
    },

    info: function (msg) {
        var prefix = '';
        if (msg.startsWith("\n")) {
            prefix = "\n";
            msg = _.trimStart(msg, "\n");
        }

        this.log(prefix + chalk.blue('>') + ' ' + msg);
    },

    projectRoot: function (path) {
        if (!path) {
            return process.env.PWD;
        }

        return process.env.PWD + '/' + path;
    },

    fileExists: function (path) {
        try {
            return fs.statSync(path).isFile();
        } catch (err) {
            return false;
        }
    },

    isSymbolicLink: function (path) {
        try {
            return fs.lstatSync(path).isSymbolicLink();
        } catch (err) {
            return false;
        }
    },

    folderExists: function (path) {
        try {
            return fs.statSync(path).isDirectory();
        } catch (err) {
            return false;
        }
    },

    copy: function (from, to) {
        try {
            fsExtra.copySync(from, to);
            return true;
        } catch (err) {
            console.log(err);
            return false;
        }
    },

    readFile: function (path) {
        return fs.readFileSync(path, 'utf8');
    },

    writeFile: function (file, data) {
        fsExtra.outputFileSync(file, data);
    },

    shellExecute: function (cmd, options) {
        options = options || {cwd: process.env.PWD, env: process.env, stdio: 'inherit'};
        return execSync(cmd, options);
    },

    validate: {
        email: function (value) {
            var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
            if (!re.test(value)) {
                return 'Please enter a valid e-mail';
            }
            return true;
        },
        url: function (value) {
            const regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
            if (regex.test(value)) {
                return true;
            }

            return 'Please enter a valid domain (e.g. http://domain.app:8001)';
        },
        writable: function (path) {
            var error = 'Given path is not writable! Please check your permissions or specify a different file path.';
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
                    fsExtra.ensureFileSync(path);
                    fsExtra.removeSync(path);
                } catch (err) {
                    return error;
                }
            }
            return true;
        }
    }
};