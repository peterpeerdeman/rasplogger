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

const writeInflux = function(influxClient, pvoutput) {
    const timestamp = convertTimestampToMoment(pvoutput.date, pvoutput.time);
    return influxClient.write('pvstatus')
    .time(timestamp.format('X'), 's')
    .field({
        energyGeneration: pvoutput.energyGeneration || 0,
        powerGeneration: pvoutput.powerGeneration || 0,
        temperature: pvoutput.temperature || undefined,
        voltage: pvoutput.voltage || 0,
    })
    .then(() => {
        console.debug(`${Date.now()} pv: write success`)  
        return true;
    })
    .catch(err => console.error(`${Date.now()} pv: write failed ${err.message}`));
}

const logPV = function(influx){
    return pvoutputclient.getStatus().then(function(result) {
        if (result.time) {
            return writeInflux(influx, result);
        } else {
            return false;
        }
    });
}

module.exports = logPV;
