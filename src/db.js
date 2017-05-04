/*
 * Copyright (c) 2017 HERE Europe B.V.
 * All rights reserved.
 */

'use strict';

const sqlite = require('sqlite3').verbose();
const fs = require('fs');
const _ = require('lodash');
const async = require('async');
const geofencing = require('./geofencing');

/** *************************************************************************
 *                                                                          *
 * This example uses a SQLite database to store many types of information.  *
 * While this works well for a demo, it is not recommended to use SQLite    *
 * for your production environment, so please consider storing your data in *
 * a storage format that suits your needs.                                  *
 *                                                                          *
 ****************************************************************************/

const TripStatusEnum = {
  NEW: 0,
  ASSIGNED: 1,
  COMPLETED: 2,
};

const WktIdAttribute = 'ID';
let db;

function initializeDb(areas, drivers, forceRecreate, fileName = 'demo.db') {
  return new Promise((fulfill, reject) => {
    const exists = fs.existsSync(fileName);
    db = new sqlite.Database(fileName);
    db.serialize();
    if (exists && !forceRecreate) {
      fulfill(db);
    } else {
      db.run('DROP TABLE IF EXISTS Drivers');
      db.run('DROP TABLE IF EXISTS Areas');
      db.run('DROP TABLE IF EXISTS Trips');
      db.run('DROP TABLE IF EXISTS Trip_Driver');
      db.run('CREATE TABLE Areas (name TEXT, admin_layer INT, admin_place_id INT)');
      db.run('CREATE TABLE Drivers (name TEXT, latitude REAL, longitude REAL, area_id INT, FOREIGN KEY(area_id) REFERENCES Areas(rowid))');
      db.run('CREATE TABLE Trips (shape TEXT, created_at TIME DEFAULT CURRENT_TIME NOT NULL, pickup_latitude REAL, pickup_longitude REAL, dropoff_latitude REAL, dropoff_longitude REAL, status INT)');
      db.run('CREATE TABLE Trip_Driver (driver_id INT, trip_id INT, FOREIGN KEY(driver_id) REFERENCES Drivers(rowid), FOREIGN KEY(trip_id) REFERENCES Trips(rowid), UNIQUE(trip_id, driver_id))');
      const stmt = db.prepare('INSERT INTO Areas(name, admin_layer, admin_place_id) VALUES (?, ?, ?)');
      async.each(areas, (area, callback) => {
        stmt.run([area.name, area.admin_layer, area.admin_place_id], (err) => { callback(err); });
      }, (err) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          db.each("SELECT rowid, name, admin_layer, admin_place_id, admin_layer || '#' || admin_place_id as comp FROM Areas", (error, row) => {
            if (error) {
              console.error(error);
            } else {
              console.log(`Area: ${row.name}, admin_layer: ${row.admin_layer}, admin_place_id: ${row.admin_place_id}, comp: ${row.comp}`);
            }
          });

          async.each(drivers, (driver, callback2) => {
            console.log(`Driver: ${driver.name}`);
            // eslint-disable-next-line no-use-before-define
            findAreaIdForLocation(driver.location)
              .then((areaId) => {
                console.log(`Inserting with area_id: ${areaId}`);
                db.prepare('INSERT INTO Drivers(name, latitude, longitude, area_id) VALUES (?, ?, ?, ?)')
                  .run([driver.name, driver.location.lat, driver.location.lon, areaId], (dbError) => { callback2(dbError); })
                  .finalize();
              })
              .catch(callback2);
          }, (iteratorErr) => {
            if (iteratorErr) {
              console.error(iteratorErr);
              reject(iteratorErr);
            } else {
              fulfill(db);
            }
          });
        }
      });
      stmt.finalize();
    }
  });
}

function printDrivers() {
  return new Promise((fulfill, reject) => {
    db.each('SELECT d.name, a.name AS area_name from Drivers d LEFT JOIN Areas a ON d.area_id = a.rowid', (err, row) => {
      if (row.area_name) {
        console.log('Driver', row.name, 'is currently in area', row.area_name);
      } else {
        console.log('Driver', row.name, 'is currently outside any registered area');
      }
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        fulfill();
      }
    });
  });
}

