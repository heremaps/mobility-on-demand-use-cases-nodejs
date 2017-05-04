/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 *
 * This is an example express app to very roughly sketch simplified area
 * administration.
 *
 * It provides an idea on how endpoints for retrieving admin area tiles from
 * PDE API could be implemented, e.g. for visualization purposes.
 * It exemplarily shows an endpoint for dynamically adding admin areas to the set
 * of supported areas for the ride-hailing scenario shown in the cli-demo.
 *
 * Note: An endpoint for assigning drivers to admin areas is missing.
 */

'use strict';

const geofencing = require('./geofencing');
const platformdata = require('./platformdata');
const db = require('./db');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

/**
 * This function generates a wkt polygon from an area row
 * @param {Object} areaRow - area row polygon as returned by the PDE API
 */
function wktPolygonFromAreaRow(areaRow) {
  // PDE returns lat and lon in 10^-5 degrees WGS84, with each value relative to the previous
  // For example: "3779297,1329,-563,-261,-155,-31,-319,"
  const lats = areaRow.LAT.split(',').map(latStr => Number(latStr) / 100000);
  const lons = areaRow.LON.split(',').map(lonStr => Number(lonStr) / 100000);
  const pairs = [];

  // WKT format requires longitude first, then latitude
  pairs.push([lons[0], lats[0]]);
  for (let i = 1; i < lats.length; i++) {
    pairs.push([pairs[i - 1][0] + lons[i], pairs[i - 1][1] + lats[i]]);
  }

  return `((${pairs.map(pair => pair.join(' ')).join(',')}))`;
}

/**
 * GET API to get list of administrative areas for a certain location
 */
app.get('/adminAreas', (req, res, next) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!_.isFinite(latitude)) {
    return next(Object.assign(new Error('Latitude must be a number'), { responseCode: 400 }));
  }
  if (!_.isFinite(longitude)) {
    return next(Object.assign(new Error('Longitude must be a number'), { responseCode: 400 }));
  }

  const location = { lat: latitude, lon: longitude };
  // First find within which administrative areas the location falls
  return geofencing.findAdminAreasForLocation(location)
    .then((areas) => {
      const adminPlaceIds = areas.map(area => area.admin_place_id);
      // Then find out which tiles to request from Platform Data Extension by using its indexes
      return platformdata.getAdminPlaceIndexTiles(adminPlaceIds)
        // Filter out ADMIN_PLACE_0 (country layer), as managing drivers/passengers per country is usually too coarse, and this avoids some unnecessary requests
        // Also replace ADMIN_PLACE_<X> with ADMIN_POLY_<X>, as we're trying to get the geometries of the area
        .then(response => ({
          Layers: response.Layers
            .filter(layer => layer.layer !== 'ADMIN_PLACE_0')
            .map(layer => _.merge({}, layer, { layer: layer.layer.replace('PLACE', 'POLY') })),
        }))
        // Then query the Platform Data Extension for tiles containing the geometry of the areas
        .then(modifiedResponse => platformdata.getTilesForIndexResponse(adminPlaceIds, modifiedResponse))
        // Then concatenate the geometries for each administrative area into a single WKT per area (because Platform Data Extension returns geometries split per tile, rather than one large geometry)
        .then(rows => areas.map((area) => {
          const areaRows = rows.filter(row => row.ADMIN_PLACE_ID === area.admin_place_id);
          return _.merge({}, area, { geometry: `MULTIPOLYGON (${areaRows ? areaRows.map(areaRow => wktPolygonFromAreaRow(areaRow)).join(',') : '(())'})` });
        }))
        // Then send the result to the caller
        .then(modifiedAreas => res.send({ areas: modifiedAreas }));
    })
    .catch(next);
});

/**
 * GET API to get list of administrative areas already stored in the database
 */
app.get('/storedAreas', (req, res, next) => {
  db.getStoredAreas()
    .then(areas => res.send(areas))
    .catch(next);
});

/**
 * POST API to store an administrative area
 */
app.post('/storedAreas', (req, res, next) => {
  const area = _.pick(req.body, ['name', 'admin_layer', 'admin_place_id']);
  if (!_.isString(area.name) || !_.isFinite(area.admin_layer) || !_.isFinite(area.admin_place_id)) {
    return next(Object.assign(new Error('Invalid area'), { responseCode: 400 }));
  }
  return db.insertArea(area.name, area.admin_layer, area.admin_place_id)
    .then(() => { res.status(201).end(); })
    .catch(next);
});

function errorHandler() {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    console.error('error handler', err);
    const message = Object.assign({}, _.omit(err, 'responseCode'), { message: err.message });
    res.status(err.responseCode || 500).json(message);
  };
}

app.use(errorHandler());

// Array of static example areas where the ride-hailing service is provided
const staticAreas = [
  { name: 'San Francisco', admin_layer: 8, admin_place_id: 21010232 },
  { name: 'Alameda', admin_layer: 8, admin_place_id: 21009409 },
];

/**
 * Initialize the database with static areas and no drivers
 * Set the third parameter to 'true' to delete existing tables and recreate them
 */
db.initializeDb(staticAreas, [], false)
  // Start listening on port 8080
  .then(() => {
    app.listen(8080);
    console.log('Server listening on port 8080.');
  })
  // Catch any errors and log them
  .catch(console.error);
