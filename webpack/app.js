if (process.env.NODE_ENV === 'production') {
    console.log('Using production webpack config');
    module.exports = require('./app.prod.js');
} else {
    console.log('Using development webpack config');
    module.exports = require('./app.dev.js');
}