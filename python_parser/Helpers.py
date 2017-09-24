import vtk
import random
import os

def getVTUSurface(vtuData):
    meshToSurfaceFilter = vtk.vtkGeometryFilter()
    meshToSurfaceFilter.SetInputData(vtuData)
    meshToSurfaceFilter.Update()
    return meshToSurfaceFilter.GetOutput()

def centerPolyData(polydata):
    center = getPolyDataCenter(polydata)
    return translatePolyData(polydata, [-center[0], -center[1], -center[2]])

def getPolyDataCenter(polydaya):
    centerOfMassFilter = vtk.vtkCenterOfMass()
    centerOfMassFilter.SetInputData(polydaya)
    centerOfMassFilter.SetUseScalarsAsWeights(False)
    centerOfMassFilter.Update()
    return centerOfMassFilter.GetCenter()

def translatePolyData(polydata, direction):
    translation = vtk.vtkTransform()
    translation.Translate(direction)
    transformFilter = vtk.vtkTransformPolyDataFilter()
    transformFilter.SetInputData(polydata)
    transformFilter.SetTransform(translation)
    transformFilter.Update()
    return transformFilter.GetOutput()

def scalePolyData(polydata, scaleFactor):
    transform = vtk.vtkTransform()
    transform.Scale(scaleFactor, scaleFactor, scaleFactor)
    transformFilter = vtk.vtkTransformFilter()
    transformFilter.SetInputData(polydata)
    transformFilter.SetTransform(transform)
    transformFilter.Update()
    return transformFilter.GetOutput()

def getEdges(polydata):
    featureEdges = vtk.vtkFeatureEdges()
    featureEdges.SetInputData(polydata)
    featureEdges.BoundaryEdgesOn()
    featureEdges.FeatureEdgesOn()
    featureEdges.ManifoldEdgesOn()
    featureEdges.NonManifoldEdgesOn()
    featureEdges.Update()
    return featureEdges.GetOutput()

def getVTUData(filename):
    reader = vtk.vtkXMLUnstructuredGridReader()
    reader.SetFileName(filename)
    reader.Update()
    return reader.GetOutput()

def getXMLData(filename):
    reader = vtk.vtkXMLPolyDataReader()
    reader.SetFileName(filename)
    reader.Update()
    return reader.GetOutput()

def writeStl(filename, data):
    writer = vtk.vtkSTLWriter()
    writer.SetFileName(filename)
    writer.SetInputData(data)
    writer.Write()

def getBounds(polydata):
    bounds = polydata.GetBounds()
    bx1 = bounds[0]
    bx2 = bounds[1]
    by1 = bounds[2]
    by2 = bounds[3]
    bz1 = bounds[4]
    bz2 = bounds[5]

    bx = max(bx1, bx2) - min(bx1, bx2)
    by = max(by1, by2) - min(by1, by2)
    bz = max(bz1, bz2) - min(bz1, bz2)

    return [bx, by, bz]

def findArraysForProperty(vtuData, propertyName, startsWith):
    arrayNames = []
    for i in range(0, vtuData.GetPointData().GetNumberOfArrays()):
        name = vtuData.GetPointData().GetArray(i).GetName()
        if startsWith:
            if name.startswith(propertyName):
                arrayNames.append(name)
        else:
            if propertyName in name:
                arrayNames.append(name)

    return arrayNames

def getObjData(filename):
    reader = vtk.vtkOBJReader()
    reader.SetFileName(filename)
    reader.Update()
    polydata = vtk.vtkPolyData()
    polydata.DeepCopy(reader.GetOutput())


    cleanFilter = vtk.vtkCleanPolyData()
    cleanFilter.SetInputData(polydata)
    cleanFilter.Update()

    return cleanFilter.GetOutput()

    # return polydata

def writeObj(filename, polydata):
    vertices = []
    faces = []

    for i in range(0, polydata.GetNumberOfPoints()):
        point = polydata.GetPoint(i)
        vertices.append(point)

    cell = vtk.vtkGenericCell()
    it = polydata.NewCellIterator()
    it.InitTraversal()
    # Iterate over the original cells
    while not it.IsDoneWithTraversal():
        it.GetCell(cell)

        ids = []
        numOfPoints = cell.GetNumberOfPoints()
        for i in range(0, numOfPoints):
            id = cell.GetPointId(i) + 1
            ids.append(id)

        faces.append(ids)

        it.GoToNextCell()

    if os.path.isfile(filename):
        os.remove(filename)
    with open(filename, 'a') as resFile:

        # vertices
        for vertex in vertices:
            line = "v"
            for c in vertex:
                line = line + " " + str(c)

            line = line + "\n"
            resFile.write(line)

        for face in faces:
            line = "f"
            for f in face:
                line = line + " " + str(f)

            line = line + "\n"
            resFile.write(line)

def writeVTP(filename, polydata):
    writer = vtk.vtkXMLPolyDataWriter()
    writer.SetFileName(filename)
    writer.SetInputData(polydata)
    writer.Write()

def initRenderer(background):
    renderer = vtk.vtkRenderer()
    renderWindow = vtk.vtkRenderWindow()
    renderWindow.AddRenderer(renderer)
    renderWindowInteractor = vtk.vtkRenderWindowInteractor()
    renderWindowInteractor.SetRenderWindow(renderWindow)
    renderer.SetBackground(background)
    return [renderer, renderWindow, renderWindowInteractor]

def renderSphereAt(renderer, position, radius, color):
    sphere = vtk.vtkSphereSource()
    sphere.SetCenter(position)
    sphere.SetRadius(radius)
    sphere.Update()
    sphereMapper = vtk.vtkPolyDataMapper()
    sphereMapper.SetInputConnection(sphere.GetOutputPort())
    sphereActor = vtk.vtkActor()
    sphereActor.SetMapper(sphereMapper)
    sphereActor.GetProperty().SetColor(color)
    renderer.AddActor(sphereActor)

def renderPolyData(renderer, polydata, color, width, wireframe):
    mapper = vtk.vtkPolyDataMapper()
    mapper.SetInputData(polydata)
    actor = vtk.vtkActor()
    actor.GetProperty().SetLineWidth(width)
    actor.GetProperty().SetColor(color)
    actor.SetMapper(mapper)
    if wireframe:
        actor.GetProperty().SetRepresentationToWireframe()

    renderer.AddActor(actor)

def getArea(polydata):
    polygonProperties = vtk.vtkMassProperties()
    polygonProperties.SetInputData(polydata)
    polygonProperties.Update()
    return polygonProperties.GetSurfaceArea()

def appendScalars(polydata, value, name):

    scalars = vtk.vtkIntArray()
    scalars.SetName(name)
    polydata.GetCellData().SetScalars(scalars)

    # iterate over the cells
    for i in range(0, polydata.GetNumberOfCells()):
        # cell = polydata.GetCell(i)
        scalars.InsertNextTuple1(value)
