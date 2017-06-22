#! /usr/bin/env node
if (!process.env.PWD) {
    process.env.PWD = __dirname;
}

const Webiny = require('..');
new Webiny().run();