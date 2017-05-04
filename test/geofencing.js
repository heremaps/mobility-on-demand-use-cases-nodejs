/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');
const nock = require('nock');
const proxyquireStrict = require('proxyquire').noCallThru();

const proximityResponse = require('./fixtures/geofencing-proximity-response.json');
const mockedCleProximityResponse = require('./fixtures/cle-proximity-response.json');
const mockedConfig = require('./fixtures/config.json');

const geofencing = proxyquireStrict('../src/geofencing', { './config': mockedConfig });

describe('geofencing', () => {
  const addNockInterceptorForFindAdminAreas = () => {
    nock('https://maps.gfe.cit.api.here.com')
      .get('/1/search/proximity.json')
      .query(Object.assign({
        layer_ids: 'ADMIN_POLY_0,ADMIN_POLY_1,ADMIN_POLY_2,ADMIN_POLY_8,ADMIN_POLY_9',
        key_attributes: 'ADMIN_PLACE_ID,ADMIN_PLACE_ID,ADMIN_PLACE_ID,ADMIN_PLACE_ID,ADMIN_PLACE_ID',
        proximity: '54.13,13.2',
      }, mockedConfig))
      .reply(200, proximityResponse);
  };

  it('geofence find admin areas for location', () => {
    addNockInterceptorForFindAdminAreas();
    return geofencing.findAdminAreasForLocation({ lat: 54.13, lon: 13.2 })
      .then((res) => { assert.strictEqual(res.length, 4); });
  });

  const addNockInterceptorForCustomLayers = () => {
    nock('https://cle.cit.api.here.com')
      .get('/2/search/proximity.json')
      .query(Object.assign({
        layer_ids: 'CUSTOM_LAYER_ID',
        key_attributes: 'ID',
        proximity: '54.13,13.2',
      }, mockedConfig))
      .reply(200, mockedCleProximityResponse);
  };

  it('geofence search custom layers', () => {
    addNockInterceptorForCustomLayers();
    return geofencing.searchCustomLayers({ lat: 54.13, lon: 13.2 }, ['CUSTOM_LAYER_ID'], ['ID'])
      .then(result => assert.deepEqual(result, ['1']));
  });

  const SOME_WKT = 'MULTIPOLYGON(((-0122.34375 37.26563,-0122.34375 37.96875,-0121.64062 37.96875,-0121.64062 37.26563,-0122.34375 37.26563)))';

  const addNockInterceptorForUpload = () => {
    nock('https://cle.cit.api.here.com')
      .post('/2/layers/upload.json')
      .query(Object.assign({
        layer_id: 'CUSTOM_LAYER_ID',
      }, mockedConfig))
      .reply(200, {});
  };

  it('geofence upload wkt', () => {
    addNockInterceptorForUpload();
    return geofencing.uploadWkt('CUSTOM_LAYER_ID', SOME_WKT);
  });
});
