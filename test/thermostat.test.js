const expect = require('chai').expect;
const nock = require('nock');
const Influx = require('influxdb-nodejs');
const fs = require('fs');
influxClient = new Influx('http://localhost:8086/thermostat');

process.env.TADO_HOME_ID = '12345';

const logThermostat = require('../modules/thermostat.js');

const thermostat_weather = fs.readFileSync(
    'test/response.thermostat.weather',
    'utf8',
);
const thermostat_zones = fs.readFileSync(
    'test/response.thermostat.zones',

    'utf8',
);

const thermostat_state = fs.readFileSync(
    'test/response.thermostat.state',

    'utf8',
);

describe('thermostat tests', () => {
    it('Should retrieve tado data', (done) => {
        nock('https://my.tado.com')
            .get('/api/v2/homes/12345/weather')
            .reply(200, thermostat_weather);

        nock('https://my.tado.com')
            .get('/api/v2/homes/12345/zones')
            .reply(200, thermostat_zones);

        nock('https://my.tado.com')
            .get('/api/v2/homes/12345/zones/1/state')
            .reply(200, thermostat_state);

        logThermostat(influxClient).then(() => {
            done();
        });
    }).timeout(10000);
});
