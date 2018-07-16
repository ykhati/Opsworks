
var fs = require('fs');
var _ = require('underscore');

var defaultParams = null;

function OpsWorksHelper(opsworks, env) {

    defaultParams = require('./DefaultParameters')(env);

    this.createStack = function(stackParams, appName, instanceType, done) {

        opsworks.createStack(stackParams, function(err, stackData) {
            if (err) console.log(err, err.stack);
            else {
                console.log("StackData: "stackData);
                defaultParams.defaultLayerParams.StackId = stackData.StackId;
                defaultParams.defaultLayerParams.Name = appName;
                defaultParams.defaultLayerParams.Shortname = appName;

                createLayer(stackData, defaultParams.defaultLayerParams, instanceType, appName, function() {
                    done(stackData);
                });
            }
        });
    };

    this.getTimeStamp = function() {
        var now = new Date();
        return (now.getFullYear().toString() +
        ((now.getMonth() < 9)
            ? ("0" + (now.getMonth() + 1)).toString()
            : (now.getMonth() + 1).toString()) +
        ((now.getDate() <= 9)
            ? ("0" + (now.getDate())).toString()
            : (now.getDate()).toString()) + "-" +
        ((now.getHours() < 10)
            ? ("0" + now.getHours())
            : (now.getHours())) +
        ((now.getMinutes() < 10)
            ? ("0" + now.getMinutes())
            : (now.getMinutes())) +
        ((now.getSeconds() < 10)
            ? ("0" + now.getSeconds())
            : (now.getSeconds())));
    };

    this.checkInstanceAvailability = function(stackId, callback) {
        opsworks.describeInstances({ StackId: stackId }, function(err, describeData) {
            if (err) {
                console.log(err);
                callback(err);
            }
            else {
                if (describeData.Instances && typeof describeData.Instances !== 'undefined') {
                    var available = [];
                    for (var i = 0, imax = 2; i < imax; i++) {
                        console.log(describeData.Instances[i].InstanceId + ': ' + describeData.Instances[i].Status);
                        if (describeData.Instances[i].Status !== "online") {
                            available.push(false);
                        } else {
                            available.push(true);
                        }
                    }
                    var data = [];
                    data.push(_.all(available));
                    if (describeData.Instances[0].PrivateIp && typeof describeData.Instances[0].PrivateIp !== 'undefined' &&
                        describeData.Instances[1].PrivateIp && typeof describeData.Instances[1].PrivateIp !== 'undefined') {
                        data.push(describeData.Instances[0].PrivateIp);
                        data.push(describeData.Instances[1].PrivateIp);
                    }
                    callback(data);
                } else {
                    callback([false, null, null]);
                }
            }
        });
    };

    this.checkInstancesStopStatus = function(layerId, callback) {
        opsworks.describeInstances({ LayerId: layerId }, function(err, describeData) {
            if (err) callback(err);
            else {
                if (!_.isUndefined(describeData.Instances)) {
                    var stopped = [];
                    for (var i = 0, imax = 2; i < imax; i++) {
                        console.log(describeData.Instances[i].InstanceId + ': ' + describeData.Instances[i].Status);
                        if (describeData.Instances[i].Status !== "stopped") {
                            stopped.push(false);
                        } else {
                            stopped.push(true);
                        }
                    }
                    var data = [];
                    data.push(_.every(stopped));
                    callback(data);
                } else {
                    callback([false, null, null]);
                }
            }
        });
    };

    this.checkOldLayer = function(appName, callback) {
        opsworks.describeStacks({}, function(err, stackData) {
            if (err) {
                console.log(err);
                callback(err);
            }
            else {
                if (stackData && typeof stackData !== 'undefined') {
                    var oldStack = _.find(stackData.Stacks, function(stack) {
                        return stack.Name.toLowerCase().indexOf(appName) != -1;
                    });

                    if (oldStack && typeof oldStack !== 'undefined') {
                        opsworks.describeLayers({StackId: oldStack.StackId}, function(err, layerData) {
                            if (err) {
                                console.log(err);
                                callback(err);
                            }
                            else {
                                var oldLayer = _.find(layerData.Layers, function(layer) {
                                    return layer.Name.toLowerCase().indexOf(appName) != -1;
                                });
                                callback(oldLayer.LayerId);
                            }
                        });
                    } else {
                        console.log('Old Stack associated for the ELB was not found.');
                        callback(null);
                    }
                } else {
                    console.log('Old Stack associated for the ELB was not found.');
                    callback(null);
                }
            }
        });
    };

    this.prepareOldStackDeletion = function(appName, callback) {
        opsworks.describeStacks({}, function(err, stackData) {
            if (err) callback(err);
            else {
                if (!_.isUndefined(stackData) && !_.isUndefined(stackData.Stacks) && _.isArray(stackData.Stacks)) {

                    var matchingStacks = _.filter(stackData.Stacks, function(stack) {
                        return stack.Name.toLowerCase().indexOf(appName.toLowerCase()) >= 0;
                    });

                    if (matchingStacks.length > 1) {

                        var oldStack = _.first(_.sortBy(matchingStacks, function(stack) { return stack.CreatedAt; }));
                        opsworks.describeLayers({StackId: oldStack.StackId}, function(err, layerData) {
                            if (err) callback(err);
                            else {
                                opsworks.describeElasticLoadBalancers({LayerIds: [layerData.Layers[0].LayerId]}, function(err, elbs) {
                                    if (err) console.log(err, err.stack);
                                    if (elbs.ElasticLoadBalancers.length > 0) {
                                        callback('An active load balancer is attached to this application.');
                                    } else {
                                        callback(null, layerData.Layers[0].LayerId, oldStack.StackId);
                                    }
                                });
                            }
                        });
                    } else {
                        callback('Only one active stack is found for this application.')
                    }
                } else {
                    callback('Old Stack associated for the ELB was not found.');
                }
            }
        });
    };

    this.stopInstances = function(layerId, callback) {
        opsworks.describeInstances({ LayerId: layerId }, function(err, describeData) {
            if (err) callback(err);
            else {
                if (!_.isUndefined(describeData.Instances)) {
                    if (describeData.Instances.length != 2) {
                        callback('A load-balanced instance set is not found.');
                    } else {
                        opsworks.stopInstance({ InstanceId: describeData.Instances[0].InstanceId }, function(err) {
                            if (err) callback(err);
                            else {
                                opsworks.stopInstance({ InstanceId: describeData.Instances[1].InstanceId }, function(err) {
                                    if (err) callback(err);
                                    else callback(null, [describeData.Instances[0].InstanceId, describeData.Instances[1].InstanceId ]);
                                });
                            }
                        });
                    }
                }
            }
        });
    };

    this.deleteInstances = function(instances, callback) {
        opsworks.deleteInstance({ InstanceId: instances[0] }, function(err) {
            if (err) callback(err);
            else {
                opsworks.deleteInstance({ InstanceId: instances[1] }, function(err) {
                    if (err) callback(err);
                    else {
                        callback(null);
                    }
                });
            }
        });
    };

    /* Private Functions and Helpers */
    var createLayer = function(stackData, layerParams, instanceType, hostName, done) {

        opsworks.createLayer(layerParams, function(err, layerData) {
            if (err) console.log('There was an error creating the layer.', err, err.stack);
            else {
                console.log(layerData);

                var fileContent = "new_layer_id=" + layerData.LayerId;
                fs.writeFile("set_parameters.env", fileContent, function(err) {
                    if(err) {
                        return console.log(err);
                    } else {
                        defaultParams.defaultInstanceParams.LayerIds = [ layerData.LayerId ];
                        defaultParams.defaultInstanceParams.StackId = stackData.StackId;
                        defaultParams.defaultInstanceParams.InstanceType = instanceType;

                        switch(env) {
                            case 'qa':
                                defaultParams.defaultInstanceParams.AvailabilityZone = 'us-west-2b';
                                defaultParams.defaultInstanceParams.Hostname = hostName + '-app-1';
                                defaultParams.defaultInstanceParams.SubnetId = 'subnet-b4e190cd';

                                createAndStartLbInstances(defaultParams.defaultInstanceParams, function() {
                                    defaultParams.defaultInstanceParams.AvailabilityZone = 'us-west-2a';
                                    defaultParams.defaultInstanceParams.Hostname = hostName + '-app-2';
                                    defaultParams.defaultInstanceParams.SubnetId = 'subnet-85ec7ece';

                                    createAndStartLbInstances(defaultParams.defaultInstanceParams, function() {
                                        done();
                                    });
                                });
                                break;
                        }
                    }
                });
            }
        });
    };

    var createAndStartLbInstances = function(instanceParams, done) {
        opsworks.createInstance(instanceParams, function(err, instanceData) {
            if (err) console.log(err, err.stack);
            else {
                var params = {
                    InstanceId: instanceData.InstanceId
                };
                opsworks.startInstance(params, function(err) {
                    if (err) console.log(err, err.stack);
                    else console.log(instanceData);
                    done();
                });
            }
        });
    };

}

module.exports = OpsWorksHelper;
