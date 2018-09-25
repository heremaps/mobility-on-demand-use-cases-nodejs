/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const bluebird = require('bluebird');
const builder = require('xmlbuilder');
const geofencing = require('./geofencing');
const matrixrouting = require('./matrixrouting');
const tollcost = require('./tollcost');
const isolinerouting = require('./isolinerouting');
const routematching = require('./routematching');
const geocoder = require('./geocoder');
const waypointsequence = require('./waypointsequence');
const db = require('./db');
const gpslogs = require('./gpslogs');

const CUSTOM_LAYER_ID = 'ON_DEMAND_DEMO_LAYER';

function printScenarioStart(scenario) {
  console.log('\n----------------------------------------------');
  console.log('Simulating scenario:', scenario);
  console.log('----------------------------------------------\n');
}

/**
 * This function represents the 'Explore options' scenario
 * It demonstrates how to find which drivers are in a passenger's area,
 * how to calculate the ETAs for those drivers to determine the closest
 * one, and how to use the Toll Cost API to determine any applicable
 * toll costs in order to provide an accurate fare estimate
 *
 * @param {Object} - pickupLocation
 * @param {Object} - dropoffLocation
 */
function exploreOptionsScenario(pickupLocation, dropoffLocation) {
  printScenarioStart('Explore options');

  // We're assuming that we'll always use the fastest route and want to account for traffic in any ETAs
  const mode = 'fastest;car;traffic:enabled';
  // The currency to use for the Toll Cost Extension
  const currency = 'USD';
  const numPassengers = 2;
  // First determine which administrative area the pickup location is in (to avoid calculating ETAs for cars that are in completely different areas)
  return db.findAreaIdForLocation(pickupLocation)
  // Then get all the drivers within that area
    .then(db.getDriversInArea)
    .then((drivers) => {
      // To determine how far all drivers are from the passenger, use the drivers' locations as 'start' locations
      const starts = drivers.map(driver => ({ lat: driver.latitude, lon: driver.longitude }));
      // Use the pickup location as 'destination'
      const destinations = [pickupLocation];
      // And finally call the Matrix Routing API to get an ETA matrix
      return matrixrouting.getEtaMatrix(starts, destinations, mode)
        // Then determine the closest driver from that ETA matrix
        // eslint-disable-next-line no-use-before-define
        .then(matrix => getClosestDriver(drivers, matrix))
        // Then get vehicle information for the closest driver's car
        .then(closestDriver => db.getVehicleSpecForDriver(numPassengers, closestDriver))
        // Then call the Toll Cost Extension to get the estimated toll cost associated with the trip
        .then(vehicleSpec => tollcost.costForWaypoints(pickupLocation, dropoffLocation, mode, currency, vehicleSpec))
        // Then use the toll cost to provide an accurate fare estimate to the passenger
        .then((totalCost) => {
          console.log('Driver will pay', currency, totalCost, 'as part of this trip');
          // You can add your own logic here to determine a fare estimate based on how long the trip is, as well as dynamic pricing aspects (e.g. based on supply and demand)
          // You can also pass driver_cost and vehicle_cost parameters to the Toll Cost Extension API to add costs per hour of driving or per kilometer driven (see the API reference for more info)
        });
    });
}

/**
 * This function represents the 'Request ride' scenario
 * It demonstrates how to calculate an isoline around the passenger's
 * pickup location, upload that isoline's shape to the Geofencing
 * Extension, and starts a trip update loop that handles assigning
 * trips based on available drivers and trips
 *
 * @param {Object} - pickupLocation
 * @param {Object} - dropoffLocation
 */
function requestRideScenario(pickupLocation, dropoffLocation) {
  printScenarioStart('Request ride');

  const mode = 'fastest;car;traffic:enabled';
  // For purposes of this example, we clear out any existing trips from the database at the beginning of this scenario
  return db.clearAllTrips()
  // Then start loops that simulate location updates from drivers' applications
  // eslint-disable-next-line no-use-before-define
    .then(startDriverLocationUpdates)
    .then((driverIntervals) => {
      // Then start the trip update loop (which will assign drivers to trips)
      // eslint-disable-next-line no-use-before-define
      const tripInterval = startTripUpdates();
      // Then calculate a reverse isochrone around the pickup location
      // A reverse isochrone is a shape that answers the question: From which area can I reach a destination within a given amount of time?
      // For this example, the amount of time used is 5 minutes (or 300 seconds)
      return isolinerouting.getReverseIsochrone(pickupLocation, 300, mode)
        // Then create a new trip, storing the calculated shape
        .then(reverseIsochrone => db.createTrip(pickupLocation, dropoffLocation, reverseIsochrone))
        // Then wait for 35 seconds before stopping loops (only for the purposes of this example, in a real example the trip update loop would run indefinitely)
        .then(() => console.log('Letting demo run for 35 seconds'))
        .then(() => bluebird.delay(35000).then(() => {
          // Stop timers
          clearInterval(tripInterval);
          driverIntervals.forEach((driverInterval) => {
            clearInterval(driverInterval);
          });
        }));
    });
}

