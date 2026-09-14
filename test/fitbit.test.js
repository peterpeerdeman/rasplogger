const expect = require('chai').expect;
const sinon = require('sinon');
const nock = require('nock');
const moment = require('moment');
const storage = require('node-persist');

process.env.FITBIT_CLIENT = 'client123';
process.env.FITBIT_SECRET = 'secret123';

const logFitbit = require('../modules/fitbit.js');
const { formatError, backfillRange } = logFitbit;

// IMPORTANT: node-persist's top-level `init()` creates a brand new storage
// instance on *every* call - even with no arguments, which is how
// modules/fitbit.js calls it internally - discarding any directory set by a
// previous init({dir}) call and falling back to the real default directory.
// Pointing init() at a temp dir once is therefore NOT enough isolation: the
// very first no-arg storage.init() inside logFitbit()/backfillRange() would
// silently reset storage back to this repo's real .node-persist/storage,
// and a later storage.clear() would then wipe real tokens (this happened
// once while writing these tests). Stub the methods directly instead, with
// an in-memory backing store, so no real init() call - real dir or not -
// is ever reachable.
function stubStorage() {
    // Plain assignment rather than sinon.stub(storage, 'x') - those methods
    // only exist on the singleton after a real init() has run once (they're
    // mixed in from the internal LocalStorage instance), which is exactly
    // what must never happen here.
    const data = new Map();
    storage.init = async () => {};
    storage.getItem = async (key) => data.get(key);
    storage.setItem = async (key, value) => {
        data.set(key, value);
    };
    storage.removeItem = async (key) => {
        data.delete(key);
    };
    return data;
}

const mockProfile = { user: { fullName: 'Test User', encodedId: 'ABC123', height: 187, weight: 88 } };
const mockHeart = (minutes) => ({
    'activities-heart': [{ value: { heartRateZones: [{ name: 'Fat Burn', minutes: 30 }] } }],
    'activities-heart-intraday': {
        dataset: minutes.map(([time, value]) => ({ time, value })),
    },
});
const mockSleep = {
    sleep: [
        {
            startTime: '2026-01-01T23:00:00.000',
            duration: 28800000,
            efficiency: 90,
            minutesAsleep: 400,
            minutesAwake: 20,
            minutesToFallAsleep: 5,
            timeInBed: 450,
        },
    ],
    summary: { totalMinutesAsleep: 400, totalTimeInBed: 450 },
};
const mockActivities = {
    summary: {
        steps: 8000,
        caloriesOut: 2000,
        distances: [{ activity: 'total', distance: 5 }],
        heartRateZones: [{ name: 'Fat Burn', minutes: 30 }],
    },
};

// Sinon stub for influxdb-nodejs's fluent write().tag().field().time().queue()
// chain that records every write instead of asserting a specific call order
// (different write* functions in fitbit.js chain these in different orders).
function createInfluxStub() {
    const writes = [];
    const write = sinon.stub().callsFake((measurement) => {
        const record = { measurement, tags: {}, fields: {}, time: null };
        const chain = {
            tag: sinon.stub().callsFake((k, v) => {
                record.tags[k] = v;
                return chain;
            }),
            field: sinon.stub().callsFake((f) => {
                record.fields = f;
                return chain;
            }),
            time: sinon.stub().callsFake((t) => {
                record.time = t;
                return chain;
            }),
            queue: sinon.stub().callsFake(() => {
                writes.push(record);
                return chain;
            }),
        };
        return chain;
    });
    return {
        write,
        syncWrite: sinon.stub().resolves(),
        writes,
        byMeasurement(name) {
            return writes.filter((w) => w.measurement === name);
        },
    };
}

