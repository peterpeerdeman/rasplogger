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

console.log(`${Date.now()} RaspLogger activated`);
