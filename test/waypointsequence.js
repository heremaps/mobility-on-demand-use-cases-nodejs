/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');
const nock = require('nock');
const proxyquireStrict = require('proxyquire').noCallThru();

const mockedConfig = require('./fixtures/config.json');

const waypointsequence = proxyquireStrict('../src/waypointsequence', { './config': mockedConfig });

describe('waypoint sequence', () => {
  const addNockInterceptor = () => {
    nock('https://wse.cit.api.here.com')
      .get('/2/findsequence.json')
      .query(Object.assign({
        start: '36.15163291326712,-115.17917275428772',
        end: '36.15163291326712,-115.17917275428772',
        destination1: '36.15247322857949,-115.18184423446655',
        destination2: '36.151589597800815,-115.17740249633789',
        destination3: '36.151589597800815,-115.17847537994383',
        improveFor: 'time',
        departure: 'now',
        mode: 'fastest;car;traffic:enabled',
      }, mockedConfig))
      .reply(200, {
        results: [
          {
            waypoints: [
              {
                id: 'start',
                lat: 36.15163291326712,
                lng: -115.17917275428772,
                sequence: 0,
                estimatedArrival: null,
                fulfilledConstraints: [],
              },
              {
                id: 'destination2',
                lat: 36.151589597800815,
                lng: -115.17740249633789,
                sequence: 1,
                estimatedArrival: null,
                fulfilledConstraints: [],
              },
              {
                id: 'destination3',
                lat: 36.151589597800815,
                lng: -115.17847537994383,
                sequence: 2,
                estimatedArrival: null,
                fulfilledConstraints: [],
              },
              {
                id: 'destination1',
                lat: 36.15247322857949,
                lng: -115.18184423446655,
                sequence: 3,
                estimatedArrival: null,
                fulfilledConstraints: [],
              },
              {
                id: 'end',
                lat: 36.15163291326712,
                lng: -115.17917275428772,
                sequence: 4,
                estimatedArrival: null,
                fulfilledConstraints: [],
              },
            ],
          }],
      });
  };

  it('should return optimal order', () => {
    addNockInterceptor();
    const mode = 'fastest;car;traffic:enabled';
    const depotLocation = { lat: 36.15163291326712, lon: -115.17917275428772 };
    const locations = [{ lat: 36.15247322857949, lon: -115.18184423446655 }, { lat: 36.151589597800815, lon: -115.17740249633789 }, { lat: 36.151589597800815, lon: -115.17847537994383 }];
    return waypointsequence.findOptimalSequence(mode, 'time', depotLocation, depotLocation, locations)
      .then(result => assert.deepEqual(result, [1, 2, 0]));
  });
});
