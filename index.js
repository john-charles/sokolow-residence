"use strict";

const SR = require("./lib");
const _ = require('lodash');

const settings = [
    {
        name: "Hot Day",
        heatTemp: 70,
        coolTemp: 73,
        sensors: withoutColdestSensor,
        threshold: (currentTemp) => currentTemp >= 78
    },
    {
        name: "Warm Day",
        heatTemp: 70,
        coolTemp: 73,
        sensors: allSensors,
        threshold: (currentTemp) => currentTemp >= 65 && currentTemp < 78

    },
    {
        name: "Cool Day",
        heatTemp: 70,
        coolTemp: 73,
        sensors: tenMinuteHighLowSensor,
        threshold: (currentTemp) => currentTemp > 32 && currentTemp < 65
    },
    {
        name: "Cold Day",
        heatTemp: 71,
        coolTemp: 75,
        sensors: tenMinuteHighLowSensor,
        threshold: (currentTemp) => currentTemp <= 32
    }
];


function allSensors(sensors) {
    return sensors;
}

function withoutColdestSensor(sensors) {
    const minSensor = _.minBy(sensors, (sensor) => sensor.temprature);
    return _.reject(sensors, (sensor) => sensor.id === minSensor.id);
}

function tenMinuteHighLowSensor(sensors) {
    const selectors = {
        0: _.minBy,
        1: _.maxBy,
        2: _.minBy,
        3: _.maxBy,
        4: _.minBy,
        5: _.maxBy
    };

    const minuteCode = Math.floor(new Date().getMinutes() / 10);
    return [selectors[minuteCode](sensors, (sensor) => sensor.temprature)];
}

// const forecast = {
//     currently: {
//         temperature: 30
//     }
// };

async function updateEcobee() {

    const s3 = new SR.S3();
    const darkSky = new SR.DarkSky(s3);
    const tokenSource = new SR.TokenSource(s3);
    const ecobee = new SR.Ecobee(tokenSource);
    const forecastPromise = darkSky.getForecast();
    const thermostatsPromise = ecobee.getThermostats();

    const forecast = await forecastPromise;
    const thermostats = await thermostatsPromise;

    const setting = settings.find((setting) =>
        setting.threshold(forecast.currently.temperature));


    console.log('current, ', forecast.currently.temperature);
    console.log('temps: ', setting);

    const diningRoom = thermostats.getThermostat("Dining Room");

    if (!diningRoom) {
        throw new Error("Could not find thermostat to update");
    }

    const program = diningRoom.getProgram();
    const sensors = setting.sensors(diningRoom.getSensors()).map(function (sensor) {
        return {
            id: `${sensor.id}:1`,
            name: sensor.name
        }
    });

    console.log('using sensors: ', sensors);

    program.climates.forEach(function (climate) {
        climate.heatTemp = Math.floor(setting.heatTemp * 10);
        climate.coolTemp = Math.floor(setting.cooltemp * 10);
        climate.sensors = sensors;
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