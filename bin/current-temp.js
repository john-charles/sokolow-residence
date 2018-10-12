#!/usr/bin/env node
const SR = require("../lib");

async function main() {

    const s3 = new SR.S3();
    const tokenSource = new SR.TokenSource(s3);
    const ecobee = new SR.Ecobee(tokenSource);


    const result = await ecobee.getThermostats();
    result.forEach(function (stat) {

        const connected = stat.isConnected();

        console.log(`Thermostat ${stat.getName()}`);
        console.log(`    connected: ${connected}`);

        if (connected) {

            console.log(`    current temperature: ${stat.getCurrentTemp()}`);
            console.log(`    equipment ${stat.getStatus()}`);
            console.log(`    sensors:`);

            const sensors = stat.getSensors();

            sensors.forEach(function (sensor) {
                console.log(`        ${sensor.name}: ${sensor.temprature}`);
            });

            const avgTemp = sensors.map((sensor) => sensor.temprature)
                .reduce((acc, value) => acc + value, 0) / sensors.length;

            console.log(`    avg sensor temp: ${avgTemp}`);


        }

        console.log();

    });


}

main().then(function () {
    process.exit(0);
}, function (e) {
    console.error(e);
    process.exit(1);
});