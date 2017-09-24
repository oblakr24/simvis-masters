package require json

#  Read the parameters .json
set paramFp [open "../data.json" r]
set file_data [read $paramFp]
close $paramFp
set params [json::json2dict $file_data]

# Set the parameters from the .json
set viscosity [dict get $params "viscosity"]
set density [dict get $params "density"]
set timesteps [dict get $params "timesteps"]
set stepsize [dict get $params "stepsize"]
set restarts [dict get $params "restarts"]

# Set the defaults
set meshedfn mesh-complete
set gendirname generated
set scriptdir supportingscripts
set svprefn svpre_gen.svpre
set inpfn solver.inp

# lists of inlets and outlets
set inlets [dict get $params "inlets"]
set outlets [dict get $params "outlets"]
set inletFns [list]
set outletFns [list]
set inletIds [list]
set outletIds [list]
set outletResistances [list]
set flowFns [list]

foreach inlet $inlets {
	lappend inletFns [dict get $inlet "name"]
	lappend inletIds [dict get $inlet "id"]
	lappend flowFns [dict get $inlet "flow"]
}
foreach outlet $outlets {
	lappend outletFns [dict get $outlet "name"]
	lappend outletIds [dict get $outlet "id"]
	lappend outletResistances [dict get $outlet "resistance"]
}

# read the script generating .tcl script
source $scriptdir/generateScripts.tcl

# generate the svsolver scripts
generateSvpre $gendirname $svprefn $meshedfn $inletFns $outletFns $inletIds $outletIds $flowFns
generateSolverInp "" $inpfn $timesteps $stepsize $restarts $viscosity $density [llength $inletFns] $outletIds $outletResistances