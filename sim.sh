#!/bin/sh

# navigate to the working directory
cd sv_workspace

echo "simulating ..."
sh ./simulate.sh

echo "python starting ..."
python ../python_parser/ResultParser.py

echo "python done"

# cleanup
# rm -r "generated"