require('dotenv').config();

const express = require('express');
const CronJob = require('cron').CronJob;
const Influx = require('influxdb-nodejs');

const { program } = require('commander');

program.version('1.0.0');

const permittedModules = [
    'nftcollections',
    'cryptogas',
    'cryptohistory',
    'cryptosupply',
    'cryptotransactions',
    'destiny',
    'fitbit',
    'lights',
    'parking',
    'pv',
    'revenuesheet',
    'router',
    'temperature',
    'thermostat',
];
program.option('-u, --url <url>', 'influx database url');

program
    .command('once <module>')
    .description('run rasplogger once for a specific module')
    .action((module, options) => {
        if (!permittedModules.includes(module)) {
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
        if (!permittedModules.includes(module)) {
            throw Error('this module is not permitted');
        }
        const logFunction = require(`./modules/${module}.js`);
        const influxClient = new Influx(program.url);

        const cronJob = new CronJob({
            cronTime: frequency,
            onTick: function () {
                logFunction(influxClient);
            },
            start: true,
            timeZone: 'Europe/Amsterdam',
        });
        cronJob.start();
        console.log(
            `${new Date().toISOString()} RaspLogger activated module ${module}`
        );
    });

program.parse(process.argv);
