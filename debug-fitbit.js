require('dotenv').config();
const Influx = require('influxdb-nodejs');
const influxClient = new Influx('http://192.168.117.2:8086/fitbit');

const logFitbit = require('./modules/fitbit.js').logFitbit;

logFitbit(influxClient).then(res => {
    console.log(res);
});

/*
const fritznode = require('fritznode');

process.env.FRITZ_HOST = '192.168.117.1';

run = async()=>{
    let con = await fritznode.fritz({
        password : 'pendule54'
    });
    // let usage = await con.getBandwithUsage();
    // console.log(JSON.stringify(usage,' ','  '));
    // let deviceList = await con.getDeviceList();
    // console.log(JSON.stringify(deviceList,' ','  '));
    let overview = await con.getOverview();
    console.log(JSON.stringify(overview,' ','  '));
    // let nas = await con.getNAS();
    // console.log(JSON.stringify(nas,' ','  '));
};
run();
*/
