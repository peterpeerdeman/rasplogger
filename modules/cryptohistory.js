const fetch = require('node-fetch');
const cheerio = require('cheerio');

const writeInflux = (influxClient, candles, coin) => {
    debugger;

    let influxWrites = candles.map(function (candle) {
        const { time, ...fields } = candle;
        return new Promise((resolve) => {
            influxClient
                .write('prices')
                .tag({
                    currency: 'eur',
                    crypto: coin,
                })
                .field(fields)
                .time(time * 1000 * 1000)
                .queue();
            resolve();
        });
    });
    Promise.all(influxWrites).then(() => {
        influxClient
            .syncWrite()
            .then(() =>
                console.debug(
                    `${Date.now()} cryptohistory: sync write ${coin} queue success`
                )
            )
            .catch((err) =>
                console.error(
                    `${Date.now()} cryptohistory: sync write ${coin} queue failed ${
                        err.message
                    }`
                )
            );
    });
};

const candlesToFields = (candles) => {
    return candles.map((candle) => {
        return {
            time: candle[0],
            open: parseInt(candle[1]),
            high: parseInt(candle[2]),
            low: parseInt(candle[3]),
            price: parseInt(candle[4]),
            volume: parseFloat(candle[5]),
        };
    });
};

const fetchBTC = async () => {
    try {
        const response = await fetch(
            'https://api.bitvavo.com/v2/BTC-EUR/candles?interval=1h',
            {}
        );
        const data = await response.json();
        const result = candlesToFields(data);
        return result;
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptohistory: retrieve btc cryptohistory failed ${error}`
        );
    }
};

const fetchETH = async () => {
    try {
        const response = await fetch(
            'https://api.bitvavo.com/v2/ETH-EUR/candles?interval=1h',
            {}
        );
        const data = await response.json();
        const result = candlesToFields(data);
        return result;
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptohistory: retrieve eth cryptohistory failed ${error}`
        );
    }
};

const logCryptoHistory = async (influxClient) => {
    const btcHistory = await fetchBTC();
    const ethHistory = await fetchETH();
    writeInflux(influxClient, ethHistory, 'eth');
    writeInflux(influxClient, btcHistory, 'btc');
};

module.exports = logCryptoHistory;
