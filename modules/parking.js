const AP = require('amsterdam-parking');
const ap = new AP();

const writeInflux = (influxClient, parkingplaces) => {
    let influxWrites = parkingplaces.map(function(parkingplace) {
        return new Promise((resolve) => {
            influxClient.write('parkingplace')
            .tag({
                name: parkingplace.name,
                status: parkingplace.status,
                availability: parkingplace.availability,
            })
            .field({
                spaces: parkingplace.spaces
            }).queue();
            resolve();
        });
    });
    Promise.all(influxWrites).then(() => {
        influxClient.syncWrite()
        .then(() => console.debug(`${Date.now()} parking: sync write queue success`))
        .catch(err => console.error(`${Date.now()} parking: sync write queue failed ${err.message}`));
    });
};

const logParking = influxClient => {
    return ap.getCurrentAvailability()
    .then(parkingplaces => {
        return writeInflux(influxClient, parkingplaces);
    })
    .catch(err => console.log(err));
};

module.exports = logParking;
