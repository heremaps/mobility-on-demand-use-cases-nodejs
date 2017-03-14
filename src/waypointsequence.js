/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const config = require('./config');
const superagent = require('superagent');
const _ = require('lodash');

/**
 * Builds a GET request for the Waypoint Sequence Extension API.
 *
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @param {string} optimizeFor - The parameter to optimize the sequence for ('time' or 'distance')
 * @param {Object} start - The start waypoint
 * @param {Object} end - The end waypoint
 * @param {Object[]} destinations  - Array of intermediate waypoints to find optimal sequence for
 * @returns {Object} An object containing the request options
 */
function buildFindSequenceRequestQuery(mode, optimizeFor, start, end, destinations) {
  const destinationParams = _.fromPairs(destinations.map((value, index) => {
    const key = `destination${index + 1}`;
    const val = `${value.lat},${value.lon}`;
    return [key, val];
  }));
  return Object.assign(
    {
      start: [start.lat, start.lon].join(','),
      end: [end.lat, end.lon].join(','),
      mode,
      improveFor: optimizeFor,
      departure: 'now',
    },
    config,
    destinationParams);
}

/**
 * Calls the Waypoint Sequence Extension (WSE) API to find the optimal sequence of waypoints
 *
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @param {string} optimizeFor - The parameter to optimize the sequence for ('time' or 'distance')
 * @param {Object} start - The start waypoint
 * @param {Object} end - The end waypoint
 * @param {Object[]} destinations  - Array of intermediate waypoints to find optimal sequence for
 */
function findOptimalSequence(mode, optimizeFor, start, end, destinations) {
  const query = buildFindSequenceRequestQuery(mode, optimizeFor, start, end, destinations);
  return superagent.get('https://wse.cit.api.here.com/2/findsequence.json')
    .query(query)
    .then((response) => {
      const result = response.body.results[0];
      // First and last items in waypoints array are start and end waypoints, we're only interested in the order of the destinations in between
      const destinationsInOrder = result.waypoints.slice(1, -1);
      // Subtract 1 from index as WSE indexes destinations starting from 1
      return destinationsInOrder.map(waypoint => Number(waypoint.id.substr('destination'.length)) - 1);
    })
    .catch((err) => {
      console.error('Error while querying Waypoint Sequence Extension API', err.status, err.message, err.response && err.response.body);
      return Promise.reject(new Error(err.message));
    });
}

module.exports = { findOptimalSequence };
