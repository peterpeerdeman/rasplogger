const expect = require('chai').expect;
const nock = require('nock');
const Influx = require('influxdb-nodejs');
const sinon = require('sinon');

influxClient = new Influx('http://localhost:8086/cryptohistory');

const logCryptoHistory = require('../modules/cryptohistory.js');

describe('cryptohistory tests', () => {
    afterEach(() => {
        nock.cleanAll();
        sinon.restore();
    });

    it('Should save crypto history data for BTC and ETH', async () => {
        const mockBTCCandles = [
            [1640995200000, "50000", "51000", "49000", "50500", "10.5"],
            [1640998800000, "50500", "51500", "50000", "51000", "12.3"]
        ];
        const mockETHCandles = [
            [1640995200000, "3000", "3100", "2900", "3050", "50.2"],
            [1640998800000, "3050", "3150", "3000", "3100", "45.8"]
        ];

        nock('https://api.bitvavo.com')
            .get('/v2/BTC-EUR/candles')
            .query({ interval: '1h' })
            .reply(200, mockBTCCandles);

        nock('https://api.bitvavo.com')
            .get('/v2/ETH-EUR/candles')
            .query({ interval: '1h' })
            .reply(200, mockETHCandles);

        const writeStub = sinon.stub(influxClient, 'write').returns({
            tag: sinon.stub().returns({
                field: sinon.stub().returns({
                    time: sinon.stub().returns({
                        queue: sinon.stub()
                    })
                })
            })
        });
        const syncWriteStub = sinon.stub(influxClient, 'syncWrite').resolves();

        // Mock fetch function
        const mockFetch = sinon.stub();
        mockFetch.onCall(0).resolves({
            ok: true,
            json: async () => mockBTCCandles
        });
        mockFetch.onCall(1).resolves({
            ok: true,
            json: async () => mockETHCandles
        });

        const result = await logCryptoHistory(influxClient, mockFetch);

        expect(writeStub.callCount).to.equal(4); // 2 BTC + 2 ETH
        expect(syncWriteStub.callCount).to.equal(2); // Once for BTC, once for ETH
        expect(result).to.be.an('array').with.lengthOf(2);
        expect(result[0]).to.deep.equal({ success: true, coin: 'eth', count: 2 });
        expect(result[1]).to.deep.equal({ success: true, coin: 'btc', count: 2 });
    });

    it('Should handle fetch errors gracefully', async () => {
        const mockFetch = sinon.stub().rejects(new Error('Network error'));

        try {
            await logCryptoHistory(influxClient, mockFetch);
            expect.fail('Should have thrown an error');
        } catch (error) {
            expect(error.message).to.equal('Network error');
        }
    });

    it('Should handle empty candles data', async () => {
        const mockFetch = sinon.stub().resolves({
            ok: true,
            json: async () => []
        });

        try {
            await logCryptoHistory(influxClient, mockFetch);
            expect.fail('Should have thrown an error for empty candles');
        } catch (error) {
            expect(error.message).to.equal('No candles data for eth');
        }
    });

});