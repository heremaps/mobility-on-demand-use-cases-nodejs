/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const config = require('./config');
const superagent = require('superagent');

/**
 * Builds a GET request for the Isoline Routing API.
 * An isoline is a shape that represents the area which can be reached from a certain point within a given time or distance (regular isoline),
 * or the area from which a certain point point can be reached within a given time or distance (reverse isoline)
 *
 * @param {string} rangeType - Indicates whether the isoline represents distance (isodistance) or time (isochrone).  Possible values are 'distance' and 'time'
 * @param {boolean} isReverse - Indicates whether a regular or reverse isoline will be calculated.  'true' results in a reverse isoline, 'false' in a regular isoline
 * @param {Object} location - The location around which to build the isoline
 * @param {number} range - The distance (in meters) or time (in seconds).  The unit is determined by the rangeType parameter
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @returns {Object} An object containing the request options
 */
function buildIsolineRoutingRequestQuery(rangeType, isReverse, location, range, mode) {
  const locationParamKey = isReverse ? 'destination' : 'start';
  const locationParam = {};
  locationParam[locationParamKey] = `geo!${location.lat},${location.lon}`;
  return Object.assign({
    rangeType,
    range,
    mode,
  }, config, locationParam);
}

/**
 * Calls the Isoline Routing API to calculate a reverse isochrone
 *
 * @param {Object} location - The location around which to build the isoline
 * @param {number} range - The distance (in meters) or time (in seconds).  The unit is determined by the rangeType parameter
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @returns {Object}
 */
function getReverseIsochrone(location, range, mode) {
  const query = buildIsolineRoutingRequestQuery('time', true, location, range, mode);
  return superagent.get('https://isoline.route.cit.api.here.com/routing/7.2/calculateisoline.json')
    .query(query)
    .then((result) => {
      let wkt = '';
      // If the response contains one or more isolines, convert them to a WKT MULTIPOLYGON
      if (result.body.response && result.body.response.isoline) {
        wkt = `MULTIPOLYGON (${result.body.response.isoline.map(isoline =>
                                     isoline.component.map(component =>
                                       `((${component.shape.map(shape =>
                                                                // Reverse order of latitude and longitude, WKT expects them in the format X Y, where X is longitude and Y is latitude
                                                                shape.split(',').reverse().join(' ')).join(', ')}))`).join(', ')).join(', ')})`;
      }
      return wkt;
    })
    .catch((err) => {
      console.error('Error while querying Isoline Routing API', err.status, err.message, err.response && err.response.body);
      return Promise.reject(new Error(err.message));
    });
}

module.exports = { getReverseIsochrone };
