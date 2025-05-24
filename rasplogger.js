const dotenv = require('dotenv');
dotenv.config();

const CronJob = require('cron').CronJob;
const Influx = require('influxdb-nodejs');

const { program } = require('commander');

program.version('1.0.0');

/** @type {string[]} */
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
    .action((module) => {
        if (!permittedModules.includes(module)) {
            throw Error('this module is not permitted');
        }
        const influxUrl = process.env.INFLUXDB_URL || program.url;
        if (!influxUrl) {
            throw Error(
                'influxurl is required, use -u <url> or set INFLUXDB_URL env variable',
            );
        }
        const logFunction = require(`./modules/${module}.js`);
        const influxClient = new Influx(influxUrl);
        logFunction(influxClient);
    });

program
    .command('cron <module> <frequency>')
    .description('run rasplogger using cron for a specific module')
    .action((module, frequency) => {
        if (!permittedModules.includes(module)) {
            throw Error('this module is not permitted');
        }
        const influxUrl = process.env.INFLUXDB_URL || program.url;
        if (!influxUrl) {
            throw Error(
                'influxurl is required, use -u <url> or set INFLUXDB_URL env variable',
            );
        }

        const logFunction = require(`./modules/${module}.js`);
        const influxClient = new Influx(influxUrl);

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
            `${new Date().toISOString()} RaspLogger activated module ${module}`,
        );
    });

program.parse(process.argv);
