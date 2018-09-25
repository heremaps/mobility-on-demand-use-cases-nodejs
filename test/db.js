/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const _ = require('lodash');
const assert = require('assert');
const proxyquireStrict = require('proxyquire').noCallThru();
const sinon = require('sinon');
const mockedAreas = require('./fixtures/find-areas-for-location.json');
const mockedConfig = require('./fixtures/config.json');

const geofencingStub = {
  findAdminAreasForLocation: sinon.stub().resolves(mockedAreas),
};
const db = proxyquireStrict('../src/db', { './geofencing': geofencingStub, './config': mockedConfig });

let testAreas;
let testDrivers;
const TEST_DB_NAME = 'test.db';

after('close connection and remove database', () => {
  db.close();
  db.remove(TEST_DB_NAME);
});

describe('database test suite', () => {
  it('should successfully initialize db', () => {
    testAreas = [
      { name: 'San Francisco', admin_layer: 8, admin_place_id: 21010232 },
      { name: 'Alameda', admin_layer: 8, admin_place_id: 21009409 },
    ];
    testDrivers = [
      { name: 'driverOne', location: { lat: 37.780464, lon: -122.417280 } },
      { name: 'driverTwo', location: { lat: 37.782734, lon: -122.414838 } },
    ];

    return db.initializeDb(testAreas, testDrivers, true, TEST_DB_NAME);
  });

  it('should get stored areas', () => db.getStoredAreas()
    .then(areas => assert.deepEqual(areas.map(area => _.omit(area, 'rowid')), testAreas)));

  it('should get all drivers', () => {
    const expected = [
      {
        name: 'driverOne',
        latitude: 37.780464,
        longitude: -122.41728,
        area_id: 2,
      }, {
        name: 'driverTwo',
        latitude: 37.782734,
        longitude: -122.414838,
        area_id: 2,
      },
    ];
    return db.getAllDrivers()
      .then(drivers => assert.deepEqual(drivers.map(driver => _.omit(driver, 'rowid')), expected));
  });

  it('should update driver location', () => {
    const location = { lat: 38.70, lon: -120.40 };
    let driver;
    return db.getOneDriver()
      .then((row) => {
        driver = row;
        return db.updateDriverLocation(driver.rowid, location);
      })
      .then(() => db.getDriverByRowId(driver.rowid))
      .then(updatedDriver => assert.deepEqual({ lat: updatedDriver.latitude, lon: updatedDriver.longitude }, location));
  });

  it('should create trip', () => {
    const wkt = 'MULTIPOLYGON (((13.3882000 52.519450, 13.3882000 52.519455, 13.3882000 52.519455, 13.3882000 52.519450)))';
    return db.createTrip({ lat: 38.60, lon: -120.30 }, { lat: 39.60, lon: -120.30 }, wkt);
  });

  it('driver should not be a candidate for a trip', () => db.getOneDriver()
    .then(driver => db.driverIsTripCandidate(driver.rowid))
    .then(isCandidate => assert.strictEqual(isCandidate, false)));

  it('should get candidate drivers for trip', () => {
    let trip;
    let driver;
    return db.getOneDriver()
      .then((row) => {
        driver = row;
        return db.getNewTrips();
      })
      .then((trips) => { trip = _.first(trips); })
      .then(() => db.addCandidateDriver(driver.rowid, [trip.rowid]))
      .then(() => db.getCandidateDriversForTrip(trip.rowid))
      .then(drivers => assert.deepEqual(_.first(drivers).rowid, driver.rowid));
  });

  it('should assign driver to trip', () => {
    let trip;
    let driver;
    return db.getOneDriver()
      .then((row) => {
        driver = row;
        return db.getNewTrips();
      })
      .then((trips) => { trip = _.first(trips); })
      .then(() => db.addCandidateDriver(driver.rowid, [trip.rowid]))
      .then(() => db.getCandidateDriversForTrip(trip.rowid))
      .then(drivers => db.assignDriverToTrip(trip.rowid, _.first(drivers).rowid))
      .then(() => db.driverIsTripCandidate(driver.rowid))
      .then(isCandidate => assert(isCandidate));
  });

  it('should get drivers in area', () => {
    const areaId = 2;
    return db.getDriversInArea(areaId)
      .then(drivers => assert.deepEqual(drivers.map(driver => driver.name), ['driverOne', 'driverTwo']));
  });

  it('should clear all trips', () => db.clearAllTrips()
    .then(() => db.getNewTrips())
    .then(trips => assert.strictEqual(trips.length, 0)));
});
