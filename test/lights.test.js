const expect = require('chai').expect;
const sinon = require('sinon');
const Influx = require('influxdb-nodejs');
const v3 = require('node-hue-api').v3;

influxClient = new Influx('http://localhost:8086/lights');

process.env.LIGHTS_HOST = '192.168.1.100';
process.env.LIGHTS_USERNAME = 'username123';

const logLights = require('../modules/lights.js');

describe('lights tests', () => {
    let createLocalStub, connectStub, getAllStub, syncWriteStub;

    beforeEach(() => {
        syncWriteStub = sinon.stub(influxClient, 'syncWrite').resolves();
        sinon.stub(influxClient, 'write').returns({
            tag: sinon.stub().returns({
                field: sinon.stub().returns({
                    queue: sinon.stub()
                })
            })
        });

        // Mock the Hue API
        const mockApi = {
            lights: {
                getAll: sinon.stub()
            }
        };

        connectStub = sinon.stub().resolves(mockApi);
        getAllStub = mockApi.lights.getAll;

        const mockLocalApi = {
            connect: connectStub
        };

        createLocalStub = sinon.stub(v3.api, 'createLocal').returns(mockLocalApi);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('Should save lights data', (done) => {
        const mockLights = {
            1: {
                name: 'Light 1',
                uniqueid: 'unique1',
                state: {
                    on: true,
                    bri: 254,
                    ct: 300,
                    xy: [0.5, 0.4],
                    reachable: true,
                    hue: 15000
                }
            },
            2: {
                name: 'Light 2',
                uniqueid: 'unique2',
                state: {
                    on: false,
                    bri: 0,
                    ct: 400,
                    xy: [0.3, 0.6],
                    reachable: false,
                    hue: 20000
                }
            }
        };

        getAllStub.resolves(mockLights);

        logLights(influxClient).then(() => {
            expect(createLocalStub.calledWith('192.168.1.100')).to.be.true;
            expect(connectStub.calledWith('username123')).to.be.true;
            expect(getAllStub.calledOnce).to.be.true;
            expect(syncWriteStub.calledOnce).to.be.true;
            done();
        }).catch(done);
    });

    it('Should handle API connection error', (done) => {
        connectStub.rejects(new Error('Connection failed'));

        logLights(influxClient).catch((error) => {
            expect(error.message).to.equal('Connection failed');
            expect(syncWriteStub.notCalled).to.be.true;
            done();
        });
    });
});