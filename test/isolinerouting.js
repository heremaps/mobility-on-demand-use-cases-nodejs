/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');
const nock = require('nock');
const proxyquireStrict = require('proxyquire').noCallThru();

const mockedConfig = require('./fixtures/config.json');

const isolinerouting = proxyquireStrict('../src/isolinerouting', { './config': mockedConfig });

describe('isoline routing', () => {
  const addNockInterceptor = () => {
    nock('https://isoline.route.cit.api.here.com')
      .get('/routing/7.2/calculateisoline.json')
      .query(Object.assign({
        destination: 'geo!52.52,13.4',
        range: 300,
        rangeType: 'time',
        mode: 'fastest;car;traffic:enabled',
      }, mockedConfig))
      .reply(200, {
        response: {
          destination: {
            originalPosition: {
              longitude: 13.4,
              latitude: 52.5199999,
            },
            mappedPosition: {
              longitude: 13.3997047,
              latitude: 52.5202703,
            },
            linkId: '+53501245',
          },
          isoline: [
            {
              component: [
                {
                  shape: [
                    '52.519450,13.3882000',
                    '52.519455,13.3882000',
                    '52.519455,13.3882000',
                    '52.519450,13.3882000',
                  ],
                  id: 0,
                },
              ],
              range: 300,
            },
          ],
          center: {
            longitude: 13.4,
            latitude: 52.5199999,
          },
        },
      });
  };


  it('should return reverse isochrone', () => {
    const location = { lat: 52.52, lon: 13.40 };
    const rangeInSeconds = 300;
    const mode = 'fastest;car;traffic:enabled';
    addNockInterceptor();
    return isolinerouting
      .getReverseIsochrone(location, rangeInSeconds, mode)
      .then(res => assert.strictEqual(res, 'MULTIPOLYGON (((13.3882000 52.519450, 13.3882000 52.519455, 13.3882000 52.519455, 13.3882000 52.519450)))'));
  });
});
