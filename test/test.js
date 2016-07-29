if (!process.env.PWD) {
    process.env.PWD = __dirname;
}
require('./../index').run();