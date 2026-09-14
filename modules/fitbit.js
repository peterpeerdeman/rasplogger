const FitbitApiClient = require('./fitbit-client');
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

// Some rejected promises in this codebase's dependencies (simple-oauth2 in
// particular) reject with plain objects rather than Error instances, which
// stringify as unhelpful "[object Object]" in template literals.
const formatError = (error) => {
    if (error instanceof Error) return error.stack || error.message;
    try {
        return JSON.stringify(error);
    } catch (_) {
        return String(error);
    }
};

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

const writeInfluxSleep = (influxClient, sleep, date) => {
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
    influxClient
        .write('sleepsummaries')
        .time(moment(date).format('x') * 1000000)
        .field(flatten(sleep.summary))
        .queue();
};

const writeInfluxHeartrate = (influxClient, heartrate, date) => {
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
        const timestamp = convertTimestampToMoment(date, rate.time);
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
    writeInfluxHeartrate(influxClient, heartrate[0], date);
    writeInfluxSleep(influxClient, sleep[0], date);

    return influxClient
        .syncWrite()
        .then(() =>
            console.debug(`${Date.now()} fitbit: influx write point success`)
        )
        .catch((error) =>
            console.debug(`${Date.now()} fitbit: write failed ${formatError(error)}`)
        );
};

const getAuthorizeUrl = () => {
    const scopes = 'activity heartrate nutrition profile sleep weight';
    return fitbit1.getAuthorizeUrl(scopes, 'http://localhost:8553');
};

const storeAuthCode = async (code) => {
    const tokens = await fitbit1.getAccessToken(code, 'http://localhost:8553');
    await storage.init();
    await storage.setItem('fitbit-tokens', tokens);
    return tokens;
};

// Returns the tokens that should actually be used for the next API calls:
// the refreshed ones if the access token had gone stale, otherwise the ones passed in.
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
        return refreshedToken;
    } else {
        return tokens;
    }
};

const logFitbit = async (influxClient) => {
    const storagestatus = await storage.init();
    let tokens = await storage.getItem('fitbit-tokens');

    if (!tokens) {
        console.log(
            `${Date.now()} fitbit: access_tokens not set, not writing data`
        );
        return;
    }

    try {
        tokens = await checkTokenAndRefreshIfNeeded(tokens);
    } catch (error) {
        return console.debug(
            `${Date.now()} fitbit: retrieve accesstoken failed ${formatError(error)}`
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
            `${Date.now()} fitbit: retrieve fitbit data failed ${formatError(error)}`
        );
    }
};

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Shared across every paced Fitbit call in this process so concurrent
// requests can't slip past the pacing (Fitbit allows ~150 requests/hour).
let lastRequestAt = 0;
const paceRequest = async (delayMs) => {
    const wait = lastRequestAt + delayMs - Date.now();
    if (wait > 0) await sleepMs(wait);
    lastRequestAt = Date.now();
};

// Performs one rate-limit-paced GET, throwing a descriptive error (tagged
// rateLimited: true on a 429) instead of silently returning a Fitbit error
// body that downstream code would misinterpret as valid data.
const pacedGet = async (client, path, accessToken, delayMs) => {
    await paceRequest(delayMs);
    const [body, response] = await client.get(path, accessToken);
    const statusCode = response && response.statusCode;
    if (statusCode === 429) {
        const error = new Error(`Fitbit rate limit hit on ${path}`);
        error.rateLimited = true;
        throw error;
    }
    if (statusCode && statusCode >= 400) {
        throw new Error(
            `Fitbit API error ${statusCode} on ${path}: ${JSON.stringify(body)}`
        );
    }
    return body;
};

// Fetches and writes a single historical day. Does not touch the profile
// measurement, since that only reflects the account's current state, not
// the historical day being backfilled. Requests are made sequentially
// (not concurrently) so pacing is accurate per-request, not per-day.
const backfillDay = async (influxClient, tokens, date, delayMs) => {
    const heart = await pacedGet(
        fitbit1,
        `/activities/heart/date/${date}/1d/1min.json`,
        tokens.access_token,
        delayMs
    );
    const sleep = await pacedGet(
        fitbit12,
        `/sleep/date/${date}.json`,
        tokens.access_token,
        delayMs
    );
    const activities = await pacedGet(
        fitbit1,
        `/activities/date/${date}.json`,
        tokens.access_token,
        delayMs
    );
    writeInfluxActivities(influxClient, activities.summary, date);
    writeInfluxHeartrate(influxClient, heart, date);
    writeInfluxSleep(influxClient, sleep, date);
    await influxClient.syncWrite();
};

// Backfills [startDate, endDate] (both YYYY-MM-DD, inclusive) sequentially,
// pacing requests to stay under Fitbit's ~150 requests/hour limit and
// checkpointing progress so an interrupted run can be resumed by rerunning
// with the same start/end.
const backfillRange = async (
    influxClient,
    startDate,
    endDate,
    delayMs = 25000
) => {
    await storage.init();
    let tokens = await storage.getItem('fitbit-tokens');
    if (!tokens) {
        throw new Error('fitbit-tokens not set, run the authorize flow first');
    }

    const checkpointKey = `fitbit-backfill-progress:${startDate}:${endDate}`;
    const resumeFrom = await storage.getItem(checkpointKey);
    let cursor = moment(resumeFrom || startDate);
    const end = moment(endDate);

    if (resumeFrom) {
        console.log(
            `${Date.now()} fitbit: resuming backfill at ${cursor.format('YYYY-MM-DD')}`
        );
    }

    let daysSinceTokenCheck = 0;
    while (cursor.isSameOrBefore(end, 'day')) {
        const date = cursor.format('YYYY-MM-DD');

        if (daysSinceTokenCheck === 0) {
            await paceRequest(delayMs);
            tokens = await checkTokenAndRefreshIfNeeded(tokens);
        }

        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await backfillDay(influxClient, tokens, date, delayMs);
                console.log(`${Date.now()} fitbit: backfilled ${date}`);
                break;
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw new Error(
                        `backfill failed on ${date} after ${maxAttempts} attempts: ${formatError(error)}. ` +
                            `Rerun with the same start/end to resume from this date.`
                    );
                }
                const backoff = error.rateLimited
                    ? 65 * 60 * 1000
                    : delayMs * attempt;
                console.log(
                    `${Date.now()} fitbit: ${date} attempt ${attempt} failed (${formatError(error)}), retrying in ${backoff}ms...`
                );
                await sleepMs(backoff);
            }
        }

        await storage.setItem(checkpointKey, date);
        daysSinceTokenCheck = (daysSinceTokenCheck + 1) % 10; // recheck token roughly every 10 days
        cursor.add(1, 'day');
    }

    await storage.removeItem(checkpointKey);
    console.log(`${Date.now()} fitbit: backfill ${startDate}..${endDate} complete`);
};

module.exports = logFitbit;
module.exports.getAuthorizeUrl = getAuthorizeUrl;
module.exports.storeAuthCode = storeAuthCode;
module.exports.backfillRange = backfillRange;
module.exports.formatError = formatError;
