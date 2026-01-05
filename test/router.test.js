const expect = require('chai').expect;
const sinon = require('sinon');
const Influx = require('influxdb-nodejs');
const fritznode = require('fritznode');

influxClient = new Influx('http://localhost:8086/router');

const logRouter = require('../modules/router.js');

describe('router tests', () => {
    let fritzStub, mockConnection;

    beforeEach(() => {
        sinon.stub(influxClient, 'syncWrite').resolves();
        sinon.stub(influxClient, 'write').returns({
            field: sinon.stub().returns({
                queue: sinon.stub()
            }),
            tag: sinon.stub().returns({
                field: sinon.stub().returns({
                    queue: sinon.stub()
                })
            })
        });

        // Mock fritznode connection
        mockConnection = {
            getBandwithUsage: sinon.stub(),
            getDeviceList: sinon.stub(),
            getOverview: sinon.stub(),
            getNAS: sinon.stub()
        };

        fritzStub = sinon.stub(fritznode, 'fritz').resolves(mockConnection);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('Should save router data', (done) => {
        const mockBandwidth = { upload: 100, download: 200 };
        const mockDevices = [
            { name: 'Device1', mac: '00:11:22:33:44:55', ip: { ip: '192.168.1.10' }, port: 'eth0', active: true },
            { name: 'Device2', mac: '00:11:22:33:44:66', ip: { ip: '192.168.1.11' }, port: 'wifi', active: false }
        ];
        const mockOverview = { osVersion: '7.50', uptime: 123456, connectionType: 'DSL' };
        const mockNAS = { totalSpace: 1000, freeSpace: 500 };

        mockConnection.getBandwithUsage.resolves(mockBandwidth);
        mockConnection.getDeviceList.resolves(mockDevices);
        mockConnection.getOverview.resolves(mockOverview);
        mockConnection.getNAS.resolves(mockNAS);

        logRouter(influxClient).then(() => {
            expect(fritzStub.calledWith({})).to.be.true;
            expect(mockConnection.getBandwithUsage.calledOnce).to.be.true;
            expect(mockConnection.getDeviceList.calledOnce).to.be.true;
            expect(mockConnection.getOverview.calledOnce).to.be.true;
            expect(mockConnection.getNAS.calledOnce).to.be.true;
            done();
        }).catch(done);
    });

    it('Should handle connection error', (done) => {
        fritzStub.rejects(new Error('Connection failed'));

        logRouter(influxClient).catch((error) => {
            expect(error.message).to.equal('Connection failed');
            done();
        });
    });
});