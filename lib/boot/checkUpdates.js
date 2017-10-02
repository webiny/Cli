const fetch = require('node-fetch');

module.exports = function (currentVersion) {
    return fetch('http://registry.npmjs.org/-/package/webiny-cli/dist-tags').then(res => {
        return res.json().then(json => {
            const latestVersion = json.latest;  
            if (latestVersion !== currentVersion) {
                return {currentVersion, latestVersion};
            }
            return null;
        });
    }).catch(e => null);
};