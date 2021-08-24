const axios = require('axios');
const CRYPTO_ADDRESS = process.env.CRYPTO_ADDRESS;

const returnNextOutputs = async (url) => {
    const response = await axios.get(url);
    const address = response.data;
    if (!address.outputs.length || !address.next_outputs) {
        return address.outputs;
    }
    return address.outputs.concat(
        await returnNextOutputs(address.next_outputs)
    );
};

const writeInfluxTransactions = async (influxClient, transactions) => {
    await transactions.forEach(async (transaction) => {
        const { received, fees, ...rest } = transaction;

        const theInput = transaction.inputs.filter((output) => {
            return output.addresses.find((address) => {
                return address == CRYPTO_ADDRESS;
            });
        });

        if (theInput.length) {
            influxClient
                .write('transactions')
                .tag({
                    crypto: 'btc',
                    address: CRYPTO_ADDRESS,
                    type: 'sell',
                })
                .field({
                    value: theInput[0].output_value,
                    fees: fees,
                })
                .time(new Date(received).getTime() * 1000 * 1000)
                .queue();
        }

        if (transaction.next_outputs) {
            transaction.outputs = transaction.outputs.concat(
                await returnNextOutputs(transaction.next_outputs)
            );
        }

        const theOutput = transaction.outputs.filter((output) => {
            return output.addresses.find((address) => {
                return address == CRYPTO_ADDRESS;
            });
        });

        if (theOutput.length) {
            influxClient
                .write('transactions')
                .tag({
                    crypto: 'btc',
                    type: 'buy',
                })
                .field({
                    value: theOutput[0].value,
                    fees: fees,
                })
                .time(new Date(received).getTime() * 1000 * 1000)
                .queue();
        }
    });
    influxClient
        .syncWrite()
        .then(() =>
            console.debug(
                `${Date.now()} cryptotransactions: sync write queue success`
            )
        )
        .catch((err) =>
            console.error(
                `${Date.now()} cryptotransactions: sync write queue failed ${
                    err.message
                }`
            )
        );
};

const writeInfluxBalance = (influxClient, address) => {
    const { total_received, total_sent, balance } = address;
    return influxClient
        .write('balance')
        .tag({
            crypto: 'btc',
        })
        .field({
            total_received,
            total_sent,
            balance,
        })
        .then(() =>
            console.debug(
                `${Date.now()} cryptotransactions: write balance success`
            )
        )
        .catch((err) =>
            console.error(
                `${Date.now()} cryptotransactions: write balance failed ${
                    err.message
                }`
            )
        );
};

const logCryptoTransactions = async (influxClient) => {
    const url = `https://api.blockcypher.com/v1/btc/main/addrs/${CRYPTO_ADDRESS}/full`;
    try {
        const response = await axios.get(url);
        const address = response.data;
        writeInfluxTransactions(influxClient, address.txs);
        writeInfluxBalance(influxClient, address);
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptohistory: retrieve cryptodata failed ${error}`
        );
    }
};

module.exports = logCryptoTransactions;
