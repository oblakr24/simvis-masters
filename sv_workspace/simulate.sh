#!/bin/sh

# generate the files for svsolver
tclsh generateSimFiles.tcl

/usr/local/sv/svsolver/2017-06-19/bin/svpre generated/svpre_gen.svpre

procs=$(cat ../data.json | jq '.threads')

#svsolver
/usr/local/sv/svsolver/2017-06-19/bin/mpiexec -np $procs /usr/local/sv/svsolver/2017-06-19/bin/svsolver

rm -r "results"
mkdir results


iterations=$(cat ../data.json | jq '.timesteps')
increment=$(cat ../data.json | jq '.restarts')


if (( procs > 1 ));then
	# move the new folder in the current one
	mv ./$procs-procs_case/* .
	rm -r $procs-procs_case
fi

svpost -all -vtu results/allresults.vtu -start 0 -stop $iterations -incr $increment -vtkcombo



# cleanup
find . -name "ltg.dat.*" -delete
find . -name \*.dat -delete
find . -name \*.log -delete
find . -name "restart*" -delete
find . -name "bct*" -delete
find . -name "geombc*" -delete
rm -r "solver.inp"
rm -r "numpe.in"
#rm -r generated