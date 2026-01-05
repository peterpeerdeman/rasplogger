const expect = require('chai').expect;
const nock = require('nock');
const Influx = require('influxdb-nodejs');
const sinon = require('sinon');

influxClient = new Influx('http://localhost:8086/temperature');

process.env.PARTICLE_DEVICE_ID = 'device123';
process.env.PARTICLE_ACCESS_TOKEN = 'token123';

const logTemperature = require('../modules/temperature.js');

describe('temperature tests', () => {
    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    it('Should save temperature data', (done) => {
        const mockResponse = { result: 23.5 };

        nock('https://api.particle.io')
            .get('/v1/devices/device123/temperature')
            .query({ access_token: 'token123' })
            .reply(200, mockResponse);

        const writeStub = sinon.stub(influxClient, 'write').returns({
            field: sinon.stub().returns({
                then: sinon.stub().callsFake((callback) => callback())
            })
        });

        logTemperature(influxClient).then(() => {
            expect(writeStub.calledOnce).to.be.true;
            expect(writeStub.calledWith('file')).to.be.true;
            done();
        }).catch(done);
    });

    it('Should not save invalid temperature data (too low)', (done) => {
        const mockResponse = { result: -150 };

        nock('https://api.particle.io')
            .get('/v1/devices/device123/temperature')
            .query({ access_token: 'token123' })
            .reply(200, mockResponse);

        const writeStub = sinon.stub(influxClient, 'write');

        logTemperature(influxClient).then(() => {
            expect(writeStub.notCalled).to.be.true;
            done();
        }).catch(done);
    });

    it('Should not save invalid temperature data (too high)', (done) => {
        const mockResponse = { result: 150 };

        nock('https://api.particle.io')
            .get('/v1/devices/device123/temperature')
            .query({ access_token: 'token123' })
            .reply(200, mockResponse);

        const writeStub = sinon.stub(influxClient, 'write');

        logTemperature(influxClient).then(() => {
            expect(writeStub.notCalled).to.be.true;
            done();
        }).catch(done);
    });
});