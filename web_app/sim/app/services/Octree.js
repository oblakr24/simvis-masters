/**
 * Created by rokoblak on 8/17/17.
 */

class Octree {

    constructor(positions, maxiter) {
        let xMin = Number.MAX_VALUE;
        let xMax = -Number.MAX_VALUE;
        let yMin = Number.MAX_VALUE;
        let yMax = -Number.MAX_VALUE;
        let zMin = Number.MAX_VALUE;
        let zMax = -Number.MAX_VALUE;

        for (let i = 0; i < positions.length/3; i++) {
            let px = positions[i * 3];
            let py = positions[i * 3 + 1];
            let pz = positions[i * 3 + 2];
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

        this.maxiter = maxiter;
        this.root = new Node(null, xMax, yMax, zMax, xMin, yMin, zMin);

        for (let i = 0; i < positions.length/3; i++) {
            let px = positions[i * 3];
            let py = positions[i * 3 + 1];
            let pz = positions[i * 3 + 2];
            this.root.add(i, [px, py, pz], this.maxiter)
        }
    }

    getLeafNodes() {
        return this.root.getLeafNodes()
    }

    getNodesAtLevel(depth) {
        return this.root.getNodesAtLevel(depth)
    }

}

class Node {

    constructor(parent, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit, Ylowerlimit, Zlowerlimit) {
        this.parent = parent;
        this.Xupperlimit = Xupperlimit;
        this.Yupperlimit = Yupperlimit;
        this.Zupperlimit = Zupperlimit;
        this.Xlowerlimit = Xlowerlimit;
        this.Ylowerlimit = Ylowerlimit;
        this.Zlowerlimit = Zlowerlimit;
        this.Xcenter = (this.Xupperlimit + this.Xlowerlimit) / 2.;
        this.Ycenter = (this.Yupperlimit + this.Ylowerlimit) / 2.;
        this.Zcenter = (this.Zupperlimit + this.Zlowerlimit) / 2.;
        this.childCount = 0;
        this.value = [];
        this.values = [];
        if (parent !== null) {
            this.depth = parent.depth + 1
        } else {
            this.depth = 0;
        }

        // children
        this.posXposYposZ = null;
        this.posXposYnegZ = null;
        this.posXnegYposZ = null;
        this.posXnegYnegZ = null;
        this.negXposYposZ = null;
        this.negXposYnegZ = null;
        this.negXnegYposZ = null;
        this.negXnegYnegZ = null;
    }

    getChildren() {
        return [this.posXposYposZ, this.posXposYnegZ, this.posXnegYposZ, this.posXnegYnegZ, this.negXposYposZ,
            this.negXposYnegZ, this.negXnegYposZ, this.negXnegYnegZ];
    }

    getLeafNodes() {
        // return self if leaf
        if (this.getChildren().every((element, index, array) => element === null)) {
            return [this]
        }

        let leaves = [];
        let children = this.getChildren();
        for (let i = 0; i < children.length; i++) {
            let child = children[i];
            if (child !== null) {
                let childLeaves = child.getLeafNodes();
                for (let j = 0; j < childLeaves.length; j++) {
                    leaves.push(childLeaves[j])
                }
            }
        }
        return leaves;
    }

    getNodesAtLevel(depth) {
        if (this.depth >= depth) {
            return [this]
        }

        let leaves = [];
        let children = this.getChildren();
        for (let i = 0; i < children.length; i++) {
            let child = children[i];
            if (child !== null) {
                let childLeaves = child.getNodesAtLevel(depth);
                for (let j = 0; j < childLeaves.length; j++) {
                    leaves.push(childLeaves[j])
                }
            }
        }
        return leaves;
    };

