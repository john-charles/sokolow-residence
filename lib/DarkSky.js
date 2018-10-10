"use strict";

const request = require('request-promise-native');

module.exports = class DarkSky {

    constructor(s3){
        this.s3 = s3;
    }


    async getForecast(){
        const apiKeyResponse = await this.s3.getObject("ecobee-update-bucket", "darksky-api-key.txt");
        const apiKey = apiKeyResponse.Body.toString("utf-8").trim();

        const darkSkyResponse = await request(`https://api.darksky.net/forecast/${apiKey}/41.6996,-87.6629`);
        return JSON.parse(darkSkyResponse);
    }


};