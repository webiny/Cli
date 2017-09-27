const username = require('username');
const chalk = require('chalk');
const Webiny = require('./lib/webiny');
const {magenta} = chalk;
const binDir = './node_modules/.bin';
const OSX = process.platform === 'darwin';

try {
    const user = username.sync();
    const osxBashProfile = `/Users/${user}/.bash_profile`;
    let profilePath = OSX ? `/Users/${user}/.profile` : `/home/${user}/.profile`;
    if (OSX && Webiny.fileExists(osxBashProfile)) {
        profilePath = osxBashProfile;
    }

    let config = Webiny.readFile(profilePath);

    if (config.match(binDir)) {
        Webiny.info(`${magenta(profilePath)} already exports ${magenta(binDir)} to PATH.`);
        return;
    }

    config += `# Added by webiny-cli\nexport PATH="$PATH:${binDir}"`;
    Webiny.writeFile(profilePath, config);
    Webiny.success(`Added ${magenta('./node_modules/.bin')} executables to PATH in ${magenta(profilePath)}`);
    Webiny.info('If not using Webiny vagrant box, please restart your shell or execute the export command yourself as follows:');
    Webiny.info(magenta('export PATH="$PATH:./node_modules/.bin"'));
} catch (err) {
    Webiny.failure('Could not export PATH!');
    Webiny.log(err);
}

