
let port = 8080;

let bodyParser = require('body-parser');

let path = require('path');
// Init express
let express = require('express');
let app = express();

// Init express path
app.use(express.static([__dirname, ".."].join(path.sep)));

app.use(bodyParser.json()); // for parsing application/json

app.use(bodyParser.urlencoded({ extended: true })); // for parsing       application/x-www-form-urlencoded

// Create server and link it to express
let server = require("http").createServer(app);

// filesystem, for listing files etc.
const fs = require('fs-extra');

//
// region Model upload
//

let multer  = require('multer');

let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '../uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, "uploaded.obj")
    }
});

let upload = multer({ //multer settings
    storage: storage
}).single('file');

// POST: upload an .obj
app.post('/sim/upload', function(req, res) {
    upload(req,res,function(err){
        if(err) {
            console.log(err);
            res.json({error_code: 1,err_desc: err});
            return;
        }
        fillHoles(function (dataResp) {
            if (dataResp["error"] === null) {
                let files = dataResp["files"];
                let capInfo = dataResp["capInfo"];
                res.json({error_code: 0,err_desc: null, files: files, capInfo: capInfo});
            } else {
                res.json({error_code: 1,err_desc: dataResp["error"]});
            }
        });

    })
});

//
// endregion
//

//
// region Meshing
//

// the data json to return after the meshing is complete
let meshingData = null;
let meshingStartTime = null;
let meshingMaxTime = 5 * 60 * 1000; // 5 minutes max
let meshingStatus = null;

app.get("/sim/mesh", function (req, res) {
    if (new Date().getTime() - meshingStartTime > meshingMaxTime) {
        res.json({error_code: 400, err_desc: "Timeout", isReady: true, data: null});
        return;
    }

    if (meshingData !== null) {
        // the data is ready - send it
        if (meshingData["error"] === undefined) {
            res.json({error_code: 0, err_desc: null, isReady: true, data: meshingData});
        } else {
            res.json({error_code: 400, err_desc: meshingData["error"], isReady: true, data: null});
        }
    } else {
        // the data is not ready, the client will have to try later
        res.json({error_code: 0,err_desc: null, isReady: false, status: meshingStatus, data: null});
    }
});

// POST: mesh the model
app.post('/sim/mesh', function(req, res) {
    // check if the process is running
    if (!isExecFree) {
        res.json({error_code: 400, err_desc: "A process is already running - make a GET request to get an update on its status"});
    }
    // reset the meshing data
    meshingData = null;
    simStatus = null;

    let content = {
        edgesize: req.body.edgeSize,
        meshFilename: " meshes/workingmesh.vtp",
        walls: [
            {
                name: "wall",
                id: 1
            }
        ],
    };
    fs.writeFile("../../data.json", JSON.stringify(content), 'utf8', function (err) {
        if (err) {
            res.json({error_code: 500,err_desc: err});
            return console.log(err);
        }

        let iterStartLine = "Iteration 1/10";
        let iterLine = "Iteration";
        let iterationStep = 1;
        let totalSteps = 10;
        let currentIteration = 0;

        // start the process
        meshingStartTime = new Date().getTime();
        startProcess('cd ../..; sh createMesh.sh', function (successful, stdout, stderr) {
            if (successful) {
                fs.readdir('../public/models', (err, files) => {
                    // set the variable
                    meshingData = {sdtout: stdout, files: files}
                });
            } else {
                meshingData = {error: "Error while meshing"}
            }
        }, function (line) {
            if (line.indexOf(iterLine) !== -1) {
                if (line.indexOf(iterStartLine) !== -1) {
                    currentIteration++;
                    iterationStep = 1;
                }
                meshingStatus = {iteration: currentIteration, step: iterationStep + "/" + totalSteps};
                iterationStep++;
            }
        });

        // send the response
        res.json({error_code: 0,err_desc: null, data: "Process started."});
    });
});

//
// endregion
//

//
// region Simulation
//

let simData = null;

let simStatus = null;

app.get("/sim/simulate", function (req, res) {
    if (simData !== null) {
        // the data is ready - send it
        res.json({error_code: 0,err_desc: null, isReady: true, data: simData});
    } else {
        // the data is not ready, the client will have to try later
        res.json({error_code: 0,err_desc: null, isReady: false, status: simStatus, data: null});
    }
});

