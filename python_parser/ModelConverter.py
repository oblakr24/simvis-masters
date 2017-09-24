import os
from os import listdir
from os.path import isfile, join
import sys

import Helpers

args = sys.argv

relativePath = ""

generatedMeshesFolder = relativePath + str(args[1])  # "../sv_workspace/generated/mesh-complete/mesh-surfaces/"
webModelsFolder = relativePath + str(args[2])  # "../web_app/public/models/"

class ModelConverter:

    def main(self):

        ModelConverter.convert()

        print "Conversion done."

    @staticmethod
    def convert():
        vtpFiles = [f for f in listdir(generatedMeshesFolder)
                    if isfile(join(generatedMeshesFolder, f)) and f.endswith(".vtp")]

        existingObjFiles = [webModelsFolder + f for f in listdir(webModelsFolder)
                    if isfile(join(webModelsFolder, f))]

        # remove existing .obj files
        for fn in existingObjFiles:
            os.remove(fn)

        # convert the .vtp files and write the .obj files
        for fn in vtpFiles:
            polydata = Helpers.getXMLData(generatedMeshesFolder + fn)

            outFn = webModelsFolder + str.replace(fn, ".vtp", ".obj")

            if os.path.isfile(outFn):
                os.remove(outFn)

            Helpers.writeObj(outFn, polydata)

        print "Converted files: " + str(vtpFiles)

ModelConverter().main()