import vtk
import sys
import os
from os import listdir
from os.path import isfile, join

import Helpers
import Utils
import math

outputFolder = "sv_workspace/"
# modelsFolder = "../models/"

args = sys.argv
# if len(args) == 1:
#     modelFn = "new.obj"
#     meshFn = "new.vtp"
#     webModelsFolder = "webmodels"
# else:
#     modelFn = args[1]
#     meshFn = args[2]

modelFn = args[1]
meshFn = outputFolder + args[2]
webModelsFolder = args[3]
capInfoFn = args[4]

class PreParser:

    def main(self):
        [wall, capsAndRadiuses] = PreParser.fillCaps(self)
        PreParser.writeFacenames(self, len(capsAndRadiuses))

        # write the .obj files

        # # remove the existing .obj files
        existingObjFiles = [webModelsFolder + f for f in listdir(webModelsFolder)
                    if isfile(join(webModelsFolder, f))]

        for fn in existingObjFiles:
            os.remove(fn)

        i = 1
        capMapping = {}
        for [cap, radius] in capsAndRadiuses:
            objFn = "cap" + str(i) + ".obj"
            fn = webModelsFolder + objFn
            Helpers.writeObj(fn, cap)
            capMapping[objFn] = i
            i = i + 1

        fn = webModelsFolder + "wall.obj"
        Helpers.writeObj(fn, wall)

        # write the cap info
        Utils.printJson(capInfoFn, {"caps": [{"capIdx": i + 1, "radius": radius} for i, [cap, radius] in enumerate(capsAndRadiuses)],
                        "mapping": capMapping})

        print "Model preparsing done."

        # polydata = Helpers.getXMLData("demomodel.vtp")
        #
        #
        # wallsPd = vtk.vtkPolyData()
        # wallsPd.Allocate(polydata, polydata.GetNumberOfCells())
        # wallsPd.SetPoints(polydata.GetPoints())
        #
        # scalars = polydata.GetCellData().GetScalars()
        #
        # cell = vtk.vtkGenericCell()
        # it = polydata.NewCellIterator()
        # i = 0
        # while not it.IsDoneWithTraversal():
        #     it.GetCell(cell)
        #     # outPD.InsertNextCell(it.GetCellType(), cell.GetPointIds())
        #
        #     capIdx = scalars.GetValue(i)
        #     # capPDs[capIdx].InsertNextCell(it.GetCellType(), cell.GetPointIds())
        #
        #     if capIdx <= 17:
        #         wallsPd.InsertNextCell(it.GetCellType(), cell.GetPointIds())
        #
        #
        #     it.GoToNextCell()
        #     i = i + 1
        #
        # cleanFilter = vtk.vtkCleanPolyData()
        # cleanFilter.SetInputData(wallsPd)
        # cleanFilter.Update()
        #
        # cleanedPD = cleanFilter.GetOutput()
        #
        # # Helpers.writeVTP("onlywalls.vtp", cleanedPD)
        #
        # Helpers.writeObj("new.obj", cleanedPD)

    def fillCaps(self):
        # read the .obj and center it
        # polydata = Helpers.centerPolyData(Helpers.getObjData(modelFn))
        # TODO: centering seems to glitch the tetgen somewhy
        polydata = Helpers.getObjData(modelFn)

        size = Helpers.getBounds(polydata)
        print "Model sizes:" + str(size)

        fillHolesFilter = vtk.vtkFillHolesFilter()
        fillHolesFilter.SetInputData(polydata)
        fillHolesFilter.SetHoleSize(1000.0)  # TODO: hole size: compute using model size (some factor of it)

        normals = vtk.vtkPolyDataNormals()
        normals.SetInputConnection(fillHolesFilter.GetOutputPort())
        normals.ConsistencyOn()
        normals.SplittingOff()
        normals.Update()

        normals.GetOutput().GetPointData().SetNormals(polydata.GetPointData().GetNormals())

        numOriginalCells = polydata.GetNumberOfCells()
        numNewCells = normals.GetOutput().GetNumberOfCells()

        it = normals.GetOutput().NewCellIterator()
        numCells = 0
        it.InitTraversal()
        # Iterate over the original cells
        while (not it.IsDoneWithTraversal()) and numCells < numOriginalCells:
            it.GoToNextCell()
            numCells += 1

        holePolyData = vtk.vtkPolyData()
        holePolyData.Allocate(normals.GetOutput(), numNewCells - numOriginalCells)
        holePolyData.SetPoints(normals.GetOutput().GetPoints())

        cell = vtk.vtkGenericCell()
        # The remaining cells are the new ones from the hole filler
        while not it.IsDoneWithTraversal():
            it.GetCell(cell)
            holePolyData.InsertNextCell(it.GetCellType(), cell.GetPointIds())
            it.GoToNextCell()

        connectivity = vtk.vtkConnectivityFilter()
        connectivity.SetInputData(holePolyData)
        connectivity.SetExtractionModeToAllRegions()
        connectivity.ColorRegionsOn()
        connectivity.Update()

        capRegions = connectivity.GetOutput()

        outPD = vtk.vtkPolyData()
        outPD.Allocate(normals.GetOutput(), numNewCells)
        outPD.SetPoints(capRegions.GetPoints())

        numOfCaps = connectivity.GetNumberOfExtractedRegions()

        print "Found " + str(numOfCaps) + " holes."

        # create the cap polydatas
        capPDs = []
        for i in range(0, numOfCaps):
            capPD = vtk.vtkPolyData()
            capPD.Allocate(normals.GetOutput(), numNewCells)
            capPD.SetPoints(capRegions.GetPoints())
            capPDs.append(capPD)

        capScalars = capRegions.GetCellData().GetScalars()

        cell = vtk.vtkGenericCell()
        it = capRegions.NewCellIterator()
        i = 0
        while not it.IsDoneWithTraversal():
            it.GetCell(cell)
            # outPD.InsertNextCell(it.GetCellType(), cell.GetPointIds())

            capIdx = capScalars.GetValue(i)
            capPDs[capIdx].InsertNextCell(it.GetCellType(), cell.GetPointIds())

            it.GoToNextCell()

            i = i + 1

        sortedCaps = []
        for i in range(0, len(capPDs)):
            capPD = capPDs[i]
            cleanFilter = vtk.vtkCleanPolyData()
            cleanFilter.SetInputData(capPD)
            cleanFilter.Update()

            cleanedPD = cleanFilter.GetOutput()

            area = Helpers.getArea(cleanedPD)
            radius = math.sqrt(area / math.pi)

            sortedCaps.append([cleanedPD, area, radius])
            capPDs[i] = cleanedPD

        sortedCaps = sorted(sortedCaps, key=lambda x: x[1], reverse=True)


        [lastPd, area, radius] = sortedCaps[len(capPDs) - 1]
        print "Recommended edge size: " + str(radius / 2)

        scalarsName = "ModelFaceID"

        Helpers.appendScalars(polydata, 1, scalarsName)  # 1 for the walls
        appendFilter = vtk.vtkAppendPolyData()
        appendFilter.AddInputData(outPD)
        appendFilter.AddInputData(polydata)

        scalarIdx = 2
        for [capPD, area, radius] in sortedCaps:
            # if radius < 0.1:
            #     Helpers.appendScalars(capPD, 1, scalarsName)  # append the face ID idx
            # else:
            #     Helpers.appendScalars(capPD, scalarIdx, scalarsName)  # append the face ID idx
            Helpers.appendScalars(capPD, scalarIdx, scalarsName)  # append the face ID idx
            appendFilter.AddInputData(capPD)
            print "Cap radius: " + str(radius)
            scalarIdx += 1

        appendFilter.Update()

        cleanFilter = vtk.vtkCleanPolyData()
        cleanFilter.SetInputConnection(appendFilter.GetOutputPort())
        cleanFilter.Update()

        joinedPD = cleanFilter.GetOutput()
        # joinedPD.GetCellData().SetScalars(scalars)

        # Write as VTP
        Helpers.writeVTP(meshFn, joinedPD)

        return [polydata, [[capPD, radius] for [capPD, area, radius] in sortedCaps]]

    def writeFacenames(self, numOfFaces):
        filename = meshFn + ".facenames"
        if os.path.isfile(filename):
            os.remove(filename)
        with open(filename, 'a') as resFile:
            resFile.write('global gPolyDataFaceNames\n')
            resFile.write('global gPolyDataFaceNamesInfo\n')

            resFile.write('set gPolyDataFaceNames(1) {wall}\n')
            for i in range(2, numOfFaces + 2):
                line = "set gPolyDataFaceNames(" + str(i) + ") {cap" + str(i - 1) + "}\n"
                resFile.write(line)


PreParser().main()