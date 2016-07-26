var fs = require('fs');
var binaryPath = process.env.PWD + '/bin/webiny';
var projectBinaryPath = process.env.PWD + '/../../webiny';
fs.createReadStream(binaryPath).pipe(fs.createWriteStream(projectBinaryPath));