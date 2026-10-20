// Command kinematics compiles a kinematics spec into an RDK kinematics model and validates
// models.
//
// Usage:
//
//	kinematics build [-o dir] [-lang go|none] [-package name] [-tcp link] [-max-triangles n] [-json] <spec|robot.urdf|robot.urdf.xacro|package-dir|package.zip>
//	kinematics import -o dir [-tcp link] [-json] <robot.urdf|robot.urdf.xacro|package-dir|package.zip>
//	kinematics init [-o dir] -namespace ns [-module name] [-model name] [-force] [-json] <spec>
//	kinematics validate [-name n] [-json] <dir|model.json>
//	kinematics help
//
// build reads a spec file, writes model.json to -o (default "kinematics" beside the spec) only if
// the built model validates, and prints the validation report. With -lang go (the default) it also
// writes kinematics.go, a Go loader in package -package (default derived from the -o base name);
// -lang none writes model.json only. init scaffolds a gripper module for the spec into -o (default
// ./<module>): it requires -namespace, defaults -module and -model to the spec name, refuses a
// non-empty target unless -force, and writes nothing if the model fails validation. validate checks an existing model;
// a directory means <dir>/model.json, and -name defaults to the model's top-level name. -json
// prints the report as protojson and nothing else on stdout.
//
// A .xacro file expands in process, with no ROS install. Given by path, its package root is the
// nearest ancestor directory holding a package.xml. A feature outside the supported subset fails
// naming the feature and the external `xacro` command to expand it with.
//
// Exit codes: 0 valid, 1 validation failures, 2 usage or I/O error.
package main

import (
	"fmt"
	"io"
	"os"
)

const (
	exitOK       = 0
	exitInvalid  = 1
	exitUsage    = 2
	usageMessage = `usage:
  kinematics build [-o dir] [-lang go|none] [-package name] [-tcp link] [-max-triangles n] [-json] <spec|robot.urdf|robot.urdf.xacro|package-dir|package.zip>
  kinematics import -o dir [-tcp link] [-json] <robot.urdf|robot.urdf.xacro|package-dir|package.zip>
  kinematics init [-o dir] -namespace ns [-module name] [-model name] [-force] [-json] <spec>
  kinematics validate [-name n] [-json] <dir|model.json>
  kinematics help
`
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		writeMessage(stderr, "%s", usageMessage)
		return exitUsage
	}
	switch args[0] {
	case "build":
		return runBuild(args[1:], stdout, stderr)
	case "import":
		return runImport(args[1:], stdout, stderr)
	case "init":
		return runInit(args[1:], stdout, stderr)
	case "validate":
		return runValidate(args[1:], stdout, stderr)
	case "help":
		writeMessage(stderr, "%s", usageMessage)
		return exitUsage
	default:
		writeMessage(stderr, "kinematics: unknown command %q\n%s", args[0], usageMessage)
		return exitUsage
	}
}

// writeMessage prints a diagnostic line. A failed write to the terminal has nowhere left to be
// reported, so its error is dropped here rather than at every call site.
func writeMessage(w io.Writer, format string, args ...any) {
	_, _ = fmt.Fprintf(w, format, args...)
}
