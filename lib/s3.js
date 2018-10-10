"use strict";
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

module.exports = class S3 {

    constructor(bucket){
        this.bucket = bucket;
        this.s3 = new AWS.S3({apiVersion: '2006-03-01'});
    }

    getObject(bucket, key){
        const self = this;

        if(typeof key === 'undefined'){
            key = bucket;
            bucket = this.bucket;
        }

        return new Promise(function (resolve, reject) {
            self.s3.getObject({Bucket: bucket, Key: key}, function (err, resp) {
                if(err){
                    return reject(err);
                } else {
                    return resolve(resp);
                }
            });
        });
    }


    putObject(bucket, key, data){
        const self = this;

        if(typeof data === 'undefined'){
            data = key;
            key = bucket;
            bucket = this.bucket;
        }

        return new Promise(function (resolve, reject) {
            self.s3.upload({Bucket: bucket, Key: key, Body: data}, function (err, resp) {
                if(err){
                    return reject(err);
                } else {
                    return resolve(resp);
                }
            });
        });
    }

};