var fetch = require('node-fetch');
var utils = require('./../utils');

module.exports = function (currentVersion) {
    process.stdout.write('Checking for updates...');
    return fetch('http://registry.npmjs.org/-/package/webiny/dist-tags').then(function (res) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        return res.json().then(function (json) {
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
        });
    }).catch(function (e) {

    });
};