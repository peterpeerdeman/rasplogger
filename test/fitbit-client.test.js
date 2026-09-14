const expect = require('chai').expect;
const nock = require('nock');

const FitbitApiClient = require('../modules/fitbit-client.js');

describe('fitbit-client tests', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    it('builds an authorize URL with client id, scope and redirect uri', () => {
        const client = new FitbitApiClient({
            clientId: 'client123',
            clientSecret: 'secret123',
        });
        const url = client.getAuthorizeUrl('activity heartrate', 'http://localhost:8553');
        expect(url).to.equal(
            'https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=client123&scope=activity+heartrate&redirect_uri=http%3A%2F%2Flocalhost%3A8553'
        );
    });

    it('exchanges an auth code for tokens using basic auth', async () => {
        const client = new FitbitApiClient({
            clientId: 'client123',
            clientSecret: 'secret123',
        });
        const expectedAuth = `Basic ${Buffer.from('client123:secret123').toString('base64')}`;

        const scope = nock('https://api.fitbit.com', {
            reqheaders: { authorization: expectedAuth },
        })
            .post('/oauth2/token', 'client_id=client123&grant_type=authorization_code&code=abc&redirect_uri=http%3A%2F%2Flocalhost%3A8553')
            .reply(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 28800 });

        const tokens = await client.getAccessToken('abc', 'http://localhost:8553');
        expect(tokens).to.deep.equal({ access_token: 'AT', refresh_token: 'RT', expires_in: 28800 });
        expect(scope.isDone()).to.be.true;
    });

    it('refreshes an access token using the refresh_token grant', async () => {
        const client = new FitbitApiClient({
            clientId: 'client123',
            clientSecret: 'secret123',
        });

        const scope = nock('https://api.fitbit.com')
            .post('/oauth2/token', 'grant_type=refresh_token&refresh_token=oldRT')
            .reply(200, { access_token: 'newAT', refresh_token: 'newRT', expires_in: 28800 });

        const tokens = await client.refreshAccessToken('oldAT', 'oldRT');
        expect(tokens.access_token).to.equal('newAT');
        expect(scope.isDone()).to.be.true;
    });

    it('GETs a user-scoped path with a bearer token and returns [body, response]', async () => {
        const client = new FitbitApiClient({
            clientId: 'client123',
            clientSecret: 'secret123',
            apiVersion: '1',
        });

        nock('https://api.fitbit.com', {
            reqheaders: { authorization: 'Bearer AT' },
        })
            .get('/1/user/-/profile.json')
            .reply(200, { user: { fullName: 'Test User' } });

        const [body, response] = await client.get('/profile.json', 'AT');
        expect(body.user.fullName).to.equal('Test User');
        expect(response.statusCode).to.equal(200);
    });

    it('resolves (does not throw) on a non-2xx response, preserving statusCode', async () => {
        const client = new FitbitApiClient({
            clientId: 'client123',
            clientSecret: 'secret123',
            apiVersion: '1',
        });

        nock('https://api.fitbit.com')
            .get('/1/user/-/activities/date/2026-01-01.json')
            .reply(429, { errors: [{ errorType: 'rate_limit_exceeded' }] });

        const [body, response] = await client.get('/activities/date/2026-01-01.json', 'AT');
        expect(response.statusCode).to.equal(429);
        expect(body.errors[0].errorType).to.equal('rate_limit_exceeded');
    });

    it('POSTs form-encoded data to a non-user-scoped path when userId is false', async () => {
        const client = new FitbitApiClient({
            clientId: 'client123',
            clientSecret: 'secret123',
            apiVersion: '1.1',
        });

        const scope = nock('https://api.fitbit.com', {
            reqheaders: { authorization: 'Bearer AT' },
        })
            .post('/1.1/oauth2/introspect', 'token=AT')
            .reply(200, { active: true });

        const [body] = await client.post('/oauth2/introspect', 'AT', { token: 'AT' }, false);
        expect(body.active).to.be.true;
        expect(scope.isDone()).to.be.true;
    });
});
