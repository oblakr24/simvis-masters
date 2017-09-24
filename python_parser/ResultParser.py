
import Helpers
import numpy as np
import BinUtils as bin
import BSpline as bs
import BSUtils as bsUtils
import time
import vtk

resultsFolder = "../sv_workspace/results/"
outputFolder = "../web_app/public/"
resultsFn = "allresults.vtu"

sparsenessFactor = 1

def getScalars(pointData, arrayNames, dim):
    scalarsArray = []
    for arrayName in arrayNames:
        array = pointData.GetArray(arrayName)

        if dim == 1:
            stepValues = np.zeros(array.GetNumberOfTuples())
        else:
            stepValues = [np.zeros(array.GetNumberOfTuples()), np.zeros(array.GetNumberOfTuples()),
                          np.zeros(array.GetNumberOfTuples())]

        for i in range(0, array.GetNumberOfTuples(), sparsenessFactor):
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

def parseResults():
    vtuData = Helpers.getVTUData(resultsFolder + resultsFn)
    pointData = vtuData.GetPointData()
    points = vtuData.GetPoints()

    start = time.time()
    numPts = points.GetNumberOfPoints()

    positions = np.zeros(numPts * 3)
    posVectors = []
    for i in range(0, numPts, sparsenessFactor):
        pt = points.GetPoint(i)
        positions[i * 3] = pt[0]
        positions[i * 3 + 1] = pt[1]
        positions[i * 3 + 2] = pt[2]
        posVectors.append(pt)

    surface = Helpers.getVTUSurface(vtuData)

    faceIds = np.zeros(surface.GetCellData().GetNumberOfTuples() * 3)
    idx = 0
    cell = vtk.vtkGenericCell()
    it = surface.NewCellIterator()
    it.InitTraversal()
    # Iterate over the original cells
    while not it.IsDoneWithTraversal():
        it.GetCell(cell)
        numOfPoints = cell.GetNumberOfPoints()
        for i in range(0, numOfPoints):
            faceIds[idx] = cell.GetPointId(i)
            idx += 1
        it.GoToNextCell()

    print "Writing mesh ... "
    bin.writeUints32(outputFolder + "mesh.b", faceIds)

    print "Writing positions ... "
    bin.writePositions(outputFolder + "positions.b", positions)

    leaves, depth = bsUtils.subdivide(posVectors)

    # Wall shear stress
    print "Compressing wall shear stresses ... "
    wssScalars = getScalars(pointData, Helpers.findArraysForProperty(vtuData, "vWSS", True), 3)
    encodedDatas = bs.compress(leaves, wssScalars, 0.75, True, False)
    dataBits = bs.convertEncodedData(encodedDatas, depth, 1, len(wssScalars) / 3)
    bin.writeBinary(outputFolder + "wss.b", dataBits)

    # In-plane traction
    print "Compressing in-plane tractions ... "
    tractionsScalars = getScalars(pointData, Helpers.findArraysForProperty(vtuData, "vinplane_traction", True), 3)
    encodedDatas = bs.compress(leaves, tractionsScalars, 0.75, True, False)
    dataBits = bs.convertEncodedData(encodedDatas, depth, 1, len(tractionsScalars) / 3)
    bin.writeBinary(outputFolder + "ipt.b", dataBits)

    # Time derivative
    print "Compressing time derivative ... "
    derivativeScalars = getScalars(pointData, Helpers.findArraysForProperty(vtuData, "timeDeriv", True), 3)
    encodedDatas = bs.compress(leaves, derivativeScalars, 0.75, True, False)
    dataBits = bs.convertEncodedData(encodedDatas, depth, 1, len(derivativeScalars) / 3)
    bin.writeBinary(outputFolder + "timederiv.b", dataBits)

    # Pressures
    print "Compressing pressures ... "
    pressuresScalars = getScalars(pointData, Helpers.findArraysForProperty(vtuData, "pressure", True), 1)
    encodedDatas = bs.compress(leaves, pressuresScalars, 1.0, True, False)
    dataBits = bs.convertEncodedData(encodedDatas, depth, 0, len(pressuresScalars))
    bin.writeBinary(outputFolder + "pressures.b", dataBits)

    # Velocities
    print "Compressing velocities ... "
    velocitiesScalars = getScalars(pointData, Helpers.findArraysForProperty(vtuData, "velocity", True), 3)
    encodedDatas = bs.compress(leaves, velocitiesScalars, 0.75, True, False)
    dataBits = bs.convertEncodedData(encodedDatas, depth, 1, len(velocitiesScalars)/3)
    bin.writeBinary(outputFolder + "velocities.b", dataBits)

    end = time.time()
    print "Compression & conversion time: " + str(end-start)

    print "All done."


parseResults()