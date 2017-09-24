# -*- coding: utf-8 -*-
# python octree implementation
# Code © Spencer Krum June 2011
# Released underl GPLv3 See LICENSE file in this repository
import numpy as np

class Node:
    """
    An Octree Node
    """

    def __init__(self, parent, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit, Ylowerlimit, Zlowerlimit):
        self.parent = parent
        self.Xupperlimit = Xupperlimit
        self.Yupperlimit = Yupperlimit
        self.Zupperlimit = Zupperlimit
        self.Xlowerlimit = Xlowerlimit
        self.Ylowerlimit = Ylowerlimit
        self.Zlowerlimit = Zlowerlimit
        self.Xcenter = (self.Xupperlimit + self.Xlowerlimit) / 2.
        self.Ycenter = (self.Yupperlimit + self.Ylowerlimit) / 2.
        self.Zcenter = (self.Zupperlimit + self.Zlowerlimit) / 2.
        self.childCount = 0
        self.value = []
        self.values = []
        if parent is not None:
            self.depth = parent.depth + 1

    depth = 0
    childCount = None

    parent = None
    value = None
    values = None

    # children
    posXposYposZ = None
    posXposYnegZ = None
    posXnegYposZ = None
    posXnegYnegZ = None
    negXposYposZ = None
    negXposYnegZ = None
    negXnegYposZ = None
    negXnegYnegZ = None

    # position in space
    Xupperlimit = None
    Yupperlimit = None
    Zupperlimit = None

    Xlowerlimit = None
    Ylowerlimit = None
    Zlowerlimit = None

    def getChildren(self):
        """
        helper function to return array of children
        because there is some weird issue where just setting an
        array variable isn't cutting it
        """
        children = [self.posXposYposZ, self.posXposYnegZ, self.posXnegYposZ, self.posXnegYnegZ, self.negXposYposZ,
                    self.negXposYnegZ, self.negXnegYposZ, self.negXnegYnegZ]
        return children

    def isFullNode(self, maxDepth):
        """
        Checks if a node is 'full' - either it is at a certain depth,
        or it has all the children and all the children are full themselves
        """
        if self.depth >= maxDepth:
            return True

        childFlags = [child is not None and child.isFullNode(maxDepth) for child in self.getChildren()]
        return all(childFlags)

    def getFullNodes(self, maxDepth):
        # return self if full OR if leaf
        if self.isFullNode(maxDepth) or all(child is None for child in self.getChildren()):
            return [self]

        # go through the children and ask them to fetch their leaves
        leaves = []
        for child in self.getChildren():
            if child is not None:
                for childLeaf in child.getFullNodes(maxDepth):
                    leaves.append(childLeaf)
        return leaves

    def getNodesOnLevels(self, levels):
        levels[self.depth].append(self.childCount)

        for child in self.getChildren():
            if child is not None:
                child.getNodesOnLevels(levels)

    def getLeafNodes(self):
        # return self if leaf
        if all(child is None for child in self.getChildren()):
            return [self]

        # go through the children and ask them to fetch their leaves
        leaves = []
        for child in self.getChildren():
            if child is not None:
                for childLeaf in child.getLeafNodes():
                    leaves.append(childLeaf)
        return leaves

    def getNodesAtLevel(self, depth):
        if self.depth >= depth:
            return [self]

        leaves = []
        for child in self.getChildren():
            if child is not None:
                for childLeaf in child.getNodesAtLevel(depth):
                    leaves.append(childLeaf)
        return leaves

    def add(self, payload, coord, level):

        self.childCount += 1
        self.values.append((coord, payload))


        if level == 0:
            self.value.append((coord, payload))

        else:
            level -= 1
            # Determine quadrant
            if coord[0] <= self.Xcenter:
                # negX
                if coord[1] <= self.Ycenter:
                    # negY
                    if coord[2] <= self.Zcenter:
                        # negZ
                        Xupperlimit = self.Xcenter
                        Yupperlimit = self.Ycenter
                        Zupperlimit = self.Zcenter
                        Xlowerlimit = self.Xlowerlimit
                        Ylowerlimit = self.Ylowerlimit
                        Zlowerlimit = self.Zlowerlimit
                        if self.negXnegYnegZ is None:
                            self.negXnegYnegZ = Node(self, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                                     Ylowerlimit, Zlowerlimit)
                        self.negXnegYnegZ.add(payload, coord, level)
                    else:
                        # posZ
                        Xupperlimit = self.Xcenter
                        Yupperlimit = self.Ycenter
                        Zupperlimit = self.Zupperlimit
                        Xlowerlimit = self.Xlowerlimit
                        Ylowerlimit = self.Ylowerlimit
                        Zlowerlimit = self.Zcenter
                        if self.negXnegYposZ is None:
                            self.negXnegYposZ = Node(self, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                                     Ylowerlimit, Zlowerlimit)
                        self.negXnegYposZ.add(payload, coord, level)
                else:
                    # posY
                    if coord[2] <= self.Zcenter:
                        # negZ
                        Xupperlimit = self.Xcenter
                        Yupperlimit = self.Yupperlimit
                        Zupperlimit = self.Zcenter
                        Xlowerlimit = self.Xlowerlimit
                        Ylowerlimit = self.Ycenter
                        Zlowerlimit = self.Zlowerlimit
                        if self.negXposYnegZ is None:
                            self.negXposYnegZ = Node(self, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                                     Ylowerlimit, Zlowerlimit)
                        self.negXposYnegZ.add(payload, coord, level)

                    else:
                        # posZ
                        Xupperlimit = self.Xcenter
                        Yupperlimit = self.Yupperlimit
                        Zupperlimit = self.Zupperlimit
                        Xlowerlimit = self.Xlowerlimit
                        Ylowerlimit = self.Ycenter
                        Zlowerlimit = self.Zcenter
                        if self.negXposYposZ is None:
                            self.negXposYposZ = Node(self, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                                     Ylowerlimit, Zlowerlimit)
                        self.negXposYposZ.add(payload, coord, level)


            else:
                # posX
                if coord[1] <= self.Ycenter:
                    # negY
                    if coord[2] <= self.Zcenter:
                        # negZ
                        Xupperlimit = self.Xupperlimit
                        Yupperlimit = self.Ycenter
                        Zupperlimit = self.Zcenter
                        Xlowerlimit = self.Xcenter
                        Ylowerlimit = self.Ylowerlimit
                        Zlowerlimit = self.Zlowerlimit
                        if self.posXnegYnegZ is None:
                            self.posXnegYnegZ = Node(self, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                                     Ylowerlimit, Zlowerlimit)
                        self.posXnegYnegZ.add(payload, coord, level)

                    else:
                        # posZ
                        Xupperlimit = self.Xupperlimit
                        Yupperlimit = self.Ycenter
                        Zupperlimit = self.Zupperlimit
                        Xlowerlimit = self.Xcenter
                        Ylowerlimit = self.Ylowerlimit
                        Zlowerlimit = self.Zcenter
                        if self.posXnegYposZ is None:
                            self.posXnegYposZ = Node(self, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                                     Ylowerlimit, Zlowerlimit)
                        self.posXnegYposZ.add(payload, coord, level)

                else:
                    # posY
                    if coord[2] <= self.Zcenter:
                        # negZ
                        Xupperlimit = self.Xupperlimit
                        Yupperlimit = self.Yupperlimit
                        Zupperlimit = self.Zcenter
                        Xlowerlimit = self.Xcenter
                        Ylowerlimit = self.Ycenter
                        Zlowerlimit = self.Zlowerlimit
                        if self.posXposYnegZ is None:
                            self.posXposYnegZ = Node(self, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                                     Ylowerlimit, Zlowerlimit)
                        self.posXposYnegZ.add(payload, coord, level)

                    else:
                        # posZ
                        Xupperlimit = self.Xupperlimit
                        Yupperlimit = self.Yupperlimit
                        Zupperlimit = self.Zupperlimit
                        Xlowerlimit = self.Xcenter
                        Ylowerlimit = self.Ycenter
                        Zlowerlimit = self.Zcenter
                        if self.posXposYposZ is None:
                            self.posXposYposZ = Node(self, Xupperlimit, Yupperlimit, Zupperlimit, Xlowerlimit,
                                                     Ylowerlimit, Zlowerlimit)
                        self.posXposYposZ.add(payload, coord, level)


