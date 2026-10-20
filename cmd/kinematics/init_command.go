package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"

	"github.com/viamrobotics/visualization/kinematics"
)

const scaffoldModelPath = "kinematics/model.json"

func runInit(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("init", flag.ContinueOnError)
	outDir := fs.String("o", "", "output directory (default ./<module>)")
	namespace := fs.String("namespace", "", "Viam organization namespace (required)")
	module := fs.String("module", "", "module name (default the spec name)")
	model := fs.String("model", "", "model name (default the spec name)")
	force := fs.Bool("force", false, "write into a non-empty output directory")
	asJSON := fs.Bool("json", false, "print the report as protojson")
	specPath, err := parseInterspersed(fs, args, stderr)
	if err != nil {
		writeMessage(stderr, "kinematics init: %v\n%s", err, usageMessage)
		return exitUsage
	}
	if *namespace == "" {
		writeMessage(stderr, "kinematics init: -namespace is required\n%s", usageMessage)
		return exitUsage
	}

	spec, err := kinematics.LoadSpec(specPath)
	if err != nil {
		writeMessage(stderr, "kinematics init: %v\n", err)
		return exitUsage
	}
	if *module == "" {
		*module = spec.GetName()
	}
	if *model == "" {
		*model = spec.GetName()
	}
	if *outDir == "" {
		*outDir = "." + string(filepath.Separator) + *module
	}
	if !*force {
		if err := requireEmptyDir(*outDir); err != nil {
			writeMessage(stderr, "kinematics init: %v (use -force to write anyway)\n", err)
			return exitUsage
		}
	}

	output, err := kinematics.Scaffold(spec, os.DirFS(filepath.Dir(specPath)), kinematics.ScaffoldOptions{
		Namespace:  *namespace,
		ModuleName: *module,
		ModelName:  *model,
	})
	if err != nil {
		writeMessage(stderr, "kinematics init: %v\n", err)
		return exitUsage
	}
	report := kinematics.ValidateSpec(output.Files[scaffoldModelPath], spec)
	if err := printReport(stdout, spec.GetName(), report, *asJSON); err != nil {
		writeMessage(stderr, "kinematics init: %v\n", err)
		return exitUsage
	}
	if len(report.GetFailures()) > 0 {
		return exitInvalid
	}
	if err := output.WriteDir(*outDir); err != nil {
		writeMessage(stderr, "kinematics init: %v\n", err)
		return exitUsage
	}
	if !*asJSON {
		names := make([]string, 0, len(output.Files))
		for name := range output.Files {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			writeMessage(stdout, "wrote %s\n", filepath.Join(*outDir, filepath.FromSlash(name)))
		}
		writeMessage(stdout, "module written to %s\nnext steps:\n  cd %s\n  go mod tidy\n  make\n", *outDir, *outDir)
	}
	return exitOK
}

// requireEmptyDir returns an error when dir exists and has entries. A missing dir is fine.
func requireEmptyDir(dir string) error {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read %q: %w", dir, err)
	}
	if len(entries) > 0 {
		return fmt.Errorf("output directory %q is not empty", dir)
	}
	return nil
}
