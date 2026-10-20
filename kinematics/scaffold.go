package kinematics

import (
	"bytes"
	"embed"
	"errors"
	"fmt"
	"go/format"
	"go/token"
	"io/fs"
	"path"
	"regexp"
	"runtime/debug"
	"strconv"
	"strings"
	"testing/fstest"
	"text/template"

	"google.golang.org/protobuf/proto"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// ScaffoldOptions names the module Scaffold generates.
type ScaffoldOptions struct {
	// Namespace is the Viam organization namespace in the model triplet, for example "acme".
	Namespace string
	// ModuleName is the module's name and its Go module path, for example "drywall-gripper".
	ModuleName string
	// ModelName is the model name in the triplet, for example "vacuum-frame".
	ModelName string
}

const (
	scaffoldCADDir      = "cad"
	scaffoldLoaderDir   = "kinematics"
	scaffoldLoaderPkg   = "kinematics"
	scaffoldRDKModule   = "go.viam.com/rdk"
	scaffoldTemplateDir = "templates/go"
)

//go:embed templates/go/*.tmpl
var scaffoldTemplates embed.FS

var scaffoldNamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]*$`)

// scaffoldFile maps a template to the module file it renders. Go files are gofmt-ed.
type scaffoldFile struct {
	template string
	target   string
}

var scaffoldFiles = []scaffoldFile{
	{"go.mod.tmpl", "go.mod"},
	{"gitignore.tmpl", ".gitignore"},
	{"Makefile.tmpl", "Makefile"},
	{"meta.json.tmpl", "meta.json"},
	{"README.md.tmpl", "README.md"},
	{"generate.go.tmpl", "generate.go"},
	{"model.go.tmpl", "{{.ModelSnake}}.go"},
	{"model_test.go.tmpl", "{{.ModelSnake}}_test.go"},
	{"main.go.tmpl", "cmd/module/main.go"},
}

// scaffoldData is what the module templates render against.
type scaffoldData struct {
	Namespace, ModuleName, ModelName string
	ModuleLower, ModulePackage       string
	ModelPascal, ModelSnake          string
	TypeName                         string
	RDKVersion                       string
	Regenerate, CLIPackage           string
	CLIVersion                       string
	TCPX, TCPY, TCPZ                 string
	DoF                              int
}

// Scaffold returns the files of a fresh Go gripper module around spec, keyed by path relative to
// the module root. It copies each link's mesh file into cad/, rewrites the spec's mesh paths to
// match, and builds kinematics/ with Build and AddGoLoader. The module imports only RDK.
func Scaffold(spec *kinematicsv1.KinematicsSpec, sources fs.FS, opts ScaffoldOptions) (*Output, error) {
	if err := validateScaffoldOptions(opts); err != nil {
		return nil, err
	}
	rdkVersion, err := rdkModuleVersion()
	if err != nil {
		return nil, err
	}

	files := map[string][]byte{}
	cadFiles := fstest.MapFS{}
	rewritten := proto.Clone(spec).(*kinematicsv1.KinematicsSpec)
	if err := copySources(rewritten, sources, files, cadFiles); err != nil {
		return nil, err
	}
	specBytes, err := MarshalSpec(rewritten)
	if err != nil {
		return nil, err
	}
	files[SpecFileName] = specBytes

	built, err := Build(rewritten, cadFiles)
	if err != nil {
		return nil, fmt.Errorf("build model: %w", err)
	}
	regenerate := RegenerateCommand(SpecFileName, scaffoldLoaderDir)
	if err := built.AddGoLoader(scaffoldLoaderPkg, regenerate); err != nil {
		return nil, err
	}
	for name, data := range built.Files {
		files[path.Join(scaffoldLoaderDir, name)] = data
	}

	data := newScaffoldData(rewritten, opts, rdkVersion, regenerate)
	if err := renderScaffoldFiles(data, files); err != nil {
		return nil, err
	}
	return &Output{Files: files}, nil
}

func validateScaffoldOptions(opts ScaffoldOptions) error {
	for _, field := range []struct{ label, value string }{
		{"namespace", opts.Namespace},
		{"module name", opts.ModuleName},
		{"model name", opts.ModelName},
	} {
		if field.value == "" {
			return fmt.Errorf("%s is required", field.label)
		}
		if !scaffoldNamePattern.MatchString(field.value) {
			return fmt.Errorf("%s %q must match %s", field.label, field.value, scaffoldNamePattern)
		}
	}
	return nil
}

// readBuildInfo is debug.ReadBuildInfo, replaceable because test binaries carry no dependency list.
var readBuildInfo = debug.ReadBuildInfo

// rdkModuleVersion returns the RDK version this binary was built with, which the scaffold pins.
func rdkModuleVersion() (string, error) {
	info, ok := readBuildInfo()
	if !ok {
		return "", errors.New("build info is unavailable, so the RDK version to pin is unknown")
	}
	for _, dep := range info.Deps {
		if dep.Path == scaffoldRDKModule {
			return dep.Version, nil
		}
	}
	return "", fmt.Errorf("%s is not in the build info dependencies", scaffoldRDKModule)
}

// cadPath maps a link's mesh path to its path under cad/, dropping leading "../" segments.
func cadPath(meshPath string) string {
	cleaned := path.Clean(strings.ReplaceAll(meshPath, `\`, "/"))
	for strings.HasPrefix(cleaned, "../") {
		cleaned = strings.TrimPrefix(cleaned, "../")
	}
	return path.Join(scaffoldCADDir, strings.TrimPrefix(cleaned, "/"))
}

// copySources reads each distinct link mesh file into files and cadFiles under its cad/ path and
// points spec's links at those paths.
func copySources(spec *kinematicsv1.KinematicsSpec, sources fs.FS, files map[string][]byte, cadFiles fstest.MapFS) error {
	originByCAD := map[string]string{}
	for _, link := range spec.GetLinks() {
		original := link.GetMeshPath()
		target := cadPath(original)
		if origin, seen := originByCAD[target]; seen {
			if origin != original {
				return fmt.Errorf("link %q: mesh file %q and %q both map to %q", link.GetId(), original, origin, target)
			}
			link.MeshPath = target
			continue
		}
		data, err := fs.ReadFile(sources, original)
		if err != nil {
			return fmt.Errorf("link %q: read mesh file %q: %w", link.GetId(), original, err)
		}
		originByCAD[target] = original
		files[target] = data
		cadFiles[target] = &fstest.MapFile{Data: data}
		link.MeshPath = target
	}
	return nil
}

func newScaffoldData(spec *kinematicsv1.KinematicsSpec, opts ScaffoldOptions, rdkVersion, regenerate string) scaffoldData {
	modulePascal := pascalCase(opts.ModuleName)
	modelPascal := pascalCase(opts.ModelName)
	modulePackage := strings.ToLower(modulePascal)
	if !token.IsIdentifier(modulePackage) {
		modulePackage = "x" + modulePackage
	}
	if !token.IsIdentifier(modelPascal) {
		modelPascal = "X" + modelPascal
	}
	pose := spec.GetTcpPose()
	return scaffoldData{
		Namespace:     opts.Namespace,
		ModuleName:    opts.ModuleName,
		ModelName:     opts.ModelName,
		ModuleLower:   strings.ToLower(modulePascal),
		ModulePackage: modulePackage,
		ModelPascal:   modelPascal,
		ModelSnake:    strings.NewReplacer("-", "_").Replace(opts.ModelName),
		TypeName:      strings.ToLower(modelPascal[:1]) + modelPascal[1:] + "Gripper",
		RDKVersion:    rdkVersion,
		Regenerate:    regenerate,
		CLIPackage:    CLIPackage,
		CLIVersion:    cliVersion(readBuildInfo()),
		TCPX:          strconv.FormatFloat(pose.GetX(), 'g', -1, 64),
		TCPY:          strconv.FormatFloat(pose.GetY(), 'g', -1, 64),
		TCPZ:          strconv.FormatFloat(pose.GetZ(), 'g', -1, 64),
		DoF:           drivenJointCount(spec),
	}
}

// drivenJointCount is the model's DoF: every joint except those that mimic another.
func drivenJointCount(spec *kinematicsv1.KinematicsSpec) int {
	count := 0
	for _, joint := range spec.GetJoints() {
		if joint.GetMimic() == nil {
			count++
		}
	}
	return count
}

// pascalCase joins the hyphen and underscore separated words of name, capitalizing each.
func pascalCase(name string) string {
	var out strings.Builder
	for _, word := range strings.FieldsFunc(name, func(r rune) bool { return r == '-' || r == '_' }) {
		out.WriteString(strings.ToUpper(word[:1]) + word[1:])
	}
	return out.String()
}

func renderScaffoldFiles(data scaffoldData, files map[string][]byte) error {
	for _, file := range scaffoldFiles {
		source, err := scaffoldTemplates.ReadFile(path.Join(scaffoldTemplateDir, file.template))
		if err != nil {
			return fmt.Errorf("read template %s: %w", file.template, err)
		}
		rendered, err := executeTemplate(file.template, string(source), data)
		if err != nil {
			return err
		}
		target, err := executeTemplate(file.template+" target", file.target, data)
		if err != nil {
			return err
		}
		out := []byte(rendered)
		if strings.HasSuffix(target, ".go") {
			if out, err = format.Source(out); err != nil {
				return fmt.Errorf("format %s: %w", target, err)
			}
		}
		files[target] = out
	}
	return nil
}

func executeTemplate(name, source string, data scaffoldData) (string, error) {
	tmpl, err := template.New(name).Option("missingkey=error").Parse(source)
	if err != nil {
		return "", fmt.Errorf("parse template %s: %w", name, err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("render template %s: %w", name, err)
	}
	return buf.String(), nil
}
