#!/bin/sh

# navigate to the working directory
cd sv_workspace

sh ./generate.sh

echo "-------------------------"
echo "---- Generating done ----"
echo "--- Converting models ---"
echo "-------------------------"

cd ..
python python_parser/ModelConverter.py "sv_workspace/generated/mesh-complete/mesh-surfaces/" "web_app/public/models/"