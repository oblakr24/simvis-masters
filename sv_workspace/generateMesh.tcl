package require json

#  Read the parameters .json
set paramFp [open "../data.json" r]
set file_data [read $paramFp]
close $paramFp
set params [json::json2dict $file_data]

# Set the parameters from the .json
set modelfn [dict get $params "meshFilename"]
set edgesize [dict get $params "edgesize"]

# Set the defaults
set tgsfn tgs_gen.tgs
set meshedfn mesh-complete
set gendirname generated
set scriptdir supportingscripts

# lists of inlets and outlets
set walls [dict get $params "walls"]
set wallsFns [list]

foreach wall $walls {
	lappend wallsFns [dict get $wall "name"]
}

file delete -force -- $gendirname
file mkdir $gendirname

# read the script generating .tcl script
source $scriptdir/generateScripts.tcl

# generate the TetGen script
generateTGS $gendirname $tgsfn $modelfn $edgesize $wallsFns

# init the VTK lib
source $scriptdir/simvascular_vtk_init.tcl

solid_setKernel -name PolyData
mesh_setKernel -name TetGen

set gOptions(meshing_kernel) TetGen
set gOptions(meshing_solid_kernel) PolyData

catch {repos_delete -obj mymodel}
solid_readNative -file $modelfn -obj mymodel

# init the meshing libs
source $scriptdir/tetgen.tcl
source $scriptdir/osmsc.tcl

catch {repos_delete -obj mymesh}
mesh_readTGS [file join $gendirname $tgsfn] mymesh

# write the final mesh
mesh_writeCompleteMesh mymesh mymodel $meshedfn $gendirname/mesh-complete