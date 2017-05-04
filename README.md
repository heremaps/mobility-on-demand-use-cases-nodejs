[![Build Status](https://travis-ci.org/heremaps/mobility-on-demand-use-cases-nodejs.svg?branch=master)](https://travis-ci.org/heremaps/mobility-on-demand-use-cases-nodejs)

# Mobility On Demand Use Cases (NodeJS)

This repository hosts 2 demo applications developed in `NodeJS` exposing server-side and CLI integration with the **HERE REST APIs & Platform Extensions**.

Application Name | File | Description
---------------- | ---- | -----------
Command Line Interface demo application | `cli-demo.js` | A `CLI` application running a sequence of potential transportation scenarios against the HERE REST APIs
`Express` server demo application | `express-demo.js` | A grossly simplified [Express](http://expressjs.com/) app showcasing area administration.

Visit the **HERE Developer Portal** for more information on the [HERE REST APIs & Platform Extensions](https://developer.here.com/develop/rest-apis).

> **Note:** In order to get the sample code to work, you **must** replace all instances of `YOUR_APP_ID` and `YOUR_APP_CODE` within the code and use your own **HERE** credentials.

> You can obtain a set of credentials from the [Plans](https://developer.here.com/plans) page on developer.here.com.

## License

Unless otherwise noted in `LICENSE` files for specific files or directories, the [LICENSE](LICENSE) in the root applies to all content in this repository.

## Requirements

> Requires node >= 6.0.0

## Setting both applications up
* Run `npm install`
* Replace `YOUR_APP_ID` and `YOUR_APP_CODE` placeholder values in `src/config.js` with your own HERE credentials.

## Running the sample applications
* Run `npm run server` to run the `Express` server application
* Run `npm run cli-demo` to run the `CLI` demo

> ℹ️ To disable specific scenarios of the demo, comment out their `then` calls at the bottom of `src/cli-demo.js`

> ℹ️ By default the local database is always cleared when starting the demo. To avoid clearing data, change the third parameter in the call to `db.initialize` to **`false`** at the bottom of `src/cli-demo.js`

## Additional NPM `run` targets

Run by issuing an `npm run <name-of-script>` command.    
Omit `<name-of-script>` to get a list of targets.

* `lint`: lints js code with `eslint`
* `build-jsdoc`: builds documentation into the `./doc` directory
* `coverage`: run code coverage analysis
* `test`: run linter and code coverage

## Notes

The examples use the Custom Integration Test (CIT) environment.
Please refer to our API Documentation on how to change from our CIT environment to our Production environment.
