var utils = require('./utils');
var inquirer = require('inquirer');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
$.duration = require('./duration');
$.inquirer = inquirer;
$.chalk = require('chalk');
$.del = require('del');
$.lazypipe = require('lazypipe');
$.es = require('event-stream');
$.livereload = require('gulp-livereload');
$.fs = require('fs');
$.path = require('path');
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