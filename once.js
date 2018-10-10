"use strict";

require(".").handler({}, {}, function (err, resp) {
    if(err){
        throw err;
    } else {
        console.log(`Finished: ${resp}`);
    }
});