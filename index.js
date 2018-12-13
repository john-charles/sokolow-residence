"use strict";

const SR = require("./lib");
const _ = require('lodash');

const HEAT_OFF = 60;
const COOL_OFF = 80;

const settings = [
    {
        name: "Any Day",
        sensors: warmestNSensors(2),
        awaySensors: warmestSensor,
        threshold: (currentTemp) => true
    }
];


function allSensors(sensors) {
    return sensors;
}

function withoutColdestSensor(sensors) {
    const minSensor = _.minBy(sensors, (sensor) => sensor.temprature);
    return _.reject(sensors, (sensor) => sensor.id === minSensor.id);
}

function warmestSensor(sensors) {
    return [_.maxBy(sensors, (sensor) => sensor.temprature)];
}

function warmestNSensors(count) {
    return function warmestNSensors(sensors) {

        const sorted = _.sortBy(sensors, (sensor) => sensor.temprature);
        return sorted.reverse().slice(0, count);

    }
}

function coldestSensor(sensors) {
    return [_.minBy(sensors, (sensor) => sensor.temprature)];
}

// this worked, but needs more finesse.
// function tenMinuteHighLowSensor(cph) {
//     return (sensors) => {
//
//         const minuteCode = Math.floor(new Date().getMinutes() / 10);
//         const maxSensor = _.maxBy(sensors, (sensor) => sensor.temprature);
//         const minSensor = _.minBy(sensors, (sensor) => sensor.temprature);
//
//         if (maxSensor.temprature > 72) {
//             return [maxSensor];
//         }
//
//         if (minuteCode % cph === 0) {
//             return sensors;
//         } else {
//             return [maxSensor];
//         }
//
//     }
// }

async function updateEcobee() {

    const s3 = new SR.S3();
    const darkSky = new SR.DarkSky(s3);
    const tokenSource = new SR.TokenSource(s3);
    const ecobee = new SR.Ecobee(tokenSource);

    console.time('get forecast + thermostats');
    const forecastPromise = darkSky.getForecast();
    const thermostatsPromise = ecobee.getThermostats();

    const forecast = await forecastPromise;
    const thermostats = await thermostatsPromise;
    console.timeEnd('get forecast + thermostats');

    const hourlyData = forecast.hourly.data.slice(0, 3);
    const currentTemp = hourlyData.map((hour) => hour.temperature)
        .reduce((acc, value) => acc + value) / hourlyData.length;

    console.log('current-tem: ', currentTemp);
    console.log(`Next three hours data: ${hourlyData.map((hour) => `${hour.temperature}f`).join(" ")}`);

    const setting = settings.find((setting) => setting.threshold(currentTemp));
    const diningRoom = thermostats.getThermostat("Dining Room");

    console.log('selected setting: ', setting);

    if (!diningRoom) {
        throw new Error("Could not find thermostat to update");
    }

    const program = diningRoom.getProgram();
    const allSensors = diningRoom.getSensors();

    console.log("all sensors: ", allSensors.map((sensor) => sensor.name).join(", "));
    const homeSensors = setting.sensors(allSensors);
    const awaySensors = setting.awaySensors(allSensors);

    console.log('chosen sensors for home: ', homeSensors.map((sensor) => `${sensor.name} -- ${sensor.temprature}`).join(", "));
    console.log('chosen sensors for away: ', awaySensors.map((sensor) => `${sensor.name} -- ${sensor.temprature}`).join(", "));

    function mapSensors(sensor) {
        return {
            id: `${sensor.id}:1`,
            name: sensor.name
        }
    }

    program.climates.forEach(function (climate) {

        if (climate.name !== 'Away') {

            climate.sensors = homeSensors.map(mapSensors);

        } else {

            climate.sensors = awaySensors.map(mapSensors);
        }
    });


    const outGoingRequest = {
        selection: {
            selectionType: "registered",
            selectionMatch: `${diningRoom.getId()}`
        },
        thermostat: {
            program
        }
    };

    console.log("Performing update!");
    return ecobee.putThermostats(outGoingRequest);

}


exports.handler = function (event, context, callback) {
    updateEcobee().then(function (success) {
        callback(null, "Success");
    }, function (error) {
        callback(error);
    });
};