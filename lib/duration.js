var through = require('through2');
var utils = require('./utils');

module.exports = function (name) {
    var start = process.hrtime();
    var stream = through.obj({
        objectMode: true
    });

    return stream.once('end', function () {
        var duration = process.hrtime(start);
        var milliseconds = (duration[0] * 1e9 + duration[1]) / 1000000;
        var time = utils.humanizer(milliseconds, {round: true, units: ['m', 's', 'ms'], largest: 1});
        utils.info('Built ' + name + ': ' + utils.chalk.magenta(time));
    });
};