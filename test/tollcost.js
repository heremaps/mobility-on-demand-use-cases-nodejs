/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');
const nock = require('nock');
const proxyquireStrict = require('proxyquire').noCallThru();

const mockedConfig = require('./fixtures/config.json');

const tollcost = proxyquireStrict('../src/tollcost', { './config': mockedConfig });

describe('tollcost', () => {
  const vehicleSpec = {
    emissionType: 5,
    height: 167,
    vehicleWeight: 1739,
    limitedWeight: 2500,
    passengersCount: 4,
    commercial: 1,
  };

  const addNockInterceptorForWaypoints = () => {
    nock('https://tce.cit.api.here.com')
      .get('/2/calculateroute.json')
      .query(Object.assign(
        vehicleSpec,
        {
          waypoint0: '37.870242,-122.268234',
          waypoint1: '37.787526,-122.407603',
          mode: 'fastest;car;traffic:enabled',
          currency: 'USD',
        }, mockedConfig))
      .reply(200, {
        costs: {
          totalCost: 14,
        },
      });
  };

  it('should return cost for waypoints', () => {
    addNockInterceptorForWaypoints();
    return tollcost.costForWaypoints({ lat: 37.870242, lon: -122.268234 }, { lat: 37.787526, lon: -122.407603 }, 'fastest;car;traffic:enabled', 'USD', vehicleSpec)
      .then(result => assert.strictEqual(result, 14));
  });

  const addNockInterceptorForWaypointsReturningError = () => {
    nock('https://tce.cit.api.here.com')
      .get('/2/calculateroute.json')
      .query(Object.assign(
        vehicleSpec,
        {
          waypoint0: '37.870242,-122.268234',
          waypoint1: '37.787526,-122.407603',
          mode: 'fastest;car;traffic:enabled',
          currency: 'USD',
        },
        mockedConfig))
      .reply(400, {
        message: 'Bad Request',
      });
  };

  it('getting costs for links should fail in case of error response', () => {
    addNockInterceptorForWaypointsReturningError();
    return tollcost.costForWaypoints({ lat: 37.870242, lon: -122.268234 }, { lat: 37.787526, lon: -122.407603 }, 'fastest;car;traffic:enabled', 'USD', vehicleSpec)
      .catch(error => assert.deepEqual(error.message, 'Bad Request'));
  });

  const addNockInterceptorForLinks = () => {
    nock('https://tce.cit.api.here.com')
      .get('/2/tollcost.json')
      .query(Object.assign(
        vehicleSpec,
        {
          route: 'linkId1,linkId2',
          rollup: true,
          mode: 'fastest;car;traffic:enabled',
          currency: 'USD',
        },
        mockedConfig))
      .reply(200, {
        costsByCountry: [{ country: 'USA', amountInTargetCurrency: 5 }],
      });
  };

  it('should return costs for links', () => {
    addNockInterceptorForLinks();
    return tollcost.costForLinks('fastest;car;traffic:enabled', 'USD', vehicleSpec, ['linkId1', 'linkId2'], true)
      .then(result => assert.deepEqual(result, { costsByCountry: [{ country: 'USA', amountInTargetCurrency: 5 }] }));
  });

  const addNockInterceptorForLinksReturningError = () => {
    nock('https://tce.cit.api.here.com')
      .get('/2/tollcost.json')
      .query(Object.assign(
        vehicleSpec,
        {
          route: 'linkId1,linkId2',
          rollup: true,
          mode: 'fastest;car;traffic:enabled',
          currency: 'USD',
        },
        mockedConfig))
      .reply(400, {
        message: 'Bad Request',
      });
  };

  it('getting costs for links should fail in case of error response', () => {
    addNockInterceptorForLinksReturningError();
    return tollcost.costForLinks('fastest;car;traffic:enabled', 'USD', vehicleSpec, [], true)
      .catch(error => assert.deepEqual(error.message, 'Bad Request'));
  });
});
