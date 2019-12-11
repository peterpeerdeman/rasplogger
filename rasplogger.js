require('dotenv').config();

const express = require('express');
const CronJob = require('cron').CronJob;

const logTemperature =  require('./modules/temperature.js').logTemperature;
const logTemperatureJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logTemperature();
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});

const logLights =  require('./modules/lights.js').logLights;
const logLightsJob = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logLights();
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});

logTemperatureJob.start();
logLightsJob.start();
console.log(`${Date.now()} RaspLogger activated`);
