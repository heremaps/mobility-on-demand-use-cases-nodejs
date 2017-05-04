/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const config = require('./config');
const superagent = require('superagent');
const _ = require('lodash');

/**
 * Builds a request query object for the Platform Data Extension API ADMIN_PLACE_X indexes.
 * These indexes tell you which tiles to request from the Platform Data Extension's layers to get information about specific places
 *
 * @param {string[]} adminPlaceIds - Array of admin place IDs
 * @returns {Object} An object containing the request query
 */
function buildPDEAdminPlaceIndexRequestQuery(adminPlaceIds) {
  return Object.assign({
    layer: 'ADMIN_PLACE_n',
    attributes: 'ADMIN_PLACE_ID',
    values: adminPlaceIds.join(','),
  }, config);
}

/**
 * Builds a request query object for the Platform Data Extension (PDE) Tiles API based on a response from the PDE Indexes
 *
 * @param {Object} indexLayerResponse - Layer Object as returned from PDE Indexes
 * @returns {Object} An object containing the request query
 */
function buildPDETilesRequestQueryFromIndexResponse(indexLayerResponse) {
  return Object.assign({
    layer: indexLayerResponse.layer,
    level: indexLayerResponse.level,
    tilexy: _.flatten(indexLayerResponse.tileXYs.map(obj => [obj.x, obj.y])).join(','),
  }, config);
}

/**
 * Calls the Platform Data Extension API indexes to find which tiles to query
 *
 * @param {string[]} adminPlaceIds - Array of admin place IDs
 * @returns {Object[]}  Array of layers
 */
function getAdminPlaceIndexTiles(adminPlaceIds) {
  const query = buildPDEAdminPlaceIndexRequestQuery(adminPlaceIds);

  return superagent.get('https://pde.cit.api.here.com/1/index.json')
    .query(query)
    .then(result => result.body)
    .catch((err) => {
      console.error('Error while querying Platform Data Extension API', err.status, err.message, err.stack);
      return Promise.reject(new Error(err.message));
    });
}

/**
 * Calls the Platform Data Extension tiles API and return results for relevant adminPlaceIds
 *
 * @param {string[]} adminPlaceIds - Array of admin place IDs
 * @param {Object} indexResponse - Layer Object as returned from PDE Indexes
 * @returns {Object[]} Array of relevant tiles
 */
function getTilesForIndexResponse(adminPlaceIds, indexResponse) {
  // PDE tiles API by default supports up to 15 tiles per request, so split each layer up into chunks of 15 tiles
  const responseLayerChunks = [];
  indexResponse.Layers.forEach((layer) => {
    const chunkedXYs = _.chunk(layer.tileXYs, 15);
    chunkedXYs.forEach((chunk) => {
      responseLayerChunks.push({ layer: layer.layer, level: layer.level, tileXYs: chunk });
    });
  });
  return Promise.all(responseLayerChunks.map((chunk) => {
    const query = buildPDETilesRequestQueryFromIndexResponse(chunk);
    return superagent.get('https://pde.cit.api.here.com/1/tiles.json')
      .query(query)
      .then(response => response.body)
      .catch((err) => {
        console.error('Error while querying Platform Data Extension tiles API', err.status, err.message, err.response && err.response.body);
        return Promise.reject(new Error(err.message));
      });
  })).then(tileChunks =>
           // Flatten and filter responses to return relevant rows
           _.flattenDeep(tileChunks.map(tileChunk =>
                                        tileChunk.Tiles.map(tile =>
                                                            tile.Rows.filter(row =>
                                                                             adminPlaceIds.includes(row.ADMIN_PLACE_ID))))));
}

module.exports = {
  getAdminPlaceIndexTiles,
  getTilesForIndexResponse,
};
