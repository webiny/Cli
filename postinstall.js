const binDir = './node_modules/.bin';

if (process.platform === "win32") {
    console.log(`Please add "${binDir}" to Windows $PATH for webiny-cli to be available in cmd prompt!`);
    process.exit(0);
}

const chalk = require('chalk');
const Webiny = require('./lib/webiny');
const {magenta} = chalk;

try {
    const userInfo = require('os').userInfo();
    const bashProfile = `${userInfo.homedir}/.bash_profile`;
    let exportTo = `${userInfo.homedir}/.profile`;

    if (Webiny.fileExists(bashProfile)) {
        exportTo = bashProfile;
    }

    if (!Webiny.fileExists(exportTo)) {
        Webiny.writeFile(exportTo, '');
    }

    let config = Webiny.readFile(exportTo);

    if (config.match(binDir)) {
        Webiny.info(`${magenta(exportTo)} already exports ${magenta(binDir)} to PATH.`);
        return;
    }

    config += `# Added by webiny-cli\nexport PATH="$PATH:${binDir}"`;
    Webiny.writeFile(exportTo, config);
    Webiny.success(`Added ${magenta('./node_modules/.bin')} executables to PATH in ${magenta(exportTo)}`);
    Webiny.info('If not using Webiny Vagrant box, please restart your session or execute the export command yourself as follows:');
    Webiny.info(magenta('export PATH="$PATH:./node_modules/.bin"'));
} catch (err) {
    Webiny.failure('Could not export PATH!');
    Webiny.log(err);
}

