package main

import (
	"flag"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing/fstest"

	"github.com/viamrobotics/visualization/kinematics"
	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

const (
	langGo   = "go"
	langNone = "none"
)

func runBuild(args []string, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet("build", flag.ContinueOnError)
	outDir := flags.String("o", "", `output directory (default "kinematics" beside the spec)`)
	lang := flags.String("lang", langGo, "loader language: go or none")
	pkg := flags.String("package", "", "Go package name of the loader (default derived from the output directory)")
	asJSON := flags.Bool("json", false, "print the report as protojson")
	tcp := flags.String("tcp", "", "URDF link to place the TCP at (URDF input only)")
	maxTriangles := flags.Uint("max-triangles", 0, "cap every mesh link's collision triangles (URDF input only)")
	specPath, err := parseInterspersed(flags, args, stderr)
	if err != nil {
		writeMessage(stderr, "kinematics build: %v\n%s", err, usageMessage)
		return exitUsage
	}

	if *lang != langGo && *lang != langNone {
		writeMessage(stderr, "kinematics build: unknown -lang %q (want go or none)\n", *lang)
		return exitUsage
	}

	vendor := isVendorPath(specPath)
	if !vendor && (*tcp != "" || *maxTriangles != 0) {
		writeMessage(stderr, "kinematics build: -tcp and -max-triangles apply only to URDF input\n")
		return exitUsage
	}
	if info, statErr := os.Stat(specPath); statErr == nil && info.IsDir() && !vendor {
		specPath = filepath.Join(specPath, kinematics.SpecFileName)
	}
	specDir := filepath.Dir(specPath)
	if vendor {
		specDir = filepath.Dir(filepath.Clean(specPath))
	}
	if *outDir == "" {
		*outDir = filepath.Join(specDir, "kinematics")
	}

	var spec *kinematicsv1.KinematicsSpec
	var sources fs.FS
	if vendor {
		imported, err := importVendor(specPath, *tcp)
		if err != nil {
			writeMessage(stderr, "kinematics build: %v\n", err)
			return exitUsage
		}
		if imported.Report.GetTcpLink() == "" {
			writeMessage(stderr, "kinematics build: no TCP link matched; candidates: %s; re-run with -tcp <link>\n",
				strings.Join(imported.Report.GetTcpCandidates(), ", "))
			return exitUsage
		}
		spec = imported.Spec
		capMeshTriangles(spec, uint32(*maxTriangles))
		meshFiles := fstest.MapFS{}
		for name, data := range imported.Meshes {
			meshFiles[name] = &fstest.MapFile{Data: data}
		}
		sources = meshFiles
		if !*asJSON {
			if err := printImportReport(stdout, imported.Report, false); err != nil {
				writeMessage(stderr, "kinematics build: %v\n", err)
				return exitUsage
			}
		}
	} else {
		var err error
		spec, err = kinematics.LoadSpec(specPath)
		if err != nil {
			writeMessage(stderr, "kinematics build: %v\n", err)
			return exitUsage
		}
		sources = os.DirFS(specDir)
	}
	output, err := kinematics.Build(spec, sources)
	if err != nil {
		writeMessage(stderr, "kinematics build: build %q: %v\n", specPath, err)
		return exitUsage
	}
	if *lang == langGo {
		if *pkg == "" {
			*pkg = defaultPackageName(*outDir)
		}
		regenerate := kinematics.RegenerateCommand(specPath, *outDir)
		if vendor {
			regenerate = kinematics.RegenerateVendorCommand(specPath, *outDir, kinematics.VendorBuildOptions{
				TCPLink:      *tcp,
				MaxTriangles: uint32(*maxTriangles),
			})
		}
		if err := output.AddGoLoader(*pkg, regenerate); err != nil {
			writeMessage(stderr, "kinematics build: %v\n", err)
			return exitUsage
		}
	}
	report := kinematics.ValidateSpec(output.Files[kinematics.ModelFileName], spec)
	if err := printReport(stdout, spec.GetName(), report, *asJSON); err != nil {
		writeMessage(stderr, "kinematics build: %v\n", err)
		return exitUsage
	}
	if len(report.GetFailures()) > 0 {
		return exitInvalid
	}
	if err := output.WriteDir(*outDir); err != nil {
		writeMessage(stderr, "kinematics build: %v\n", err)
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
	}
	return exitOK
}

// capMeshTriangles sets max_triangles to limit on every mesh link. A link whose mesh is already
// under limit is unchanged, since decimation only runs on a mesh over its budget. Primitive links
// have no mesh and are skipped.
func capMeshTriangles(spec *kinematicsv1.KinematicsSpec, limit uint32) {
	if limit == 0 {
		return
	}
	for _, link := range spec.GetLinks() {
		if link.GetMeshPath() != "" {
			link.MaxTriangles = limit
		}
	}
}
