/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const assert = require('assert');

const config = {
  app_id: 'YOUR_APP_ID', // Replace with your app_id
  app_code: 'YOUR_APP_CODE', // Replace with your app_code
};

assert.notEqual(config.app_id, 'YOUR_APP_ID', 'Please add your own app_id and app_code');
assert.notEqual(config.app_code, 'YOUR_APP_CODE', 'Please add your own app_id and app_code');

module.exports = config;
