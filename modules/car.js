const tjs = require('teslajs');
const fs = require('fs');
const storage = require('node-persist');

const sleep = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const writeInfluxChargeState = (influxClient, vehicleData) => {
    influxClient.write('charge_state')
    .field(vehicleData.charge_state)
    .tag('vin',vehicleData.vin)
    .tag('display_name', vehicleData.display_name)
    .queue();
};

const writeInfluxClimateState = (influxClient, vehicleData) => {
    influxClient.write('climate_state')
    .field(vehicleData.climate_state)
    .tag('vin',vehicleData.vin)
    .tag('display_name', vehicleData.display_name)
    .queue();
};

const writeInfluxDriveState = (influxClient, vehicleData) => {
    influxClient.write('drive_state')
    .field(vehicleData.drive_state)
    .tag('vin',vehicleData.vin)
    .tag('display_name', vehicleData.display_name)
    .queue();
};

const writeInfluxVehicleState = (influxClient, vehicleData) => {
    // spread these nested object fields to ignore them while writing
    const { media_state, software_update, speed_limit_mode, ...fields } = vehicleData.vehicle_state;
    influxClient.write('vehicle_state')
    .field(fields)
    .tag('vin',vehicleData.vin)
    .tag('display_name', vehicleData.display_name)
    .queue();
};

const writeInflux = (influxClient, vehicleData) => {
    writeInfluxChargeState(influxClient, vehicleData);
    writeInfluxClimateState(influxClient, vehicleData);
    writeInfluxDriveState(influxClient, vehicleData);
    writeInfluxVehicleState(influxClient, vehicleData);

    influxClient.syncWrite()
    .then(() => console.debug(`${Date.now()} car: influx write point success`))
    .catch((error) => console.debug(`${Date.now()} car: write failed ${error}`));
};

const loginAndSetToken = async function() {
    const login = await tjs.loginAsync({
        username: process.env.CAR_USER,
        password: process.env.CAR_PASSWORD,
    });
    if (login.error) {
        console.log(`${Date.now()} car: could not login ${JSON.stringify(login.error)}`);
        return false;
    } else {
        const token = login.authToken;
        storage.setItem('tesla-authtoken', token);
        return token;
    }
};

const checkTokenAndRefreshIfNeeded = async (token) => {
    const baseOptions = {
        authToken: token,
    };
    try {
        const vehicle = await tjs.vehicleAsync(baseOptions);
        return token;
    } catch (error) {
        console.log(`${Date.now()} car: token unauthorized, resetting access token`);
        const freshToken = await loginAndSetToken();
        return freshToken;
    }
};

const retrieveAndStoreData = async (influxClient, token) => {
    try {
        const baseOptions = {
            authToken: token,
        };
        const vehicle = await tjs.vehicleAsync(baseOptions);

        const vehicleOptions = {
            ...baseOptions,
            vehicleID: vehicle.id_s,
        };

        if (vehicle.state == 'offline') {
            const wakeup = await tjs.wakeUpAsync(vehicleOptions);
            await sleep(30000);
        }
        const vehicleData = await tjs.vehicleDataAsync(vehicleOptions);
        return writeInflux(influxClient, vehicleData);
    } catch (error) {
        return console.debug(`${Date.now()} car: retrieve tesla data failed ${error}`);
    }
};

const logCar = async influxClient => {
    const storagestatus = await storage.init();
    let token = await storage.getItem('tesla-authtoken');

    try {
        if (!token) {
            console.log(`${Date.now()} car: tesla-authtoken not set, logging in and setting token`);
            token = await loginAndSetToken();
            return retrieveAndStoreData(influxClient, token);
        }
        token = await checkTokenAndRefreshIfNeeded(token);
        return retrieveAndStoreData(influxClient, token);
    } catch (error) {
        return console.debug(`${Date.now()} car: logging car failed failure ${error}`);
    }
};

module.exports = logCar;
