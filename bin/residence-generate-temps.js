#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SR = require("../lib");

async function run(){

    const s3 = new SR.S3();
    const tokenSource = new SR.TokenSource(s3);
    const ecobee = new SR.Ecobee(tokenSource);


    const stats = await ecobee.getThermostats();
    const stat = stats.find((stat) => stat.getName() === 'Living Room');

    const temp = stat.getCurrentTemp();
    const status = stat.getStatus();

    fs.writeFileSync(path.join(process.env.HOME, ".temps.txt"), `${temp}f ${status}`, {encoding: "utf-8"});
}


run();

// fs.writeFileSync(path.join(process.env.HOME, ".temps.txt"), new Date().toString(), {encoding: "utf-8"});