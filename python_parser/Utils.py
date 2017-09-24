import os
import json


def printJson(filename, data):
    if os.path.isfile(filename):
        os.remove(filename)

    with open(filename, 'a') as resFile:

        json.dump(data, resFile)