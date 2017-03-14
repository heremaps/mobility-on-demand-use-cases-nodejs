/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const config = require('./config');
const superagent = require('superagent');

/**
 * Builds a GET request for the calculateroute.json endpoint of the Toll Cost Extension API.
 * The calculateroute.json endpoint calculates a route given two (or more) waypoints, and returns a route, along with its associated toll costs
 *
 * @param {Object} start - The start location
 * @param {Object} destination - The destination location
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @param {string} currency - The currency in which to return toll cost information (three-letter code, e.g. 'USD')
 * @param {Object} vehicleSpec - An object containing the vehicle's attributes. See the Toll Cost Extension's API Reference for more information on available parameters
 * @returns {Object} An object containing the request options
 */
function buildTollCostCalculateRouteRequestQuery(start, destination, mode, currency, vehicleSpec) {
  return Object.assign({
    waypoint0: `${start.lat},${start.lon}`,
    waypoint1: `${destination.lat},${destination.lon}`,
    mode,
    currency,
  }, config, vehicleSpec);
}

/**
 * Builds a GET request for the tollcost.json endpoint of the Toll Cost Extension API.
 * The tollcost.json endpoint return detailed toll cost information associated with given linkids
 *
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @param {string} currency - The currency in which to return toll cost information (three-letter code, e.g. 'USD')
 * @param {Object} vehicleSpec - An object containing the vehicle's attributes. See the Toll Cost Extension's API Reference for more information on available parameters
 * @param {string[]} links - An array of link ids that were traversed as part of the route (in order of traversal)
 * @param {string} rollup - Comma separated list of aggregation levels in the result. Currently supported: 'none', 'total', 'tollsys', 'country'
 * @returns {Object} An object containing the request options
 */
function buildTollCostLinksRequestQuery(mode, currency, vehicleSpec, links, rollup) {
  return Object.assign({
    mode,
    currency,
    route: links.join(';'),
    rollup,
  }, config, vehicleSpec);
}

/**
 * Calls the Toll Cost Extension API to calculate a route between waypoints and its associated toll costs
 *
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @param {string} currency - The currency in which to return toll cost information (three-letter code, e.g. 'USD')
 * @param {Object} vehicleSpec - An object containing the vehicle's attributes. See the Toll Cost Extension's API Reference for more information on available parameters
 * @param {string[]} links - An array of link ids that were traversed as part of the route (in order of traversal)
 * @returns {number} The total cost
 */
function costForWaypoints(start, destination, mode, currency, vehicleSpec) {
  const query = buildTollCostCalculateRouteRequestQuery(start, destination, mode, currency, vehicleSpec);
  return superagent.get('https://tce.cit.api.here.com/2/calculateroute.json')
    .query(query)
    .then(result => result.body.costs.totalCost)
    .catch((err) => {
      console.error('Error while querying Tollcost Extension API for route', err.status, err.message, err.response && err.response.body);
      return Promise.reject(new Error(err.message));
    });
}

/**
 * Calls the Toll Cost Extension API to calculate toll costs associated with given links
 *
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @param {string} currency - The currency in which to return toll cost information (three-letter code, e.g. 'USD')
 * @param {Object} vehicleSpec - An object containing the vehicle's attributes. See the Toll Cost Extension's API Reference for more information on available parameters
 * @param {string[]} links - An array of link ids that were traversed as part of the route (in order of traversal)
 * @param {string} rollup - Comma separated list of aggregation levels in the result. Currently supported: 'none', 'total', 'tollsys', 'country'
 * @returns {Object}
 */
function costForLinks(mode, currency, vehicleSpec, links, rollup) {
  const query = buildTollCostLinksRequestQuery(mode, currency, vehicleSpec, links, rollup);
  return superagent.get('https://tce.cit.api.here.com/2/tollcost.json')
    .query(query)
    .then(result => result.body)
    .catch((err) => {
      console.error('Error while querying Tollcost Extension API for costs', err.status, err.message, err.response && err.response.body);
      return Promise.reject(new Error(err.message));
    });
}

module.exports = {
  costForWaypoints,
  costForLinks,
};
