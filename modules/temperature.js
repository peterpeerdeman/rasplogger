const axios = require("axios");
const fs = require('fs');
const Influx = require('influxdb-nodejs');
const influxClient = new Influx('http://127.0.0.1:8086/raspweather-outside');

const writeLog = function(temperatureFloat) {
    var logEntry = new Date().toString() + ';' + temperatureFloat + '\n';
    fs.appendFile('temperatures-outside.txt', logEntry, function(err) {
        //
    });
}

const writeInflux = function(temperatureFloat) {
    influxClient.write('file').field({
        time: Date.now(),
        temperature: temperatureFloat,
    }).then(() => console.debug(`${Date.now()} influx write point success`))
    .catch(console.error);
}

const logTemperature = async url => {
    var url = `https://api.particle.io/v1/devices/${process.env.PARTICLE_DEVICE_ID}/temperature?access_token=${process.env.PARTICLE_ACCESS_TOKEN}`;
    try {
        const response = await axios.get(url);
        const temperatureFloat = response.data.result;
        if (parseFloat(temperatureFloat) < -100 || temperatureFloat == "-0.0625" || parseFloat(temperatureFloat) >100) return;
        writeLog(temperatureFloat);
        writeInflux(temperatureFloat);
    } catch (error) {
        console.log(error);
    }
}

exports.logTemperature = logTemperature;
