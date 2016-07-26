// Execute shell script
const execSync = require('child_process').execSync;
execSync('npm install', {cwd: cwd, env: process.env, stdio: 'inherit'});

// Check if file exists
if (fs.existsSync(cwd + DS + 'node_modules' + DS + packageName) !== true) {
    // do something...
}