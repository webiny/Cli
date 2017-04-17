const _ = require('lodash');
class ModuleIdsPlugin {
    apply(compiler) {
        compiler.plugin("compilation", (compilation) => {
            compilation.plugin("before-chunk-ids", (chunks) => {
                chunks.forEach((chunk, index) => {
                    if (!chunk.hasEntryModule() && chunk.id === null) {
                        let id = index;
                        if (process.env.NODE_ENV === 'development') {
                            const context = _.map(chunk.modules, 'context').sort()[0];

                            if (context.includes('/node_modules/')) {
                                id = context.split('/node_modules/')[1].split('/')[0] + '-' + index;
                            } else if (context.includes('/Ui/Components/')) {
                                id = context.split('/Ui/Components/')[1].split('/')[0] + '-' + index;
                            } else if (context.includes('/Vendors/')) {
                                id = 'Vendors-' + context.split('/Vendors/')[1].split('/')[0] + '-' + index;
                            }
                        }

                        chunk.id = compiler.options.name + '-' + id;
                    }
                });
            });
        });
    }
}

module.exports = ModuleIdsPlugin;
