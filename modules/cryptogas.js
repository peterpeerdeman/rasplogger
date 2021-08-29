const axios = require('axios');

const writeInflux = async (influxClient, data) => {
    const {
        fast,
        fastest,
        safeLow,
        average,
        block_time,
        blockNum,
        speed,
        safeLowWait,
        avgWait,
        fastWait,
        fastestWait,
    } = data;

    influxClient
        .write('cryptogas')
        .tag({
            crypto: 'eth',
        })
        .field({
            fast,
            fastest,
            safeLow,
            average,
            block_time,
            blockNum,
            speed,
            safeLowWait,
            avgWait,
            fastWait,
            fastestWait,
        })
        .then(() => console.debug(`${Date.now()} cryptogas: write success`))
        .catch((err) =>
            console.error(
                `${Date.now()} cryptogas: write failed ${err.message}`
            )
        );
};

const logCryptoGas = async (influxClient) => {
    const url = `https://ethgasstation.info/json/ethgasAPI.json`;
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
