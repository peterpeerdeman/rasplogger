const fetch = require('node-fetch');
const cheerio = require('cheerio');

const writeInflux = async (influxClient, data) => {
    influxClient
        .write('cryptosupply')
        .tag({
            crypto: 'btc',
        })
        .field(data)
        .then(() => console.debug(`${Date.now()} cryptosupply: write success`))
        .catch((err) =>
            console.error(
                `${Date.now()} cryptosupply: write failed ${err.message}`
            )
        );
};

const scrapeData = (data) => {
    const $ = cheerio.load(data);
    const bufferBarDiv = $('.buffer__bar');
    return {
        balance: bufferBarDiv.data('balance'),
        target: bufferBarDiv.data('target'),
    };
};

const logCryptoSupply = async (influxClient) => {
    const url = `https://bitonic.nl/en/`;
    try {
        const response = await fetch(url);
        const scrapedData = scrapeData(await response.text());
        debugger;
        writeInflux(influxClient, scrapedData);
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptosupply: retrieve cryptosupply failed ${error}`
        );
    }
};

module.exports = logCryptoSupply;
