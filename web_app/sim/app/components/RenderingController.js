/**
 * Created by rokoblak on 6/18/17.
 */

let renderingController = function($scope, $http, $q, $interval, FileService, VisualizationService, DecoderService, VisUtils) {

    let container;
    let camera, cameraOrtho, scene, sceneOrtho, renderer, raycaster, INTERSECTED;
    let controls;
    let mousePos = new THREE.Vector2();

    // The legend
    let legend = new THREE.Sprite(new THREE.SpriteMaterial({ map: null }));
    let legendTicks = 7;
    let legendVMarginRatio = 0.025;
    let legendHMarginRatio = 0.02;
    let legendHeightRatio = 0.15;
    let legendWidthRatio = 0.075;

    // Data
    let positions = null; // array of vectors
    let pressures = null; // array of scalar arrays
    let velocities = null; // array of vector arrays
    let derivatives = null; // array of vector arrays
    let stresses = null; // array of vectors
    let tractions = null; // array of vectors
    let pressuresRatios = null;
    let shearStressesRatios = null;
    let tractionsRatios = null;
    let derivativesRatios = null;
    let velocitiesRatios = null;
    let pressureMinMaxes = null;
    let velocityMinMaxes = null;
    let stressesMinMaxes = null;
    let derivativesMinMaxes = null;
    let tractionsMinMaxes = null;

    let velocityMagnitudes = []; // array of magnitude arrays
    let derivativesMagnitudes = []; // array of derivatives arrays
    let tractionsMagnitudes = [];
    let stressesMagnitudes = [];
    let stepDataCalculated = [];

    let streamlineStartPts = []; // streamlines start positions

    // Meshes
    let pointsMesh = null;
    let linesMesh = null;
    let surfaceMesh = null;
    let modelMeshes = [];
    let velocityVectorsArray = [];
    let derivativesVectorsArray = [];
    let streamlinesMeshesIn = []; // the currently displayed set of inlet streamlines
    let streamlinesMeshesOut = []; // the currently displayed set of outlet streamlines
    let streamlinesArrayIn = []; // the array of all sets of inlet streamlines
    let streamlinesArrayOut = []; // the array of all sets of outlet streamlines

    let useFaceHighlighting = true;
    let isMouseDragging = false;
    let lastHLMousePos = new THREE.Vector2();

    let objectsMapping = {};
    let capObjMapping = {};

    let streamlinePtsPerCap = 150;

    let currentFrame = 0;

    let highlightColor = new THREE.Color(0xf7ea00);

    let wallsMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        shininess: 100,
        specular: 0x222222,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: $scope.visParams.meshOpacity
    });

    let materials = [];

    //
    // region Sliders
    //

    $scope.slider = {
        value: 0,
        options: {
            floor: 0,
            ceil: 0,
            onChange: sliderId => {
                if (stepDataCalculated[$scope.slider.value] !== undefined) {
                    setKeyframe($scope.slider.value);
                } else {
                    $scope.$applyAsync(() => {
                        $scope.startLoading("Preparing data for step " + $scope.slider.value + ", please wait ...");
                        setTimeout(() => {
                            setKeyframe($scope.slider.value);
                            $scope.$applyAsync(function () {
                                $scope.stopLoading()
                            });
                        }, 50)
                    });
                }
            }
        }
    };

    $scope.pointSlider = {
        value: 0,
        options: {
            floor: -1.0,
            ceil: 1.0,
            step: 0.01,
            precision: 1,
            onChange: sliderId => VisualizationService.setPointAttenuationFactor($scope.pointSlider.value)
        }
    };

    $scope.pointScaleSlider = {
        value: 1.0,
        options: {
            floor: 0.0,
            ceil: 3.0,
            step: 0.01,
            precision: 1,
            onChange: sliderId => VisualizationService.setPointScale($scope.pointScaleSlider.value)
        }
    };

    $scope.opacitySlider = {
        value: $scope.visParams.meshOpacity,
        options: {
            floor: 0.0,
            ceil: 1.0,
            step: 0.01,
            precision: 1,
            onChange: sliderId => materials.forEach(mat => mat.opacity = $scope.opacitySlider.value)
        }
    };

    $scope.lineWidthSlider = {
        value: 1.0,
        options: {
            floor: 0.5,
            ceil: 6.0,
            step: 0.01,
            precision: 1,
            onChange: sliderId => {
                if (linesMesh !== null) linesMesh.material.linewidth = $scope.lineWidthSlider.value;
                streamlinesMeshesIn.forEach(mesh => mesh.material.linewidth = $scope.lineWidthSlider.value);
                streamlinesMeshesOut.forEach(mesh => mesh.material.linewidth = $scope.lineWidthSlider.value);
            }
        }
    };

    //
    // endregion
    //

    //
    // region Lifecycle
    //

    /**
     * Respond to app controller messages
     */
    $scope.$on("renderer", function (event, msg) {
        if (msg.type === "objFiles") {
            loadObjFiles(msg, true, msg.resetCamera, () => addModelMeshes());
            useFaceHighlighting = true; // enable face highlighting d
        } else if (msg.type === "fetchResults") {
            removeModelMeshes();
            $scope.fetchData();
            msg.callback();
        } else if (msg.type === "changeCap") {
            let capObject = capObjMapping[$scope.sharedParams.hlCapIdx];
            moveCameraToCap(capObject)
        } else if (msg.type === "results") {
            loadObjFiles(msg, false, true, function () {
                FileService.getCompressedData(msg.resDirPath, function (newPositions, newFaceIds, newPressures, newVelocities, newWss, newTractions, newDerivatives) {
                    parseCompressedData(newPositions, newFaceIds, newPressures, newVelocities, newWss, newTractions, newDerivatives);
                    msg.callback();
                })
            });
        }
    });

    $scope.resizeCanvas = function (width, height) {
        $scope.width = width;
        $scope.height = height;
        camera.aspect = $scope.width / $scope.height;
        cameraOrtho.left = - width / 2;
        cameraOrtho.right = width / 2;
        cameraOrtho.top = height / 2;
        cameraOrtho.bottom = - height / 2;

        let legendWidth = width * legendWidthRatio;
        let legendHeight = width * legendHeightRatio;
        legend.scale.set(legendWidth, legendHeight, 1);
        legend.position.set(width * 0.5 - legendWidth * 0.5 - width * legendHMarginRatio,
            -height * 0.5 + legendHeight * 0.5 + height * legendVMarginRatio + 50, 1);

        cameraOrtho.updateProjectionMatrix();
        camera.updateProjectionMatrix();
        renderer.setSize( $scope.width, $scope.height );
    };

    $scope.init = function (canvas) {
        raycaster = new THREE.Raycaster();

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

        cameraOrtho = new THREE.OrthographicCamera(-window.innerWidth / 2, window.innerWidth / 2, window.innerHeight / 2, - window.innerHeight / 2, 1, 10);
        cameraOrtho.position.z = 4;

        let camDist = 3;
        camera.position.set(camDist, camDist, camDist);

        scene = new THREE.Scene();
        sceneOrtho = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.0008);
        scene.background = new THREE.Color(0x000000);
        // sceneOrtho.background = new THREE.Color(0xffffff00);

        renderer = new THREE.WebGLRenderer();
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( $scope.width, $scope.height );
        renderer.autoClear = false;
        canvas.appendChild( renderer.domElement );

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.addEventListener('change', render); // remove when using animation loop
        controls.enableDamping = true; // enable animation loop when using damping or autorotation
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;

        /* Determine the (relative) mouse position */
        container = renderer.domElement;
        let pos = {}, offset = {}, ref;
        document.addEventListener('mousemove', function (e) {
            e.preventDefault();

            ref = container.offsetParent;
            pos.x = !! e.touches ? e.touches[ 0 ].pageX : e.pageX;
            pos.y = !! e.touches ? e.touches[ 0 ].pageY : e.pageY;
            offset.left = container.offsetLeft;
            offset.top = container.offsetTop;

            while (ref) {
                offset.left += ref.offsetLeft;
                offset.top += ref.offsetTop;
                ref = ref.offsetParent;
            }

            mousePos.x = ((pos.x - offset.left) / (container.width / window.devicePixelRatio)) * 2 - 1;
            mousePos.y = - ((pos.y - offset.top) / (container.height / window.devicePixelRatio)) * 2 + 1;
        }, false);

        document.addEventListener("mousedown", () => isMouseDragging = true);
        document.addEventListener("mouseup", () => isMouseDragging = false);

        // lights
        let ambientLight = new THREE.AmbientLight( 0x444444 );
        scene.add(ambientLight);
        let directionalLight = new THREE.DirectionalLight( 0xffeedd );
        directionalLight.position.set(0, 0, 1).normalize();
        scene.add(directionalLight);

        animate();
    };

    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true
        render();
    }

    function render() {
        if (useFaceHighlighting && !isMouseDragging && lastHLMousePos.x !== mousePos.x && lastHLMousePos.y !== mousePos.y) {
            highlightFaces();
            lastHLMousePos.x = mousePos.x;
            lastHLMousePos.y = mousePos.y;
        }
        renderer.render(scene, camera);
        renderer.render(sceneOrtho, cameraOrtho);
    }

    //
    // endregion
    //

    //
    // region Functionality
    //

    function loadObjFiles(data, addCapTexts, centerCamera, callback) {
        let files = data["files"];
        let modelsPath = data["modelsPath"];
        resetData();
        FileService.getObjFiles(modelsPath, files, $scope.capMapping, function (mapping) {
            for (let i = 0; i < mapping.length; i++) {
                let child = mapping[i].object;
                let name = mapping[i].name;
                let capIdx = mapping[i].capIdx;
                let isCap = capIdx > 0;
                let material;
                if (isCap) {
                    material = createCapMaterial();
                } else {
                    material = wallsMaterial
                }
                materials.push(material);
                let object = new THREE.Mesh(child.geometry, material);

                objectsMapping[object.uuid] = {name: name, obj: object};
                modelMeshes.push(object);
                if (isCap) {
                    if (addCapTexts) VisUtils.createCapText("Cap " + capIdx, object, 0.5, obj => scene.add(obj));
                    capObjMapping[capIdx] = object;
                    let radius = $scope.capInfo[capIdx-1].radius;
                    let pts = VisUtils.samplePoints(object, radius * 0.7, streamlinePtsPerCap);
                    streamlineStartPts.push({pts: pts, capIdx: capIdx})
                } else if (centerCamera) {
                    let center = VisUtils.getCenter(child);
                    let [sx, sy, sz] = VisUtils.multiply(VisUtils.getSize(child), 0.6);
                    camera.position.set(center[0] + Math.max(10, sx), center[1] + sy, center[2] + sz);
                    controls.target.set(center[0], center[1], center[2]);
                }
            }
            if (callback !== null) callback();
        });
    }

    function moveCameraToCap(capObj) {
        // capObj.geometry.computeBoundingSphere();
        let center = VisUtils.getCenter(capObj);
        let normal = VisUtils.getNormal(capObj);

        let factor = 4.3; // TODO: check if this is OK
        camera.position.x = center[0] + normal[0] * factor;
        camera.position.y = center[1] + normal[1] * factor;
        camera.position.z = center[2] + normal[2] * factor;

        controls.target.set(center[0], center[1], center[2]);
    }

    function highlightFaces() {
        raycaster.setFromCamera(mousePos, camera);
        let intersects = raycaster.intersectObjects(scene.children);
        if (intersects.length > 0) {
            if (INTERSECTED !== intersects[0].object) {
                if (INTERSECTED && objectsMapping[INTERSECTED.uuid] !== undefined) INTERSECTED.material.color = INTERSECTED.currentColor;
                INTERSECTED = intersects[0].object;
                // update the selected cap index
                let object = objectsMapping[INTERSECTED.uuid];
                if (object !== undefined) {
                    let objectName = object.name.slice(0, -4);
                    let capIdx = 0;
                    if (objectName.indexOf("cap") !== -1) {
                        capIdx = parseInt(objectName.replace("cap", ""))
                    }
                    // update the scope variable
                    $scope.sharedParams.hlCapIdx = capIdx;
                    $scope.$apply();

                    INTERSECTED.currentColor = INTERSECTED.material.color;
                    INTERSECTED.material.color = highlightColor;
                }
            }
        } else {
            if (INTERSECTED && objectsMapping[INTERSECTED.uuid] !== undefined) {
                INTERSECTED.material.color = INTERSECTED.currentColor;
                $scope.sharedParams.hlCapIdx = -1;
                $scope.$apply();
            }
            INTERSECTED = null;
        }
    }

    $scope.fetchData = () => FileService.getCompressedData("", function (newPositions, newFaceIds, newPressures, newVelocities, newWss, newTractions, newDerivatives) {
            parseCompressedData(newPositions, newFaceIds, newPressures, newVelocities, newWss, newTractions, newDerivatives);
        });

    function parseCompressedData(newPositions, newFaceIds, newPressures, newVelocities, newWss, newTractions, newDerivatives) {
        surfaceMesh = VisualizationService.createMesh(newPositions, newFaceIds);

        DecoderService.initialize(newPositions);
        let decPressures = DecoderService.decode(newPressures);
        let decVelocities = DecoderService.decode(newVelocities);
        let decWss = DecoderService.decode(newWss);
        let decTractions = DecoderService.decode(newTractions);
        let decDerivatives = DecoderService.decode(newDerivatives);
        [pressuresRatios, pressureMinMaxes] = VisUtils.convertToRatios(decPressures);
        [velocitiesRatios, velocityMinMaxes] = VisUtils.convertVectorsToRatios(decVelocities);
        [shearStressesRatios, stressesMinMaxes] = VisUtils.convertVectorsToRatios(decWss);
        [tractionsRatios, tractionsMinMaxes] = VisUtils.convertVectorsToRatios(decTractions);
        [derivativesRatios, derivativesMinMaxes] = VisUtils.convertVectorsToRatios(decDerivatives);

        // re-structure the positions
        let pos = new Array(newPositions.length / 3);
        for (let i = 0; i < pos.length; i++) {
            pos[i] = [newPositions[i * 3], newPositions[i * 3 + 1], newPositions[i * 3 + 2]];
        }

        positions = pos;
        pressures = decPressures;
        velocities = VisUtils.restructure(decVelocities);
        derivatives = VisUtils.restructure(decDerivatives);
        stresses = VisUtils.restructure(decWss);
        tractions = VisUtils.restructure(decTractions);

        useFaceHighlighting = false; // disable the face highlighting
        // reset the highlighted material
        resetHighlights();
        $scope.visParams.isShowingResults = true;
        $scope.visParams.showMesh = false; // hide the mesh by default
        $scope.slider.options.ceil = velocities.length - 1;

        setKeyframe(0);
    }

    function resetHighlights() {
        if (INTERSECTED) {
            INTERSECTED.material.color = INTERSECTED.currentColor;
        }
        INTERSECTED = null;
    }

    function setKeyframe(idx) {
        // points mesh
        if (pointsMesh === null) {
            pointsMesh = VisualizationService.createPoints(positions);
        }
        // velocity magnitudes and vectors
        if (velocityVectorsArray[idx] === undefined) {
            velocityVectorsArray[idx] = VisualizationService.createVelocityLines(positions, velocities[idx]);
            velocityVectorsArray[idx].updateMatrix();
            velocityMagnitudes[idx] = VisUtils.getMagnitudes(velocities[idx]);
        }
        // time-derivative vectors
        if (derivativesVectorsArray[idx] === undefined && idx > 0) {
            derivativesVectorsArray[idx] = VisualizationService.createVelocityLines(positions, derivatives[idx-1]);
            derivativesVectorsArray[idx].updateMatrix();
            derivativesMagnitudes[idx] = VisUtils.getMagnitudes(derivatives[idx-1]);
        }
        // wall shear stresses
        if (stressesMagnitudes[idx] === undefined && idx > 0) {
            stressesMagnitudes[idx] = VisUtils.getMagnitudes(stresses[idx-1])
        }
        // tractions
        if (tractionsMagnitudes[idx] === undefined && idx > 0) {
            tractionsMagnitudes[idx] = VisUtils.getMagnitudes(tractions[idx-1])
        }

        // streamlines
        if (streamlinesArrayIn[idx] === undefined || streamlinesArrayOut[idx] === undefined) {
            let startPtsIn = [];
            let startPtsOut = [];
            for (let i = 0; i < streamlineStartPts.length; i++) {
                let isInlet = $scope.capInfo[streamlineStartPts[i].capIdx - 1].isInlet;
                if (isInlet) {
                    startPtsIn.push(...streamlineStartPts[i].pts)
                } else {
                    startPtsOut.push(...streamlineStartPts[i].pts)
                }
            }
            let maxDistance = 0.05; // $scope.edgesize;

            if (streamlinesArrayIn[idx] === undefined) {
                streamlinesArrayIn[idx] = VisualizationService.createStreamlines(startPtsIn, positions, velocities[idx], maxDistance, false)
            }
            if (streamlinesArrayOut[idx] === undefined) {
                streamlinesArrayOut[idx] = VisualizationService.createStreamlines(startPtsOut, positions, velocities[idx], maxDistance, true)
            }
        }
        stepDataCalculated[idx] = true; // mark that the data for this step is done
        currentFrame = idx;
        $scope.$broadcast('reCalcViewDimensions');
        $scope.updateVisibility();
    }

    $scope.updateVisibility = function() {
        // the legend data (tick value texts)
        let legendTexts = [];
        if (pointsMesh !== null) {
            scene.remove(pointsMesh);
        }
        // model meshes
        removeModelMeshes();
        if ($scope.visParams.showMesh) {
            addModelMeshes();
        }
        // velocity vectors
        if (linesMesh !== null) {
            scene.remove(linesMesh); // remove previous velocity lines mesh
        }
        // surface mesh
        scene.remove(surfaceMesh);

        if ($scope.visParams.showPressures) {
            legendTexts = VisualizationService.createLegendData(pressureMinMaxes[currentFrame], legendTicks);
            if ($scope.visParams.pressureDispType === "magnitude") {
                VisualizationService.setScalarValues(pointsMesh, pressures[currentFrame]);
                scene.add(pointsMesh);
            } else {
                VisualizationService.colorMeshVertices(surfaceMesh, pressuresRatios[currentFrame]);
                scene.add(surfaceMesh)
            }
        } else if ($scope.visParams.showVelocities) {
            legendTexts = VisualizationService.createLegendData(velocityMinMaxes[currentFrame], legendTicks);
            if ($scope.visParams.velocityDispType === "magnitude") {
                VisualizationService.setScalarValues(pointsMesh, velocityMagnitudes[currentFrame]);
                scene.add(pointsMesh);
            } else if ($scope.visParams.velocityDispType === "vector") {
                linesMesh = velocityVectorsArray[currentFrame];
                scene.add(linesMesh);
            } else {
                VisualizationService.colorMeshVertices(surfaceMesh, velocitiesRatios[currentFrame]);
                scene.add(surfaceMesh);
            }
        } else if ($scope.visParams.showDerivatives && currentFrame > 0) {
            legendTexts = VisualizationService.createLegendData(derivativesMinMaxes[currentFrame-1], legendTicks);
            if ($scope.visParams.derivativeDispType === "magnitude") {
                VisualizationService.setScalarValues(pointsMesh, derivativesMagnitudes[currentFrame]);
                scene.add(pointsMesh);
            } else if ($scope.visParams.derivativeDispType === "vector") {
                linesMesh = derivativesVectorsArray[currentFrame];
                scene.add(linesMesh);
            } else {
                VisualizationService.colorMeshVertices(surfaceMesh, derivativesRatios[currentFrame-1]);
                scene.add(surfaceMesh);
            }
        } else if ($scope.visParams.showStresses && currentFrame > 0) {
            legendTexts = VisualizationService.createLegendData(stressesMinMaxes[currentFrame-1], legendTicks);
            if ($scope.visParams.stressDispType === "magnitude") {
                VisualizationService.setScalarValues(pointsMesh, stressesMagnitudes[currentFrame]);
                scene.add(pointsMesh);
            } else {
                VisualizationService.colorMeshVertices(surfaceMesh, shearStressesRatios[currentFrame-1]);
                scene.add(surfaceMesh)
            }
        } else if ($scope.visParams.showTractions && currentFrame > 0) {
            legendTexts = VisualizationService.createLegendData(tractionsMinMaxes[currentFrame-1], legendTicks);
            if ($scope.visParams.tractionDispType === "magnitude") {
                VisualizationService.setScalarValues(pointsMesh, tractionsMagnitudes[currentFrame]);
                scene.add(pointsMesh);
            } else {
                VisualizationService.colorMeshVertices(surfaceMesh, tractionsRatios[currentFrame-1]);
                scene.add(surfaceMesh)
            }
        }
        // streamlines
        VisUtils.removeFromScene(streamlinesMeshesIn, scene); // remove previous streamline meshes
        VisUtils.removeFromScene(streamlinesMeshesOut, scene); // remove previous streamline meshes
        if ($scope.visParams.showStreamlinesIn) {
            if (legendTexts.length === 0) legendTexts = VisualizationService.createLegendData(velocityMinMaxes[currentFrame], legendTicks);
            streamlinesMeshesIn = streamlinesArrayIn[currentFrame];
            VisUtils.addToScene(streamlinesMeshesIn, scene)
        } else {
            streamlinesMeshesIn = [];
        }
        if ($scope.visParams.showStreamlinesOut) {
            if (legendTexts.length === 0) legendTexts = VisualizationService.createLegendData(velocityMinMaxes[currentFrame], legendTicks);
            streamlinesMeshesOut = streamlinesArrayOut[currentFrame];
            VisUtils.addToScene(streamlinesMeshesOut, scene)
        } else {
            streamlinesMeshesOut = [];
        }
        // setup the legend
        sceneOrtho.remove(legend);
        VisualizationService.setupLegend(legend, legendTexts);
        sceneOrtho.add(legend);
    };

    //
    // endregion
    //

    //
    // region Utilities
    //

    let createCapMaterial = () => new THREE.MeshPhongMaterial({
        color: 0xffffff,
        wireframe: false,
        transparent: true,
        opacity: $scope.visParams.meshOpacity
    });

    let addModelMeshes = () => {
        VisUtils.addToScene(modelMeshes, scene);
        resetHighlights();
    };

    let removeModelMeshes = () => VisUtils.removeAllMeshes(scene);

    function removeSimResults() {
        sceneOrtho.remove(legend);
        if (pointsMesh !== null) scene.remove(pointsMesh);
        if (linesMesh !== null) scene.remove(linesMesh);
        if (surfaceMesh !== null) scene.remove(surfaceMesh);
        VisUtils.removeFromScene(streamlinesMeshesIn, scene);
        VisUtils.removeFromScene(streamlinesMeshesOut, scene);
    }

    function resetData() {
        // clear the scene
        removeModelMeshes();
        $scope.slider.options.ceil = 0; // hide the slider
        $scope.visParams.isShowingResults = false;
        currentFrame = 0;
        modelMeshes = [];
        removeSimResults();
        materials = [];
        VisualizationService.resetKDTree();

        positions = null;
        pressures = null;
        velocities = null;
        derivatives = null;
        stresses = null;
        tractions = null;
        pressuresRatios = null;
        shearStressesRatios = null;
        tractionsRatios = null;
        derivativesRatios = null;
        velocitiesRatios = null;
        pressureMinMaxes = null;
        velocityMinMaxes = null;
        stressesMinMaxes = null;
        derivativesMinMaxes = null;
        tractionsMinMaxes = null;
        velocityMagnitudes = [];
        derivativesMagnitudes = [];
        tractionsMagnitudes = [];
        stressesMagnitudes = [];
        stepDataCalculated = [];
        streamlineStartPts = [];
        pointsMesh = null;
        linesMesh = null;
        surfaceMesh = null;
        modelMeshes = [];
        velocityVectorsArray = [];
        derivativesVectorsArray = [];
        streamlinesMeshesIn = []; // the currently displayed set of inlet streamlines
        streamlinesMeshesOut = []; // the currently displayed set of outlet streamlines
        streamlinesArrayIn = []; // the array of all sets of inlet streamlines
        streamlinesArrayOut = []; // the array of all sets of outlet streamlines
        objectsMapping = {};
        capObjMapping = {};
    }

    //
    // endregion
    //

    //
    // region Visualization toggles
    //

    function resetVisibilities() {
        $scope.visParams.showPressures = false;
        $scope.visParams.showVelocities = false;
        $scope.visParams.showDerivatives = false;
        $scope.visParams.showStresses = false;
        $scope.visParams.showTractions = false;
    }

    $scope.togglePressures = function () {
        if (!$scope.visParams.showPressures) resetVisibilities();
        $scope.visParams.showPressures = !$scope.visParams.showPressures;
        $scope.updateVisibility()
    };

    $scope.toggleVelocities = function () {
        if (!$scope.visParams.showVelocities) resetVisibilities();
        $scope.visParams.showVelocities = !$scope.visParams.showVelocities;
        // if ($scope.visParams.showVelocities) $scope.visParams.showPressures = false;
        $scope.updateVisibility()
    };

    $scope.toggleDerivatives = function () {
        if (!$scope.visParams.showDerivatives) resetVisibilities();
        $scope.visParams.showDerivatives = !$scope.visParams.showDerivatives;
        // if ($scope.visParams.showVelocities) $scope.visParams.showPressures = false;
        $scope.updateVisibility()
    };

    $scope.toggleStresses = function () {
        if (!$scope.visParams.showStresses) resetVisibilities();
        $scope.visParams.showStresses = !$scope.visParams.showStresses;
        // if ($scope.visParams.showVelocities) $scope.visParams.showPressures = false;
        $scope.updateVisibility()
    };

    $scope.toggleTractions = function () {
        if (!$scope.visParams.showTractions) resetVisibilities();
        $scope.visParams.showTractions = !$scope.visParams.showTractions;
        // if ($scope.visParams.showVelocities) $scope.visParams.showPressures = false;
        $scope.updateVisibility()
    };

    $scope.toggleStreamlinesIn = function () {
        $scope.visParams.showStreamlinesIn = !$scope.visParams.showStreamlinesIn;
        $scope.updateVisibility()
    };

    $scope.toggleStreamlinesOut = function () {
        $scope.visParams.showStreamlinesOut = !$scope.visParams.showStreamlinesOut;
        $scope.updateVisibility()
    };

    $scope.toggleMesh = function () {
        $scope.visParams.showMesh = !$scope.visParams.showMesh;
        $scope.updateVisibility()
    };

    //
    // endregion
    //
};

app.controller('RenderingController', renderingController);