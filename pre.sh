#!/bin/sh

# pre-process the .obj
modelfn=web_app/uploads/uploaded.obj
meshfn=meshes/workingmesh.vtp
python python_parser/PreParser.py "$modelfn" "$meshfn" "web_app/public/models/" "web_app/public/capInfo.json"