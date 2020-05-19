const fritznode = require('fritznode');

const writeInfluxBandwidth = (influxClient, bandwidth) => {
    influxClient.write('bandwidth')
    .field(bandwidth)
    .queue();
};

const writeInfluxDevices = (influxClient, devices) => {
    for (let device of devices) {
        influxClient.write('devices')
        .tag({
            name: device.name || undefined,
            mac: device.mac || undefined,
            ip: device.ip || undefined,
            port: device.port || undefined,
        })
        .field({
            active: device.active,
        })
        .queue();
    }
};

const writeInfluxOverview = (influxClient, overview) => {
    const {osVersion, ...overviewFields} = overview;
    influxClient.write('overview')
    .tag({
        osVersion,
    })
    .field(overviewFields)
    .queue();
};

const writeInfluxNAS = (influxClient, nas) => {
    influxClient.write('nas')
    .field(nas)
    .queue();
};

const writeInflux = (influxClient, bandwidth, devices, overview, nas) => {
    writeInfluxBandwidth(influxClient, bandwidth);
    writeInfluxDevices(influxClient, devices);
    writeInfluxOverview(influxClient, overview);
    writeInfluxNAS(influxClient, nas);

    influxClient.syncWrite()
    .then(() => console.debug(`${Date.now()} router: influx write point success`))
    .catch((error) => console.debug(`${Date.now()} router: write failed ${error}`));
};

const logRouter = async influxClient => {
    const con = await fritznode.fritz({});
    const promises = [
        con.getBandwithUsage(),
        con.getDeviceList(),
        con.getOverview(),
        con.getNAS(),
    ];
    return Promise.all(promises)
    .then((results) => {
        return writeInflux(influxClient, ...results);
    });
};

module.exports = logRouter;
