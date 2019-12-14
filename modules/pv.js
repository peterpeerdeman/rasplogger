const Influx = require('influxdb-nodejs');
const influxClient = new Influx('http://127.0.0.1:8086/pv');
const pvoutput = require('pvoutput');
const moment = require('moment');

const pvoutputclient = new pvoutput({
    debug: false,
    apiKey: process.env.PVOUTPUT_APIKEY,
    systemId: process.env.PVOUTPUT_SYSTEMID
});

const convertTimestampToMoment = function (date, time) {
    const [hour, minute] = time.split(':');
    let timestamp = moment(date);
    timestamp.hour(hour);
    timestamp.minute(minute);
    return timestamp;
};

const writeInflux = function(pvoutput) {
    const timestamp = convertTimestampToMoment(pvoutput.date, pvoutput.time);
    influxClient.write('pvstatus')
    .time(timestamp.toformat('X'))
    .field({
        energyGeneration: pvoutput.energyGeneration,
        powerGeneration: pvoutput.powerGeneration,
        temperature: pvoutput.temperature,
        voltage: pvoutput.voltage,
    })
    .then(() => console.debug(`${Date.now()} pv: write success`))
    .catch(err => console.error(`${Date.now()} pv: write failed ${err.message}`));
}

const logPV = function(){
    pvoutputclient.getStatus().then(function(result) {
        if (result.time) {
            writeInflux(result);
        }
    });
}

exports.logPV = logPV;
