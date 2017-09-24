/**
 * Created by rokoblak on 7/30/17.
 */

app.service("VisUtils", [function () {

    //
    // region Utilities
    //

    this.addToScene = (objects, scene) => objects.forEach(object => scene.add(object));

    this.removeFromScene = function(objects, scene) {
        if (objects === undefined || objects === null) return;
        objects.forEach(object => scene.remove(object))
    };

    this.removeAllMeshes = function (scene) {
        scene.children.filter(child => child.type === "Mesh" && child.geometry.type === "BufferGeometry")
            .forEach(object => scene.remove(object));
    };

    this.restructure = function (data) {
        let array = new Array(data.length);
        for (let s = 0; s < array.length; s++) {
            let array_s = new Array(data[0][0].length);
            for (let i = 0; i < array_s.length; i++) {
                array_s[i] = [data[s][0][i], data[s][1][i], data[s][2][i]];
            }
            array[s] = array_s
        }
        return array;
    };

    //
    // endregion
    //

    //
    // region Maths
    //

    this.getMagnitudes = function(vectors) {
        let mags = new Float32Array(vectors.length);
        for (let i = 0; i < vectors.length; i++) {
            mags[i] = this.getMagnitude(vectors[i]);
        }
        return mags;
    };

    this.getMagnitude = vector => Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);

    this.getMinMax = function(scalars) {
        let min = Number.MAX_VALUE;
        let max = Number.MIN_VALUE;
        let val;
        for ( let i = 0; i < scalars.length; i ++ ) {
            val = scalars[i];

            if (val > max) max = val;
            if (val < min) min = val;
        }
        return [min, max];
    };

    this.getMinMaxV = function(vectors) {
        let magMin = Number.MAX_VALUE;
        let magMax = Number.MIN_VALUE;
        let mag;
        for ( let i = 0; i < vectors.length; i ++ ) {
            mag = this.getMagnitude(vectors[i]);

            if (mag > magMax) magMax = mag;
            if (mag < magMin) magMin = mag;
        }
        return [magMin, magMax];
    };

    this.distanceFunction = (a, b) => Math.pow(a[0] - b[0], 2) +  Math.pow(a[1] - b[1], 2) +  Math.pow(a[2] - b[2], 2);

    this.normalized = function (vector) {
        let mag = this.getMagnitude(vector);
        return [vector[0] / mag, vector[1] / mag, vector[2] / mag]
    };

    this.multiply = (vector, scalar) => [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];

    this.multiplyAndClip = function (vector, scalar, max) {
        let mag = this.getMagnitude(vector);
        if (mag * scalar > max) {
            scalar = max / mag;
        }
        return this.multiply(vector, scalar)
    };

    this.add = (vectorA, vectorB) =>[vectorA[0] + vectorB[0], vectorA[1] + vectorB[1], vectorA[2] + vectorB[2]];

    this.convertVectorsToRatios = function (vectors) {
        let mags = new Array(vectors.length);
        let minMaxes = new Array(vectors.length);
        let numOfPts = vectors[0][0].length;
        for (let s = 0; s < mags.length; s++) {
            let magMin = Number.MAX_VALUE;
            let magMax = Number.MIN_VALUE;

            let magsStep = new Array(numOfPts);
            for (let i = 0; i < numOfPts; i++) {
                magsStep[i] = this.getMagnitude([vectors[s][0][i], vectors[s][1][i], vectors[s][2][i]]);
                if (magsStep[i] < magMin) {
                    magMin = magsStep[i]
                }
                if (magsStep[i] > magMax) {
                    magMax = magsStep[i]
                }
            }

            let ratio = 0;
            let magDiff = magMax - magMin;
            for (let i = 0; i < numOfPts; i++) {
                if (magDiff === 0) {
                    ratio = 0;
                } else {
                    ratio = (magsStep[i] - magMin) / magDiff;
                }
                magsStep[i] = ratio;

            }
            mags[s] = magsStep;
            minMaxes[s] = [magMin, magMax]
        }
        return [mags, minMaxes];
    };

    this.convertToRatios = function (scalars) {
        let mags = new Array(scalars.length);
        let minMaxes = new Array(scalars.length);
        let numOfPts = scalars[0].length;
        for (let s = 0; s < mags.length; s++) {
            let magMin = Number.MAX_VALUE;
            let magMax = Number.MIN_VALUE;

            let magsStep = new Array(numOfPts);
            for (let i = 0; i < numOfPts; i++) {
                magsStep[i] = scalars[s][i];
                if (magsStep[i] < magMin) {
                    magMin = magsStep[i]
                }
                if (magsStep[i] > magMax) {
                    magMax = magsStep[i]
                }
            }

            let ratio = 0;
            let magDiff = magMax - magMin;
            for (let i = 0; i < numOfPts; i++) {
                if (magDiff === 0) {
                    ratio = 0;
                } else {
                    ratio = (magsStep[i] - magMin) / magDiff;
                }
                magsStep[i] = ratio;

            }
            mags[s] = magsStep;
            minMaxes[s] = [magMin, magMax]
        }
        return [mags, minMaxes];
    };

    //
    // endregion
    //

    //
    // region Geometric
    //

    this.calcVectorAt = function(kdtree, indices, vectors, position, num, maxDistance, valThr) {
        let neighbors = kdtree.nearest(position, num, maxDistance);
        if (neighbors.length <= num / 2) return null;
        // if (neighbors.length === 0) return null;

        let x = 0;
        let y = 0;
        let z = 0;
        let factorSum = 0;
        let validNeighbors = 0;
        for (let n = 0; n < neighbors.length; n ++) {
            let neighbor = neighbors[n][0];
            let dist = neighbors[n][1];
            let vec = vectors[indices[neighbor.pos]];
            if (dist === 0) {
                // return directly
                return vec
            } else {
                if (this.getMagnitude(vec) > valThr) {
                    // the vector's influence is inversely proportional to distance squared
                    let distFactor = 1 / (dist * dist);
                    x += distFactor * vec[0];
                    y += distFactor * vec[1];
                    z += distFactor * vec[2];
                    factorSum += distFactor;
                    validNeighbors++;
                }

            }
        }
        if (validNeighbors === 0) return null;
        return [x / factorSum, y / factorSum, z / factorSum]
    };

    this.calcPointAt = function(kdtree, indices, scalars, position, num, maxDistance) {
        let neighbors = kdtree.nearest(position, num, maxDistance);
        if (neighbors.length === 0) return null;

        let x = 0;
        let factorSum = 0;
        for (let n = 0; n < neighbors.length; n ++) {
            let neighbor = neighbors[n][0];
            let dist = neighbors[n][1];
            let scalar = scalars[indices[neighbor.pos]];
            if (dist === 0) {
                // return directly
                return scalar
            } else {
                // the vector's influence is inversely proportional to distance squared
                let distFactor = 1 / (dist * dist);
                x += distFactor * scalar;
                factorSum += distFactor;
            }
        }
        return x / factorSum
    };

    this.getCapNormalPoint = function(object, dist) {
        let startPos = this.getCenter(object);
        let normal = this.getNormal(object);
        return this.add(startPos, this.multiply(normal, dist));
    };

    /** Randomly sample points in a given radius on an object's surface */
    this.samplePoints = function(object, rad, total) {
        let startPos = this.getCenter(object);
        let normal = this.getNormal(object);
        let result = [];
        let radSq = rad * rad;
        let validSamples = 0;
        while (validSamples <= total) {
            let x = 2 * rad * Math.random() - rad;
            let y = 2 * rad * Math.random() - rad;
            if (x * x + y * y < radSq) {
                let xDir = this.multiply(this.normalized(this.perpVector(normal)), x);
                let yDir = this.rotateVector(this.multiply(this.normalized(this.perpVector(normal)), y), normal, Math.PI / 2);
                let point = this.add(startPos, this.add(xDir, yDir));
                validSamples++;
                result.push(point);
            }
        }

        return result;
    };

    /** Calculate a vector perpendicular to the given vector */
    this.perpVector = function (vector) {
        let a = vector[0];
        let b = vector[1];
        let c = vector[2];
        return  c<a  ? [b, -a, 0] : [0, -c, b];
    };

    this.rotateVector = function (vector, axis, angle) {
        let vec = new THREE.Vector3().fromArray(vector);
        vec.applyAxisAngle(new THREE.Vector3().fromArray(axis), angle);
        return [vec.x, vec.y, vec.z];
    };

    this.getNormal = function (object) {
        // TODO: do something more clever
        let normals = object.geometry.attributes.normal.array;
        return this.normalized([normals[0], normals[1], normals[2]]);
    };

    this.getCenter = function (mesh) {
        let middle = new THREE.Vector3();
        let geometry = mesh.geometry;
        geometry.computeBoundingBox();
        middle.x = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2;
        middle.y = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;
        middle.z = (geometry.boundingBox.max.z + geometry.boundingBox.min.z) / 2;
        mesh.localToWorld(middle);
        return [middle.x, middle.y, middle.z];
    };

    this.getSize = function (mesh) {
        let geometry = mesh.geometry;
        geometry.computeBoundingBox();
        return [geometry.boundingBox.max.x - geometry.boundingBox.min.x,
                geometry.boundingBox.max.y - geometry.boundingBox.min.y,
                geometry.boundingBox.max.z - geometry.boundingBox.min.z];
    };

    //
    // endregion
    //

    //
    // region Text sprites
    //

    let loader = new THREE.FontLoader();

    let textMaterial = new THREE.MeshBasicMaterial( {
        color: 0xff0000,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    } );

    this.createCapText = function(message, capObject, dist, callback) {
        let pos = this.getCapNormalPoint(capObject, dist);
        let posLonger = this.getCapNormalPoint(capObject, dist*2);
        let lookAtDir = new THREE.Vector3(posLonger[0], posLonger[1], posLonger[2]);
        loader.load( 'assets/fonts/helvetiker_regular.typeface.json', function ( font ) {
            let xMid, yMid, text;
            let textShape = new THREE.BufferGeometry();
            let shapes = font.generateShapes(message, 0.2, 2);
            let geometry = new THREE.ShapeGeometry(shapes);
            geometry.computeBoundingBox();
            xMid = - 0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
            yMid = - 0.5 * (geometry.boundingBox.max.y - geometry.boundingBox.min.y);
            geometry.translate(xMid, 0, 0);
            geometry.translate(0, yMid, 0);
            textShape.fromGeometry(geometry);
            text = new THREE.Mesh(textShape, textMaterial);

            text.position.set(pos[0], pos[1], pos[2]);
            text.lookAt(lookAtDir);
            callback(text);
        } );
    };

    //
    // endregion
    //

    // region Other utilities

    this.createCubeAt = function(pos, sizeX, sizeY, sizeZ) {
        let geometry = new THREE.BoxGeometry( sizeX, sizeY, sizeZ );
        // let material = new THREE.MeshBasicMaterial( {
        //     color: 0x00ff00,
        //     wireframe: true
        // } );

        let material = new THREE.MeshPhongMaterial({
            color: 0xffffff * Math.random(),
            transparent: true,
            opacity: 0.3
        });

        let cube = new THREE.Mesh( geometry, material );
        cube.position.x = pos[0];
        cube.position.y = pos[1];
        cube.position.z = pos[2];
        return cube;
    };

    this.createSphereAt = function(pos, size) {
        let geometry = new THREE.SphereGeometry( size, 32, 32 );
        let material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
        let sphere = new THREE.Mesh( geometry, material );
        sphere.position.x = pos[0];
        sphere.position.y = pos[1];
        sphere.position.z = pos[2];
        return sphere;
    }

    // endregion

}]);
