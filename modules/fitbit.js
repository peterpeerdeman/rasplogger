const FitbitApiClient = require('fitbit-node');
const storage = require('node-persist');
const moment = require('moment');
const flatten = require('flat');

const fitbit1 = new FitbitApiClient({
    clientId: process.env.FITBIT_CLIENT,
    clientSecret: process.env.FITBIT_SECRET,
    apiVersion: '1',
});
const fitbit11 = new FitbitApiClient({
    clientId: process.env.FITBIT_CLIENT,
    clientSecret: process.env.FITBIT_SECRET,
    apiVersion: '1.1',
});
const fitbit12 = new FitbitApiClient({
    clientId: process.env.FITBIT_CLIENT,
    clientSecret: process.env.FITBIT_SECRET,
    apiVersion: '1.2',
});

const convertTimestampToMoment = function (date, time) {
    const [hour, minute, second] = time.split(':');
    let timestamp = moment(date);
    timestamp.hour(hour);
    timestamp.minute(minute);
    timestamp.seconds(second);
    return timestamp;
};

const writeInfluxActivities = (influxClient, summary, date) => {
    if (!summary) {
        throw new Error('summary was not defined');
    }
    const { distances, heartRateZones, ...simplefields } = summary;
    let distanceFields = {};
    for (const distance of distances) {
        const key = `distance_${distance.activity}`;
        distanceFields[key] = distance.distance;
    }
    let heartRateZonesFields = {};
    for (const heartRateZone of heartRateZones) {
        const key = `heartratezones_${heartRateZone.name.replace(/ /g, '_')}`;
        heartRateZonesFields[key] = heartRateZone.minutes;
    }
    const fields = {
        ...simplefields,
        ...distanceFields,
        ...heartRateZonesFields,
    };
    const timestamp = moment(date);
    influxClient
        .write('activities')
        .field(fields)
        .time(timestamp.format('x') * 1000000)
        .queue();
};

const writeInfluxProfile = (influxClient, user) => {
    if (!user) {
        throw new Error('user was not defined');
    }
    const fields = {
        height: user.height,
        weight: user.weight,
        age: user.age,
        averageDailySteps: user.averageDailySteps,
        strideLengthRunning: user.strideLengthRunning,
        strideLengthWalking: user.strideLengthWalking,
    };

    influxClient
        .write('user')
        .tag('encodedId', user.encodedId)
        .tag('fullName', user.fullName)
        .field(fields)
        .queue();
};

const writeInfluxSleep = (influxClient, sleep) => {
    if (!sleep.sleep) {
        throw new Error('sleepdata was not defined');
    }
    // sleeps
    for (sleepItem of sleep.sleep) {
        const {
            duration,
            efficiency,
            minutesAFterWakeup,
            minutesAsleep,
            minutesAwake,
            minutesToFallAsleep,
            timeInBed,
        } = sleepItem;

        const fields = {
            duration,
            efficiency,
            minutesAFterWakeup,
            minutesAsleep,
            minutesAwake,
            minutesToFallAsleep,
            timeInBed,
        };

        influxClient
            .write('sleep')
            .time(moment(sleepItem.startTime).format('x') * 1000000)
            .field(fields)
            .queue();
    }

    //summary
    const currentDate = new moment(moment().format('YYYY-MM-DD'));
    influxClient
        .write('sleepsummaries')
        .time(currentDate.format('x') * 1000000)
        .field(flatten(sleep.summary))
        .queue();
};

const writeInfluxHeartrate = (influxClient, heartrate) => {
    if (!heartrate['activities-heart']) return;
    if (!heartrate['activities-heart-intraday']) return;

    //zones
    for (zone of heartrate['activities-heart'][0].value.heartRateZones) {
        const { name, ...zoneValues } = zone;
        influxClient
            .write('heartratezones')
            .tag('zone', name)
            .field(zoneValues)
            .queue();
    }

    //heartrates
    for (rate of heartrate['activities-heart-intraday'].dataset) {
        const timestamp = convertTimestampToMoment(new Date(), rate.time);
        influxClient
            .write('heartrate')
            .time(timestamp.format('x') * 1000000)
            .field({
                value: rate.value,
            })
            .queue();
    }
};

const writeInflux = (
    influxClient,
    profile,
    heartrate,
    sleep,
    activities,
    date
) => {
    writeInfluxActivities(influxClient, activities[0].summary, date);
    writeInfluxProfile(influxClient, profile[0].user);
    writeInfluxHeartrate(influxClient, heartrate[0]);
    writeInfluxSleep(influxClient, sleep[0]);

    influxClient
        .syncWrite()
        .then(() =>
            console.debug(`${Date.now()} fitbit: influx write point success`)
        )
        .catch((error) =>
            console.debug(`${Date.now()} fitbit: write failed ${error}`)
        );
};

const printCallbackUrl = () => {
    const scopes = 'activity heartrate nutrition profile sleep weight';
    const callback = fitbit1.getAuthorizeUrl(scopes, 'http://localhost:8553');
    console.log(callback);
};

const translateCode = (code) => {
    return fitbit1
        .getAccessToken(code, 'http://localhost:8553')
        .then((result) => {
            return result;
        });
};

const checkTokenAndRefreshIfNeeded = async (tokens) => {
    const result = await fitbit11.post(
        '/oauth2/introspect',
        tokens.access_token,
        { token: tokens.access_token },
        false
    );
    if (result[0] && !result[0].active) {
        console.log(`${Date.now()} fitbit: refreshing access token`);
        const refreshedToken = await fitbit1.refreshAccessToken(
            tokens.access_token,
            tokens.refresh_token
        );
        await storage.setItem('fitbit-tokens', refreshedToken);
        return false;
    } else {
        return true;
    }
};

const logFitbit = async (influxClient) => {
    const storagestatus = await storage.init();
    const tokens = await storage.getItem('fitbit-tokens');

    if (!tokens) {
        console.log(
            `${Date.now()} fitbit: access_tokens not set, not writing data`
        );
        return;
        // printCallbackUrl();
        // translateCode('cb66d319df23d67d6041532c0811ad8cf016e4ff').then(function(result) {
        //     storage.setItem('fitbit-tokens', result);
        // });
        // return;
    }

    try {
        await checkTokenAndRefreshIfNeeded(tokens);
    } catch (error) {
        return console.debug(
            `${Date.now()} fitbit: retrieve accesstoken failed ${error}`
        );
    }

    try {
        const date = moment().format('YYYY-MM-DD');
        const promises = [
            fitbit1.get('/profile.json', tokens.access_token),
            fitbit1.get(
                '/activities/heart/date/today/1d/1min.json',
                tokens.access_token
            ),
            fitbit12.get(`/sleep/date/${date}.json`, tokens.access_token),
            fitbit1.get(`/activities/date/${date}.json`, tokens.access_token),
        ];
        return Promise.all(promises).then((results) => {
            return writeInflux(influxClient, ...results, date);
        });
    } catch (error) {
        return console.debug(
            `${Date.now()} fitbit: retrieve fitbit data failed ${error}`
        );
    }
};

module.exports = logFitbit;
