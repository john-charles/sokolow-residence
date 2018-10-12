#!/usr/bin/env bash

const request = require('request-promise-native');
const tokenEndpoint = "https://api.ecobee.com/token";

module.exports = class TokenSource {

    constructor(s3) {
        this.s3 = s3;
        this.authTokens = null;
    }

    async getApiKey() {
        const resp = await this.s3.getObject("ecobee-update-bucket", "api-key.txt");
        return resp.Body.toString("utf-8");
    }


    async getAuthTokens() {

        if (!this.authTokens) {

            const resp = await this.s3.getObject("ecobee-update-bucket", "auth-tokens.json");
            this.authTokens = JSON.parse(resp.Body.toString("utf-8"));

            this.authTokens.isExpired = function () {
                if (!this.expireTime) {
                    return true;
                } else {
                    return (new Date().getTime() / 1000) < this.expireTime;
                }
            };

        }

        return this.authTokens;
    }

    async putAuthTokens(authTokens) {
        this.authTokens = authTokens;
        return this.s3.putObject("ecobee-update-bucket", "auth-tokens.json", JSON.stringify(authTokens));
    }

    async updateTokens(authTokens) {

        const apiKey = await this.getApiKey();
        const refreshToken = authTokens.refresh_token;
        const query = `grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${apiKey}`;
        const resp = await request(`${tokenEndpoint}?${query}`, {method: 'POST'});

        authTokens = JSON.parse(resp);
        authTokens.expireTime = (new Date().getTime() / 1000) + authTokens.expires_in;

        await this.putAuthTokens(authTokens);
        return authTokens;

    }

};