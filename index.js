"use strict";

const SR = require("./lib");
const _ = require('lodash');

const settings = [
    {
        name: "Hot Day",
        heatTemp: 69,
        coolTemp: 73,
        sensors: withoutColdestSensor,
        awaySensors: coldestSensor,
        threshold: (currentTemp) => currentTemp >= 78
    },
    {
        name: "Warm Day",
        heatTemp: 69,
        coolTemp: 73,
        sensors: allSensors,
        awayHeatTemp: 60,
        awayCoolTemp: 73,
        awaySensors: allSensors,
        threshold: (currentTemp) => currentTemp >= 60 && currentTemp < 78

    },
    {
        name: "Cool Day",
        heatTemp: 71,
        coolTemp: 73,
        sensors: allSensors,
        awayHeatTemp: 69,
        awaySensors: warmestSensor,
        threshold: (currentTemp) => currentTemp > 45 && currentTemp < 65
    },
    {
        name: "Cold Day",
        heatTemp: 71,
        coolTemp: 75,
        awayHeatTemp: 68,
        sensors: allSensors,
        awaySensors: warmestSensor,
        threshold: (currentTemp) => currentTemp <= 45
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

            climate.heatTemp = Math.floor(setting.heatTemp * 10);
            climate.coolTemp = Math.floor(setting.cooltemp * 10);
            climate.sensors = homeSensors.map(mapSensors);

        } else {

            const heatTemp = setting.awayHeatTemp || setting.heatTemp;
            const coolTemp = setting.awayCoolTemp || setting.coolTemp;

            climate.heatTemp = Math.floor(heatTemp * 10);
            climate.coolTemp = Math.floor(coolTemp * 10);
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