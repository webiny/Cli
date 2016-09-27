var utils = require('./utils');
var $ = require('gulp-load-plugins')();
$.duration = require('./duration');
$.inquirer = require('inquirer');
$.es = require('event-stream');
$.livereload = require('gulp-livereload');
$.cssImport = require('gulp-cssimport');
$.babelRegister = require('babel-register');
$.moment = require('moment');

var pipes = require('./gulp/pipes');
var tasks = require('./gulp/tasks');

module.exports = function (task, config) {
    try{
        $.webiny = require('./webiny')(config);
        $.webinyBuild = require('./gulp/webinyBuild')(config, $);
        return tasks(config, $, pipes(config, $))[task]();
    } catch(err){
        utils.failure(err.message)
    }
};