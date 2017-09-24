/**
 * Created by rokoblak on 7/16/17.
 */

let appController = function($scope, FileService) {

    // for model management
    $scope.modelName = "";
    $scope.existingModels = [];
    $scope.selectedModel = "";
    $scope.modelSaveEnabled = false; // whether the model saving is enabled

    // for results management
    $scope.existingResults = [];
    $scope.selectedResults = null;
    $scope.resultsSaveEnabled = false; // whether the results saving is enabled

    // visualization settings
    $scope.visParams = {};
    $scope.visParams.showPressures = true;
    $scope.visParams.showVelocities = false;
    $scope.visParams.showStresses = false;
    $scope.visParams.showTractions = false;
    $scope.visParams.showDerivatives = false;
    $scope.visParams.pressureDispType = "magnitude"; // "magnitude" or "surface"
    $scope.visParams.tractionDispType = "magnitude"; // "magnitude" or "surface"
    $scope.visParams.stressDispType = "magnitude"; // "magnitude" or "surface"
    $scope.visParams.velocityDispType = "vector"; // "vector" or "magnitude" or "surface"
    $scope.visParams.derivativeDispType = "vector"; // "vector" or "magnitude" or "surface"

    $scope.visParams.isShowingResults = false;
    $scope.visParams.showStreamlinesIn = false;
    $scope.visParams.showStreamlinesOut = false;
    $scope.visParams.showMesh = true;
    $scope.visParams.meshOpacity = 1.0;

    // model cap info, a mapping of indices, their radii and other parameters
    $scope.capInfo = [
        // sample data
        // {capIdx: 1, radius: 1.2, isInlet: false, resistance: 0, flow: null},
        // {capIdx: 2, radius: 1.2, isInlet: false, resistance: 1333, flow: null},
        // {capIdx: 3, radius: 1.2, isInlet: false, resistance: 1230, flow: null},
        // {capIdx: 4, radius: 1.2, isInlet: false, resistance: 0, flow: null},
        // {capIdx: 5, radius: 1.2, isInlet: false, resistance: 0, flow: null},
        // {capIdx: 6, radius: 1.2, isInlet: false, resistance: 0, flow: null},
        // {capIdx: 7, radius: 1.2, isInlet: false, resistance: 0, flow: null},
        // {capIdx: 8, radius: 1.2, isInlet: false, resistance: 0, flow: null},
        // {capIdx: 9, radius: 1.2, isInlet: false, resistance: 0, flow: null},
        // {capIdx: 10, radius: 1.2, isInlet: true, resistance: 0, flow: null},
        // {capIdx: 11, radius: 1.2, isInlet: true, resistance: 0, flow: null},
        // {capIdx: 12, radius: 1.2, isInlet: true, resistance: 0, flow: null},
        // {capIdx: 13, radius: 1.2, isInlet: true, resistance: 0, flow: null},
        // {capIdx: 14, radius: 1.2, isInlet: true, resistance: 0, flow: null},
        // {capIdx: 15, radius: 1.2, isInlet: true, resistance: 0, flow: null},
        // {capIdx: 16, radius: 1.2, isInlet: false, resistance: 0, flow: null},
        // {capIdx: 17, radius: 1.2, isInlet: true, resistance: 0, flow: null},
        // {capIdx: 18, radius: 1.2, isInlet: true, resistance: 0, flow: null}
        ];

    $scope.capMapping = null;

    $scope.modelFiles = null; // a list of loaded .obj files

    $scope.hasMesh = false; // true if the meshing has been done

    $scope.hasNeededSimParams = false; // true if every needed simulation parameter has been entered

    $scope.hasData = false; // true if the simulation data has been received

    // default steady flow value
    $scope.steadyFlowValue = -100.0;

    // loaded flow files
    $scope.flowFiles = [{id: 0, filename: "Steady (-100 cc/sec)", times: [0, 100.0], values: [$scope.steadyFlowValue, $scope.steadyFlowValue], steady: true}];

    let steadyFlowCounter = 1; // counts the number of currently added flows, to keep track for the file names
    let flowIdCtr = 1;

    $scope.selectedFlowFile = null;

    // mesh edge size
    $scope.edgeSize = 0;

    $scope.sharedParams = {};
    $scope.sharedParams.hlCapIdx = 0; // highlighted cap index
    $scope.sharedParams.capIdx = 0;

    // simulation parameters - default values
    $scope.timeSteps = 20;
    $scope.timeStepSize = 0.01;
    $scope.restarts = 10;
    $scope.viscosity = 0.04;
    $scope.density = 1.06;

    // current loading bar message
    $scope.loadingMessage = "";

    let notifyRenderer = message => $scope.$broadcast("renderer", message);

    $scope.startLoading = message => $scope.loadingMessage = message;

    $scope.stopLoading = () => $scope.loadingMessage = "";

    $scope.selectCap = cap => $scope.sharedParams.capIdx = cap.capIdx;

    $scope.highlightCap = function (cap) {
        $scope.sharedParams.hlCapIdx = cap.capIdx;
        notifyRenderer({type: "changeCap"})
    };

    $scope.checkSimParams = function () {
        let valid = true;
        for (let i = 0; i < $scope.capInfo.length; i++) {
            if ($scope.capInfo[i].isInlet && $scope.capInfo[i].flow === null) {
                valid = false;
                break;
            }
        }
        $scope.hasNeededSimParams = valid;
    };

    $scope.simulate = function () {
        $scope.startLoading("Simulating ...");

        // construct the inlet and outlet parameters
        let simLength = $scope.timeSteps * $scope.timeStepSize;

        // set the final timestamps for the steady flows
        for (let i = 0; i < $scope.flowFiles.length; i++) {
            if ($scope.flowFiles[i].steady) {
                let times = $scope.flowFiles[i].times;
                if (times.length === 2) {
                    times[1] = simLength;
                } else {
                    times.push(simLength)
                }
            }
        }

        let inlets = [];
        let outlets = [];
        for (let i = 0; i < $scope.capInfo.length; i++) {
            let cap = $scope.capInfo[i];
            let idx = cap.capIdx;
            let name = "cap" + idx + ".vtp";
            let objName = "cap" + idx + ".obj";
            let id = idx + 1;
            if (cap.isInlet) {
                inlets.push({name: name, id: id, flow: cap.flow})
            } else {
                let resistance = cap.resistance;
                if (resistance === null || resistance === undefined) {
                    resistance = 0;
                }
                outlets.push({name: name, objName: objName, id: id, resistance: resistance})
            }
        }

        let simParams = {
            timesteps: $scope.timeSteps,
            stepsize: $scope.timeStepSize,
            restarts: $scope.restarts,
            viscosity: $scope.viscosity,
            density: $scope.density,
            inlets: inlets,
            outlets: outlets,
            edgeSize: $scope.edgeSize, // needed for future reference
            capInfo: $scope.capInfo, // needed for future reference
            capMapping: $scope.capMapping, // needed for future reference
            files: $scope.modelFiles // needed for future reference
        };

        FileService.runSimulation(simParams, function (data) {
            $scope.hasData = true;
            let callback = function () {
                $scope.stopLoading();
            };
            notifyRenderer({type: "fetchResults", callback: callback});
            $scope.resultsSaveEnabled = true;
        }, function (status) {
            if (status !== null) {
                $scope.startLoading("Simulating: " + status.desc + " ...");
            }
        });
    };
    
    $scope.meshModel = function () {
        $scope.startLoading("Creating mesh ...");
        $scope.hasMesh = false;
        FileService.meshModel($scope.edgeSize, function (data) {
            let files = data["files"];
            if (files !== null) {
                $scope.hasMesh = true;
                notifyRenderer({type: "objFiles", resetCamera: false, files: files, modelsPath: "public/models/"});
                $scope.stopLoading();
            } else {
                $scope.stopLoading();
                setTimeout(function () {
                    alert("The meshing failed. Most likely a too large edge size value was selected, please try again with a smaller value.");
                }, 100)
            }
        }, function (status) {
            if (status !== null) {
                $scope.startLoading("Creating mesh: iteration " + status.iteration + ", step " + status.step + " ...");
            }
        });
    };

    //
    // region Flows management
    //

    $scope.selectFlowFile = flowFile => $scope.selectedFlowFile = flowFile;

    $scope.removeFlowFile = flowFile => $scope.flowFiles = $scope.flowFiles.filter(item => item !== flowFile);

    $scope.addNewSteadyFlow = function () {
        let steadyFlow = {id: flowIdCtr, filename: "Steady " + steadyFlowCounter + " (" + $scope.steadyFlowValue + " cc/sec)", times: [0], values: [$scope.steadyFlowValue, $scope.steadyFlowValue], steady: true};
        $scope.flowFiles.push(steadyFlow);
        steadyFlowCounter++;
        flowIdCtr++;
    };

    $scope.setCapFlowFile = function () {
        if ($scope.selectedFlowFile !== null) {
            $scope.capInfo[$scope.sharedParams.capIdx - 1].flow = $scope.selectedFlowFile;
        }
    };

    $scope.updateSelectedFlowFile = function () {
        if ($scope.sharedParams.capIdx > 0 && $scope.capInfo[$scope.sharedParams.capIdx - 1].flow === null) {
            $scope.selectedFlowFile = null;
        } else if ($scope.sharedParams.capIdx > 0) {
            $scope.selectedFlowFile = $scope.capInfo[$scope.sharedParams.capIdx - 1].flow;
        }
    };

    $scope.loadFlowFile = function (file) {
        FileService.readFlowFile(file, function (flowFile) {
            let fn = flowFile.filename;

            let fileExists = false;
            let nameIdx = 1;
            for (let i = 0; i < $scope.flowFiles.length; i++) {
                if ($scope.flowFiles[i].id === flowFile.id) {
                    fileExists = true;
                    break;
                }
                if ($scope.flowFiles[i].filename === fn) {
                    fn = flowFile.filename + " (" + nameIdx + ")";
                    nameIdx++;
                }
            }

            if (!fileExists) {
                flowFile.filename = fn;
                flowFile.id = flowIdCtr;
                $scope.flowFiles.push(flowFile);
                $scope.$apply();
                flowIdCtr++;
            }
        });
    };

    //
    // endregion
    //

    //
    // region Models management
    //

    $scope.uploadModel = function(file) {
        $scope.hasMesh = false;
        $scope.startLoading("Loading model ...");
        FileService.uploadObj(file, function (data) {
            $scope.modelName = file.name;
            $scope.modelSaveEnabled = true;
            loadModel(data, "public/models/");
        })
    };

    $scope.loadServerModel = function() {
        $scope.hasMesh = false;
        $scope.startLoading("Loading model and creating caps ...");
        FileService.loadModel($scope.selectedModel, function (data) {
            $scope.modelName = data["modelName"];
            let modelsPath = data["modelsPath"];
            loadModel(data, modelsPath);
        })
    };

    $scope.selectModel = selectedModel => $scope.selectedModel = selectedModel;

    $scope.saveModel = function () {
        FileService.saveModel($scope.modelName, function (resp) {
            $scope.existingModels = resp;
            $scope.modelSaveEnabled = false;
            alert("Model saved!")
        })
    };

    $scope.listExistingModels = () => FileService.listModels(resp => $scope.existingModels = resp);

    $scope.removeModel = function (modelName) {
        if (confirm("Remove " + modelName + "?") === true) {
            FileService.removeModel(modelName, function (resp) {
                $scope.selectedModel = "";
                $scope.existingModels = resp;
            })
        }
    };

    function loadModel(data, modelsPath) {
        let files = data["files"];
        let filesInfo = data["capInfo"];
        let capInfo = filesInfo["caps"];
        let capMapping = filesInfo["mapping"];
        let smallestCapHalfRadius = capInfo[capInfo.length - 1].radius / 2;
        capInfo.forEach(cap => cap.isInlet = false);
        capInfo[0].isInlet = true; // by default, the first one - the largest one - is an inlet
        capInfo[0].flow = $scope.flowFiles[0];
        $scope.capInfo = capInfo;
        $scope.capMapping = capMapping;
        $scope.modelFiles = files;
        $scope.edgeSize = parseFloat(smallestCapHalfRadius.toFixed(4));
        if (files !== null) {
            notifyRenderer({type: "objFiles", resetCamera: true, files: files, modelsPath: modelsPath, mapping: capMapping});
            $scope.stopLoading();
            $scope.hasData = false;
            closeSidebar();
        }
    }

    //
    // endregion
    //

    //
    // region Results management
    //

    $scope.selectResults = selectedResults => $scope.selectedResults = selectedResults;

    $scope.listExistingResults = () => FileService.listResults(resp => $scope.existingResults = resp);

    $scope.removeResults = function (resultsName) {
        if (confirm("Remove " + resultsName + "?") === true) {
            FileService.removeResults(resultsName, function (resp) {
                $scope.selectedResults = "";
                $scope.existingResults = resp;
            })
        }
    };

    $scope.saveResults = function () {
        FileService.saveResults($scope.modelName, function (resp) {
            $scope.existingResults = resp;
            $scope.resultsSaveEnabled = false;
            alert("Results saved!")
        })
    };

    $scope.loadResults = function () {
        let resDirName = $scope.selectedResults.dir;

        $scope.hasMesh = false;
        $scope.startLoading("Loading results ...");

        let files = $scope.selectedResults.data.files;
        $scope.capMapping = $scope.selectedResults.data.capMapping;
        $scope.capInfo = $scope.selectedResults.data.capInfo;
        $scope.edgeSize = $scope.selectedResults.data.edgeSize;
        let modelsPath = "public/savedresults/" + resDirName;
        let resDirPath = "savedresults/" + resDirName + "/";

        let callback = function () {
            $scope.stopLoading();
            $scope.hasData = true;
            $scope.hasMesh = true;
        };

        notifyRenderer({type: "results", files: files, modelsPath: modelsPath, resDirPath: resDirPath, callback: callback});
    };

    //
    // endregion
    //

};

app.controller('AppController', appController);