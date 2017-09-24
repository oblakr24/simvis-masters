#!/bin/sh

# pre-process the .obj
modelfn=$(cat data.json | jq '.modelFilename' --raw-output)
meshfn=$(cat data.json | jq '.meshFilename' --raw-output)
python python_parser/PreParser.py "$modelfn" "$meshfn" "web_app/public/gen/" "cap_info.json"

# navigate to the working directory
cd sv_workspace

sh ./generate.sh

echo "-------------------------"
echo "---- Generating done ----"
echo "--- Converting models ---"
echo "-------------------------"

cd ..
python python_parser/ModelConverter.py "sv_workspace/generated/mesh-complete/mesh-surfaces/" "web_app/public/models/"