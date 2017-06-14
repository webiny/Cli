var crypto = require('crypto');

class ChunkIds {
    apply(compiler) {
        compiler.plugin("compilation", (compilation) => {
            compilation.plugin("before-chunk-ids", (chunks) => {
                chunks.forEach((chunk, index) => {
                    if (!chunk.hasEntryModule() && chunk.id === null) {
                        let id = index;
                        if (process.env.NODE_ENV === 'production') {
                            chunk.id = compiler.options.name + '-' + this.createChunkIdHash(chunk);
                        } else {
                            const context = chunk.modules[0].context;
                            if (context.includes('/node_modules/')) {
                                id = context.split('/node_modules/')[1].split('/')[0];
                            } else if (context.includes('/Ui/Components/')) {
                                id = context.split('/Ui/Components/')[1].split('/')[0];
                            } else if (context.includes('/Vendors/')) {
                                id = 'Vendors-' + context.split('/Vendors/')[1].split('/')[0];
                            } else {
                                id = context.split('/').pop();
                            }
                            // ID must contain the name of the app to avoid ID clashes between multiple apps
                            chunk.id = compiler.options.name + '-' + index;
                            // Name is only used in development for easier debugging
                            chunk.name = id + '-' + index;
                        }
                    }
                });
            });
        });
    }

    createChunkIdHash(chunk) {
        const paths = chunk.modules.map(m => m.context).sort().join('\n');
        return crypto.createHash('md5').update(paths).digest('hex').substr(0, 10);
    }
}

module.exports = ChunkIds;
