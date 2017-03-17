/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const config = require('./config');
const superagent = require('superagent');
const _ = require('lodash');


/**
 * Builds a request query object for the Matrix Routing API.
 *
 * @param {Object[]} starts An array of locations that serve as start points
 * @param {Object[]} destinations An array of locations that serve as destination points
 * @param {string} mode The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @returns {Object} An object containing the request query
 */
function buildEtaMatrixRoutingRequestQuery(starts, destinations, mode) {
  const startParams = _.fromPairs(starts.map((value, index) => {
    const key = `start${index}`;
    const val = `geo!${value.lat},${value.lon}`;
    return [key, val];
  }));
  const destinationParams = _.fromPairs(destinations.map((value, index) => {
    const key = `destination${index}`;
    const val = `geo!${value.lat},${value.lon}`;
    return [key, val];
  }));
  return Object.assign({
    mode,
    summaryAttributes: 'traveltime',
  }, config, startParams, destinationParams);
}

/**
 * Calls the Matrix Routing API to calculate an ETA Matrix
 *
 * @param {Object[]} starts An array of locations that serve as start points
 * @param {Object[]} destinations An array of locations that serve as destination points
 * @param {string} mode The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @returns {Object[]} Array of matrix entries
 */
function getEtaMatrix(starts, destinations, mode) {
  const query = buildEtaMatrixRoutingRequestQuery(starts, destinations, mode);
  let etaMatrix = [];
  return superagent.get('https://matrix.route.cit.api.here.com/routing/7.2/calculatematrix.json')
    .query(query)
    .then((result) => {
      if (result.body.response && result.body.response.matrixEntry) {
        etaMatrix = result.body.response.matrixEntry.map(element => ({
          startIndex: element.startIndex,
          destinationIndex: element.destinationIndex,
          eta: element.summary.travelTime }));
      }
      return etaMatrix;
    })
    .catch((err) => {
      console.error('Error while querying Matrix Routing API', err.status, err.message, err.response && err.response.body);
      return Promise.reject(new Error(err.message));
    });
}

module.exports = { getEtaMatrix };
