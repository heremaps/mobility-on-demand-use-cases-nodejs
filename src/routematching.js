/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const config = require('./config');
const superagent = require('superagent');

/**
 * Builds a POST request for the Route Matching Extension API.
 *
 * @param {string} routeMode - The routing mode ('car' or 'pedestrian')
 * @returns {Object} An object containing the request options
 */
function buildMatchRouteRequestQuery(routeMode) {
  return Object.assign(
    { routemode: routeMode },
    config);
}

/**
 * Calls the Route Matching Extension API to match a GPX trace to links in the HERE data
 *
 * @param {string} routeMode - The routing mode ('car' or 'pedestrian')
 * @param {string} gpx - The gpx trace
 * @returns {Promise}
 */
function matchGpx(routeMode, gpx) {
  const query = buildMatchRouteRequestQuery(routeMode);
  return superagent.post('https://rme.cit.api.here.com/2/matchroute.json')
    .set('content-type', 'text/plain') // For production use cases data should be zipped
    .query(query)
    .send(gpx)
    .then((result) => {
      let links = [];
      if (result.body && result.body.RouteLinks) {
        links = result.body.RouteLinks.map(link => link.linkId);
      }
      return links;
    });
}

module.exports = { matchGpx };
