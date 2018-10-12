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
        sensors: tenMinuteHighLowSensor(3),
        threshold: (currentTemp) => currentTemp > 32 && currentTemp < 65
    },
    {
        name: "Cold Day",
        heatTemp: 71,
        coolTemp: 75,
        sensors: tenMinuteHighLowSensor(2),
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

function tenMinuteHighLowSensor(cph) {
    return (sensors) => {

        const minuteCode = Math.floor(new Date().getMinutes() / 10);
        const maxSensor = _.maxBy(sensors, (sensor) => sensor.temprature);
        const minSensor = _.minBy(sensors, (sensor) => sensor.temprature);

        if (maxSensor.temprature > 72) {
            return [maxSensor];
        }

        if (minuteCode % cph === 0) {
            return [minSensor];
        } else {
            return [maxSensor];
        }

    }
}

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


    const setting = settings.find((setting) =>
        setting.threshold(forecast.currently.temperature));


    console.log('current, ', forecast.currently.temperature);
    console.log('temps: ', setting);

    const diningRoom = thermostats.getThermostat("Dining Room");

    if (!diningRoom) {
        throw new Error("Could not find thermostat to update");
    }

    const program = diningRoom.getProgram();
    let sensors = diningRoom.getSensors();

    sensors = _.reject(sensors, (sensor) => sensor.name === 'Bedroom');
    console.log("all sensors: ", sensors.map((sensor) => sensor.name));
    sensors = setting.sensors(sensors);


    console.log('chosen sensors: ', sensors.map((sensor) => `${sensor.name} -- ${sensor.temprature}`));

    sensors = sensors.map(function (sensor) {
        return {
            id: `${sensor.id}:1`,
            name: sensor.name
        }
    });


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