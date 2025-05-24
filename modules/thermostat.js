const { Tado } = require('node-tado-client');
const storage = require('node-persist');
const tado = new Tado();

// formatZone, ported from https://github.com/ekeih/tado-influxdb/blob/master/src/tado-influxdb.py
const formatZone = (zone, weather) => {
    let wanted_temperature;
    const current_temperature = parseFloat(
        zone['sensorDataPoints']['insideTemperature']['celsius'],
    );
    const humidity = parseFloat(
        zone['sensorDataPoints']['humidity']['percentage'],
    );
    const heating_power = parseFloat(
        zone['activityDataPoints']['heatingPower']['percentage'],
    );
    const tado_mode = zone['tadoMode'];
    if (zone['setting']['power'] == 'ON') {
        wanted_temperature = parseFloat(
            zone['setting']['temperature']['celsius'],
        );
    } else {
        wanted_temperature = current_temperature;
    }
    const outside_temperature = parseFloat(
        weather['outsideTemperature']['celsius'],
    );
    const solar_intensity = parseFloat(weather['solarIntensity']['percentage']);
    const weather_state = weather['weatherState']['value'];
    return {
        outside_temperature: outside_temperature,
        solar_intensity: solar_intensity,
        weather_state: weather_state,
        current_temperature: current_temperature,
        wanted_temperature: wanted_temperature,
        humidity: humidity,
        heating_power: heating_power,
        tado_mode: zone['tadoMode'],
    };
};

const writeInflux = (influxClient, zone, fields) => {
    return influxClient
        .write('thermostat')
        .field(fields)
        .tag({
            name: zone.name,
            type: zone.type,
        })
        .then(() => {
            console.debug(
                `${Date.now()} thermostat: influx write point success for zone ${
                    zone.name
                }`,
            );
            return true;
        })
        .catch((error) =>
            console.debug(
                `${Date.now()} thermostat: write failed for ${
                    zone.name
                } ${error}`,
            ),
        );
};

const logThermostat = async (influxClient) => {
    const storagestatus = await storage.init();
    let tokens = await storage.getItem('tado-tokens');
    if (!tokens) {
        console.log(
            `${Date.now()} thermostat: refresh_tokens not set, need to verify`,
        );
        tokens = { refresh_token: 'refresh_token' };
    }
    const [verify, futureToken] = await tado.authenticate(tokens.refresh_token);
    if (verify) {
        console.log('------------------------------------------------');
        console.log('Device authentication required.');
        console.log('Please visit the following website in a browser.');
        console.log('');
        console.log(`  ${verify.verification_uri_complete}`);
        console.log('');
        console.log(
            `Checks will occur every ${verify.interval}s up to a maximum of ${verify.expires_in}s`,
        );
        console.log('------------------------------------------------');
    }
    await futureToken.then((token) => {
        storage.setItem('tado-tokens', token);
    });
    return Promise.all([
        tado.getZones(process.env.TADO_HOME_ID),
        tado.getWeather(process.env.TADO_HOME_ID),
    ])
        .then((promiseResults) => {
            const [zones, weather] = promiseResults;
            return Promise.all(
                zones.map((zone) => {
                    return tado
                        .getZoneState(process.env.TADO_HOME_ID, zone.id)
                        .then((zoneresult) => {
                            const fields = formatZone(zoneresult, weather);
                            return writeInflux(influxClient, zone, fields);
                        });
                }),
            );
        })
        .catch((err) => console.log(err));
};

module.exports = logThermostat;
