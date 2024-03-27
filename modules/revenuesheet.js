const { GoogleSpreadsheet } = require('google-spreadsheet');
const moment = require('moment');

const getRevenuesheetData = async function () {
    // Initialize the sheet - doc ID is the long id in the sheets URL
    const doc = new GoogleSpreadsheet(process.env.REVENUE_SHEET_DOC_ID, {
        apiKey: process.env.REVENUE_GOOGLE_APIKEY,
    });

    await doc.loadInfo(); // loads document properties and worksheets
    const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();
    return rows.map((row) => {
        return {
            date: new Date(row.get('date')),
            client: row.get('Opdrachtgever'),
            kind: row.get('Soort werk'),
            description: row.get('Omschrijving activiteit'),
            amount: parseFloat(row.get('amount')),
            words: parseInt(row.get('Aantal woorden')) || undefined,
            hours: parseFloat(row.get('Aantal uren')) || undefined,
            payed: row.get('Betaald?') == 'Ja' ? true : false,
            projectnr: row.get('Projectnummer Scripta'),
        };
    });
};

const writeInflux = function (influxClient, data) {
    for (const datapoint of data) {
        const { date, projectnr, client, kind, ...fields } = datapoint;

        const timestamp = moment(date).add(12, 'hours');
        influxClient
            .write('revenue')
            .time(timestamp.format('x') * 1000000)
            .field(fields)
            .tag('projectnr', projectnr)
            .tag('kind', kind)
            .tag('client', client)
            .queue();
    }
    return influxClient
        .syncWrite()
        .then(() => console.debug(`${Date.now()} revenuesheet: write success`))
        .catch((err) =>
            console.error(
                `${Date.now()} revenuesheet: write failed ${err.message}`
            )
        );
};

const logRevenuesheet = async (influxClient) => {
    const data = await getRevenuesheetData();
    return writeInflux(influxClient, data);
};

module.exports = logRevenuesheet;