function clearAllTrips() {
  return new Promise((fulfill, reject) => {
    db.run('DELETE FROM Trip_Driver', (err) => {
      if (err) {
        reject(err);
      } else {
        db.run('DELETE FROM Trips', (error) => {
          if (error) {
            reject(error);
          } else {
            fulfill();
          }
        });
      }
    });
  });
}

function getNewTrips() {
  return new Promise((fulfill, reject) => {
    const newTrips = [];
    db.prepare('SELECT rowid, * FROM Trips WHERE status = ?')
          .each([TripStatusEnum.NEW], (err, row) => {
            if (row) {
              newTrips.push(row);
            }
          }, (err) => {
            if (err) {
              reject(err);
            } else {
              fulfill(newTrips);
            }
          });
  });
}

function getGeofencesWkt() {
  return getNewTrips()
        .then((newTrips) => {
          let wkt = `${WktIdAttribute}\tWKT\n`;
          wkt += newTrips.map(trip => `${trip.rowid}\t${trip.shape}`).join('\n');
          return wkt;
        });
}

function getCandidateDriversForTrip(tripId) {
  return new Promise((fulfill, reject) => {
    console.log('Finding candidate drivers for trip', tripId);
    const drivers = [];
    db.prepare('SELECT d.name, d.latitude, d.longitude, d.rowid FROM Trip_Driver td JOIN Drivers d ON td.driver_id = d.rowid WHERE td.trip_id = ? ')
          .each([tripId], (err, row) => {
            if (row) {
              drivers.push(row);
            }
          }, (err) => {
            if (err) {
              reject(err);
            } else {
              console.log('Found drivers:', drivers);
              fulfill(drivers);
            }
          })
          .finalize();
  });
}

function getOneDriver() {
  return new Promise((fulfill, reject) => {
    db.get('SELECT rowid, * FROM Drivers', (err, row) => {
      if (err) {
        reject(err);
      } else {
        fulfill(row);
      }
    });
  });
}

function getDriverByRowId(id) {
  return new Promise((fulfill, reject) => {
    db.get(`SELECT rowid, * FROM Drivers where rowid = ${id}`, (err, row) => {
      if (err) {
        reject(err);
      } else {
        fulfill(row);
      }
    });
  });
}

function getAllDrivers() {
  return new Promise((fulfill, reject) => {
    const drivers = [];
    db.each('SELECT rowid, * FROM Drivers', (err, row) => {
      if (row) {
        drivers.push(row);
      }
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        fulfill(drivers);
      }
    });
  });
}

function getStoredAreas() {
  return new Promise((fulfill, reject) => {
    const areas = [];
    db.each('SELECT rowid, * FROM Areas', (err, row) => {
      if (row) {
        areas.push(row);
      }
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        fulfill(areas);
      }
    });
  });
}

function createTrip(pickupLocation, dropoffLocation, wkt) {
  return new Promise((fulfill, reject) => {
    db.prepare('INSERT INTO Trips(shape, pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, status) VALUES(?, ?, ?, ?, ?, ?)')
          .run([wkt, pickupLocation.lat, pickupLocation.lon, dropoffLocation.lat, dropoffLocation.lon, TripStatusEnum.NEW], (err) => {
            if (err) {
              reject(err);
            } else {
              fulfill();
            }
          })
          .finalize();
  });
}

function updateDriverLocation(id, location) {
  return new Promise((fulfill, reject) => {
    console.log('Updating driver', id, 'location');
    db.prepare('UPDATE Drivers SET latitude = ?, longitude = ? WHERE rowid = ?')
          .run([location.lat, location.lon, id], (err) => {
            if (err) {
              reject(err);
            } else {
              fulfill();
            }
          })
          .finalize();
  });
}

function assignDriverToTrip(tripId, driverId) {
  return new Promise((fulfill, reject) => {
    console.log('Assigning driver', driverId, 'to trip', tripId);
    db.prepare('UPDATE Trips SET status = ? WHERE rowid = ?')
          .run([TripStatusEnum.ASSIGNED, tripId], (err) => {
            if (err) {
              reject(err);
            } else {
              db.prepare('DELETE FROM Trip_Driver WHERE trip_id = ? AND driver_id != ?')
                  .run([tripId, driverId], (error) => {
                    if (error) {
                      reject(error);
                    } else {
                      fulfill();
                    }
                  })
                  .finalize();
            }
          })
          .finalize();
  });
}

