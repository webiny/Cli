#! /usr/bin/env node
if (!process.env.PWD) {
    process.env.PWD = __dirname;
}

const WebinyCli = require('..');
new WebinyCli().run();