/**
 * This function represents the 'Post-ride processing' scenario
 * It demonstrates how to calculate the route taken from a gps log
 * and calculate the toll cost paid by the driver along the route
 *
 * @param {Object[]} gpsLog - An array of position updates
 */
function postProcessingScenario(gpsLog) {
  printScenarioStart('Post-ride processing');

  const mode = 'fastest;car;traffic:enabled';
  const startTime = gpsLog[0].timestamp;
  const currency = 'USD';
  const numPassengers = 2;
  // First convert the array of position updates into a GPX trace
  // eslint-disable-next-line no-use-before-define
  const gpx = buildGpx(gpsLog);
  // Then use the Route Matching Extension to match the GPX trace to HERE links
  return routematching.matchGpx('car', gpx)
    .then(links => db.getOneDriver()
      // Get the relevant vehicle information required by the Toll Cost Extension
      .then(driver => db.getVehicleSpecForDriver(numPassengers, driver))
      // Then calculate the toll costs associated with the links that the route traverses
      // eslint-disable-next-line no-use-before-define
      .then(vehicleSpec => calculateCostForLinksPerCountry(mode, startTime, currency, vehicleSpec, links)))
    // Then provide a summary of toll costs along the route per country
    .then((tollCosts) => {
      tollCosts.forEach((costByCountry) => {
        console.log('Toll costs in country', costByCountry.country, ':', currency, costByCountry.amountInTargetCurrency);
      });
    });
}

/**
 * This function represents the 'Delivery sequence' scenario
 * It demonstrates how to geocode a batch of delivery addresses
 * and calculate the most efficient delivery sequence for a route
 * that starts and ends at a depot and traverses all delivery
 * addresses.
 *
 * @param {string[]} deliveryAddresses - An array of delivery addresses
 * @param {Object} depotLocation - Location of the depot
 */
function deliverySequenceScenario(deliveryAddresses, depotLocation) {
  printScenarioStart('Delivery sequence');

  const mode = 'fastest;car;traffic:enabled';
  const optimizeFor = 'time';
  // First geocode all addresses to get lat/lon coordinate pairs
  return Promise.all(deliveryAddresses.map(address => geocoder.geocode(address)))
    // Then use the Waypoint Sequence Extension to find the optimal sequence of waypoints
    .then(locations => waypointsequence.findOptimalSequence(mode, optimizeFor, depotLocation, depotLocation, locations))
    // Then print out the optimal sequence
    .then((orderedWaypointIndexes) => {
      console.log('Optimal delivery sequence:');
      orderedWaypointIndexes.forEach((waypointIndex, orderIndex) => {
        console.log(`${orderIndex + 1} - ${deliveryAddresses[waypointIndex]}`);
      });
    });
}

/**
* @typedef LinkCostInfo {Object}
* @property {string} country - 3-letter country code of the country for which the information is returned.
* @property {number} amountInTargetCurrency - The total amount payable for this country
*/

/**
 * This function queries the Toll Cost Extension for toll cost information and parses
 * that information, returning a summary of costs per selected rollup / aggregation level
 *
 * @param {string} mode - The routing mode (e.g. 'fastest;car;traffic:enabled')
 * @param {string} startTime - The starting time of the trip
 * @param {string} currency - The currency in which to return toll cost information (three-letter code, e.g. 'USD')
 * @param {Object} vehicleSpec - An object containing the vehicle's attributes. See the Toll Cost Extension's API Reference for more information on this parameter
 * @param {string[]} links - An array of link ids that were traversed as part of the route (in order of traversal)
 * @param {string} rollup - Comma separated list of aggregation levels in the result. Currently supported: 'none', 'total', 'tollsys', 'country'
 * @return {LinkCostInfo[]} - An array of cost information per country
 */
