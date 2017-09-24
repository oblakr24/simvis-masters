/**
 * Created by rokoblak on 7/15/17.
 */

app.service("FileService", ['$http', '$q', '$rootScope', 'Upload', '$interval', function ($http, $q, $rootScope, Upload, $interval) {

    /**
     * Uploads an .obj file to the server
     */
    this.uploadObj = function (file, callback) {
        Upload.upload({
            url: 'upload',
            data: {file: file, 'username': ""}
        }).then(function (resp) {
            callback({files: resp.data.files, capInfo: resp.data.capInfo})
        }, function (resp) {
            console.log('Error status: ' + resp.status);
            callback(null)
        }, function (evt) {});
    };

    /**
     * Returns a list of .obj files fetched from the server
     */
    this.getObjFiles = function (modelsPath, fileNames, capFnMapping, callback) {
        let loader = new THREE.OBJLoader();
        let loadsCompleted = 0;
        let totalLoads = fileNames.length;
        let objectsMapping = [];
        for (let i = 0; i < fileNames.length; i++) {
            let fn = fileNames[i];
            let fnUrl = "/" + modelsPath + "/" + fileNames[i];
            loader.load(fnUrl, function ( parentObj ) {
                parentObj.traverse( function ( child ) {
                    if (child instanceof THREE.Mesh) {
                        let capIdx = capFnMapping[fileNames[i]];
                        if (capIdx === undefined) capIdx = -1;
                        objectsMapping.push({name: fn, object: child, capIdx: capIdx});
                        loadsCompleted ++;
                        if (loadsCompleted >= totalLoads) {
                            callback(objectsMapping)
                        }
                    }})
                }
            );
        }
    };

    /**
     * Requests a new simulation job
     * @param simParams the simulation parameters
     * @param callback
     * @param statusCallback
     */
    this.runSimulation = function (simParams, callback, statusCallback) {
        postAndPoll(simParams, '/sim/simulate', '/sim/simulate', 3000, function (data) {
            if (data !== null) {
                callback({files: data.files, status: data.status});
            } else {
                callback({files: null});
            }
        }, function (status) {
            statusCallback(status)
        })
    };


    /**
     * Requests a new meshing job
     * @param edgeSize
     * @param callback
     * @param statusCallback
     */
    this.meshModel = function (edgeSize, callback, statusCallback) {
        postAndPoll({edgeSize: edgeSize}, '/sim/mesh', '/sim/mesh', 3000, function (data) {
            if (data !== null) {
                callback({files: data.files});
            } else {
                callback({files: null});
            }
        }, function (status) {
            statusCallback(status)
        })
    };

    /**
     * Loads the result data files from the server
     * @param dir - the results directory
     * @param callback - the three parameter callback function
     */
    this.getCompressedData = function (dir, callback) {
        $q.all([
            // positions
            $http({method: 'GET', url: "/public/" + dir + "positions.b", responseType: "arraybuffer"
            }).then(function successCallback(response) {
                return new Float32Array(response.data)
            }, function errorCallback(response) {
                console.log("Error: " + response)
            }),
            // mesh face ids
            $http({method: 'GET', url: "/public/" + dir + "mesh.b", responseType: "arraybuffer"
            }).then(function successCallback(response) {
                return new Uint32Array(response.data)
            }, function errorCallback(response) {
                console.log("Error: " + response)
            }),
            // pressures
            $http({method: 'GET', url: "/public/" + dir + "pressures.b", responseType: "arraybuffer"
            }).then(function successCallback(response) {
                return new Uint8Array(response.data);
            }, function errorCallback(response) {
                console.log("Error: " + response)
            }),
            // velocities
            $http({method: 'GET', url: "/public/" + dir + "velocities.b", responseType: "arraybuffer"
            }).then(function successCallback(response) {
                return new Uint8Array(response.data);
            }, function errorCallback(response) {
                console.log("Error: " + response)
            }),
            // wall shear stress
            $http({method: 'GET', url: "/public/" + dir + "wss.b", responseType: "arraybuffer"
            }).then(function successCallback(response) {
                return new Uint8Array(response.data);
            }, function errorCallback(response) {
                console.log("Error: " + response)
            }),
            // in-plane tractions
            $http({method: 'GET', url: "/public/" + dir + "ipt.b", responseType: "arraybuffer"
            }).then(function successCallback(response) {
                return new Uint8Array(response.data);
            }, function errorCallback(response) {
                console.log("Error: " + response)
            }),
            // time-derivative
            $http({method: 'GET', url: "/public/" + dir + "timederiv.b", responseType: "arraybuffer"
            }).then(function successCallback(response) {
                return new Uint8Array(response.data);
            }, function errorCallback(response) {
                console.log("Error: " + response)
            })
        ])
        .then(function(responses) {
            let positions = responses[0];
            let faceIds = responses[1];
            let pressures = responses[2];
            let velocities = responses[3];
            let wss = responses[4];
            let tractions = responses[5];
            let derivatives = responses[6];

            callback(positions, faceIds, pressures, velocities, wss, tractions, derivatives)
        });
    };

    /**
     * Helper function that POSTs the initial data and then polls the server for updates with GET requests
     */
    let postAndPoll = function (postData, postUrl, pollUrl, interval, callback, statusCallback) {
        $http.post(postUrl, postData).
        success(function (successResp) {
            console.log("posted successfully");
            console.log(successResp);
            // start the polling
            let poller = $interval(function () {
                $http.get(pollUrl)
                    .success( function (successResp) {
                        console.log(successResp);
                        if (successResp.isReady) {
                            $interval.cancel(poller);
                            callback(successResp.data);
                        } else {
                            if (statusCallback !== null) {
                                statusCallback(successResp.status)
                            }
                        }
                    } ).error( function (errResp) {
                        $interval.cancel(poller);
                        console.log("Error in polling:");
                        console.log(errResp);
                        callback(null);
                    } )
            }, interval);

        } ).error(function (errResp) {
            console.error("Error in posting:");
            console.log(errResp);
            callback(null);
        } )
    };

    /**
     * Locally loads .flow / .txt file containing flow info
     * @param file
     * @param callback
     */
    this.readFlowFile = function (file, callback) {
        let reader = new FileReader();
        reader.onload = function(progressEvent) {
            let parsedFile = this.result;
            let times = [];
            let flowValues = [];
            let lines = parsedFile.split('\n');
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let split = line.split(/\s+/g);
                if (split.length > 1 && split[0].indexOf("#") === -1) {
                    times.push(parseFloat(split[0]));
                    flowValues.push(parseFloat(split[1]));
                }
            }
            callback({filename: file.name, id: file.lastModified, times, values: flowValues, steady: false})
        };

        reader.readAsText(file);
    };

    /** Lists the available results */
    this.listResults = function (callback) {
        $http.get('/sim/listresults').success(function (successResp) {
            callback(successResp.data);
        } ).error(function (errResp) {
            console.log(errResp);
            callback(null);
        } )
    };
    /** Saves the results under the 'modelName' directory */
    this.saveResults = function (modelName, callback) {
        $http.post('/sim/saveresults', {dirName: modelName}).success(function (successResp) {
            callback(successResp.data);
        } ).error(function (errResp) {
            console.log(errResp);
            callback(null);
        } )
    };
    /** Removes the results */
    this.removeResults = function (results, callback) {
        $http.post('/sim/removeresults', {dirName: results.dir}).success(function (successResp) {
            callback(successResp.data);
        } ).error(function (errResp) {
            console.log(errResp);
            callback(null);
        } )
    };
    /** Lists the available server models */
    this.listModels = function (callback) {
        $http.get('/sim/listmodels').success(function (successResp) {
            callback(successResp.data);
        } ).error(function (errResp) {
            console.log(errResp);
            callback(null);
        } )
    };
    /** Saves the model under the 'modelName' directory */
    this.saveModel = function (modelName, callback) {
        $http.post('/sim/savemodel', {modelName: modelName}).success(function (successResp) {
            callback(successResp.data);
        } ).error(function (errResp) {
            console.log(errResp);
            callback(null);
        } )
    };
    /** Removes the model */
    this.removeModel = function (modelName, callback) {
        $http.post('/sim/removemodel', {modelName: modelName}).success(function (successResp) {
            callback(successResp.data);
        } ).error(function (errResp) {
            console.log(errResp);
            callback(null);
        } )
    };
    /** Loads the existing server model */
    this.loadModel = function (modelName, callback) {
        $http.post('/sim/loadmodel', {modelName: modelName}).success(function (successResp) {
            callback({files: successResp.files, modelsPath: successResp.modelsPath, capInfo: successResp.capInfo, modelName: successResp.modelName});
        } ).error(function (errResp) {
            console.log(errResp);
            callback(null);
        } )
    };

}]);
