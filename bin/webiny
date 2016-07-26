#! /usr/local/bin/node
// uglifyjs -c --mangle=toplevel -o webiny.min.js webiny.js
var cwd = process.env.PWD;
var log = console.log;

// Require packages
var fs = require("fs");
var DS = require("path").sep;
const execSync = require('child_process').execSync;

// Check dependencies
var missing = [];
var packages = JSON.parse(fs.readFileSync('./package.json', 'utf8')).dependencies;
Object.keys(packages).map(function (packageName) {
    if (fs.existsSync(cwd + DS + 'node_modules' + DS + packageName) !== true) {
        missing.push(packageName);
    }
});

if (missing.length > 0) {
    log("\nWARNING: the following core dependencies are missing!");
    missing.map(function (p) {
        log('- ' + p);
    });
    log("\nRunning `npm install` to fix dependencies...");
    execSync('npm install', {cwd: cwd, env: process.env, stdio: 'inherit'});
}


var chalk = require('chalk');

log("\nWebiny CLI v0.1");
log("Working directory: " + chalk.magenta(cwd) + "\n");


