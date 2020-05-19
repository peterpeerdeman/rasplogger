require('dotenv').config();

const express = require('express');
const CronJob = require('cron').CronJob;
const Influx = require('influxdb-nodejs');

const { program } = require('commander');

program.version('1.0.0');

const permittedModules = [
  "destiny",
  "fitbit",
  "lights",
  "parking",
  "pv",
  "router",
  "temperature",
  "thermostat",
];
program
  .option('-u, --url <url>', 'influx database url');

program
  .command('once <module>')
  .description('run rasplogger once for a specific module')
  .action((module, options) => {
    if(!permittedModules.includes(module)) {
      throw Error('this module is not permitted');
    }
    const logFunction = require(`./modules/${module}.js`);
    const influxClient = new Influx(program.url);
    logFunction(influxClient);
  });

program
  .command('cron <module> <frequency>')
  .description('run rasplogger using cron for a specific module')
  .action((module, frequency, options) => {
    if(!permittedModules.includes(module)) {
      throw Error('this module is not permitted');
    }
    const logFunction = require(`./modules/${module}.js`);
    const influxClient = new Influx(program.url);

    const cronJob = new CronJob({
        cronTime: frequency,
        onTick: function() {
            logFunction(influxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    cronJob.start();
    console.log(`${new Date().toISOString()} RaspLogger activated module ${module}`);
  });

program
  .command('all')
  .description('run all rasplogger modules with precooked cron')
  .action((options) => {

    const temperatureInfluxClient = new Influx(program.url + '/raspweather-outside');
    const logTemperature =  require('./modules/temperature.js');
    const logTemperatureJob = new CronJob({
        cronTime: '*/5 * * * *',
        onTick: function() {
            logTemperature(temperatureInfluxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    logTemperatureJob.start();

    const lightsInfluxClient = new Influx(program.url + '/huelights');
    const logLights =  require('./modules/lights.js');
    const logLightsJob = new CronJob({
      cronTime: '*/5 * * * * *',
        onTick: function() {
            logLights(lightsInfluxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    logLightsJob.start();

    const logPV =  require('./modules/pv.js');
    const pvInfluxClient = new Influx(program.url + '/pv');
    const logPVJob = new CronJob({
        cronTime: '*/5 * * * *',
        onTick: function() {
            logPV(pvInfluxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    logPVJob.start();

    const logThermostat =  require('./modules/thermostat.js');
    const thermostatInfluxClient = new Influx(program.url + '/thermostat');
    const logThermostatJob = new CronJob({
        cronTime: '*/5 * * * *',
        onTick: function() {
            logThermostat(thermostatInfluxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    logThermostatJob.start();

    const logRouter =  require('./modules/router.js');
    const fitbitInfluxClient = new Influx(program.url + '/router');
    const logRouterJob = new CronJob({
        cronTime: '*/5 * * * *',
        onTick: function() {
            logRouter(fitbitInfluxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    logRouterJob.start();

    const logFitbit = require('./modules/fitbit.js');
    const routerInfluxClient = new Influx(program.url + '/fitbit');
    const logFitbitJob = new CronJob({
        cronTime: '*/5 * * * *',
        onTick: function() {
            logFitbit(routerInfluxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    logFitbitJob.start();

    const logParking = require('./modules/parking.js');
    const parkingInfluxClient = new Influx(program.url + '/parking');
    const logParkingJob = new CronJob({
        cronTime: '*/5 * * * *',
        onTick: function() {
            logParking(parkingInfluxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    logParkingJob.start();

    const logDestiny = require('./modules/destiny.js');
    const destinyInfluxClient = new Influx(program.url + '/destiny');
    const logDestinyJob = new CronJob({
        cronTime: '*/30 * * * *',
        onTick: function() {
            logDestiny(destinyInfluxClient);
        },
        start: true,
        timeZone: 'Europe/Amsterdam'
    });
    logDestinyJob.start();

    console.log(`${new Date().toISOString()} RaspLogger activated`);
  });

program.parse(process.argv);
