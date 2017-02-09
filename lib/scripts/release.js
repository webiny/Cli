const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const chalk = require('chalk');
const gulp = require('gulp');
const gulpZip = require('gulp-zip');
const gulpPrint = require('gulp-print');
const utils = require('./../utils');

class Release {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        utils.info('\nCreating release archive...');
        const paths = [
            'Apps/**/*',
            '!Apps/**/node_modules/**/*',
            '!Apps/**/Js/**/*',
            '!Apps/**/*.git',
            '!Apps/**/*.json',
            'Configs/**/*.yaml',
            'public_html/build/production/**/*',
            'public_html/*.{php,html}',
            'vendor/**/*.{php,crt,ser}',
            '!vendor/**/[tT]est*/**/*',
            '!vendor/**/*.git'
        ];

        const parts = path.parse(this.config.release);
        if (!parts.dir.startsWith('/') && !parts.dir.startsWith('~/')) {
            parts.dir = utils.projectRoot(parts.dir);
        }

        if (parts.dir.startsWith('~/')) {
            parts.dir = parts.dir.replace('~/', os.homedir() + '/');
        }

        parts.dir = path.resolve(parts.dir);

        return new Promise((resolve, reject) => {
            gulp.src(paths, {base: '.'})
                .pipe(gulpZip(parts.name + '.zip'))
                .pipe(gulp.dest(parts.dir))
                .pipe(gulpPrint(() => {
                    utils.success('Done! Archive saved to ' + chalk.magenta(this.config.release) + '\n');
                })).on('end', () => resolve(this.config.release)).on('error', reject);
        });
    }
}
module.exports = Release;