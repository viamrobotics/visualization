package main

import (
	"flag"
	"io"
	"path/filepath"

	"github.com/viamrobotics/visualization/kinematics"
)

func runImport(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("import", flag.ContinueOnError)
	outDir := fs.String("o", "", "output directory (required)")
	tcp := fs.String("tcp", "", "URDF link to place the TCP at (default chosen by naming convention)")
	asJSON := fs.Bool("json", false, "print the import report as protojson")
	path, err := parseInterspersed(fs, args, stderr)
	if err != nil {
		writeMessage(stderr, "kinematics import: %v\n%s", err, usageMessage)
		return exitUsage
	}
	if *outDir == "" {
		writeMessage(stderr, "kinematics import: -o is required\n%s", usageMessage)
		return exitUsage
	}

	imported, err := importVendor(path, *tcp)
	if err != nil {
		writeMessage(stderr, "kinematics import: %v\n", err)
		return exitUsage
	}
	specBytes, err := kinematics.MarshalSpec(imported.Spec)
	if err != nil {
		writeMessage(stderr, "kinematics import: %v\n", err)
		return exitUsage
	}
	output := &kinematics.Output{Files: map[string][]byte{kinematics.SpecFileName: specBytes}}
	for name, data := range imported.Meshes {
		if !filepath.IsLocal(filepath.FromSlash(name)) || name == kinematics.SpecFileName {
			writeMessage(stderr, "kinematics import: mesh path %q is not allowed\n", name)
			return exitUsage
		}
		output.Files[name] = data
	}
	if err := output.WriteDir(*outDir); err != nil {
		writeMessage(stderr, "kinematics import: %v\n", err)
		return exitUsage
	}
	if err := printImportReport(stdout, imported.Report, *asJSON); err != nil {
		writeMessage(stderr, "kinematics import: %v\n", err)
		return exitUsage
	}
	if !*asJSON {
		writeMessage(stdout, "wrote %s and %d mesh files to %s\n",
			kinematics.SpecFileName, len(imported.Meshes), *outDir)
	}
	return exitOK
}
