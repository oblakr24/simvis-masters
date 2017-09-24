/**
 * Created by rokoblak on 7/15/17.
 */

app.service("VisualizationService", ['VisUtils', function (VisUtils) {

    this.kdTree = null; // cached K-D tree
    this.indices = null;

    this.createLegendData = function (minMax, numOfTicks) {
        let [min, max] = minMax;
        let texts = new Array(numOfTicks);
        let val = max;
        let diff = (max - min) / (numOfTicks - 1);
        for (let i = 0; i < numOfTicks; i++) {
            texts[i] = val.toFixed(4);
            val -= diff;
        }
        return texts;
    };

    this.setupLegend = function (sprite, texts) {
        let vPadding = 30;

        let canvas = document.createElement( 'canvas' );
        canvas.width = 256;
        canvas.height = 512;
        let context = canvas.getContext( '2d' );

        let gradient=context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "red");
        gradient.addColorStop(1, "blue");

        let gradientWidth = canvas.width / 8;

        context.fillStyle = gradient;
        context.fillRect(0, vPadding, gradientWidth, canvas.height - vPadding );

        let tickHeight = 3;

        let x = gradientWidth / 2;
        let y = vPadding;
        let tickHDiff = (canvas.height - vPadding - tickHeight) / (texts.length - 1);
        // draw the texts
        context.font = "36px Helvetica";
        context.fillStyle = "white";
        context.textAlign = "left";
        context.strokeStyle = "white";
        context.lineWidth = tickHeight;
        let tickWidth = 30;
        let hPadding = 15;
        for (let i = 0; i < texts.length; i++) {
            context.fillText(texts[i], x + tickWidth + hPadding, y);
            context.beginPath();
            context.lineTo(x, y + tickHeight/2);
            context.lineTo(x + tickWidth, y + tickHeight/2);
            context.stroke();
            y += tickHDiff;
        }

        // return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.material.map = new THREE.CanvasTexture(canvas);
        sprite.material.needsUpdate = true;
    };

    this.createMesh = function (positions, faceIds) {
        let geom = new THREE.Geometry();
        for (let i = 0; i < positions.length / 3; i++) {
            geom.vertices.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
        }

        let v1Idx, v2Idx, v3Idx;
        for (let i = 0; i < faceIds.length / 3; i++) {
            v1Idx = faceIds[3 * i];
            v2Idx = faceIds[3 * i + 1];
            v3Idx = faceIds[3 * i + 2];
            let face = new THREE.Face3(v1Idx, v2Idx, v3Idx);
            face.vertexColors[0] = new THREE.Color(1, 1, 1);
            face.vertexColors[1] = new THREE.Color(1, 1, 1);
            face.vertexColors[2] = new THREE.Color(1, 1, 1);
            geom.faces.push(face);
        }

        let material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            vertexColors: THREE.VertexColors,
            side: THREE.DoubleSide
        });

        return new THREE.Mesh(geom, material);
    };

    this.colorMeshVertices = function (mesh, magnitudes) {
        for (let i = 0; i < mesh.geometry.faces.length; i++) {
            let face = mesh.geometry.faces[i];
            let r1 = magnitudes[face.a];
            let r2 = magnitudes[face.b];
            let r3 = magnitudes[face.c];
            face.vertexColors[0].setRGB(r1, 0, 1 - r1);
            face.vertexColors[1].setRGB(r2, 0, 1 - r2);
            face.vertexColors[2].setRGB(r3, 0, 1 - r3);
        }
        mesh.geometry.colorsNeedUpdate = true;
    };

    this.resetKDTree = () => this.kdTree = null;

    this.createStreamlines = function (startingPositions, vpositions, velocities, maxDistance, reverse) {

        let [vmin, vmax] = VisUtils.getMinMaxV(velocities);

        if (vmax - vmin < 0.0001) {
            return []
        }

        if (this.kdTree === null) {
            let positions = new Float32Array( vpositions.length * 3 );
            for ( let i = 0; i < vpositions.length; i ++ ) {
                positions[i * 3] = vpositions[i][0];
                positions[i * 3 + 1] = vpositions[i][1];
                positions[i * 3 + 2] = vpositions[i][2];
            }

            this.indices = new Int32Array(vpositions.length);
            for (let i = 0; i < this.indices.length; i ++) {
                this.indices[i] = i;
            }
            this.kdTree = new THREE.TypedArrayUtils.Kdtree(positions, this.indices, VisUtils.distanceFunction, 3);
        }

        // let maxDistance = 0.015;
        let valThr = (vmax - vmin) * 0.01;
        let n = 2000;
        let h = 0.0015 * 0.30 * 25;
        if (reverse) h *= -1;

        let colors = new Array(n * 2);

        let streamlines = new Array(startingPositions.length);

        for (let s = 0; s < startingPositions.length; s ++) {

            let pos = startingPositions[s];
            let px = pos[0];
            let py = pos[1];
            let pz = pos[2];

            let geometry = new THREE.Geometry();

            let stop = false;
            let stopIdx = 0;
            for (let i = 0; i < n && !stop; i++) {

                let dir = VisUtils.calcVectorAt(this.kdTree, this.indices, velocities, [px, py, pz], 5, maxDistance, valThr);
                if (dir === null) {
                    stop = true;
                    stopIdx = i;
                    continue;
                }
                geometry.vertices.push(new THREE.Vector3().fromArray([px, py, pz]));

                let ratio = (VisUtils.getMagnitude(dir) - vmin) / (vmax - vmin);
                let color = new THREE.Color(ratio, 0, 1 - ratio);
                // normalize the direction
                dir = VisUtils.normalized(dir);
                colors[2 * i] = color;
                colors[2 * i + 1] = color;

                px += dir[0] * h;
                py += dir[1] * h;
                pz += dir[2] * h;

                geometry.vertices.push(new THREE.Vector3().fromArray([px, py, pz]));
            }
            if (!stop && stopIdx === 0) stopIdx = n;
            geometry.colors = colors.slice(0, stopIdx * 2);
            let material = new THREE.LineBasicMaterial({
                color: 0xffffff,
                vertexColors: THREE.VertexColors,
                linewidth: 2
            });

            let streamline = new THREE.LineSegments(geometry, material);

            streamline.updateMatrix();
            streamlines[s] = streamline;
        }
        return streamlines
    };

    this.createVelocityLines = function(positions, velocities) {
        let geometry = createVelocityVectors(positions, velocities);
        let material = new THREE.LineBasicMaterial( {
            color: 0xffffff,
            vertexColors: THREE.VertexColors,
            linewidth: 1.0
        } );
        let lines = new THREE.LineSegments( geometry, material );
        lines.updateMatrix();
        return lines
    };

    function createVelocityVectors(positions, velocities) {
        let geometry = new THREE.Geometry();
        let magnitudes = new Array(positions.length);
        let magMin = Number.MAX_VALUE;
        let magMax = Number.MIN_VALUE;

        let colors = [];

        let maxLen = 0.1;
        let scaleFactor = 0.0010;

        for (let i = 0; i < positions.length; i ++ ) {
            let pos = positions[i];

            let vertex1 = new THREE.Vector3();
            vertex1.x = pos[0];
            vertex1.y = pos[1];
            vertex1.z = pos[2];

            let dir = VisUtils.multiplyAndClip(velocities[i], scaleFactor, maxLen);

            let vertex2 = new THREE.Vector3();
            vertex2.x = pos[0] + dir[0];
            vertex2.y = pos[1] + dir[1];
            vertex2.z = pos[2] + dir[2];

            magnitudes[i] = VisUtils.getMagnitude(velocities[i]);

            if (magnitudes[i] > magMax) magMax = magnitudes[i];
            if (magnitudes[i] < magMin) magMin = magnitudes[i];

            geometry.vertices.push( vertex1 );
            geometry.vertices.push( vertex2 );
        }

        let ratio = 0;
        let magDiff = magMax - magMin;
        for ( let i = 0; i < positions.length; i+=1 ) {
            if (magDiff === 0) {
                ratio = 0;
            } else {
                ratio = (magnitudes[i] - magMin) / magDiff;
            }
            colors[ i * 2 ] = new THREE.Color( ratio, 0, 1 - ratio );
            colors[ i * 2 + 1 ] = colors[ i * 2 ];
        }

        geometry.colors = colors;
        geometry.colorsNeedUpdate = true;

        return geometry;
    }

    let constScaleFactor = 0.08;

    this.setScalarValues = function (points, scalars) {
        let [min, max] = VisUtils.getMinMax(scalars);
        let diff = max - min;

        let magsArray = new Float32Array(scalars.length);
        for (let i = 0; i < scalars.length; i ++) {
            if (scalars === null) {
                magsArray[i] = constScaleFactor
            } else {
                let clippedVal = scalars[i];
                let ratio = ((clippedVal - min) / diff);
                if (diff === 0) ratio = 0;
                magsArray[i] = ratio * constScaleFactor;
            }
        }

        points.geometry.removeAttribute("magnitude");
        points.geometry.addAttribute("magnitude", new THREE.InstancedBufferAttribute( magsArray, 1, 1 ) );
    };

    let vShader =
        "precision highp float;\n" +
        "uniform mat4 modelViewMatrix;\n" +
        "uniform mat4 projectionMatrix;\n" +
        "uniform float posRatio;\n" +
        "uniform float negRatio;\n" +
        "uniform float neutRatio;\n" +
        "uniform float scaleFactor;\n" +
        "uniform float scale;\n" +
        "attribute vec3 position;\n" +
        "attribute vec2 uv;\n" +
        "attribute vec3 translate;\n" +
        "attribute float magnitude;\n" +
        "varying vec2 vUv;\n" +
        "varying float vScale;\n" +
        "void main() {\n" +
        "   vec4 mvPosition = modelViewMatrix * vec4( translate, 1.0 );\n"+
        "   vScale = magnitude;\n"+
        "   float scalef = clamp(magnitude / scaleFactor, 0.3, 1.0) * scale;\n"+
        "   mvPosition.xyz += position * scaleFactor * (neutRatio * scalef + negRatio * scalef * scalef + posRatio * sqrt(scalef));\n"+
        "   vUv = uv;\n"+
        "   gl_Position = projectionMatrix * mvPosition;\n"+
        "}\n";

    let fShader =
        "precision highp float;\n"+
        "uniform sampler2D map;\n"+
        "uniform float scaleFactor;\n" +
        "varying vec2 vUv;\n"+
        "varying float vScale;\n"+
        "void main() {\n"+
        "    float scale = clamp(vScale / scaleFactor, 0.01, 0.99);\n"+
        "    vec4 diffuseColor = texture2D( map, vUv );\n"+
        "    gl_FragColor = vec4( diffuseColor.xyz * vec3(scale, 0.0, 1.0 - scale), diffuseColor.w );\n"+
        "    if ( diffuseColor.w < 0.5 ) discard;\n"+
        "}\n";

    let shaderMaterial = new THREE.RawShaderMaterial( {
        uniforms: {
            map: { value: new THREE.TextureLoader().load( "circle.png" ) },
            posRatio: { value: 0.0 },
            negRatio: { value: 0.0 },
            neutRatio: { value: 1.0 },
            scaleFactor: { value: constScaleFactor },
            scale: { value: 1.0 }
        },
        vertexShader: vShader,
        fragmentShader: fShader,
        depthTest: true,
        depthWrite: true
    } );

    this.setPointAttenuationFactor = function (factor) {
        if (factor > 0) {
            shaderMaterial.uniforms.neutRatio.value = 1.0 - factor;
            shaderMaterial.uniforms.posRatio.value = factor;
            shaderMaterial.uniforms.negRatio.value = 0.0;
        } else {
            shaderMaterial.uniforms.neutRatio.value = 1.0 + factor;
            shaderMaterial.uniforms.negRatio.value = -factor;
            shaderMaterial.uniforms.posRatio.value = 0.0;
        }
        shaderMaterial.uniforms.posRatio.needsUpdate = true;
        shaderMaterial.uniforms.posRatio.needsUpdate = true;
        shaderMaterial.uniforms.neutRatio.needsUpdate = true;
    };

    this.setPointScale = function (scale) {
        shaderMaterial.uniforms.scale.value = scale;
        shaderMaterial.uniforms.scale.value = scale;
        shaderMaterial.uniforms.scale.needsUpdate = true;
    };

    this.createPoints = function (positions) {
        let geometry = new THREE.InstancedBufferGeometry();
        geometry.copy( new THREE.CircleBufferGeometry( 1, 6 ) );
        let particleCount = positions.length;
        let translateArray = new Float32Array( particleCount * 3 );
        for ( let i = 0, i3 = 0, l = particleCount; i < l; i ++, i3 += 3 ) {
            translateArray[ i3 ] = positions[i][0];
            translateArray[ i3 + 1 ] = positions[i][1];
            translateArray[ i3 + 2 ] = positions[i][2];
        }

        let magsArray = new Float32Array(particleCount);
        for (let i = 0; i < particleCount; i ++) {
            magsArray[i] = constScaleFactor
        }
        geometry.addAttribute("magnitude", new THREE.InstancedBufferAttribute( magsArray, 1, 1 ) );
        geometry.addAttribute("translate", new THREE.InstancedBufferAttribute( translateArray, 3, 1 ) );
        let pts =  new THREE.Mesh(geometry, shaderMaterial);
        pts.frustumCulled = false; // this prevents the occasional flicker on certain camera angles, not sure why
        return pts;
    };


    this.createSlice = function(z, vpositions, scalars, startX, endX, startY, endY, resolution, scene) {

        // construct the K-D tree
        let positions = new Float32Array( vpositions.length * 3 );
        for ( let i = 0; i < vpositions.length; i ++ ) {
            positions[ i * 3 ] = vpositions[i][0];
            positions[ i * 3 + 1 ] = vpositions[i][1];
            positions[ i * 3 + 2 ] = vpositions[i][2];
        }

        this.indices = new Int32Array(vpositions.length);
        for (let i = 0; i < this.indices.length; i ++) {
            this.indices[i] = i;
        }
        this.kdTree = new THREE.TypedArrayUtils.Kdtree(positions, this.indices, VisUtils.distanceFunction, 3);


        let maxDist = 0.02;

        let result = new Array(resolution);

        // sample the points
        let px = startX;
        let shift = (endX - startX) / resolution;
        for (let x = 0; x < resolution; x++) {

            let py = startY;
            let line = new Array(resolution);
            result[x] = line;

            for (let y = 0; y < resolution; y++) {
                let samplePoint = [px, py, z];
                let interpValue = VisUtils.calcPointAt(this.kdTree, this.indices, scalars, samplePoint, 20, maxDist);


                if (interpValue !== null) {
                    console.log(px + " " + py + " " + interpValue)

                    let s = VisUtils.createSphereAt([px, py, z], 0.06);
                    scene.add(s)
                }

                line[y] = [px, py, interpValue];


                py += shift;
            }

            px += shift;
        }

        return result
    };

}]);
