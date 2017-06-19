const fetch = require('node-fetch');
const chalk = require('chalk');
const Webiny = require('./../webiny');

let timeout = null;

module.exports = function (currentVersion) {
    const stdin = process.stdin;
    return new Promise(function (resolve, reject) {
        stdin.setRawMode(true);
        stdin.resume();
        process.stdin.write('Checking for updates... (hit ' + chalk.magenta('ESC') + ' or ' + chalk.magenta('ENTER') + ' to skip)');

        function keyPress(buffer) {
            const key = buffer.toJSON().data[0];
            if (key === 13 || key === 27) {
                clearTimeout(timeout);
                timeout = null;
                stdin.removeListener('data', keyPress);
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                resolve();
            }
        }

        stdin.on('data', keyPress);

        timeout = setTimeout(function () {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            stdin.removeListener('data', keyPress);
            process.stdout.write('Checking for updates...');
            fetch('http://registry.npmjs.org/-/package/webiny/dist-tags').then(function (res) {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                res.json().then(function (json) {
                    const latestVersion = json.latest;
                    if (latestVersion !== currentVersion) {
                        const blue = chalk.blue;
                        const green = chalk.green;
                        const grey = chalk.grey;

                        const line = '---------------------------------------------';

                        Webiny.log('\n' + green(line));
                        Webiny.success('Update available: ' + green(latestVersion) + grey(' (current: ' + currentVersion + ')'));
                        Webiny.info('Run ' + blue('npm install webiny@' + latestVersion) + ' to update');
                        Webiny.log(green(line) + '\n');
                    }
                    resolve();
                });
            }).catch(reject);
        }, 2000);
    });
};