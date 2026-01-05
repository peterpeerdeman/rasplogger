 const expect = require('chai').expect;
 const axios = require('axios');
 const Influx = require('influxdb-nodejs');
 const sinon = require('sinon');

 influxClient = new Influx('http://localhost:8086/cryptotransactions');

 process.env.CRYPTO_ADDRESS = '1ABC...';

 const logCryptoTransactions = require('../modules/cryptotransactions.js');

 describe('cryptotransactions tests', () => {
     afterEach(() => {
         sinon.restore();
     });

     it('Should save crypto transactions and balance data', (done) => {
         const mockResponse = {
             txs: [
                 {
                     received: '2023-01-01T00:00:00Z',
                     fees: 1000,
                     inputs: [{ output_value: 50000, addresses: ['1ABC...'] }],
                     outputs: [{ value: 49000, addresses: ['other'] }],
                     next_outputs: null
                 },
                 {
                     received: '2023-01-02T00:00:00Z',
                     fees: 2000,
                     inputs: [{ output_value: 30000, addresses: ['1ABC...'] }],
                     outputs: [{ value: 28000, addresses: ['1ABC...'] }],
                     next_outputs: null
                 }
             ],
             total_received: 100000,
             total_sent: 80000,
             balance: 20000
         };

         const axiosStub = sinon.stub(axios, 'get').resolves({ data: mockResponse });

        const writeStub = sinon.stub(influxClient, 'write').callsFake(() => {
            const obj = {
                tag: sinon.stub().returnsThis(),
                field: sinon.stub().returnsThis(),
                time: sinon.stub().returnsThis(),
                queue: sinon.stub(),
                then: sinon.stub().callsFake((callback) => {
                    callback();
                    return {
                        catch: sinon.stub().callsFake((callback) => callback())
                    };
                })
            };
            return obj;
        });
        const syncWriteStub = sinon.stub(influxClient, 'syncWrite').resolves();

        logCryptoTransactions(influxClient);

        // Wait for async operations
        setTimeout(() => {
            try {
                expect(writeStub.callCount).to.be.greaterThan(2); // Transactions + balance
                expect(syncWriteStub.calledOnce).to.be.true;
                done();
            } catch (error) {
                done(error);
            }
        }, 100);
    });

     it('Should handle API error', (done) => {
         const axiosStub = sinon.stub(axios, 'get').rejects(new Error('Server error'));

         logCryptoTransactions(influxClient).then(() => {
             // Should not throw, just log error
             done();
         }).catch(done);
     });
});