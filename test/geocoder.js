/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const assert = require('assert');
const nock = require('nock');
const proxyquireStrict = require('proxyquire').noCallThru();

const mockedConfig = require('./fixtures/config.json');

const geocoder = proxyquireStrict('../src/geocoder', { './config': mockedConfig });

describe('geocoder', () => {
  const addNockInterceptor = () => {
    nock('https://geocoder.cit.api.here.com')
      .get('/6.2/geocode.json')
      .query(Object.assign({
        searchText: 'address',
        gen: 9,
      }, mockedConfig))
      .reply(200, {
        Response: {
          View: [{
            Result: [{
              Location: {
                NavigationPosition: [{
                  Latitude: 53,
                  Longitude: 13,
                }],
              },
            }],
          }],
        },
      });
  };

  it('should geocode an address', () => {
    addNockInterceptor();
    return geocoder.geocode('address')
      .then(result => assert.deepEqual(result, { lat: 53, lon: 13 }));
  });

  const addDisplayPositionNockInterceptor = () => {
    nock('https://geocoder.cit.api.here.com')
      .get('/6.2/geocode.json')
      .query(Object.assign({
        searchText: 'address',
        gen: 9,
      }, mockedConfig))
      .reply(200, {
        Response: {
          View: [{
            Result: [{
              Location: {
                DisplayPosition: {
                  Latitude: 53,
                  Longitude: 13,
                },
              },
            }],
          }],
        },
      });
  };

  it('should geocode an address and use display position', () => {
    addDisplayPositionNockInterceptor();
    return geocoder.geocode('address')
      .then(result => assert.deepEqual(result, { lat: 53, lon: 13 }));
  });

  const addErrorNockInterceptor = () => {
    nock('https://geocoder.cit.api.here.com')
      .get('/6.2/geocode.json')
      .query(Object.assign({
        searchText: 'address',
        gen: 9,
      }, mockedConfig))
      .reply(400, {
        Response: {
          View: [{
            Result: [{
              Location: {
                NavigationPosition: [{
                  Latitude: 53,
                  Longitude: 13,
                }],
              },
            }],
          }],
        },
      });
  };

  it('should return an error', () => {
    addErrorNockInterceptor();
    return geocoder.geocode('address')
      .then(null, res => assert.deepEqual(res.message, 'Bad Request'));
  });
});
