/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');
const nock = require('nock');
const proxyquireStrict = require('proxyquire').noCallThru();

const mockedConfig = require('./fixtures/config.json');

const matrixrouting = proxyquireStrict('../src/matrixrouting', { './config': mockedConfig });

describe('matrix routing', () => {
  const addNockInterceptor = () => {
    nock('https://matrix.route.cit.api.here.com')
      .get('/routing/7.2/calculatematrix.json')
      .query(Object.assign({
        summaryAttributes: 'traveltime',
        mode: 'fastest;car;traffic:enabled',
        start0: 'geo!52.5194,13.3882',
        start1: 'geo!52.5204,13.3802',
        start2: 'geo!52.5254,13.3812',
        destination0: 'geo!52.7378,13.389',
      }, mockedConfig))
      .reply(200, {
        response: {
          matrixEntry: [
            {
              summary: {
                costFactor: 5841,
                travelTime: 5573,
              },
              destinationIndex: 0,
              startIndex: 0,
            },
            {
              summary: {
                costFactor: 5679,
                travelTime: 5323,
              },
              destinationIndex: 0,
              startIndex: 1,
            },
            {
              summary: {
                costFactor: 5668,
                travelTime: 5303,
              },
              destinationIndex: 0,
              startIndex: 2,
            },
          ],
        },
      });
  };

  it('should return a matrix with ETA', () => {
    const starts = [{ lat: 52.5194, lon: 13.38820 }, { lat: 52.5204, lon: 13.38020 }, { lat: 52.5254, lon: 13.38120 }];
    const destinations = [{ lat: 52.7378, lon: 13.3890 }];
    const mode = 'fastest;car;traffic:enabled';
    addNockInterceptor();
    return matrixrouting.getEtaMatrix(starts, destinations, mode)
      .then(res => assert.deepEqual([
        { startIndex: 0, destinationIndex: 0, eta: 5573 },
        { startIndex: 1, destinationIndex: 0, eta: 5323 },
        { startIndex: 2, destinationIndex: 0, eta: 5303 },
      ], res));
  });
});
