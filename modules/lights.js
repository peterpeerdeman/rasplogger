const Influx = require('influxdb-nodejs');
const influxClient = new Influx('http://127.0.0.1:8086/huelights');
const v3 = require('node-hue-api').v3;

const writeInflux = function(lights) {
    let influxWrites = Object.values(lights).map(function(dataset) {
        return new Promise((resolve) => {
            influxClient.write('lightstatus')
            .tag({
                name: dataset.name,
                uniqueid: dataset.uniqueid,
                'alert': dataset['alert'],
                colormode: dataset.colormode,
                effect: dataset.effect,
            })
            .field({
                on: dataset._rawData.state.on,
                bri: dataset._rawData.state.bri,
                ct: dataset._rawData.state.ct,
                ...dataset._rawData.state.xy,
                reachable: dataset._rawData.state.reachable,
                hue: dataset._rawData.state.hue,
            }).queue();
            resolve();
        })
    })
    Promise.all(influxWrites).then(() => {
        influxClient.syncWrite()
        .then(() => console.debug(`${Date.now()} lights: sync write queue success`))
        .catch(err => console.error(`${Date.now()} lights: sync write queue failed ${err.message}`));
    });
}

const logLights = function(){
    v3.api.createLocal(process.env.LIGHTS_HOST).connect(process.env.LIGHTS_USERNAME)
    .then(api => {
        return api.lights.getAll()
    })
    .then(allLights => {
        writeInflux(allLights);
    });
}

module.exports = logLights;
