const axios = require("axios");
const fs = require('fs');

const writeLog = function(temperatureFloat) {
    var logEntry = new Date().toString() + ';' + temperatureFloat + '\n';
    fs.appendFile('temperatures-outside.txt', logEntry, function(err) {
        //
    });
};

const writeInflux = function(influxClient, temperatureFloat) {
    return influxClient.write('file').field({
        time: Date.now(),
        temperature: temperatureFloat,
    }).then(() => {
        return console.debug(`${Date.now()} temperature: influx write point success`);
    });
};

const logTemperature = async influxClient => {
    var url = `https://api.particle.io/v1/devices/${process.env.PARTICLE_DEVICE_ID}/temperature?access_token=${process.env.PARTICLE_ACCESS_TOKEN}`;
    try {
        const response = await axios.get(url);
        const temperatureFloat = response.data.result;
        if (parseFloat(temperatureFloat) < -100 || temperatureFloat == "-0.0625" || parseFloat(temperatureFloat) >100) return;
        writeLog(temperatureFloat);
        writeInflux(influxClient, temperatureFloat);
    } catch (error) {
        return console.debug(`${Date.now()} temperature: retrieve temperature failed ${error}`);
    }
};

module.exports = logTemperature;
