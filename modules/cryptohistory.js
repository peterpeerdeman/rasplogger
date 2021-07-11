const fetch = require('node-fetch');
const cheerio = require('cheerio');

const writeInflux = (influxClient, cryptoDays) => {
    let influxWrites = cryptoDays.map(function (day) {
        const { date, ...fields } = day;
        return new Promise((resolve) => {
            influxClient
                .write('prices')
                .tag({
                    currency: 'eur',
                    crypto: 'btc',
                })
                .field(fields)
                .time(date * 1000 * 1000 * 1000)
                .queue();
            resolve();
        });
    });
    Promise.all(influxWrites).then(() => {
        influxClient
            .syncWrite()
            .then(() =>
                console.debug(
                    `${Date.now()} cryptohistory: sync write queue success`
                )
            )
            .catch((err) =>
                console.error(
                    `${Date.now()} cryptohistory: sync write queue failed ${
                        err.message
                    }`
                )
            );
    });
};

const logCryptoHistory = async (influxClient) => {
    const end_date = encodeURIComponent(
        new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
    ); // e.g. 07%2F11%2F2021
    const url = `https://www.investing.com/instruments/HistoricalDataAjax`;
    try {
        const response = await fetch(
            'https://www.investing.com/instruments/HistoricalDataAjax',
            {
                method: 'POST',
                headers: {
                    authority: 'www.investing.com',
                    pragma: 'no-cache',
                    'cache-control': 'no-cache',
                    'sec-ch-ua':
                        '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    accept: 'text/plain, */*; q=0.01',
                    'x-requested-with': 'XMLHttpRequest',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                    'content-type': 'application/x-www-form-urlencoded',
                    origin: 'https://www.investing.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer:
                        'https://www.investing.com/crypto/bitcoin/historical-data?cid=1057388',
                    'accept-language':
                        'en-NL,en;q=0.9,nl-NL;q=0.8,nl;q=0.7,en-US;q=0.6',
                },
                body: `curr_id=1057388&smlID=25609848&header=null&st_date=01%2F01%2F2013&end_date=${end_date}&interval_sec=Daily&sort_col=date&sort_ord=DESC&action=historical_data`,
            }
        );

        const $ = cheerio.load(await response.text());
        const table = $('#curr_table');
        let results = [];
        table.find('tbody > tr').each(function (i, el) {
            const tds = $(el).find('td');
            results.push({
                date: $(tds[0]).data('real-value'),
                price: parseFloat(
                    $(tds[1]).attr('data-real-value').replace(/,/g, '')
                ),
                open: parseFloat(
                    $(tds[2]).attr('data-real-value').replace(/,/g, '')
                ),
                high: parseFloat(
                    $(tds[3]).attr('data-real-value').replace(/,/g, '')
                ),
                low: parseFloat(
                    $(tds[4]).attr('data-real-value').replace(/,/g, '')
                ),
                volume: parseFloat($(tds[5]).attr('data-real-value')),
                change: parseFloat($(tds[6]).text()),
            });
        });
        writeInflux(influxClient, results);
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptohistory: retrieve cryptohistory failed ${error}`
        );
    }
};

module.exports = logCryptoHistory;
