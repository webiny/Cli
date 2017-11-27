Webiny CLI
----------

This is a plugginable cli tool to develop and manage a Webiny project.

Get our [Webiny Installer](https://www.webiny.com/download) to quickly setup a Webiny project and begin developing.

## Manual installation (not really recommended)
In your project folder...
```
yarn add webiny-cli
```

Now run the `webiny-cli` using one of the following approaches:

1) Run the cli using a binary in `node_modules/.bin` 
2) Run by adding a script to your `package.json` and simply `yarn webiny-cli` to get started:

```
{
    "scripts": {
        "webiny-cli": "node node_modules/webiny-cli/bin/webiny-cli.js"
    }
}
```