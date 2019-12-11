require('dotenv').config();

const express = require('express');
const CronJob = require('cron').CronJob;

const logTemperature =  require('./modules/temperature.js').logTemperature;

const logOutsideTemp = new CronJob({
    cronTime: '*/5 * * * *',
    onTick: function() {
        logTemperature();
    },
    start: true,
    timeZone: 'Europe/Amsterdam'
});

logOutsideTemp.start();
console.log('Datalogger activated');
