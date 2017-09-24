proc generateSolverInp {dstdir inpfn timesteps stepsize restarts viscosity density inletsNum outletIds outletResistances} {

	set fp [open [file join $dstdir $inpfn] w]
	fconfigure $fp -translation lf
	
	# ================
	# BCT CONTROL
	# ================
	puts $fp "Number of BCT Files: $inletsNum"
	
	puts $fp "Time Varying Boundary Conditions From File: True"
	
	# ================
	# SOLUTION CONTROL
	# ================
	puts $fp "Number of Timesteps: $timesteps"
	puts $fp "Time Step Size: $stepsize"
	
	# ==============
	# OUTPUT CONTROL
	# ==============
	puts $fp "Number of Timesteps between Restarts: $restarts"
	# 1 - Wall
	puts $fp "Number of Force Surfaces: 1"
	puts $fp "Surface ID's for Force Calculation: 1"
	puts $fp "Force Calculation Method: Velocity Based"
	
	# ===================
	# MATERIAL PROPERTIES
	# ===================
	puts $fp "Viscosity: $viscosity"
	puts $fp "Density: $density"
	
	# ==================================
	# CARDIOVASCULAR MODELING PARAMETERS
	# ==================================
	#set startIdx [expr {2 + $inletsNum}]
	#set outletIds2 [list]
	#foreach outletId $outletIds {
	#	lappend outletIds2 $startIdx
	#	incr startIdx
	#}
	# start from the last inlet index
	set outletsNum [llength $outletIds]
	puts $fp "Number of Coupled Surfaces: $outletsNum"
	puts $fp "Number of Resistance Surfaces: $outletsNum"
	puts $fp "List of Resistance Surfaces: $outletIds"
	puts $fp "Resistance Values : $outletResistances"
	
	# =============
	# STEP SEQUENCE
	# =============
	# 0 1 0 1
	puts $fp "Step Construction: 0 1 0 1 0 1 0 1 0 1"
	
	# =============
	# OTHER STUFF
	# =============
	
	puts $fp "Backflow Stabilization Coefficient: 0.2"
	puts $fp "Residual Control: True"
	puts $fp "Residual Criteria: 0.01"
	puts $fp "Minimum Required Iterations: 3"
	puts $fp "svLS Type: NS"
	puts $fp "Number of Krylov Vectors per GMRES Sweep: 100"
	puts $fp "Number of Solves per Left-hand-side Formation: 1"
	puts $fp "Tolerance on Momentum Equations: 0.05"
	puts $fp "Tolerance on Continuity Equations: 0.4"
	puts $fp "Tolerance on svLS NS Solver: 0.4"
	puts $fp "Maximum Number of Iterations for svLS NS Solver: 10"
	puts $fp "Maximum Number of Iterations for svLS Momentum Loop: 2"
	puts $fp "Maximum Number of Iterations for svLS Continuity Loop: 400"
	puts $fp "Time Integration Rule: Second Order"
	puts $fp "Time Integration Rho Infinity: 0.5"
	puts $fp "Flow Advection Form: Convective"
	puts $fp "Quadrature Rule on Interior: 2"
	puts $fp "Quadrature Rule on Boundary: 3"
}

proc generateSvpre {gendirfn svprefn modelfn inletFilenames outletFilenames inletIds outletIds flowFilenames} {

	set dstdir $gendirfn	

	set fp [open [file join $dstdir $svprefn] w]
	fconfigure $fp -translation lf

	# Read Mesh info
	puts $fp "mesh_and_adjncy_vtu $gendirfn/mesh-complete/$modelfn.mesh.vtu"

	# Assign IDs to the surfaces

	# 1 for the exterior
	puts $fp "set_surface_id_vtp $gendirfn/mesh-complete/$modelfn.exterior.vtp 1"

	#set idIdx 2
	# inlets
	foreach inletFilename $inletFilenames inletId $inletIds {
		puts $fp "set_surface_id_vtp $gendirfn/mesh-complete/mesh-surfaces/$inletFilename $inletId"
		#incr idIdx
	}
	# outlets
	foreach outletFilename $outletFilenames outletId $outletIds {
		puts $fp "set_surface_id_vtp $gendirfn/mesh-complete/mesh-surfaces/$outletFilename $outletId"
		#incr idIdx
	}

	# Set Inlet BC
	foreach inletFilename $inletFilenames {
		puts $fp "prescribed_velocities_vtp $gendirfn/mesh-complete/mesh-surfaces/$inletFilename"
	}

	# Set BCT for Inlet

	puts $fp "fluid_density 1.06"
	puts $fp "fluid_viscosity 0.04"
	puts $fp "bct_analytical_shape parabolic"
	puts $fp "bct_period 1.0"
	puts $fp "bct_point_number 2"
	puts $fp "bct_fourier_mode_number 1"
	
	foreach inletFilename $inletFilenames flowFilename $flowFilenames {
		puts $fp "bct_create $gendirfn/mesh-complete/mesh-surfaces/$inletFilename flows/$flowFilename"
	}
	
	puts $fp "bct_write_dat"
	puts $fp "bct_write_vtp"

	# Set Outlet BC
	# zero pressure on outlets
	foreach outletFilename $outletFilenames {
		puts $fp "zero_pressure_vtp $gendirfn/mesh-complete/mesh-surfaces/$outletFilename"
	}

	# Set Wall BC
	puts $fp "noslip_vtp $gendirfn/mesh-complete/walls_combined.vtp"

	# Write geometry and property data to geombc.dat.1
	puts $fp "write_geombc"
	
	# Write initial values of velocity, pressure, etc to restart.0.1
	puts $fp "write_restart"

	# Write the numstart file
	puts $fp "write_numstart 0"
	
	close $fp
}

# The procedure for TetGen to mesh the model
proc generateTGS {dstdir tgsfn solidfn edgesize wallfns} {

  #
  #  Mesh the solid
  #

  # create meshsim style script file
  set fp [open [file join $dstdir $tgsfn] w]
  fconfigure $fp -translation lf
  puts $fp "logon [file join $dstdir cylinder.logfile]"
  puts $fp "loadModel $solidfn"
  puts $fp "setSolidModel"
  #puts $fp "newMesh"
  puts $fp "option surface 1"
  puts $fp "option volume 1"
  puts $fp "option UseMMG 0"
  puts $fp "option GlobalEdgeSize $edgesize"
  puts $fp "wallFaces $wallfns"
  puts $fp "option Optimization 3"
  puts $fp "option QualityRatio 1.4"
  puts $fp "option NoBisect 1"

  puts $fp "generateMesh"
  puts $fp "writeMesh [file join $dstdir cylinder.sms] vtu 0"
  puts $fp "deleteMesh"
  puts $fp "deleteModel"
  puts $fp "logoff"
  close $fp
}