    add(payload, coord, level) {
        this.childCount++;
        this.values.push([coord, payload]);

        if (level === 0) {
            this.value.push([coord, payload])
        } else {
            level--;

            // Determine quadrant
            if (coord[0] <= this.Xcenter) {
                // negX
                if (coord[1] <= this.Ycenter) {
                    // negY
                    if (coord[2] <= this.Zcenter) {
                        // negZ
                        let Xupperlimit = this.Xcenter;
                        let Yupperlimit = this.Ycenter;
                        let Zupperlimit = this.Zcenter;
                        let Xlowerlimit = this.Xlowerlimit;
                        let Ylowerlimit = this.Ylowerlimit;
                        let Zlowerlimit = this.Zlowerlimit;
                        if (this.negXnegYnegZ === null) {
                            this.negXnegYnegZ = new Node(this, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                Ylowerlimit, Zlowerlimit);
                        }
                        this.negXnegYnegZ.add(payload, coord, level);
                    } else {
                        // posZ
                        let Xupperlimit = this.Xcenter;
                        let Yupperlimit = this.Ycenter;
                        let Zupperlimit = this.Zupperlimit;
                        let Xlowerlimit = this.Xlowerlimit;
                        let Ylowerlimit = this.Ylowerlimit;
                        let Zlowerlimit = this.Zcenter;
                        if (this.negXnegYposZ === null) {
                            this.negXnegYposZ = new Node(this, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                Ylowerlimit, Zlowerlimit);
                        }
                        this.negXnegYposZ.add(payload, coord, level);
                    }
                } else {
                    // posY
                    if (coord[2] <= this.Zcenter) {
                        // negZ
                        let Xupperlimit = this.Xcenter;
                        let Yupperlimit = this.Yupperlimit;
                        let Zupperlimit = this.Zcenter;
                        let Xlowerlimit = this.Xlowerlimit;
                        let Ylowerlimit = this.Ycenter;
                        let Zlowerlimit = this.Zlowerlimit;
                        if (this.negXposYnegZ === null) {
                            this.negXposYnegZ = new Node(this, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                Ylowerlimit, Zlowerlimit);
                        }
                        this.negXposYnegZ.add(payload, coord, level);
                    } else {
                        // posZ
                        let Xupperlimit = this.Xcenter;
                        let Yupperlimit = this.Yupperlimit;
                        let Zupperlimit = this.Zupperlimit;
                        let Xlowerlimit = this.Xlowerlimit;
                        let Ylowerlimit = this.Ycenter;
                        let Zlowerlimit = this.Zcenter;
                        if (this.negXposYposZ === null) {
                            this.negXposYposZ = new Node(this, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                Ylowerlimit, Zlowerlimit);
                        }
                        this.negXposYposZ.add(payload, coord, level);
                    }
                }
            } else {
                // posX
                if (coord[1] <= this.Ycenter) {
                    // negY
                    if (coord[2] <= this.Zcenter) {
                        // negZ
                        let Xupperlimit = this.Xupperlimit;
                        let Yupperlimit = this.Ycenter;
                        let Zupperlimit = this.Zcenter;
                        let Xlowerlimit = this.Xcenter;
                        let Ylowerlimit = this.Ylowerlimit;
                        let Zlowerlimit = this.Zlowerlimit;
                        if (this.posXnegYnegZ === null) {
                            this.posXnegYnegZ = new Node(this, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                Ylowerlimit, Zlowerlimit);
                        }
                        this.posXnegYnegZ.add(payload, coord, level);
                    } else {
                        // posZ
                        let Xupperlimit = this.Xupperlimit;
                        let Yupperlimit = this.Ycenter;
                        let Zupperlimit = this.Zupperlimit;
                        let Xlowerlimit = this.Xcenter;
                        let Ylowerlimit = this.Ylowerlimit;
                        let Zlowerlimit = this.Zcenter;
                        if (this.posXnegYposZ === null) {
                            this.posXnegYposZ = new Node(this, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                Ylowerlimit, Zlowerlimit);
                        }
                        this.posXnegYposZ.add(payload, coord, level);
                    }
                } else {
                    // posY
                    if (coord[2] <= this.Zcenter) {
                        // negZ
                        let Xupperlimit = this.Xupperlimit;
                        let Yupperlimit = this.Yupperlimit;
                        let Zupperlimit = this.Zcenter;
                        let Xlowerlimit = this.Xcenter;
                        let Ylowerlimit = this.Ycenter;
                        let Zlowerlimit = this.Zlowerlimit;
                        if (this.posXposYnegZ === null) {
                            this.posXposYnegZ = new Node(this, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                Ylowerlimit, Zlowerlimit);
                        }
                        this.posXposYnegZ.add(payload, coord, level);

                    } else {
                        // posZ
                        let Xupperlimit = this.Xupperlimit;
                        let Yupperlimit = this.Yupperlimit;
                        let Zupperlimit = this.Zupperlimit;
                        let Xlowerlimit = this.Xcenter;
                        let Ylowerlimit = this.Ycenter;
                        let Zlowerlimit = this.Zcenter;
                        if (this.posXposYposZ === null) {
                            this.posXposYposZ = new Node(this, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                Ylowerlimit, Zlowerlimit);
                        }
                        this.posXposYposZ.add(payload, coord, level);
                    }
                }
            }
        }
    }
}