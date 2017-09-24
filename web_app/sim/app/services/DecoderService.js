/**
 * Created by rokoblak on 8/18/17.
 */

app.service("DecoderService", ['$http', '$q', '$rootScope', 'VisUtils', function ($http, $q, $rootScope, VisUtils) {

    let octree = null;

    let leaves = null;
    let Ns_cached = {};
    let numSamples = 400;
    let numOfPoints = null;

    this.initialize = function (positions) {
        numOfPoints = positions.length / 3;
        octree = new Octree(positions, 7);
    };

    this.visualizeOctree = function (scene) {
        let nodes = octree.getNodesAtLevel(5);

        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];

            let pos = [node.Xcenter, node.Ycenter, node.Zcenter];
            let sx = node.Xupperlimit - node.Xlowerlimit;
            let sy = node.Yupperlimit - node.Ylowerlimit;
            let sz = node.Zupperlimit - node.Zlowerlimit;
            scene.add(VisUtils.createCubeAt(pos, sx, sy, sz));

        }
    };

    /**
     * Decodes the raw uint8 array
     */
    this.decode = function (uint8Array) {
        let decodedSteps = [];

        // convert to a binary string
        let bitStr = "";
        for (let i = 0; i < uint8Array.length; i++) {
            bitStr += ("00000000" + (uint8Array[i]).toString(2)).slice(-8);
        }

        let idx = 0;

        let depth = parseInt(takeBits(bitStr, idx, 3), 2); idx += 3;
        let is3D = parseInt(takeBits(bitStr, idx, 1), 2); idx += 1;
        let steps = parseInt(takeBits(bitStr, idx, 8), 2); idx += 8;

        is3D = is3D === 1;

        // take the leaves at the specified depth
        leaves = octree.getNodesAtLevel(depth);

        let dim = 1;
        if (is3D) dim = 3;

        for (let i = 0; i < steps; i++) {
            let stepVals = [];
            for (let j = 0; j < dim; j++) {
                let decodedVals = new Array(numOfPoints);
                for (let r = 0; r < leaves.length; r++) {
                    idx = decodeRegion(bitStr, idx, leaves[r], decodedVals);
                }
                stepVals.push(decodedVals);
            }
            if (is3D) {
                decodedSteps.push(stepVals)
            } else {
                decodedSteps.push(stepVals[0])
            }
        }
        return decodedSteps
    };

    function decodeRegion(bitStr, idx, leaf, decodedVals) {
        let type = parseInt(takeBits(bitStr, idx, 2), 2); idx += 2;
        let minV = parseF32(takeBits(bitStr, idx, 32)); idx += 32;
        let rangeV = parseF32(takeBits(bitStr, idx, 32)); idx += 32;

        if (type === 0) {
            let n = parseInt(takeBits(bitStr, idx, 5), 2); idx += 5;
            let C = new Array(n*n*n);
            for (let i = 0; i < n*n*n; i++) {
                C[i] = parseF16(takeBits(bitStr, idx, 16)); idx += 16;
            }
            let deg = 3;
            if (n === 2) {
                deg = 1;
            } else if (n === 3) {
                deg = 2;
            }

            let [x, y, z, I] = getNodeValues(leaf);

            let X = constructX(x, y, z, deg, n);

            let Pr = multiplyVec(X, C);
            for (let i = 0; i < Pr.length; i++) {
                decodedVals[I[i]] = (Pr[i] * rangeV) + minV;
            }

        } else if (type === 1) {
            let numOfValues = leaf.values.length;
            let bitsPerPoint = parseInt(takeBits(bitStr, idx, 4), 2); idx += 4;

            let bins = Math.pow(2, bitsPerPoint) - 1;
            for (let i = 0; i < numOfValues; i++) {
                let val = parseInt(takeBits(bitStr, idx, bitsPerPoint), 2); idx += bitsPerPoint;
                let ptIdx = leaf.values[i][1];
                decodedVals[ptIdx] = (val / bins) * rangeV + minV;
            }

        } else if (type === 2) {
            for (let i = 0; i < leaf.values.length; i++) {
                let ptIdx = leaf.values[i][1];
                decodedVals[ptIdx] = minV + 0.5 * rangeV;
            }
        }
        return idx;
    }

    function constructX(x, y, z, deg, n) {
        let NS = getN(deg, n);
        let X = new Array(x.length);
        for (let i = 0; i < x.length; i++) {
            let u = x[i];
            let v = y[i];
            let w = z[i];
            X[i] = outer(outer(getNcol(v, n, NS), getNcol(u, n, NS)), getNcol(w, n, NS));
        }
        return X;
    }

    function getNcol(x, n, NS) {
        let idx = Math.floor(x * (numSamples - 1));
        let ret = new Array(n);
        for (let i = 0; i < n; i++) {
            ret[i] = NS[i][idx];
        }
        return ret;
    }

    function linspace(a,b,n) {
        if (typeof n === "undefined") n = Math.max(Math.round(b-a)+1,1);
        if (n < 2) { return n===1 ? [a] : []; }
        let i,ret = new Array(n);
        n--;
        for (i = n; i >= 0; i--) { ret[i] = (i*b+(n-i)*a)/n; }
        return ret;
    }

    /** Calculates the outer product between the two vectors */
    function outer(v1, v2) {
        let res = new Array(v1.length * v2.length);
        for (let i = 0; i < v1.length; i++) {
            for (let j = 0; j < v2.length; j++) {
                res[i * v2.length + j] = v1[i] * v2[j]
            }
        }
        return res;
    }

    function multiplyVec(X, v) {
        let p = new Array(X.length);
        for (let r = 0; r < X.length; ++r) {
            let sum = 0;
            for (let i = 0; i < v.length; ++i) {
                sum += X[r][i] * v[i];
            }
            p[r] = sum;
        }
        return p;
    }

    function getNodeValues(node) {
        let vals = node.values;
        let x = new Array(vals.length);
        let y = new Array(vals.length);
        let z = new Array(vals.length);
        let I = new Array(vals.length);

        for (let i = 0; i < vals.length; i++) {
            let pos = vals[i][0];
            x[i] = pos[0];
            y[i] = pos[1];
            z[i] = pos[2];
            I[i] = vals[i][1]
        }

        normalize(x, y, z);

        return [x, y, z, I]
    }

    function normalize(x, y, z) {
        let xMin = Number.MAX_VALUE;
        let xMax = -Number.MAX_VALUE;
        let yMin = Number.MAX_VALUE;
        let yMax = -Number.MAX_VALUE;
        let zMin = Number.MAX_VALUE;
        let zMax = -Number.MAX_VALUE;

        for (let i = 0; i < x.length; i++) {
            let px = x[i];
            let py = y[i];
            let pz = z[i];
            if (px < xMin) {
                xMin = px;
            }
            if (px > xMax) {
                xMax = px;
            }
            if (py < yMin) {
                yMin = py;
            }
            if (py > yMax) {
                yMax = py;
            }
            if (pz < zMin) {
                zMin = pz;
            }
            if (pz > zMax) {
                zMax = pz;
            }
        }

        for (let i = 0; i < x.length; i++) {
            x[i] = (x[i] - xMin) / (xMax - xMin);
            y[i] = (y[i] - yMin) / (yMax - yMin);
            z[i] = (z[i] - zMin) / (zMax - zMin);
        }
    }

    function takeBits(binStrArray, idx, n) {
        return binStrArray.substring(idx, idx + n)
    }

    function calcBasisFn(us, u, i, deg) {
        if (deg === 0) {
            if (us[i] <= u && u < us[i + 1]) {
                return 1;
            } else {
                return 0;
            }
        }
        let f1, f2;
        if (us[i + deg] === us[i]) {
            f1 = 0;
        } else {
            f1 = (u - us[i]) / (us[i + deg] - us[i]) * calcBasisFn(us, u, i, deg - 1)
        }
        if (us[i + deg + 1] === us[i + 1]) {
            f2 = 0
        } else {
            f2 = (us[i + deg + 1] - u) / (us[i + deg + 1] - us[i + 1]) * calcBasisFn(us, u, i + 1, deg - 1)
        }

        return f1 + f2;
    }

    function getN(deg, n) {
        let key = deg + "_" + n;
        if (Ns_cached[key] === undefined) {
            let start = 0;
            let end = 1;
            let marg = 1 * (end - start) * 0.01;
            let us = linspace(start - marg, end + marg, n + 1 - deg);
            us = prepend(us, deg, 0);
            us = append(us, deg, us[us.length-1])

            // let NS = math.zeros(n, numSamples);
            let NS = new Array(n);
            let sampleXs = linspace(0, 1.0, numSamples);
            for (let k = 0; k < n; k++) {
                let row = new Array(numSamples);
                for (let i = 0; i < numSamples; i++) {
                    // NS.subset(math.index(k, i), calcBasisFn(us, sampleXs[i], k, deg))
                    row[i] = calcBasisFn(us, sampleXs[i], k, deg)
                }
                NS[k] = row
            }

            Ns_cached[key] = NS;
        }
        return Ns_cached[key]
    }

    function parseF32(str) {
        let sign = parseInt(str[0]);
        if (sign === 0) sign = 1; else sign = -1;
        let exp = parseInt(str.substring(1, 9), 2) - 127;
        let mantissa = parseInt(str.substring(9, 32), 2) / 8388608.0;
        if (exp === -127) return sign * Math.pow(2, -14) * mantissa;
        return sign * Math.pow(2, exp) * (1.0 + mantissa)
    }

    function parseF16(str) {
        let sign = parseInt(str[0]);
        if (sign === 0) sign = 1; else sign = -1;
        let exp = parseInt(str.substring(1, 6), 2) - 15;
        let mantissa = parseInt(str.substring(6, 16), 2) / 1024.0;
        if (exp === -15) return sign * Math.pow(2, -14) * mantissa;
        return sign * Math.pow(2, exp) * (1.0 + mantissa)
    }

    function prepend(list, num, val) {
        for (let i = 0; i < num; i++) {
            list.splice(0, 0, val)
        }
        return list;
    }

    function append(list, num, val) {
        for (let i = 0; i < num; i++) {
            list.push(val)
        }
        return list;
    }

}]);