// POST: mesh the model
app.post('/sim/simulate', function(req, res) {
    // check if the process is running
    if (!isExecFree) {
        res.json({error_code: 400, err_desc: "A process is already running - make a GET request to get an update on its status"});
    }
    // reset the meshing data
    simData = null;
    simStatus = null;

    let threads = 8;

    let params = req.body;

    let flows = [];
    for (let i = 0; i < params.inlets.length; i++) {
        let flow = params.inlets[i].flow;
        let fn = "flow_" + flow.id;
        if (flow.steady) {
            fn = "flow_steady_" + flow.id;
        }
        flow["fn"] = fn + ".flow";
        flows.push(flow);
        params.inlets[i].flow = fn + ".flow"; // overwrite with the filename
    }

    // set the number of threads
    params["threads"] = threads;
    fs.writeFile("../../data.json", JSON.stringify(params), 'utf8', function (err) {
        if (err) {
            res.json({error_code: 500,err_desc: err});
            console.log(err);
            return err;
        }

        // TODO: only write unique flows, don't write the same ones multiple times
        writeFlows("../../sv_workspace/flows/", flows, function (success) {
            if (!success) {
                res.json({error_code: 500,err_desc: err});
            }
        });

        let procRankLine = "is my rank and my nnz_tot is:";
        let procLinesPassed = false;
        let iterLinesPassed = false;

        // start the process
        startProcess('cd ../..; sh sim.sh', function (successful, stdout, stderr) {
            if (successful) {
                simData = {sdtout: stdout, succes: true};
            }
        }, function (line) {

            if (line.indexOf(procRankLine) !== -1) {
                procLinesPassed = true;
            } else if (procLinesPassed && !iterLinesPassed) {
                let split = String(line).split(/[ ,]+/);

                let step = parseInt(split[1]);
                if (step <= params["timesteps"]) {
                    let statusDesc = "step " + step + " of " + params["timesteps"];
                    simStatus = {simStep: step, desc: statusDesc}
                } else if (simStatus !== null) {
                    iterLinesPassed = true;
                    simStatus["desc"] = "gathering results"
                }
            }

        });

        // send the response
        res.json({error_code: 0,err_desc: null, data: "Process started."});
    });
});

//
// endregion
//

//
// region Results management
//

app.get("/sim/listresults", function (req, res) {
    listResults(data => res.json({error_code: 0, err_desc: null, data: data}))
});

app.post("/sim/removeresults", function (req, res) {
    removeResultDir(req.body.dirName);
    listResults(data => res.json({error_code: 0, err_desc: null, data: data}))
});

app.post("/sim/saveresults", function (req, res) {
    createNewResultDir(req.body.dirName);
    listResults(data => res.json({error_code: 0, err_desc: null, data: data}))
});

//
// endregion
//

//
// region Model management
//

app.get("/sim/listmodels", function (req, res) {
    res.json({error_code: 0, err_desc: null, data: listModels()});
});

app.post("/sim/removemodel", function (req, res) {
    removeModel(req.body.modelName);
    res.json({error_code: 0, err_desc: null, data: listModels()});
});

app.post("/sim/savemodel", function (req, res) {
    saveModel(req.body.modelName);
    res.json({error_code: 0, err_desc: null, data: listModels()});
});

app.post("/sim/loadmodel", function (req, res) {
    loadModel(req.body.modelName, function (dataResp) {
        if (dataResp["error"] === null) {
            let files = dataResp["files"];
            let capInfo = dataResp["capInfo"];
            let modelName = dataResp["modelName"];
            let modelsPath = dataResp["modelsPath"];
            res.json({error_code: 0,err_desc: null, files: files, modelsPath: modelsPath, modelName: modelName, capInfo: capInfo});
        } else {
            res.json({error_code: 1,err_desc: dataResp["error"]});
        }
    });
});

//
// endregion
//

//
// region Exec functions
//

const { exec } = require('child_process');

let isExecFree = true;

let startProcess = function (execString, callback, stdoutHandler) {
    isExecFree = false;
    let process = exec(execString, {maxBuffer: 1024 * 500}, (error, stdout, stderr) => {
        isExecFree = true;
        if (error) {
            console.error(`exec error: ${error}`);
            callback(false, stdout, stderr);
            return;
        }
        callback(true, stdout, null);
    });

    // log the stdout data
    process.stdout.on('data', function(data) {
        console.log(data);
        if (stdoutHandler !== null) {
            stdoutHandler(data)
        }
    });
};

//
// endregion
//

//
// region Utilities
//

let fillHoles = function (callback) {
    exec('cd ../..; sh pre.sh', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            callback({error: error});
            return;
        }
        let objFiles = fs.readdirSync('../public/models');
        fs.readFile('../public/capInfo.json', 'utf8', function (err, data) {
            if (err) throw err; // we'll not consider error handling for now
            let capInfo = JSON.parse(data);
            callback({files: objFiles, capInfo: capInfo, error: null});
        });
    });
};

let resultDirPath = "../public/savedresults";
let resFolderStartName = "res_";
let meshesDirPath = '../../sv_workspace/meshes';
let savedMeshesDirPath = "../public/meshes";
let publicDir = '../public';
let modelsDir = publicDir + "/models";

