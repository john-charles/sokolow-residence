'use strict';

const request = require('request-promise-native');


class SensorFacade {
    constructor(sensor) {
        this.sensor = sensor;
    }

    get id() {
        return this.sensor.id;
    }

    get name() {
        return this.sensor.name;
    }

    get temprature() {

        const capability = this.sensor.capability.find(
            (cap) => cap.type === 'temperature');

        return capability.value / 10;
    }

}

class ThermostatFacade {
    constructor(stat) {
        this.stat = stat;
    }

    getId() {
        return this.stat.identifier;
    }

    getName() {
        return this.stat.name;
    }

    getCurrentTemp() {
        return this.stat.runtime.actualTemperature / 10;
    }

    isConnected() {
        return this.stat.runtime.connected;
    }

    getStatus() {
        return this.stat.equipmentStatus;
    }

    getClimates() {
        return this.stat.program.climates;
    }

    getProgram() {
        return this.stat.program;
    }

    getSensors() {
        const found = [];

        this.stat.remoteSensors.forEach(function (sensor) {
            found.push(new SensorFacade(sensor));
        });

        return found;
    }


}

class ThermostatListFacade {

    constructor(tstats) {
        this.tstats = tstats;
    }


    getThermostat(name) {
        const stat = this.tstats.find(function (stat) {
            return stat.name === name;
        });

        if (stat) {
            return new ThermostatFacade(stat);
        }

        return null;
    }

    forEach(iter) {
        this.tstats.forEach((stat) => iter(new ThermostatFacade(stat)));
    }

}

module.exports = class Ecobee {

    constructor(tokenSource) {
        this.tokenSource = tokenSource;
    }

    async getFreshTokens() {
        let tokens = await this.tokenSource.getAuthTokens();

        if (!tokens.isExpired()) {
            console.log("Ecobee bearer token is expired, refreshing!");
            tokens = await this.tokenSource.updateTokens(tokens);
        } else {
            console.log("Ecobee bearer is valid");
        }

        return tokens;
    }

    async getThermostats() {
        const tokens = await this.getFreshTokens();
        console.time('Ecobee:getThermostats');
        const respBody = await request({
            url: "https://api.ecobee.com/1/thermostat",
            qs: {
                json: JSON.stringify({
                    selection: {
                        selectionMatch: "",
                        selectionType: "registered",
                        includeAlerts: true,
                        includeEvents: true,
                        includeSettings: true,
                        includeProgram: true,
                        includeRuntime: true,
                        includeSensors: true,
                        includeEquipmentStatus: true
                    }
                })
            },
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        console.timeEnd('Ecobee:getThermostats');
        const tstats = JSON.parse(respBody);
        return new ThermostatListFacade(tstats.thermostatList);
    }

    async putThermostats(updateRequest) {
        const tokens = await this.getFreshTokens();
        console.time('Ecobee:putThermostats');
        await request({
            method: "POST",
            url: "https://api.ecobee.com/1/thermostat",
            qs: {
                format: "json"
            },
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${tokens.access_token}`
            },
            body: JSON.stringify(updateRequest)
        });
        console.timeEnd('Ecobee:putThermostats');


    }

};
