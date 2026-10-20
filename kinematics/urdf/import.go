// Package urdf converts a URDF, or a ROS description package holding one, into a kinematics spec.
package urdf

import (
	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// Import is a URDF converted into a spec.
type Import struct {
	// Spec has every pose in the assembly frame, every mesh_path a key of Meshes, and the TCP at
	// the chosen link.
	Spec *kinematicsv1.KinematicsSpec
	// Meshes holds the bytes of every mesh file the spec references, keyed by mesh_path.
	Meshes map[string][]byte
	Report *kinematicsv1.ImportReport
}

// Options adjusts an import.
type Options struct {
	// URDFPath is the `.urdf` or `.xacro` file to read, relative to the root of files. Empty finds the only URDF, else the only xacro entry file.
	URDFPath string
	// TCPLink is the URDF link to place the TCP at. Empty picks one by naming convention.
	TCPLink string
}
