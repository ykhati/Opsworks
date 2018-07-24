var AWS = require('aws-sdk');
var async = require('async');
var fs = require('fs');
var _ = require('underscore');

var appName = process.argv[2];
var environment = process.argv[3];

if (!_.isUndefined(appName) && !_.isUndefined(environment)) {
    var creds = new AWS.SharedIniFileCredentials({profile: 'default'});
    AWS.config.credentials = creds;
    AWS.config.region = 'us-west-2';

    var opsworks = new AWS.OpsWorks();

    var opsworksHelper = new (require('./OpsWorksHelper'))(opsworks, environment);
    var defaultParams = require('./DefaultParameters')(environment);

    defaultParams.defaultStackParams.Name = appName + '-' + opsworksHelper.getTimeStamp();
    defaultParams.defaultStackParams.Attributes = { Color: 'rgb(209, 105, 41)' };

    opsworksHelper.createStack(defaultParams.defaultStackParams, appName, 't2.micro', function(stackData) {
        if (stackData) {
            var isOnline = false;
            opsworksHelper.checkOldLayer(appName, function(oldLayerId) {
                if (oldLayerId && typeof oldLayerId !== 'undefined') {
                    var fileContent = "\nold_layer_id=" + oldLayerId + "\nattach_elb=true";
                    fs.appendFile("set_parameters.env", fileContent, function(err) {
                        if(err) {
                            return console.log(err);
                        } else {
                            async.whilst(
                                function () {
                                    return !isOnline;
                                },
                                function (callback) {
                                    opsworksHelper.checkInstanceAvailability(stackData.StackId, function (data) {
                                        isOnline = data[0];
                                        console.log(isOnline);
                                        setTimeout(function () {
                                            if (data[0]) {
                                                console.log(data[1]);
                                                console.log(data[2]);
                                                var fileContent = "\nprimary_ip=" + data[1] + "\nsecondary_ip=" + data[2];
                                                fs.appendFile("set_parameters.env", fileContent, function(err) {
                                                    if(err) {
                                                        return console.log(err);
                                                    }
                                                });
                                            }
                                            callback(data[0]);
                                        }, 10000);
                                    });
                                }
                            );
                        }
                    });
                } else {
                    console.log('There was an error creating the stack');
                }
            });
        } else {
            console.log('There was an error creating the stack');
        }
    });
} else {
    console.log('Application name and/or environment in command line argument is/are not specified.');
}
