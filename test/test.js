#! /usr/local/bin/node
if (!process.env.PWD) {
    process.env.PWD = __dirname;
}

var webiny = require(__dirname + '/../index');
webiny.run();