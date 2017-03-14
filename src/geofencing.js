/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

const config = require('./config');
const https = require('https');
const _ = require('lodash');
const superagent = require('superagent');
const FormData = require('form-data');
const zip = require('node-zip')();

/**
 * Builds a GET request for the Geofencing Extension using pre-defined adminstrative area layers.
 * This request will test a location for the administrative areas (e.g. cities, counties, countries, etc.) it is within.
 *
 * @param {Object} location The location to test for
 * @returns {Object} An object containing the request options
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
 * @returns {Object} An object containing the request options
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
 * @param {Object} form A FormData object containing the file to be uploaded
 * @returns {Object} An object containing the request options
 */
function buildUploadLayerRequestOptions(layerId, form) {
  const requestParams = _({
    layer_id: layerId,
    app_id: config.app_id,
    app_code: config.app_code,
  }).map((value, key) => `${key}=${encodeURIComponent(value)}`).join('&');
  return {
    method: 'POST',
    hostname: 'cle.cit.api.here.com',
    path: ['/2/layers/upload.json', requestParams].join('?'),
    headers: form.getHeaders(),
  };
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
      console.error('Error while querying geofencing extension API', err.status, err.message, err.response && err.response.error && err.response.error.text);
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
      console.error('error while querying custom layer extension API', err.status, err.message, err.response && err.response.body);
      return Promise.reject(new Error(err.message));
    });
}

/**
 * Calls the Geofencing Extension API to upload a WKT file to a custom layer.
 *
 * @param {Object} location The location to test for
 * @param {Object} wkt polygon in well-known-text format
 */
function uploadWkt(layerId, wkt) {
  return new Promise((fulfill, reject) => {
    // The Geofencing Extension expects the data as "multipart/form-data" MIME-type, hence we use the FormData module to append the data
    const form = new FormData();

    // The data must be zipped before uploading to the Geofencing Extension
    // The WKT filename is arbitrary, but must have the .wkt extension
    zip.file('wktUpload.wkt', wkt);
    const wktData = zip.generate({ type: 'base64', compression: 'DEFLATE' });
    const buffer = new Buffer(wktData, 'base64');

    // The file must be appended as 'zipfile'
    form.append('zipfile', buffer, { filename: 'wktUpload.wkt.zip', contentType: 'application/zip' });

    const options = buildUploadLayerRequestOptions(layerId, form);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => {
        data += d;
      });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(JSON.parse(data));
        } else {
          console.log('Uploaded WKT layer');
          fulfill();
        }
      });
    });
    form.pipe(req);
    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

const geofencing = {
  findAdminAreasForLocation,
  searchCustomLayers,
  uploadWkt,
};

module.exports = geofencing;
