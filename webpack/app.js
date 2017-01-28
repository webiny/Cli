if (process.env.NODE_ENV === 'production') {
    console.log('IMPORTED PRODUCTION WEBPACK');
    module.exports = require('./app.prod.js');
} else {
    console.log('IMPORTED DEVELOPMENT WEBPACK');
    module.exports = require('./app.dev.js');
}