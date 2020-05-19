const v3 = require('node-hue-api').v3;

const writeInflux = function(influxClient, lights) {
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
        });
    });
    return Promise.all(influxWrites).then(() => {
        return influxClient.syncWrite()
        .then(() => console.debug(`${Date.now()} lights: sync write queue success`))
        .catch(err => console.error(`${Date.now()} lights: sync write queue failed ${err.message}`));
    });
};

const logLights = async influxClient => {
    return v3.api.createLocal(process.env.LIGHTS_HOST).connect(process.env.LIGHTS_USERNAME)
    .then(api => {
        return api.lights.getAll();
    })
    .then(allLights => {
        return writeInflux(influxClient, allLights);
    });
};

module.exports = logLights;
