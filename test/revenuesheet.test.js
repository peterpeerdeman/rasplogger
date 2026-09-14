const expect = require('chai').expect;
const sinon = require('sinon');
const Influx = require('influxdb-nodejs');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

influxClient = new Influx('http://localhost:8086/revenuesheet');

process.env.REVENUE_SERVICE_EMAIL = 'test@example.com';
process.env.REVENUE_PRIVATE_KEY = Buffer.from('fake-key').toString('base64');
process.env.REVENUE_SHEET_DOC_ID = 'doc123';

const logRevenuesheet = require('../modules/revenuesheet.js');

function makeRow(data) {
    return { get: (key) => data[key] };
}

// Records every write().tag()/.field()/.time()/.queue() call regardless of
// the order they're chained in, instead of asserting one fixed call order.
function createInfluxWriteRecorder(client) {
    const writes = [];
    const write = sinon.stub().callsFake((measurement) => {
        const record = { measurement, tags: {}, fields: {}, time: null };
        const chain = {
            tag: sinon.stub().callsFake((k, v) => {
                record.tags[k] = v;
                return chain;
            }),
            field: sinon.stub().callsFake((f) => {
                record.fields = f;
                return chain;
            }),
            time: sinon.stub().callsFake((t) => {
                record.time = t;
                return chain;
            }),
            queue: sinon.stub().callsFake(() => {
                writes.push(record);
                return chain;
            }),
        };
        return chain;
    });
    sinon.stub(client, 'write').callsFake(write);
    return writes;
}

describe('revenuesheet tests', () => {
    let loadInfoStub, loadHeaderRowStub, getRowsStub, sheetsByTitleStub;

    beforeEach(() => {
        loadInfoStub = sinon.stub(GoogleSpreadsheet.prototype, 'loadInfo').resolves();
        loadHeaderRowStub = sinon.stub().resolves();
        getRowsStub = sinon.stub();
        sheetsByTitleStub = sinon
            .stub(GoogleSpreadsheet.prototype, 'sheetsByTitle')
            .get(() => ({
                Facturen: {
                    loadHeaderRow: loadHeaderRowStub,
                    getRows: getRowsStub,
                },
            }));
    });

    afterEach(() => {
        sinon.restore();
    });

    it('Should be a function', () => {
        expect(typeof logRevenuesheet).to.equal('function');
    });

    it('loads the "Facturen" sheet using the configured doc id and service account', async () => {
        getRowsStub.resolves([]);
        const syncWriteStub = sinon.stub(influxClient, 'syncWrite').resolves();

        await logRevenuesheet(influxClient);

        expect(loadInfoStub.calledOnce).to.be.true;
        expect(loadHeaderRowStub.calledOnce).to.be.true;
        expect(getRowsStub.calledOnce).to.be.true;
        expect(syncWriteStub.calledOnce).to.be.true;
    });

    it('maps rows into fields/tags and writes them to influx, skipping rows without a date', async () => {
        getRowsStub.resolves([
            makeRow({
                date: '2026-01-15',
                Opdrachtgever: 'Acme Corp',
                'Soort werk': 'writing',
                'Omschrijving activiteit': 'blog post',
                amount: '250.50',
                'Aantal woorden': '1200',
                'Aantal uren': '4.5',
                'Betaald?': 'Ja',
                Projectnummer: 'P-1',
                Tarief: 'fixed',
            }),
            makeRow({ Opdrachtgever: 'No Date Co' }), // no `date` - should be dropped
            makeRow({
                date: '2026-02-01',
                Opdrachtgever: 'Beta Ltd',
                'Soort werk': 'consulting',
                amount: '100',
                'Betaald?': 'Nee',
            }),
        ]);

        const writes = createInfluxWriteRecorder(influxClient);
        sinon.stub(influxClient, 'syncWrite').resolves();

        await logRevenuesheet(influxClient);

        // one write() call per row with a date -> 2 of the 3 mock rows
        expect(writes).to.have.lengthOf(2);
        expect(writes[0].measurement).to.equal('revenue');

        expect(writes[0].fields.amount).to.equal(250.5);
        expect(writes[0].fields.words).to.equal(1200);
        expect(writes[0].fields.hours).to.equal(4.5);
        expect(writes[0].fields.payed).to.be.true;
        expect(writes[0].fields.description).to.equal('blog post');
        expect(writes[0].tags).to.deep.equal({
            projectnr: 'P-1',
            kind: 'writing',
            client: 'Acme Corp',
        });

        expect(writes[1].fields.amount).to.equal(100);
        expect(writes[1].fields.payed).to.be.false;
        expect(writes[1].fields.words).to.be.undefined;
        expect(writes[1].fields.hours).to.be.undefined;
    });
});
