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

const fetchBTC = async (fetch) => {
    try {
        const response = await fetch(
            'https://api.bitvavo.com/v2/BTC-EUR/candles?interval=1h',
            {},
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const result = candlesToFields(data);
        return result;
    } catch (error) {
        console.debug(
            `${Date.now()} cryptohistory: retrieve btc cryptohistory failed ${error}`,
        );
        throw error;
    }
};

const fetchETH = async (fetch) => {
    try {
        const response = await fetch(
            'https://api.bitvavo.com/v2/ETH-EUR/candles?interval=1h',
            {},
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const result = candlesToFields(data);
        return result;
    } catch (error) {
        console.debug(
            `${Date.now()} cryptohistory: retrieve eth cryptohistory failed ${error}`,
        );
        throw error;
    }
};

const writeInflux = async (influxClient, candles, coin) => {
    if (!candles || candles.length === 0) {
        throw new Error(`No candles data for ${coin}`);
    }

    const influxWrites = candles.map(function (candle) {
        const { time, ...fields } = candle;
        influxClient
            .write('prices')
            .tag({
                currency: 'eur',
                crypto: coin,
            })
            .field(fields)
            .time(time * 1000 * 1000)
            .queue();
    });

    try {
        await influxClient.syncWrite();
        console.debug(
            `${Date.now()} cryptohistory: sync write ${coin} queue success`,
        );
        return { success: true, coin, count: candles.length };
    } catch (err) {
        console.error(
            `${Date.now()} cryptohistory: sync write ${coin} queue failed ${
                err.message
            }`,
        );
        throw err;
    }
};

const logCryptoHistory = async (
    influxClient,
    fetchImpl = require('node-fetch'),
) => {
    try {
        const btcHistory = await fetchBTC(fetchImpl);
        const ethHistory = await fetchETH(fetchImpl);
        const result1 = await writeInflux(influxClient, ethHistory, 'eth');
        const result2 = await writeInflux(influxClient, btcHistory, 'btc');
        return [result1, result2];
    } catch (error) {
        console.error(
            `${Date.now()} cryptohistory: logCryptoHistory failed ${error}`,
        );
        throw error;
    }
};

module.exports = logCryptoHistory;
