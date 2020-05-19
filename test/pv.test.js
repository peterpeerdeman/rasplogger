const expect = require('chai').expect;
const nock = require('nock');
const Influx = require('influxdb-nodejs');
const fs = require('fs');
influxClient = new Influx('http://localhost:8086/pv');

process.env.PVOUTPUT_APIKEY = 'apikey';
process.env.PVOUTPUT_SYSTEMID = '1234';

const logPV = require('../modules/pv.js');

const pvoutput_sunny_response = fs.readFileSync('test/response.pvoutput.sunny','utf8');
const pvoutput_cloudy_response = fs.readFileSync('test/response.pvoutput.cloudy','utf8');
const pvoutput_notime_response = fs.readFileSync('test/response.pvoutput.notime','utf8');

describe('pvoutput tests', () => {
    it('Should save sunny data', (done) => {
        nock('http://pvoutput.org')
            .get('/service/r2/getstatus.jsp')
            .query({
                key: 'apikey',
                sid: 1234

            })
            .reply(200, pvoutput_sunny_response);

        logPV(influxClient).then(response => {
            expect(response).to.equal(true);
            done();
        });
    }).timeout(10000);

    it('Should save cloudy data', (done) => {
        nock('http://pvoutput.org')
            .get('/service/r2/getstatus.jsp')
            .query({
                key: 'apikey',
                sid: 1234

            })
            .reply(200, pvoutput_cloudy_response);
        logPV(influxClient).then(response => {
            expect(response).to.equal(true);
            done();
        });
    }).timeout(10000);

    it('Should not fail when there is no timestamp in the pv result', (done) => {
        nock('http://pvoutput.org')
            .get('/service/r2/getstatus.jsp')
            .query({
                key: 'apikey',
                sid: 1234

            })
            .reply(200, pvoutput_notime_response);
        logPV(influxClient).then(response => {
            expect(response).to.equal(false);
            done();
        });
    }).timeout(10000);
});