class Octree:
    """
    Wrapper class holding the root node and the exposed functions
    """

    def __init__(self, Xmax, Ymax, Zmax, Xmin, Ymin, Zmin, root_coords=(0, 0, 0), maxiter=7):
        self.Xmax = Xmax
        self.Ymax = Ymax
        self.Zmax = Xmax
        self.Xmin = Xmin
        self.Ymin = Ymin
        self.Zmin = Zmin
        self.root_coords = root_coords
        self.maxiter = maxiter

        self.root = Node(None, Xmax, Ymax, Zmax, Xmin, Ymin, Zmin)

    def addItem(self, payload, coord):
        """
        Recursively create subnodes until maxiter is reached
        then deposit payload in that node
        """

        self.root.add(payload, coord, self.maxiter)

    def getLeafNodes(self):
        return self.root.getLeafNodes()

    def getNodesWithAvgChildCount(self, maxChildren):
        levels = {}
        for i in range(0, self.maxiter+1):
            levels[i] = []

        self.root.getNodesOnLevels(levels)

        # print "Average node child count:"
        idx = self.maxiter
        for i in range(0, self.maxiter + 1):
            avgChildren = np.average(levels[i])
            # print str(i) + ": " + str(avgChildren)
            if avgChildren <= maxChildren:
                idx = i
                break

        return self.root.getNodesAtLevel(idx), idx

    def getFullNodes(self):
        return self.root.getFullNodes(self.maxiter)