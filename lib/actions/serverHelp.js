var utils = require('./../utils');
var blue = utils.chalk.blue;
var cyan = utils.chalk.cyan;
var magenta = utils.chalk.magenta;
var white = utils.chalk.white;
var grey = utils.chalk.grey;
var help = [];

module.exports = function () {
    utils.exclamation('\nMake sure you are able to ssh into your remote server without password! (HINT: setup an SSH key)');

    utils.info('\nThis is the server folder structure created by our deploy process:');
    help.push(blue('~/www'));
    help.push(white('|-- ') + blue('files') + grey("\t// folder containing static files for each environment (e.g. uploads, temp, etc.)"));
    help.push(white('|   |-- ') + blue('development'));
    help.push(white('|   `-- ') + blue('production'));
    help.push(white('|-- ') + blue('logs') + grey("\t// folder containing your web server log files"));
    help.push(white('|   |-- yoursite-dev-error.log'));
    help.push(white('|   `-- yoursite-prod-error.log'));
    help.push(white('|--') + blue('active') + grey('\t// links to active releases. Web server hosts should point here.'));
    help.push(white('|   |-- ') + cyan('production') + white(' -> ') + blue('releases/release-20160719-090143'));
    help.push(white('|   |-- ') + cyan('development') + white(' -> ') + blue('releases/release-20160706-112349'));
    help.push(white('`-- ') + blue('releases') + grey("\t// folder containing all deployed releases"));
    help.push(white('    |-- ') + blue('release-20160706-090143'));
    help.push(white('    |-- ') + blue('release-20160706-105214'));
    help.push(white('    `-- ') + blue('release-20160706-112349'));

    utils.log('----------------------------------------');
    utils.log(help.join("\n"));
    utils.log('----------------------------------------');

    utils.info('\nPoint your web server to one of the following:');
    utils.log('  - ' + magenta('~/www/active/production/public_html'));
    utils.log('  - ' + magenta('~/www/active/development/public_html'));

    return Promise.resolve();
};