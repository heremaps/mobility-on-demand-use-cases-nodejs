/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');
const nock = require('nock');
const proxyquireStrict = require('proxyquire').noCallThru();

const mockedConfig = require('./fixtures/config.json');

const routematching = proxyquireStrict('../src/routematching', { './config': mockedConfig });

const addNockInterceptor = () => {
  nock('https://rme.cit.api.here.com')
    .post('/2/matchroute.json')
    .query(Object.assign({}, mockedConfig))
    .reply(200, {
      RouteLinks: [
        {
          shape: '37.87004 -122.26995 37.86996 -122.27055',
          linkId: -798712120,
          functionalClass: 5,
          confidence: 1,
          linkLength: 53.54,
          mSecToReachLinkFromStart: 5518,
        },
        {
          shape: '37.86996 -122.27055 37.87086 -122.27063',
          linkId: 23665445,
          functionalClass: 5,
          confidence: 1,
          linkLength: 100.14,
          mSecToReachLinkFromStart: 22456,
        },
      ],
    });
};

describe('routematching', () => {
  it('should match gpx track', () => {
    addNockInterceptor();
    return routematching
      .matchGpx()
      .then(result => assert.deepEqual(result, [-798712120, 23665445]));
  });
});
