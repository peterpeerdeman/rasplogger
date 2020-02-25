require('dotenv').config();

const express = require('express');
const CronJob = require('cron').CronJob;
const Influx = require('influxdb-nodejs');

const logTemperature =  require('./modules/temperature.js').logTemperature;
const logTemperatureJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logTemperature();
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});
logTemperatureJob.start();

const logLights =  require('./modules/lights.js').logLights;
const logLightsJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logLights();
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});
logLightsJob.start();

const logPV =  require('./modules/pv.js').logPV;
const pvInfluxClient = new Influx('http://127.0.0.1:8086/pv');
const logPVJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logPV(pvInfluxClient);
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});
logPVJob.start();

const logThermostat =  require('./modules/thermostat.js').logThermostat;
const thermostatInfluxClient = new Influx('http://127.0.0.1:8086/thermostat');
const logThermostatJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logThermostat(thermostatInfluxClient);
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});
logThermostatJob.start();

const logRouter =  require('./modules/router.js').logRouter;
const fitbitInfluxClient = new Influx('http://127.0.0.1:8086/router');
const logRouterJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logRouter(fitbitInfluxClient);
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});
logRouterJob.start();

const logFitbit = require('./modules/fitbit.js').logFitbit;
const routerInfluxClient = new Influx('http://127.0.0.1:8086/fitbit');
const logFitbitJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logFitbit(routerInfluxClient);
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});
logFitbitJob.start();

const logParking = require('./modules/parking.js').logParking;
const parkingInfluxClient = new Influx('http://127.0.0.1:8086/parking');
const logParkingJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logParking(parkingInfluxClient);
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});
logParkingJob.start();

console.log(`${Date.now()} RaspLogger activated`);
