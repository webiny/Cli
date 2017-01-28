var fetch = require('node-fetch');
var utils = require('./../utils');

var timeout = null;

module.exports = function (currentVersion) {
    var stdin = process.stdin;
    return new Promise(function (resolve, reject) {
        stdin.setRawMode(true);
        stdin.resume();
        process.stdin.write('Checking for updates... (hit ' + utils.chalk.magenta('ESC') + ' or ' + utils.chalk.magenta('ENTER') + ' to skip)');

        function keyPress(buffer) {
            var key = buffer.toJSON().data[0];
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
                    var latestVersion = json.latest;
                    if (latestVersion !== currentVersion) {
                        var blue = utils.chalk.blue;
                        var green = utils.chalk.green;
                        var grey = utils.chalk.grey;

                        var line = '---------------------------------------------';

                        console.log('\n' + green(line));
                        utils.success('Update available: ' + green(latestVersion) + grey(' (current: ' + currentVersion + ')'));
                        utils.info('Run ' + blue('npm install webiny@' + latestVersion) + ' to update');
                        console.log(green(line) + '\n');
                    }
                    resolve();
                });
            }).catch(reject);
        }, 2000);
    });
};