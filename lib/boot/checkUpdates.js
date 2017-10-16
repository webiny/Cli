const fetch = require('node-fetch');
const semver = require('semver');

module.exports = function (currentVersion) {
    return fetch('http://registry.npmjs.org/-/package/webiny-cli/dist-tags').then(res => {
        return res.json().then(json => {
            const latestVersion = json.latest;
            if (semver.gt(latestVersion, currentVersion)) {
                return {currentVersion, latestVersion};
            }
            return null;
        });
    }).catch(e => null);
};