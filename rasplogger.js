const dotenv = require('dotenv');
dotenv.config();

const CronJob = require('cron').CronJob;
const Influx = require('influxdb-nodejs');

const { program } = require('commander');

program.version('1.0.0');

/** @type {string[]} */
const permittedModules = [
    'cryptogas',
    'cryptohistory',
    'cryptotransactions',
    'destiny',
    'fitbit',
    'lights',
    'pv',
    'revenuesheet',
    'router',
    'temperature',
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

program
    .command('authorize-url <module>')
    .description('print the OAuth authorize URL for a module (visit it, approve access, then use authorize-code with the code from the redirect URL)')
    .action((module) => {
        if (!permittedModules.includes(module)) {
            throw Error('this module is not permitted');
        }
        const logFunction = require(`./modules/${module}.js`);
        if (!logFunction.getAuthorizeUrl) {
            throw Error(`module ${module} does not support authorize-url`);
        }
        console.log(logFunction.getAuthorizeUrl());
    });

program
    .command('authorize-code <module> <code>')
    .description('exchange an OAuth authorize code for tokens and store them')
    .action((module, code) => {
        if (!permittedModules.includes(module)) {
            throw Error('this module is not permitted');
        }
        const logFunction = require(`./modules/${module}.js`);
        if (!logFunction.storeAuthCode) {
            throw Error(`module ${module} does not support authorize-code`);
        }
        logFunction.storeAuthCode(code).then(
            () => console.log('tokens stored'),
            (error) => {
                console.error('failed to store tokens', error);
                process.exitCode = 1;
            }
        );
    });

program
    .command('backfill <module> <start> <end>')
    .description('backfill historical data for a module over a date range (YYYY-MM-DD, inclusive)')
    .action((module, start, end) => {
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
        if (!logFunction.backfillRange) {
            throw Error(`module ${module} does not support backfill`);
        }
        const influxClient = new Influx(influxUrl);
        logFunction.backfillRange(influxClient, start, end).catch((error) => {
            console.error('backfill failed', error);
            process.exitCode = 1;
        });
    });

program.parse(process.argv);
