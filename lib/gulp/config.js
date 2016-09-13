var _ = require('lodash');

var paths = {
    scripts: ["**/*.{js,jsx}", "!Assets/**/*", "!Tests/**/*.js"],
    scriptsDev: ["**/*.{js,jsx}", "!Modules/**/*.{js,jsx}", "!Assets/**/*", "!Tests/**/*.js"],
    testScripts: ["Tests/**/*.js"],
    fonts: ["Assets/fonts/**/*", "!Assets/fonts/**/*.{css,less}"],
    images: ["Assets/images/**/*"]
};

var parseValues = function (values, sourceAppDir) {
    return _.map(values, function (value) {
        sourceAppDir = _.trimStart(sourceAppDir, './');
        var path = sourceAppDir + '/' + value;
        if (_.startsWith(value, '!')) {
            path = '!' + sourceAppDir + '/' + _.trimStart(value, '!');
        }
        return path;
    });
};

module.exports = {
    paths: {
        scripts: function (sourceAppDir) {
            return parseValues(paths.scripts, sourceAppDir);
        },

        scriptsDev: function (sourceAppDir) {
            return parseValues(paths.scriptsDev, sourceAppDir);
        },

        styles: function (appObj) {
            return appObj.sourceDir + '/Assets/' + appObj.assets.getStyles();
        },

        other: function (appObj) {
            return appObj.sourceDir + '/Assets/other/**/*';
        },

        watchAssets: function (appObj) {
            return [
                this.fonts(appObj.sourceDir),
                this.images(appObj.sourceDir),
                appObj.sourceDir + '/Assets/styles/**/*.{css,less,scss}',
                appObj.sourceDir + '/Assets/Assets.yaml',
                appObj.sourceDir + '/Assets/bower_components/bower.json',
                appObj.sourceDir + '/Assets/custom_components/**/*'
            ];
        },

        fonts: function (sourceAppDir) {
            return parseValues(paths.fonts, sourceAppDir);
        },

        images: function (sourceAppDir) {
            return parseValues(paths.images, sourceAppDir);
        }
    }
};