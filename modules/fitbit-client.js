const axios = require('axios');

// Minimal Fitbit Web API OAuth2 client, replacing the unmaintained
// fitbit-node package (last published ~2019, pulling in an old
// request/simple-oauth2 dependency tree responsible for most of this
// project's npm audit findings). Only implements what modules/fitbit.js
// actually uses: getAuthorizeUrl, getAccessToken, refreshAccessToken,
// get and post - mirroring fitbit-node's method signatures and its
// [body, response] resolution shape (including on non-2xx responses,
// which callers rely on to detect rate limiting) so it's a drop-in swap.
module.exports = class FitbitApiClient {
    constructor({ clientId, clientSecret, apiVersion = '1.2' }) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.apiVersion = apiVersion;
    }

    getUrl(path, userId) {
        const userSubPath = userId === false ? '' : `/user/${userId || '-'}`;
        return `https://api.fitbit.com/${this.apiVersion}${userSubPath}${path}`;
    }

    basicAuthHeader() {
        const credentials = `${this.clientId}:${this.clientSecret}`;
        return `Basic ${Buffer.from(credentials).toString('base64')}`;
    }

    getAuthorizeUrl(scope, redirectUrl) {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            scope,
            redirect_uri: redirectUrl,
        });
        return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
    }

    async getAccessToken(code, redirectUrl) {
        const response = await axios.post(
            'https://api.fitbit.com/oauth2/token',
            new URLSearchParams({
                client_id: this.clientId,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUrl,
            }).toString(),
            {
                headers: {
                    Authorization: this.basicAuthHeader(),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        return response.data;
    }

    async refreshAccessToken(accessToken, refreshToken) {
        const response = await axios.post(
            'https://api.fitbit.com/oauth2/token',
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }).toString(),
            {
                headers: {
                    Authorization: this.basicAuthHeader(),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        return response.data;
    }

    async get(path, accessToken, userId) {
        return this.request('get', path, accessToken, userId);
    }

    async post(path, accessToken, data, userId) {
        return this.request('post', path, accessToken, userId, data);
    }

    async request(method, path, accessToken, userId, data) {
        const response = await axios.request({
            method,
            url: this.getUrl(path, userId),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(data && { 'Content-Type': 'application/x-www-form-urlencoded' }),
            },
            data: data ? new URLSearchParams(data).toString() : undefined,
            // fitbit-node resolved [body, response] regardless of status
            // (callers inspect response.statusCode themselves), so don't
            // let axios throw on non-2xx.
            validateStatus: () => true,
        });
        return [response.data, { ...response, statusCode: response.status }];
    }
};