describe('fitbit tests', () => {
    beforeEach(() => {
        stubStorage();
        nock.disableNetConnect();
    });

    afterEach(() => {
        nock.cleanAll();
        nock.enableNetConnect();
        sinon.restore();
    });

    it('Should be a function', () => {
        expect(typeof logFitbit).to.equal('function');
    });

    describe('formatError', () => {
        it('formats Error instances using their message/stack', () => {
            expect(formatError(new Error('boom'))).to.include('boom');
        });

        it('formats plain-object rejections as JSON instead of [object Object]', () => {
            const formatted = formatError({ statusCode: 401, error: 'invalid_grant' });
            expect(formatted).to.not.include('[object Object]');
            expect(formatted).to.include('invalid_grant');
        });
    });

    describe('logFitbit', () => {
        it('does nothing when no tokens are stored', async () => {
            const influx = createInfluxStub();
            await logFitbit(influx);
            expect(influx.writes).to.be.empty;
        });

        it('fetches today\'s data and writes all measurements when the token is valid', async () => {
            await storage.setItem('fitbit-tokens', { access_token: 'AT', refresh_token: 'RT' });
            const today = moment().format('YYYY-MM-DD');

            nock('https://api.fitbit.com', { reqheaders: { authorization: 'Bearer AT' } })
                .post('/1.1/oauth2/introspect', 'token=AT')
                .reply(200, { active: true })
                .get('/1/user/-/profile.json')
                .reply(200, mockProfile)
                .get('/1/user/-/activities/heart/date/today/1d/1min.json')
                .reply(200, mockHeart([['00:01:00', 60]]))
                .get(`/1.2/user/-/sleep/date/${today}.json`)
                .reply(200, mockSleep)
                .get(`/1/user/-/activities/date/${today}.json`)
                .reply(200, mockActivities);

            const influx = createInfluxStub();
            await logFitbit(influx);

            expect(influx.byMeasurement('user')).to.have.lengthOf(1);
            expect(influx.byMeasurement('activities')).to.have.lengthOf(1);
            expect(influx.byMeasurement('activities')[0].fields.steps).to.equal(8000);
            expect(influx.byMeasurement('heartrate')).to.have.lengthOf(1);
            expect(influx.byMeasurement('heartratezones')).to.have.lengthOf(1);
            expect(influx.byMeasurement('sleep')).to.have.lengthOf(1);
            expect(influx.byMeasurement('sleepsummaries')).to.have.lengthOf(1);
        });

        it('regression: uses the refreshed token for the same run\'s API calls, not the stale one', async () => {
            // Before this was fixed, checkTokenAndRefreshIfNeeded's result was
            // discarded and the original (now-invalid) access token kept being
            // used, causing every call to silently 401 once a token went stale.
            await storage.setItem('fitbit-tokens', { access_token: 'staleAT', refresh_token: 'RT' });
            const today = moment().format('YYYY-MM-DD');

            nock('https://api.fitbit.com')
                .post('/1.1/oauth2/introspect', 'token=staleAT')
                .reply(200, { active: false })
                .post('/oauth2/token', 'grant_type=refresh_token&refresh_token=RT')
                .reply(200, { access_token: 'freshAT', refresh_token: 'newRT', expires_in: 28800 });

            const freshCalls = nock('https://api.fitbit.com', {
                reqheaders: { authorization: 'Bearer freshAT' },
            })
                .get('/1/user/-/profile.json')
                .reply(200, mockProfile)
                .get('/1/user/-/activities/heart/date/today/1d/1min.json')
                .reply(200, mockHeart([]))
                .get(`/1.2/user/-/sleep/date/${today}.json`)
                .reply(200, mockSleep)
                .get(`/1/user/-/activities/date/${today}.json`)
                .reply(200, mockActivities);

            const influx = createInfluxStub();
            await logFitbit(influx);

            expect(freshCalls.isDone()).to.be.true;
            const stored = await storage.getItem('fitbit-tokens');
            expect(stored.access_token).to.equal('freshAT');
        });
    });

    describe('backfillRange', () => {
        it('regression: timestamps historical data on the requested date, not today', async () => {
            await storage.setItem('fitbit-tokens', { access_token: 'AT', refresh_token: 'RT' });
            const historicalDate = '2025-11-10';

            nock('https://api.fitbit.com')
                .post('/1.1/oauth2/introspect', 'token=AT')
                .reply(200, { active: true })
                .get(`/1/user/-/activities/heart/date/${historicalDate}/1d/1min.json`)
                .reply(200, mockHeart([['00:01:00', 60]]))
                .get(`/1.2/user/-/sleep/date/${historicalDate}.json`)
                .reply(200, mockSleep)
                .get(`/1/user/-/activities/date/${historicalDate}.json`)
                .reply(200, mockActivities);

            const influx = createInfluxStub();
            await backfillRange(influx, historicalDate, historicalDate, 1);

            const heartratePoint = influx.byMeasurement('heartrate')[0];
            const writtenDate = moment(heartratePoint.time / 1e6).format('YYYY-MM-DD');
            expect(writtenDate).to.equal(historicalDate);
            expect(writtenDate).to.not.equal(moment().format('YYYY-MM-DD'));

            const activitiesPoint = influx.byMeasurement('activities')[0];
            expect(moment(activitiesPoint.time / 1e6).format('YYYY-MM-DD')).to.equal(historicalDate);
        });

        it('checkpoints progress and resumes from the failed date on rerun', async () => {
            await storage.setItem('fitbit-tokens', { access_token: 'AT', refresh_token: 'RT' });
            const day1 = '2025-11-10';
            const day2 = '2025-11-11';

            nock('https://api.fitbit.com')
                .post('/1.1/oauth2/introspect', 'token=AT')
                .reply(200, { active: true })
                .get(`/1/user/-/activities/heart/date/${day1}/1d/1min.json`)
                .reply(200, mockHeart([]))
                .get(`/1.2/user/-/sleep/date/${day1}.json`)
                .reply(200, mockSleep)
                .get(`/1/user/-/activities/date/${day1}.json`)
                .reply(200, mockActivities)
                // day2 fails every attempt (3x) so backfillRange throws
                .get(`/1/user/-/activities/heart/date/${day2}/1d/1min.json`)
                .times(3)
                .reply(500, { error: 'boom' });

            const influx = createInfluxStub();
            let thrown;
            try {
                await backfillRange(influx, day1, day2, 1);
            } catch (error) {
                thrown = error;
            }
            expect(thrown).to.exist;
            expect(thrown.message).to.include(day2);

            const checkpoint = await storage.getItem(`fitbit-backfill-progress:${day1}:${day2}`);
            expect(checkpoint).to.equal(day1);

            // Rerun with day2 now succeeding. Resume starts AT the checkpointed
            // date (the last *successful* day) and redoes it - harmless since
            // writes are idempotent per timestamp - before moving past it, so
            // day1 needs mocking again too.
            nock('https://api.fitbit.com')
                .post('/1.1/oauth2/introspect', 'token=AT')
                .reply(200, { active: true })
                .get(`/1/user/-/activities/heart/date/${day1}/1d/1min.json`)
                .reply(200, mockHeart([]))
                .get(`/1.2/user/-/sleep/date/${day1}.json`)
                .reply(200, mockSleep)
                .get(`/1/user/-/activities/date/${day1}.json`)
                .reply(200, mockActivities)
                .get(`/1/user/-/activities/heart/date/${day2}/1d/1min.json`)
                .reply(200, mockHeart([]))
                .get(`/1.2/user/-/sleep/date/${day2}.json`)
                .reply(200, mockSleep)
                .get(`/1/user/-/activities/date/${day2}.json`)
                .reply(200, mockActivities);

            await backfillRange(influx, day1, day2, 1);

            // day1 (first run) + day1 again + day2 (resumed run) = 3.
            const activitiesWrites = influx.byMeasurement('activities');
            expect(activitiesWrites).to.have.lengthOf(3);

            const finalCheckpoint = await storage.getItem(`fitbit-backfill-progress:${day1}:${day2}`);
            expect(finalCheckpoint).to.be.undefined;
        });

        it('regression: tags a 429 response as rate-limited instead of misreading it as missing data', async () => {
            await storage.setItem('fitbit-tokens', { access_token: 'AT', refresh_token: 'RT' });
            const date = '2025-11-12';

            nock('https://api.fitbit.com')
                .post('/1.1/oauth2/introspect', 'token=AT')
                .reply(200, { active: true })
                .get(`/1/user/-/activities/heart/date/${date}/1d/1min.json`)
                .times(3)
                .reply(429, { errors: [{ errorType: 'rate_limit_exceeded' }] });

            const influx = createInfluxStub();

            // Intercept setTimeout to record the requested delay (to confirm
            // a 65-minute rate-limit backoff was chosen, not the short
            // per-attempt one) while still firing almost immediately, so real
            // I/O (nock/axios) keeps working normally. A full sinon fake
            // clock was tried here first and reliably stalled nock's
            // response delivery, which depends on real setImmediate/nextTick
            // scheduling internally.
            const delays = [];
            const realSetTimeout = global.setTimeout;
            const setTimeoutStub = sinon
                .stub(global, 'setTimeout')
                .callsFake((fn, delay, ...args) => {
                    delays.push(delay);
                    return realSetTimeout(fn, Math.min(delay, 5), ...args);
                });

            let result;
            try {
                result = await backfillRange(influx, date, date, 1).catch((e) => e);
            } finally {
                setTimeoutStub.restore();
            }

            expect(result).to.be.instanceOf(Error);
            // Before this fix, a 429 body (no `summary` field) reached
            // writeInfluxActivities and threw the unrelated, confusing
            // "summary was not defined" - this asserts we see the real cause.
            expect(result.message).to.include('rate limit');
            // Other setTimeout calls happen too (axios/nock internals) - only
            // assert on our own rate-limit backoff, chosen twice (attempts
            // 1->2 and 2->3) before the 3rd attempt gives up.
            const rateLimitBackoffs = delays.filter((d) => d === 65 * 60 * 1000);
            expect(rateLimitBackoffs).to.have.lengthOf(2);
        });
    });
});
