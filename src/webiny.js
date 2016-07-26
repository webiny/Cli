#! /usr/local/bin/node
// uglifyjs -c --mangle=toplevel -o webiny.min.js webiny.js
var cwd = process.env.PWD;
var log = console.log;

// Require packages
var fs = require("fs");
var DS = require("path").sep;
var chalk = require('chalk');

log("\nWebiny CLI v0.1");
log("Working directory: " + chalk.magenta(cwd) + "\n");


