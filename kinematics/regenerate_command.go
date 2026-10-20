package kinematics

import (
	"runtime/debug"
	"strconv"
	"strings"
)

// CLIPackage is the import path `go run` uses to invoke the kinematics CLI.
const CLIPackage = "github.com/viamrobotics/visualization/cmd/kinematics"

// RegenerateCommand returns the `go run` command that rebuilds outDir from specPath with the same
// CLI revision as the running binary, for a generated-code header or a go:generate directive.
//
// This module's v2+ tags lack a /v2 module path, so `@latest` resolves to an old v1 release. The
// version is pinned instead: the build's module version, else its vcs.revision, else "main". A
// build from a modified tree uses "main", because neither its "+dirty" version nor its revision
// names the code that ran.
func RegenerateCommand(specPath, outDir string) string {
	return regenerateCommand(specPath, outDir)
}

// VendorBuildOptions are the build flags a package built straight from a vendor URDF carries into its
// regenerate command. A zero field is left off the command.
type VendorBuildOptions struct {
	// TCPLink is the URDF link the TCP was placed at, passed as -tcp.
	TCPLink string
	// MaxTriangles is the collision mesh triangle budget, passed as -max-triangles.
	MaxTriangles uint32
}

// RegenerateVendorCommand is RegenerateCommand for a package built straight from a vendor URDF path,
// ROS description package directory, or zip. The command runs `kinematics build <vendorPath>` with the
// options that shaped the import, so regenerating reproduces it.
func RegenerateVendorCommand(vendorPath, outDir string, opts VendorBuildOptions) string {
	var flags []string
	if opts.TCPLink != "" {
		flags = append(flags, "-tcp", shellQuote(opts.TCPLink))
	}
	if opts.MaxTriangles > 0 {
		flags = append(flags, "-max-triangles", strconv.FormatUint(uint64(opts.MaxTriangles), 10))
	}
	return regenerateCommand(vendorPath, outDir, flags...)
}

func regenerateCommand(inputPath, outDir string, flags ...string) string {
	info, ok := debug.ReadBuildInfo()
	command := "go run " + CLIPackage + "@" + cliVersion(info, ok) +
		" build " + shellQuote(inputPath) + " -o " + shellQuote(outDir)
	if len(flags) > 0 {
		command += " " + strings.Join(flags, " ")
	}
	return command
}

// cliVersion picks the version suffix for CLIPackage from the running binary's build info.
func cliVersion(info *debug.BuildInfo, ok bool) string {
	if !ok || info == nil {
		return "main"
	}
	if v := info.Main.Version; v != "" && v != "(devel)" && !strings.HasSuffix(v, "+dirty") {
		return v
	}
	settings := map[string]string{}
	for _, s := range info.Settings {
		settings[s.Key] = s.Value
	}
	if revision := settings["vcs.revision"]; revision != "" && settings["vcs.modified"] != "true" {
		return revision
	}
	return "main"
}

// shellQuote single-quotes arg only when it has characters a shell would interpret.
func shellQuote(arg string) string {
	if arg != "" && !strings.ContainsFunc(arg, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' ||
			strings.ContainsRune("_@%+=:,./-", r))
	}) {
		return arg
	}
	return "'" + strings.ReplaceAll(arg, "'", `'\''`) + "'"
}