function calculateCostForLinksPerCountry(mode, startTime, currency, vehicleSpec, links) {
  const rollup = 'country';
  // First use the Toll Cost Extension API to determine the cost associated with the links
  return tollcost.costForLinks(mode, currency, vehicleSpec, links, rollup)
    // Then return costs summary by country as returned by the Toll Cost Extension API
    .then(tollcostResponse => tollcostResponse.costsByCountry);
}

/**
 * This function transforms a gps track into GPX format
 *
 * @param {Object[]} gpsLog - Array of position updates
 * @returns {string} gps track in GPX format
 */
function buildGpx(gpsLog) {
  // Create <gpx version="1.1"> root element
  const xml = builder.create('gpx').att('version', '1.1');
  // Create <trk><trkseg>...</trkseg></trk> tags
  const segment = xml.ele('trk').ele('trkseg');
  gpsLog.forEach((element) => {
    // Create <trkpt lat=X lon=Y><time>Z</time></trkpt> tags within trkseg element
    segment.ele('trkpt', { lat: element.lat, lon: element.lon }).ele('time', {}, element.timestamp);
  });
  // Convert xml to string
  const xmlString = xml.doc().end();
  return xmlString;
}

/**
 * This function is used to find available trips close to a driver's location
 *
 * @param {Object} location - The driver's location
 * @returns {string[]} Array of tripIds
 */
function findNearbyTrips(location) {
  // Use the Geofencing extension to find geofences for trips which the driver is inside of
  return geofencing.searchCustomLayers(location, [CUSTOM_LAYER_ID], [db.WktIdAttribute]);
}

/**
 * This function calculates which driver has the smallest ETA from an ETA matrix
 *
 * @param {Object[]} drivers - Array of driver objects
 * @param {Object[]} etaMatrix - Array of matrix entries
 * @returns {string} id of the closest driver
 */
function getClosestDriver(drivers, etaMatrix) {
  const driversWithEta = [];
  // Each entry in the ETA matrix has a startIndex and a destinationIndex, which represent the indices in the 'starts' and 'destinations' array which are associate with the entry
  etaMatrix.forEach((entry) => {
    // Here, we use the startIndex as index in the drivers array, as we passed the drivers as 'starts' array when calling the Matrix Routing API prior to calling this function
    console.log('Driver', drivers[entry.startIndex].name, 'is', entry.eta, 'seconds away from the destination');
    driversWithEta.push(Object.assign({}, drivers[entry.startIndex], { eta: entry.eta }));
  });
  // To find the closest driver, order the drivers by ETA
  const closestDriver = driversWithEta.sort((a, b) => a.eta - b.eta)[0];
  console.log('Estimated ETA for closest driver:', closestDriver.eta);
  // Finally, return the id of the closest driver
  return closestDriver.rowid;
}

/**
 * This function demonstrates what happens when a driver's app sends a location update to your backend
 * For the sake of this demo, it only shows what happens when the driver sends an update when he is not yet assigned to a trip
 *
 * @param {string} id - driver id
 * @param {Object} location - driver location
 */
function updateDriverLocation(id, location) {
  // First update the driver's location in the database
  db.updateDriverLocation(id, location)
    .then(() => db.driverIsTripCandidate(id))
    .then(isCandidate => (isCandidate ? Promise.reject(new Error('DRIVER_ASSIGNED')) : {}))
    // Then find nearby unassigned trips
    .then(() => findNearbyTrips(location))
    // Then add this driver as a candidate to any trips that were found
    .then(trips => db.addCandidateDriver(id, trips))
    // Catch any errors and log unexpected ones
    .catch((err) => { if (err.message !== 'DRIVER_ASSIGNED') { console.error(err); } });
}

/**
 * This function starts recurring timers that simulate drivers' applications sending location updates to the backend
 */
function startDriverLocationUpdates() {
  return db.getAllDrivers()
    .then(drivers => drivers.map(driver => setInterval(updateDriverLocation, 6000, driver.rowid, { lat: driver.latitude, lon: driver.longitude })));
}

/**
 * This function demonstrates how trip assignment logic could work
 */
