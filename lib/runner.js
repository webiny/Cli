var utils = require('./utils');
var inquirer = require('./../node_modules/inquirer');
var gulp = require('./../node_modules/gulp');
var $ = require('./../node_modules/gulp-load-plugins')();
$.glob = require('./../node_modules/glob');
$.inquirer = inquirer;
$.chalk = require('./../node_modules/chalk');
$.del = require('./../node_modules/del');
$.lazypipe = require('./../node_modules/lazypipe');
$.es = require('./../node_modules/event-stream');
$.q = require('./../node_modules/q');
$._ = _ = require('./../node_modules/lodash');
$.livereload = require('./../node_modules/gulp-livereload');
$.fs = require('fs');
$.path = require('path');
$.mainBowerFiles = require('./../node_modules/main-bower-files');
$.cssImport = require('./../node_modules/gulp-cssimport');
$.babelRegister = require('./../node_modules/babel-register');
$.moment = require('./../node_modules/moment');

var pipes = require('./gulp/pipes');
var tasks = require('./gulp/tasks');

module.exports = function (task, config) {
    try{
        $.webiny = require('./webiny')(config);
        $.webinyAssets = require('./gulp/webinyAssets')(config, $);
        return tasks(config, $, pipes(config, $))[task]();
    } catch(err){
        utils.failure(err.message)
    }
};