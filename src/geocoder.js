/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const config = require('./config');
const superagent = require('superagent');

/**
 * Builds a request query object for the Geocoder API.
 *
 * @param {string} address - The address to geocode
 * @returns {Object} An object containing the request query
 */
function buildGeocoderRequestQuery(address) {
  return Object.assign({
    gen: 9, // latest generation of the Geocoder API, recommended (see the Geocoder API documentation for more information)
    searchText: address,
  }, config);
}

/**
 * Calls the Geocoder API indexes to find a lat/lon position for an address
 *
 * @param {string} address - The address to geocode
 * @returns {Object} An object containing the position
 */
function geocode(address) {
  const query = buildGeocoderRequestQuery(address);

  return superagent.get('https://geocoder.cit.api.here.com/6.2/geocode.json')
    .query(query)
    .then((result) => {
      const view = result.body.Response.View[0];
      const location = view.Result[0].Location;
      // If navigation position is available, return it, otherwise, return display position
      const position = (location.NavigationPosition && location.NavigationPosition.length > 0) ?
                        location.NavigationPosition[0] : location.DisplayPosition;
      return { lat: position.Latitude, lon: position.Longitude };
    })
    .catch((err) => {
      console.error('Error while querying geocoder API', err.status, err.message, err.stack);
      return Promise.reject(new Error(err.message));
    });
}

module.exports = { geocode };
