const fetch = require('node-fetch');
const cheerio = require('cheerio');

const writeInflux = (influxClient, cryptoDays, coin) => {
    let influxWrites = cryptoDays.map(function (day) {
        const { date, ...fields } = day;
        return new Promise((resolve) => {
            influxClient
                .write('prices')
                .tag({
                    currency: 'eur',
                    crypto: coin,
                })
                .field(fields)
                .time(date * 1000 * 1000 * 1000)
                .queue();
            resolve();
        });
    });
    Promise.all(influxWrites).then(() => {});
};

const parseWebpage = async (response, influxClient) => {
    const $ = cheerio.load(await response.text());
    const divs = $('.all_coll_row');
    let i = 0;
    for (const div of divs) {
        if (i == 0) {
            i++;
            continue;
        }
        const cols = $(div).find('.all_coll_col');
        const name = $(cols[0]).text().trim();
        const datapoint = {
            floor: parseFloat($(cols[1]).text().split(' ')[0]),
            items: parseInt($(cols[2]).text().trim()),
            holders: parseInt($(cols[3]).text().trim()),
            onsale_count: parseInt($(cols[4]).text().trim()),
            onsale_percentage: parseFloat($(cols[5]).text().trim()),
            floor_marketcap: $(cols[6]).text().trim(),
        };

        influxClient
            .write('collections')
            .tag('name', name)
            .field(datapoint)
            .queue();
    }

    return influxClient
        .syncWrite()
        .then(() =>
            console.debug(
                `${Date.now()} cryptocollections: sync write queue success`
            )
        );
};

const scrapeCollectionStats = async (influxClient) => {
    try {
        const response = await fetch('https://howrare.is/');
        const results = parseWebpage(response, influxClient);
        return results;
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptocollections: retrieve btc cryptohistory failed ${error}`
        );
    }
};

const logCryptoCollections = async (influxClient) => {
    const collectionStats = await scrapeCollectionStats(influxClient);
};

module.exports = logCryptoCollections;
