const path = require('path');
const fs = require('fs-extra');
const webpack = require('webpack');
const _ = require('lodash');
const baseAppConfig = require('./../../webpack/app');
const baseVendorConfig = require('./../../webpack/vendor');
const utils = require('./../utils');

class Build {
    constructor(Webiny, config) {
        this.Webiny = Webiny;
        this.config = config;
    }

    run() {
        const vendorConfigs = this.getVendorConfigs();

        utils.log('--------------------------------------------------------------------------');
        utils.info('Please be patient, the production build may take a while...');
        utils.log('--------------------------------------------------------------------------');

        // Remove all files from build folder
        this.config.apps.map(app => {
            fs.emptyDirSync(utils.projectRoot('public_html') + '/build/' + process.env.NODE_ENV + '/' + app.path);
        });

        return this.buildConfigs(vendorConfigs).then(() => {
            const appConfigs = this.getAppConfigs();
            return this.buildConfigs(appConfigs);
        });
    }

    buildConfigs(configs) {
        return new Promise((resolve, reject) => {
            webpack(configs).run(function (err, stats) {
                if (err) {
                    reject(err);
                } else {
                    console.log(stats.toString({
                        colors: true
                    }));
                    resolve();
                }
            });
        });
    }

    getAppConfigs() {
        const appConfigs = [];
        this.config.apps.map(app => {
            // Create a base config which can be used without modification
            let appConfig = baseAppConfig(app, this.Webiny);
            // Check if the app has a webpack app config defined
            const appCfgPath = utils.projectRoot(app.sourceFolder + '/webpack.app.js');
            if (utils.fileExists(appCfgPath)) {
                // Import app config and pass the base app config for modification
                appConfig = require(appCfgPath)(appConfig);
            }

            appConfigs.push(appConfig);
        });

        return appConfigs.length > 0 ? appConfigs : null;
    }

    getVendorConfigs() {
        const vendorConfigs = [];
        this.config.apps.map(app => {
            // Check if the app has a webpack vendor config defined
            const vendorCfgPath = utils.projectRoot(app.sourceFolder + '/webpack.vendor.js');
            if (utils.fileExists(vendorCfgPath)) {
                const baseConfig = baseVendorConfig(app);
                const vendorConfig = require(vendorCfgPath)(baseConfig);
                const entry = vendorConfig['entry'];
                if ((_.isArray(entry) && entry.length > 0) || _.isPlainObject(entry) && Object.keys(entry).length > 0) {
                    vendorConfigs.push(vendorConfig);
                }
            }
        });
        return vendorConfigs;
    }
}

module.exports = Build;