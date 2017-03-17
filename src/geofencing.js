/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const config = require('./config');

const _ = require('lodash');
const superagent = require('superagent');
const zip = require('node-zip')();

/**
 * Builds a GET request for the Geofencing Extension using pre-defined adminstrative area layers.
 * This request will test a location for the administrative areas (e.g. cities, counties, countries, etc.) it is within.
 *
 * @param {Object} location The location to test for
 * @returns {Object} An object containing the request query
 */
function buildGfeWithPdeLayersRequestQuery(location) {
  return Object.assign({
    // The ADMIN_POLY_X layers are layers that contain shapes of administrative areas.  These layers are defined in the Platform Data Extension
    layer_ids: 'ADMIN_POLY_0,ADMIN_POLY_1,ADMIN_POLY_2,ADMIN_POLY_8,ADMIN_POLY_9',
    // The key_attributes are the attributes for each layer which uniquely identify an entry in this layer.  For the ADMIN_POLY_X layers, these are always ADMIN_PLACE_ID
    key_attributes: 'ADMIN_PLACE_ID,ADMIN_PLACE_ID,ADMIN_PLACE_ID,ADMIN_PLACE_ID,ADMIN_PLACE_ID',
    proximity: `${location.lat},${location.lon}`,
  }, config);
}

/**
 * Builds a GET request for the Geofencing Extension using custom layers uploaded by the developer.
 *
 * @param {Object} location The location to test for
 * @param {string[]} layerIds An array of ids of the layers to test the location for
 * @param {string[]} keyAttributes An array of the attributes in each layer which uniquely identify an entry.
 * This array must always have the same length as the layerIds array, as a keyAttribute needs to be present for each layer
 * @returns {Object} An object containing the request query
 */
function buildGfeWithCustomLayersRequestQuery(location, layerIds, keyAttributes) {
  return Object.assign({
    layer_ids: layerIds.join(','),
    key_attributes: keyAttributes.join(','),
    proximity: `${location.lat},${location.lon}`,
  }, config);
}

/**
 * Builds a POST request for uploading a layer to the Geofencing Extension.
 *
 * @param {string} layerId  The id of the layer being uploaded
 * @returns {Object} An object containing the request query
 */
function buildUploadLayerRequestQuery(layerId) {
  return Object.assign({
    layer_id: layerId,
  }, config);
}


/**
 * Calls the Geofencing Extension API to find administrative areas a location is within.
 *
 * @param {Object} location The location to test for
 * @returns {Object[]} An array of area objects
 */
function findAdminAreasForLocation(location) {
  const query = buildGfeWithPdeLayersRequestQuery(location);
  let areas = [];

  return superagent.get('https://maps.gfe.cit.api.here.com/1/search/proximity.json')
    .query(query)
    .then((result) => {
      const geometries = result.body.geometries;
      if (geometries) {
        areas = geometries.filter(geometry => geometry.distance <= 0).map(geometry => ({
          name: geometry.attributes.NAME,
          admin_layer: geometry.attributes.ADMIN_ORDER,
          admin_place_id: geometry.attributes.ADMIN_PLACE_ID,
          geometry: geometry.geometry }));
      }
      return areas;
    })
    .catch((err) => {
      console.error('Error while querying geofencing extension API', err.status, err.message, _.get(err, 'response.text'));
      return Promise.reject(new Error(err.message));
    });
}

/**
 * Calls the Geofencing Extension API to find custom layers a location is within.
 *
 * @param {Object} location The location to test for
 * @returns {string[]} Array of tripIds
 */
function searchCustomLayers(location, layerIds, keyAttributes) {
  const query = buildGfeWithCustomLayersRequestQuery(location, layerIds, keyAttributes);
  let rows = [];
  return superagent.get('https://cle.cit.api.here.com/2/search/proximity.json')
    .query(query)
    .then((result) => {
      const geometries = result.body.geometries;
      if (geometries) {
        rows = geometries.filter(geometry => geometry.distance <= 0).map((geometry) => {
          let keyAttribute;
          // The geometry doesn't necessarily have a layerId object if the request contained only one layer
          if (geometry.layerId) {
            keyAttribute = keyAttributes[layerIds.indexOf(geometry.layerId)];
          } else {
            keyAttribute = keyAttributes[0];
          }
          return geometry.attributes[keyAttribute];
        });
      }
      return rows;
    })
    .catch((err) => {
      console.error('Error while querying custom layer extension API', err.status, err.message, _.get(err, 'response.text'));
      return Promise.reject(new Error(err.message));
    });
}

/**
 * Calls the Custom Location Extension API to upload a WKT file to a custom layer.
 *
 * @param {Object} location The location to test for
 * @param {Object} wkt polygon in well-known-text format
 */
function uploadWkt(layerId, wkt) {
  // The data must be zipped before uploading to the Custome Location Extension
  // The WKT filename is arbitrary, but must have the .wkt extension
  zip.file('wktUpload.wkt', wkt);
  const wktData = zip.generate({ type: 'base64', compression: 'DEFLATE' });
  const buffer = new Buffer(wktData, 'base64');
  const query = buildUploadLayerRequestQuery(layerId);
  return superagent.post('https://cle.cit.api.here.com/2/layers/upload.json')
    .query(query)
    .attach('zipfile', buffer, 'wktUpload.wkt.zip')
    .catch((err) => {
      console.error('Error while uploading to the Custom Location Extension API', err.status, err.message, _.get(err, 'response.text'));
      return Promise.reject(new Error(err.message));
    });
}

module.exports = {
  findAdminAreasForLocation,
  searchCustomLayers,
  uploadWkt,
};