let saveModel = function (meshName) {
    while (true) {
        if (fs.existsSync(savedMeshesDirPath + "/" + meshName)) {
            let strLen = meshName.length;
            let parIdx = meshName.lastIndexOf(" (");
            if (parIdx !== -1) {
                let idx = parseInt(meshName.substring(parIdx+2, strLen-1)) + 1;
                meshName = meshName.substring(0, parIdx) + " (" + idx + ")";
            } else {
                meshName = meshName + " (1)"
            }
        } else {
            break;
        }
    }
    copyPaste(meshesDirPath, savedMeshesDirPath + "/" + meshName, "workingmesh.vtp");
    copyPaste(meshesDirPath, savedMeshesDirPath + "/" + meshName, "workingmesh.vtp.facenames");
    copyPaste(publicDir, savedMeshesDirPath + "/" + meshName, "capInfo.json");
    let objFiles = fs.readdirSync(modelsDir).filter(file => file.indexOf(".obj") !== -1);
    objFiles.forEach(file => copyPaste(modelsDir, savedMeshesDirPath + "/" + meshName, file));
};

let loadModel = function (modelName, callback) {
    let dirName = savedMeshesDirPath + "/" + modelName;
    // copy the model to our meshes directory
    copyPaste(dirName, meshesDirPath, "workingmesh.vtp");
    copyPaste(dirName, meshesDirPath, "workingmesh.vtp.facenames");

    let objFiles = fs.readdirSync(dirName).filter(file => file.indexOf(".obj") !== -1);
    fs.readFile(dirName + '/capInfo.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now
        let capInfo = JSON.parse(data);
        callback({files: objFiles, modelsPath: dirName, modelName: modelName, capInfo: capInfo, error: null});
    });
};

let listModels = function () {
    return fs.readdirSync(savedMeshesDirPath)
        .filter(file => fs.lstatSync(savedMeshesDirPath + "/" + file).isDirectory())
        .sort((a,b) => a.localeCompare(b));
};

let removeModel = function (modelName) {
    fs.removeSync(savedMeshesDirPath + "/" + modelName)
};

let listResults = function (callback) {
    let res = [];
    let totalResults = 0;
    fs.readdir(resultDirPath, (err, files) => {
        let resDirs = files.filter(file => file.indexOf(resFolderStartName) !== -1);
        totalResults = resDirs.length;
        let fetchedResults = 0;
        if (resDirs.length === 0) callback([]);
        resDirs.forEach(function(resDir) {
            fs.readdir(resultDirPath + "/" + resDir, (err, resFiles) => {
                resFiles.forEach(function(file) {
                    if (file.indexOf(".json") !== -1) {
                        fs.readFile(resultDirPath + "/" + resDir + "/" + file, 'utf8', function (err, data) {
                            if (err) throw err;
                            let dataJson = JSON.parse(data);
                            res.push({dir: resDir, data: dataJson});
                            fetchedResults++;

                            if (fetchedResults >= totalResults) {
                                callback(res.sort((a,b) => a.dir.localeCompare(b.dir)))
                            }
                        });
                    }
                })
            })
        })
    });
};

let createNewResultDir = function (dir) {
    let dateStr = new Date().toISOString().replace(/T/, '-').replace(/\..+/, '').replace(/:/g, '-');
    let dirName = resFolderStartName + dir + "_" + dateStr;
    copyPaste('../../', resultDirPath + "/" + dirName, 'data.json');

    let resFiles = fs.readdirSync(publicDir).filter(file => file.indexOf(".b") !== -1);
    resFiles.forEach(file => copyPaste(publicDir, resultDirPath + "/" + dirName, file));

    let objFiles = fs.readdirSync(modelsDir).filter(file => file.indexOf(".obj") !== -1);
    objFiles.forEach(file => copyPaste(modelsDir, resultDirPath + "/" + dirName, file));
};

let removeResultDir = function (dirName) {
    fs.removeSync(resultDirPath + "/" + dirName);
    console.log(resultDirPath + "/" + dirName);
};

let copyPaste = function (srcDir, dstDir, fnSrc, fnDst=fnSrc) {
    if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir);
    }
    fs.createReadStream(srcDir + "/" + fnSrc).pipe(fs.createWriteStream(dstDir + "/" + fnDst));
};

let writeFlows = function (dest, flows, callback) {
    let total = flows.length;
    let done = 0;

    let internalCallback = function (err) {
        done++;
        if (err) {
            console.log(err);
            callback(false);
        }

        if (done >= total) {
            callback(true);
        }
    };

    for (let i = 0; i < total; i++) {
        let flowFile = flows[i];
        let fn = flowFile.fn;

        let formatted = "";
        for (let n = 0; n < flowFile.times.length; n++) {
            let time = flowFile.times[n];
            let value = flowFile.values[n];
            formatted += time + " " + value + "\n";
        }

        fs.writeFile(dest + fn, formatted, 'utf8', internalCallback);
    }
};

//
// endregion
//

server.listen(port);
console.log("Listening on port: ", port);