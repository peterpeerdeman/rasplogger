const expect = require('chai').expect;

describe('fitbit tests', () => {
    it('Should be a function', () => {
        const logFitbit = require('../modules/fitbit.js');
        expect(typeof logFitbit).to.equal('function');
    });

    // TODO: Add full test with mocked Fitbit API and storage
    // This would require mocking fitbit-node and node-persist libraries
    // For now, the module is tested indirectly through integration
});