import numpy as np
import Helpers
import TimeQuant as tq
import BSpline as bs
import time
import BSUtils as bsUtils

def getScalars(quantityName, dim):
    arrayNames = Helpers.findArraysForProperty(vtuData, quantityName, True)
    pointData = vtuData.GetPointData()
    scalarsArray = []
    for arrayName in arrayNames:
        array = pointData.GetArray(arrayName)

        if dim == 1:
            stepValues = np.zeros(array.GetNumberOfTuples())
        else:
            stepValues = [np.zeros(array.GetNumberOfTuples()), np.zeros(array.GetNumberOfTuples()),
                          np.zeros(array.GetNumberOfTuples())]

        for i in range(0, array.GetNumberOfTuples()):
            tuple = array.GetTuple(i)

            if dim == 1:
                stepValues[i] = tuple[0]
            else:
                stepValues[0][i] = tuple[0]
                stepValues[1][i] = tuple[1]
                stepValues[2][i] = tuple[2]

        if dim == 1:
            scalarsArray.append(stepValues)
        else:
            scalarsArray.append(stepValues[0])
            scalarsArray.append(stepValues[1])
            scalarsArray.append(stepValues[2])

    return scalarsArray



# get the data

# vtuData = Helpers.getVTUData("data/cyl_6.vtu")
# vtuData = Helpers.getVTUData("data/cyl_16.vtu")

# vtuData = Helpers.getVTUData("data/Y_6.vtu")
# vtuData = Helpers.getVTUData("data/Y_16.vtu")

# vtuData = Helpers.getVTUData("data/q1_6.vtu")
# vtuData = Helpers.getVTUData("data/q1_16.vtu")

# vtuData = Helpers.getVTUData("data/fork_6.vtu")
# vtuData = Helpers.getVTUData("data/fork_16.vtu")

# vtuData = Helpers.getVTUData("data/big_6.vtu")
# vtuData = Helpers.getVTUData("data/big_16.vtu")

# vtuData = Helpers.getVTUData("data/long_6.vtu")
# vtuData = Helpers.getVTUData("data/long_16.vtu")

# vtuData = Helpers.getVTUData("data/aorta_6.vtu")
vtuData = Helpers.getVTUData("data/aorta_16.vtu")


# vtuData = Helpers.getVTUData("data/allresults_pulse.vtu")
# vtuData = Helpers.getVTUData("data/big.vtu")
# vtuData = Helpers.getVTUData("data/long.vtu")
# vtuData = Helpers.getVTUData("data/aorta.vtu")
# vtuData = Helpers.getVTUData("data/allresults_q1.vtu")

points = vtuData.GetPoints()


numPts = points.GetNumberOfPoints()
posVectors = []
for i in range(0, numPts):
    posVectors.append(points.GetPoint(i))


# construct the octree
leaves, depth = bsUtils.subdivide(posVectors)


# BppPr = 0.75
# BppVel = 0.75
BppPr = 1.0
BppVel = 1.0


# Pressures
pressuresScalars = getScalars("pressure", 1)

# Velocities
velocitiesScalars = getScalars("velocity", 3)

print "Number of points: " + str(len(posVectors))
print "Time steps: " + str(len(pressuresScalars))
print "Total data points: " + str(len(posVectors) * len(pressuresScalars))
print "Number of leaf nodes: " + str(len(leaves))
print "Depth: " + str(depth)

print " ******************************************************************************* "
print "Time domain quantization:"

print "------ Pressures:"
tq.compressOnTimeDomain(pressuresScalars, BppPr)

print "------ Velocities:"
tq.compressOnTimeDomain(velocitiesScalars, BppVel)


print " ******************************************************************************* "
print "Octree quantization:"

print "------ Pressures:"
encodedDatas = bs.compress(leaves, pressuresScalars, BppPr, False, False)
# dataBits = bs.convertEncodedData(encodedDatas, depth, 0, len(pressuresScalars))
# bin.writeBinary(outputFolder + "pressures.b", dataBits)


print "------ Velocities:"
encodedDatas = bs.compress(leaves, velocitiesScalars, BppVel, False, False)
# dataBits = bs.convertEncodedData(encodedDatas, depth, 1, len(velocitiesScalars) / 3)
# bin.writeBinary(outputFolder + "velocities.b", dataBits)

