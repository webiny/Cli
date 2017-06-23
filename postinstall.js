#! /usr/bin/env node
const username = require('username');
const chalk = require('chalk');
const binDir = './node_modules/.bin';
const Webiny = require('./lib/webiny');
const profilePath = `/home/${username.sync()}/.profile`;
const {magenta} = chalk;

let config = Webiny.readFile(profilePath);

if (config.match(binDir)) {
    Webiny.info(`${magenta(profilePath)} already exports ${magenta(binDir)} to PATH.`);
    return;
}

config += `# Added by webiny\nexport PATH="$PATH:${binDir}"`;
Webiny.writeFile(profilePath, config);
Webiny.success(`Added ${magenta('./node_modules/.bin')} executables to PATH in ${magenta(profilePath)}`);
Webiny.info('If not using Webiny vagrant box, please restart your shell or execute the export command yourself as follows:');
Webiny.info(magenta('export PATH="$PATH:./node_modules/.bin"'));
