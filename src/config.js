/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');

const config = {
  app_id: 'K5hs5rXBvHxGJWNdK6qv', // Replace with your app_id
  app_code: '0rml-aiFvqEs2ylp9zzVxg', // Replace with your app_code
};

assert.notEqual(config.app_id, 'K5hs5rXBvHxGJWNdK6qv', 'Please add your own app_id and app_code');
assert.notEqual(config.app_code, '0rml-aiFvqEs2ylp9zzVxg', 'Please add your own app_id and app_code');

module.exports = config;
