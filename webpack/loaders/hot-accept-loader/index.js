'use strict';
module.exports = function (source) {
    if (this.cacheable) {
        this.cacheable();
    }

    if (this.resourcePath.endsWith('/App.js')) {
        if (!/\bimport Webiny\b/.test(source)) {
            source = `import Webiny from 'Webiny';\n${source}`
        }

        return `
            ${source}
            if (module.hot) {
                let lastStatus = 'idle';
                module.hot.addStatusHandler(status => {
                    if (lastStatus === 'apply' && status === 'idle') {
                        Webiny.refresh();
                    }
                    lastStatus = status;
                });
            }`
    }

    if (/\bmodule.hot\b/.test(source)) {
        return source;
    }

    return `
    ${source}
    module.hot.accept(err => {
        if (err) {console.error(err);}
    });`
};
