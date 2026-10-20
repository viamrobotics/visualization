package main

import (
	"encoding/json"
	"flag"
	"io"
	"os"
	"path/filepath"

	"github.com/viamrobotics/visualization/kinematics"
)

func runValidate(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("validate", flag.ContinueOnError)
	name := fs.String("name", "", "model name (default: the model JSON's top-level name)")
	asJSON := fs.Bool("json", false, "print the report as protojson")
	target, err := parseInterspersed(fs, args, stderr)
	if err != nil {
		writeMessage(stderr, "kinematics validate: %v\n%s", err, usageMessage)
		return exitUsage
	}

	path := target
	if info, err := os.Stat(target); err == nil && info.IsDir() {
		path = filepath.Join(target, kinematics.ModelFileName)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		writeMessage(stderr, "kinematics validate: read model: %v\n", err)
		return exitUsage
	}

	modelName := *name
	if modelName == "" {
		// A corrupt file has no readable name; Validate then reports the parse failure.
		var header struct {
			Name string `json:"name"`
		}
		_ = json.Unmarshal(data, &header)
		modelName = header.Name
	}

	report := kinematics.Validate(data, modelName)
	if err := printReport(stdout, modelName, report, *asJSON); err != nil {
		writeMessage(stderr, "kinematics validate: %v\n", err)
		return exitUsage
	}
	if len(report.GetFailures()) > 0 {
		return exitInvalid
	}
	return exitOK
}
