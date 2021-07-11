const axios = require('axios');
const parse = require('csv-parse/lib/sync');

const writeInflux = (influxClient, cryptoDays) => {
    let influxWrites = cryptoDays.map(function (day) {
        if (isNaN(parseFloat(day['Open']))) return [];

        return new Promise((resolve) => {
            influxClient
                .write('prices')
                .tag({
                    currency: 'eur',
                    crypto: 'btc',
                })
                .field({
                    open: parseFloat(day['Open'] || 0),
                    high: parseFloat(day['High'] || 0),
                    low: parseFloat(day['Low'] || 0),
                    close: parseFloat(day['Close'] || 0),
                    adjClose: parseFloat(day['Adj Close'] || 0),
                    volume: parseFloat(day['Volume'] || 0),
                })
                .time(new Date(day.Date).getTime() * 1000 * 1000)
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
    const timestamp = Math.floor(Date.now() / 1000);
    var url = `https://query1.finance.yahoo.com/v7/finance/download/BTC-EUR?period1=1594490376&period2=${timestamp}&interval=1d&events=history&includeAdjustedClose=true`;
    try {
        const response = await axios.get(url);
        const cryptoDays = parse(response.data, { columns: true });
        writeInflux(influxClient, cryptoDays);
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptohistory: retrieve cryptohistory failed ${error}`
        );
    }
};

module.exports = logCryptoHistory;
