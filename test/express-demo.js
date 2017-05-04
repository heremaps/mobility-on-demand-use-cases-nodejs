/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const proxyquireStrict = require('proxyquire').noCallThru();
const assert = require('assert');
const request = require('supertest');
const sinon = require('sinon');

const mockedAreas = require('./fixtures/get-stored-areas.json');
const mockedAdminAreas = require('./fixtures/find-areas-for-location.json');
const mockedAdminPlaceIndexTiles = require('./fixtures/platformdata-index-response.json');
const mockedTilesForIndexResponse = require('./fixtures/get-tiles-for-index.json');

const geofencingStub = {};
const platformdataStub = {};
const dbStub = {};
dbStub.getStoredAreas = sinon.stub().resolves(mockedAreas);
dbStub.insertArea = sinon.stub().resolves();
dbStub.initializeDb = sinon.stub().resolves();
geofencingStub.findAdminAreasForLocation = sinon.stub().resolves(mockedAdminAreas);
platformdataStub.getAdminPlaceIndexTiles = sinon.stub().resolves(mockedAdminPlaceIndexTiles);
platformdataStub.getTilesForIndexResponse = sinon.stub().resolves(mockedTilesForIndexResponse);

const app = proxyquireStrict('../src/express-demo', { './geofencing': geofencingStub, './platformdata': platformdataStub, './db': dbStub });

describe('server test suite', () => {
  it('should get admin areas', () => {
    request(app)
      .get('/adminAreas')
      .query({ lat: 37.870242, lon: -122.268234 })
      .expect('Content-Type', /json/)
      .expect(200)
      .then((response) => {
        assert.strictEqual(response.body.areas.length, 4);
      });
  });

  it('getting admin areas should fail if latitude is not a number', () =>
     request(app)
      .get('/adminAreas')
      .query({ lat: NaN, lon: -122.268234 })
      .expect('Content-Type', /json/)
      .expect(400)
      .expect({ message: 'Latitude must be a number' }));

  it('getting admin areas should fail if longitude is not a number', () =>
     request(app)
     .get('/adminAreas')
     .query({ lat: 37.870242, lon: NaN })
     .expect('Content-Type', /json/)
     .expect(400)
     .expect({ message: 'Longitude must be a number' }));

  it('should get stored areas', () =>
     request(app)
     .get('/storedAreas')
     .expect('Content-Type', /json/)
     .expect(mockedAreas));

  it('should store area', () => {
    const area = {
      admin_layer: 8,
      admin_place_id: 21009409,
      name: 'Alameda',
    };
    return request(app)
      .post('/storedAreas')
      .send(area)
      .expect(201);
  });

  it('storing area should fail in case of invalid data', () => {
    const area = {
      admin_place_id: 21009409,
      name: 'Alameda',
    };

    return request(app)
      .post('/storedAreas')
      .send(area)
      .expect(400)
      .expect('Content-Type', /json/)
      .expect({ message: 'Invalid area' });
  });
});