function assignTrips() {
  // First, get all currently unassigned trips
  return db.getNewTrips()
    .then((trips) => {
      // Iterating over trips in series to avoid having the same driver assigned to multiple trips
      // This is okay the purposes of this example, but may be too slow when dealing with high volumes of trips and drivers
      bluebird.mapSeries(trips, trip => db.getCandidateDriversForTrip(trip.rowid)
        .then((drivers) => {
          if (drivers.length === 0) {
            return Promise.resolve();
          }
          const mode = 'fastest;car;traffic:enabled';
          const starts = drivers.map(driver => ({ lat: driver.latitude, lon: driver.longitude }));
          const destinations = [{ lat: trip.pickup_latitude, lon: trip.pickup_longitude }];
          // Then calculate an ETA matrix from the drivers' locations to the pickup location
          return matrixrouting.getEtaMatrix(starts, destinations, mode)
          // Then find the closest driver
            .then(matrix => getClosestDriver(drivers, matrix))
          // Then assign the closest driver to the trip
          // You can insert your more complex matchmaking algorithm here as this logic is fairly primitive
            .then(closestDriver => db.assignDriverToTrip(trip.rowid, closestDriver));
        }));
    });
}

/**
 * This function starts a recurring timer that updates the trip database
 * This includes assigning trips for which candidate drivers have been found
 * and re-uploading the shapes of still unassigned jobs to the Geofencing Extension
 */
function startTripUpdates() {
  // Set a timer for every 10 seconds
  return setInterval(() => {
    // First assign trips for which candidate drivers have been found
    assignTrips()
      // Then get a WKT file which contains geofences for jobs that have not yet been assigned
      .then(db.getGeofencesWkt)
      // Then upload the WKT file to the Geofencing extension
      .then(wkt => geofencing.uploadWkt(CUSTOM_LAYER_ID, wkt))
      // Catch any errors and log them
      .catch(console.error);
  }, 10000);
}

// Coordinates for downtown Berkeley, CA
const downtownBerkeley = { lat: 37.870242, lon: -122.268234 };
// Coordinates for Union Square (in San Francisco, CA)
const unionSquare = { lat: 37.787526, lon: -122.407603 };

// Array of example areas where the ride-hailing service is provided
const exampleAreas = [
  { name: 'San Francisco', admin_layer: 8, admin_place_id: 21010232 },
  { name: 'Alameda', admin_layer: 8, admin_place_id: 21009409 },
];

// Array of example drivers
const exampleDrivers = [
  { name: 'John D.', location: { lat: 37.780464, lon: -122.417280 } },
  { name: 'James A.', location: { lat: 37.782734, lon: -122.414838 } },
  { name: 'Ellen P.', location: { lat: 37.787250, lon: -122.409439 } },
  { name: 'Mark Z.', location: { lat: 37.756637, lon: -122.425896 } },
  { name: 'Bill F.', location: { lat: 37.806119, lon: -122.270636 } },
  { name: 'Bob J.', location: { lat: 37.868943, lon: -122.267870 } },
  { name: 'Lisa M.', location: { lat: 37.727691, lon: -122.158144 } },
];

const exampleDeliveryAddresses = [
  '531 29th St Richmond CA 94803',
  '17 Crest Rd, Lafayette, CA 94549',
  '1501 Harrison St, Oakland, CA 94612',
  '1432 Grove St, San Francisco, CA 94117',
  '5300 Horton St Emeryville CA 94608',
  '2152 San Antonio Ave Alameda CA 94501',
  '3271 16th St San Francisco CA 94103',
];

const exampleDepotLocation = downtownBerkeley;

/**
 * Initialize the database with example areas and drivers
 * Set the third parameter to 'false' to keep existing tables and not recreate them
 */
db.initializeDb(exampleAreas, exampleDrivers, true)
  // Print out all drivers as sanity check to make sure they've been added to the database
  .then(db.printDrivers)
  // Start the 'Explore options' scenario
  .then(() => exploreOptionsScenario(downtownBerkeley, unionSquare))
  // Start the 'Request ride' scenario
  .then(() => requestRideScenario(downtownBerkeley, unionSquare))
  // Start the 'Post-ride processing' scenario
  // The GPS log used here is a pre-defined example log, ordinarily this data would come from your own tracking service
  .then(() => postProcessingScenario(gpslogs.berkeleyToSf))
  // Start the 'Delivery Sequence' scenario
  .then(() => deliverySequenceScenario(exampleDeliveryAddresses, exampleDepotLocation))
  // Close database connection
  .then(() => db.close())
  // Catch any errors and log them
  .catch(console.error);
