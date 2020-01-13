const FitbitApiClient = require("fitbit-node");

const fitbit1 = new FitbitApiClient({
    clientId: process.env.FITBIT_CLIENT, 
    clientSecret: process.env.FITBIT_SECRET, 
    apiVersion: "1"
});
const fitbit12 = new FitbitApiClient({
    clientId: process.env.FITBIT_CLIENT, 
    clientSecret: process.env.FITBIT_SECRET, 
    apiVersion: "1.2"
});

const writeInfluxProfile = (influxClient, user) => {
    const fields = {
        height: user.height,
        weight: user.weight,
        age: user.age,
        averageDailySteps: user.averageDailySteps,
        strideLengthRunning: user.strideLengthRunning,
        strideLengthWalking: user.strideLengthWalking,
    };
    influxClient.write('user')
    .tag('encodedId', user.encodedId)
    .tag('fullName', user.fullName)
    .field(fields)
    .queue();
};

const writeInfluxHeartrate = (influxClient, heartrate) => {
    if(!heartrate['activities-heart']) return;
    if(!heartrate['activities-heart-intraday']) return;

    //zones
    for(zone in heartrate['activities-heart'][0].heartRateZones) {
        const {zoneName, ...zonevalues} = zone;

        console.log(zoneName, zoneValues);

        influxClient.write('heartratezones')
        .tag('zone', zoneName)
        .field(zoneValues)
        .queue();
    }
    return;

    //heartrates
    for(rate in heartrate['activities-heart-intraday'].dataset) {
        influxClient.write('heartrate')
        .field({
            value: rate.value
        })
        .queue();
    }

};

const writeInflux = (influxClient, profile, heartrate, overview, nas) => {
    writeInfluxProfile(influxClient, profile[0].user);
    writeInfluxHeartrate(influxClient, heartrate);
    // writeInfluxSleep(influxClient, steps);
    //
    influxClient.syncWrite()
    .then(() => console.debug(`${Date.now()} fitbit: influx write point success`))
    .catch((error) => console.debug(`${Date.now()} fitbit: write failed ${error}`));
};

const printCallbackUrl = () => {
    const scopes = 'activity heartrate nutrition profile sleep weight';
    const callback = fitbit1.getAuthorizeUrl(scopes, 'http://localhost:8553');
    console.log(callback);
};

const translateCode = () => {
    fitbit1.getAccessToken('66137492dc9983de64169fa61b28c2d8c056817e', 'http://localhost:8553').then(result => {
        console.log(result);
    });
};

const logFitbit = async influxClient => {
    // printCallbackUrl();
    // translateCode();
    
    //TODO: get proper sleep date
    fitbit12.get('/sleep/date/[date].json', process.env.FITBIT_TOKEN).then(results => {
        console.log(results[0]['activities-heart']);
    }).catch(err => {
        console.log(err);
    });

    //TODO remove debugging
    return;
    
    const promises = [
        fitbit1.get('/profile.json', process.env.FITBIT_TOKEN),
        fitbit1.get('/activities/heart/date/today/1d/1min.json', process.env.FITBIT_TOKEN),
    ];
    return Promise.all(promises)
    .then((results) => {
        return writeInflux(influxClient, ...results);
    });
};

exports.logFitbit = logFitbit;
