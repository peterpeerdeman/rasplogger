const axios = require('axios');

const writeInflux = async (influxClient, data) => {
    const { avgGas, avgTime, avgTx } = data;

    const slowPriceWei = data.speeds[0].baseFee;
    const standardPriceWei = data.speeds[1].baseFee;
    const fastPriceWei = data.speeds[2].baseFee;
    const instantPriceWei = data.speeds[3].baseFee;
    const slowFeeDollars = data.speeds[0].estimatedFee;
    const standardFeeDollars = data.speeds[1].estimatedFee;
    const fastFeeDollars = data.speeds[2].estimatedFee;
    const instantFeeDollars = data.speeds[3].estimatedFee;

    influxClient
        .write('cryptogas')
        .tag({
            crypto: 'eth',
        })
        .field({
            avgGas,
            avgTime,
            avgTx,
            slowPriceWei,
            standardPriceWei,
            fastPriceWei,
            instantPriceWei,
            slowFeeDollars,
            standardFeeDollars,
            fastFeeDollars,
            instantFeeDollars,
        })
        .then(() => console.debug(`${Date.now()} cryptogas: write success`))
        .catch((err) =>
            console.error(
                `${Date.now()} cryptogas: write failed ${err.message}`
            )
        );
};

const logCryptoGas = async (influxClient) => {
    const url = `https://api.owlracle.info/v4/eth/gas?apikey=${process.env.CRYPTO_GAS_APIKEY}`;
    try {
        const response = await axios.get(url);
        writeInflux(influxClient, response.data);
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptogas: retrieve cryptogas failed ${error}`
        );
    }
};

module.exports = logCryptoGas;
