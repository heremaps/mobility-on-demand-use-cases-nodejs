/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');
const nock = require('nock');
const proxyquireStrict = require('proxyquire').noCallThru();

const mockedIndexResponse = require('./fixtures/platformdata-index-response.json');
const mockedTilesResponse = require('./fixtures/platformdata-tiles-response.json');
const mockedConfig = require('./fixtures/config.json');

const platformdata = proxyquireStrict('../src/platformdata', { './config': mockedConfig });

const addNockInterceptor = () => {
  nock('https://pde.cit.api.here.com')
    .get('/1/index.json')
    .query(Object.assign({
      layer: 'ADMIN_PLACE_n',
      attributes: 'ADMIN_PLACE_ID',
      values: '21000001,21009408,21009747,21009798',
    }, mockedConfig))
    .reply(200, mockedIndexResponse);
};

const expected = {
  Layers: [
    {
      layer: 'ADMIN_PLACE_0',
      level: 7,
      tileXYs: [
        {
          x: 31,
          y: 105,
        },
        {
          x: 23,
          y: 112,
        },
        {
          x: 60,
          y: 93,
        },
        {
          x: 20,
          y: 111,
        },
      ],
    },
    {
      layer: 'ADMIN_PLACE_1',
      level: 8,
      tileXYs: [
        {
          x: 84,
          y: 178,
        },
        {
          x: 88,
          y: 181,
        },
        {
          x: 85,
          y: 180,
        },
        {
          x: 82,
          y: 184,
        },
        {
          x: 87,
          y: 174,
        },
        {
          x: 90,
          y: 177,
        },
      ],
    },
    {
      layer: 'ADMIN_PLACE_8',
      level: 10,
      tileXYs: [
        {
          x: 325,
          y: 727,
        },
        {
          x: 324,
          y: 728,
        },
        {
          x: 324,
          y: 730,
        },
      ],
    },
  ],
};


describe('platform data', () => {
  it('get admin place index tiles', () => {
    addNockInterceptor();
    const adminPlaceIds = ['21000001', '21009408', '21009747', '21009798'];
    return platformdata.getAdminPlaceIndexTiles(adminPlaceIds)
      .then(result => assert.deepEqual(result, expected));
  });


  const addNockInterceptorForTiles = () => {
    nock('https://pde.cit.api.here.com')
      .get('/1/tiles.json')
      .query(Object.assign({
        layer: 'ADMIN_PLACE_0',
        level: '7',
        tilexy: '31,105,23,112,60,93,20,111',
      }, mockedConfig))
      .reply(200, mockedTilesResponse);
  };

  it('get tiles for index response', () => {
    addNockInterceptorForTiles();

    const expectedTiles = [
      { CARTO_ID: '718002093',
        ADMIN_PLACE_ID: '21009408',
        ADMIN_LEVEL: '2',
        ADMIN_ORDER: '1',
        FEATURE_TYPE: '909996',
        SOURCE_TYPE: 'L',
        NAME: 'California',
        LAT: '4007813,70312,,-70312,',
        LON: '-012234375,00,070313,00,-070313',
        INNER_LAT: null,
        INNER_LON: null },
      { CARTO_ID: '718002093',
        ADMIN_PLACE_ID: '21009408',
        ADMIN_LEVEL: '2',
        ADMIN_ORDER: '1',
        FEATURE_TYPE: '909996',
        SOURCE_TYPE: 'L',
        NAME: 'California',
        LAT: '3445313,70312,,-70312,',
        LON: '-011601562,00,070312,00,-070312',
        INNER_LAT: null,
        INNER_LON: null },
    ];

    const indexResponse = {
      Layers: [
        {
          layer: 'ADMIN_PLACE_0',
          level: 7,
          tileXYs: [
            {
              x: 31,
              y: 105,
            },
            {
              x: 23,
              y: 112,
            },
            {
              x: 60,
              y: 93,
            },
            {
              x: 20,
              y: 111,
            },
          ],
        },
      ],
    };
    return platformdata.getTilesForIndexResponse(['21009408'], indexResponse)
      .then(result => assert.deepEqual(result, expectedTiles));
  });
});
