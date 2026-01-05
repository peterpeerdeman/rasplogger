const expect = require('chai').expect;
const nock = require('nock');
const Influx = require('influxdb-nodejs');
const sinon = require('sinon');

influxClient = new Influx('http://localhost:8086/cryptogas');

process.env.CRYPTO_GAS_APIKEY = 'apikey123';

const logCryptoGas = require('../modules/cryptogas.js');

describe('cryptogas tests', () => {
    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    it('Should save crypto gas data', (done) => {
        const mockResponse = {
            avgGas: 25.5,
            avgTime: 30,
            avgTx: 150,
            speeds: [
                { baseFee: 20, estimatedFee: 0.5 },
                { baseFee: 25, estimatedFee: 0.7 },
                { baseFee: 30, estimatedFee: 1.0 },
                { baseFee: 35, estimatedFee: 1.5 },
            ],
        };

        nock('https://api.owlracle.info')
            .get('/v4/eth/gas')
            .query({ apikey: 'apikey123' })
            .reply(200, mockResponse);

        const fieldStub = sinon.stub().returns({
            then: sinon.stub().callsFake((callback) => callback()),
        });

        const writeStub = sinon.stub(influxClient, 'write').returns({
            tag: sinon.stub().returns({
                field: fieldStub,
            }),
        });

        logCryptoGas(influxClient)
            .then((data) => {
                expect(writeStub.calledOnce).to.be.true;
                expect(writeStub.calledWith('cryptogas')).to.be.true;
                expect(fieldStub.calledOnce).to.be.true;
                expect(
                    fieldStub.calledWith({
                        avgGas: 25.5,
                        avgTime: 30,
                        avgTx: 150,
                        slowPriceWei: 20,
                        standardPriceWei: 25,
                        fastPriceWei: 30,
                        instantPriceWei: 35,
                        slowFeeDollars: 0.5,
                        standardFeeDollars: 0.7,
                        fastFeeDollars: 1.0,
                        instantFeeDollars: 1.5,
                    }),
                ).to.be.true;
                done();
            })
            .catch(done);
    });

    it('Should handle API error', (done) => {
        nock('https://api.owlracle.info')
            .get('/v4/eth/gas')
            .query({ apikey: 'apikey123' })
            .reply(500, 'Server error');

        logCryptoGas(influxClient)
            .then(() => {
                // Should not throw, just log error
                done();
            })
            .catch(done);
    });
});