function addCandidateDriver(driverId, tripIds) {
  return Promise.resolve(tripIds)
        .then(resolvedTripIds => new Promise((fulfill, reject) => {
          async.each(resolvedTripIds, (tripId, callback) => {
            console.log('Adding driver', driverId, 'as candidate for trip', tripId);
            db.prepare('INSERT OR IGNORE INTO Trip_Driver(driver_id, trip_id) VALUES(?, ?)')
                      .run([driverId, tripId], (err) => {
                        callback(err);
                      })
                      .finalize();
          }, (err) => {
            if (err) {
              reject(err);
            } else {
              fulfill();
            }
          });
        }));
}

function getDriversInArea(areaId) {
  return new Promise((fulfill, reject) => {
    const drivers = [];
    db.prepare('SELECT d.rowid, d.name, d.latitude, d.longitude FROM Drivers d JOIN Areas a ON d.area_id = a.rowid WHERE a.rowid = ?')
          .each([areaId], (err, row) => {
            if (err) {
              console.error(err);
            }
            if (row) {
              drivers.push(row);
            }
          }, (err) => {
            if (err) {
              console.error(err);
              reject(err);
            } else {
              fulfill(drivers);
            }
          });
  });
}

// eslint-disable-next-line no-unused-vars
function getVehicleSpecForDriver(numPassengers, driverId) {
  // For purposes of the demo, return the same vehicle specification for all cars.
  return {
    emissionType: 5,
    height: 167,
    vehicleWeight: 1739,
    limitedWeight: 2500,
    passengersCount: numPassengers + 1, // driver counts as passenger
    commercial: 1,
  };
}

function getMatchingArea(foundAreas) {
  return new Promise((fulfill, reject) => {
    const areaList = foundAreas.map(area => `${area.admin_layer}#${area.admin_place_id}`);
    const placeholders = _.times(areaList.length, _.constant('?')).join(', ');
    const query = `SELECT rowid FROM Areas WHERE admin_layer || '#' || admin_place_id IN (${placeholders})`;
    db.prepare(query)
          .get(areaList, (err, row) => {
            if (err) {
              reject(err);
            } else {
              const matchedArea = row ? row.rowid : null;
              fulfill(matchedArea);
            }
          }).finalize();
  });
}

// eslint-disable-next-line camelcase
function insertArea(name, admin_layer, admin_place_id) {
  return new Promise((fulfill, reject) => {
    db.prepare('INSERT INTO Areas(name, admin_layer, admin_place_id) VALUES (?, ?, ?)')
            // eslint-disable-next-line camelcase
            .run([name, admin_layer, admin_place_id], (err) => {
              if (err) {
                reject(err);
              } else {
                fulfill();
              }
            })
            .finalize();
  });
}

function findAreaIdForLocation(location) {
  return geofencing.findAdminAreasForLocation(location)
            .then(getMatchingArea);
}

function close() {
  return new Promise((fulfill, reject) => {
    console.log('Closing db connection.');
    db.close((err) => {
      if (err) {
        console.error('Error while closing connection', err);
        reject(err);
      } else {
        console.log('Db connection closed.');
        fulfill();
      }
    });
  });
}

function remove(filename) {
  fs.unlinkSync(filename);
}

const database = {
  assignDriverToTrip,
  addCandidateDriver,
  clearAllTrips,
  close,
  createTrip,
  findAreaIdForLocation,
  getAllDrivers,
  getCandidateDriversForTrip,
  getDriverByRowId,
  getDriversInArea,
  getGeofencesWkt,
  getNewTrips,
  getOneDriver,
  getStoredAreas,
  getVehicleSpecForDriver,
  initializeDb,
  insertArea,
  printDrivers,
  remove,
  updateDriverLocation,
  WktIdAttribute,
};

module.exports = database;
