package kinematics

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"testing/fstest"

	"connectrpc.com/connect"

	"github.com/viamrobotics/visualization/kinematics/urdf"
	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
	"github.com/viamrobotics/visualization/kinematics/v1/kinematicsv1connect"
)

var _ kinematicsv1connect.KinematicsServiceHandler = (*KinematicsService)(nil)

// KinematicsService serves Build and Export for the standalone app's /kinematics route. It holds no
// state between calls.
type KinematicsService struct{}

// NewKinematicsService returns a KinematicsService.
func NewKinematicsService() *KinematicsService {
	return &KinematicsService{}
}

// sourcesFS wraps request sources as a filesystem, rejecting keys that are not valid paths.
func sourcesFS(sources map[string][]byte) (fs.FS, error) {
	files := make(fstest.MapFS, len(sources))
	for path, data := range sources {
		if !fs.ValidPath(path) {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("mesh file key %q is not a valid relative path", path))
		}
		files[path] = &fstest.MapFile{Data: data}
	}
	return files, nil
}

// Build compiles and validates the request's spec over its sources. A spec Build rejects is
// CodeInvalidArgument. A model that builds but fails validation is a normal response whose report
// carries the failures.
func (s *KinematicsService) Build(
	ctx context.Context,
	req *connect.Request[kinematicsv1.BuildRequest],
) (*connect.Response[kinematicsv1.BuildResponse], error) {
	spec := req.Msg.GetSpec()
	if spec == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("spec is required"))
	}
	sources, err := sourcesFS(req.Msg.GetSources())
	if err != nil {
		return nil, err
	}

	out, err := Build(spec, sources)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("build kinematics: %w", err))
	}
	modelJSON := out.Files[ModelFileName]
	report := ValidateSpec(modelJSON, spec)

	resp := &kinematicsv1.BuildResponse{Report: report, ModelJson: modelJSON}
	if order, err := inputOrder(spec); err == nil {
		if collision, meshes, err := sceneGeometries(spec, sources); err == nil {
			if !req.Msg.GetIncludeVisualMeshes() {
				meshes = nil
			}
			resp.Frames = sceneFrames(spec, collision, meshes, jointValues(spec, order, req.Msg.GetInputs()))
		}
	}
	return connect.NewResponse(resp), nil
}

// Export packages the request's spec as a zip of the requested kind. A spec Build rejects or an
// option Scaffold rejects is CodeInvalidArgument, and a model that fails validation is
// CodeFailedPrecondition naming every failure.
func (s *KinematicsService) Export(
	ctx context.Context,
	req *connect.Request[kinematicsv1.ExportRequest],
) (*connect.Response[kinematicsv1.ExportResponse], error) {
	spec := req.Msg.GetSpec()
	if spec == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("spec is required"))
	}
	sources, err := sourcesFS(req.Msg.GetSources())
	if err != nil {
		return nil, err
	}

	var files map[string][]byte
	var fileName string
	var report *kinematicsv1.ValidationReport
	switch req.Msg.GetKind() {
	case kinematicsv1.ExportKind_EXPORT_KIND_PACKAGE:
		files, report, err = packageFiles(spec, sources)
		fileName = spec.GetName() + "-kinematics.zip"
	case kinematicsv1.ExportKind_EXPORT_KIND_MODULE:
		moduleName := req.Msg.GetModuleName()
		if moduleName == "" {
			moduleName = spec.GetName()
		}
		modelName := req.Msg.GetModelName()
		if modelName == "" {
			modelName = spec.GetName()
		}
		files, report, err = moduleFiles(spec, sources, ScaffoldOptions{
			Namespace:  req.Msg.GetNamespace(),
			ModuleName: moduleName,
			ModelName:  modelName,
		})
		fileName = moduleName + ".zip"
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("export kind is required"))
	}
	if err != nil {
		return nil, err
	}
	if len(report.GetFailures()) > 0 {
		return nil, connect.NewError(connect.CodeFailedPrecondition,
			fmt.Errorf("model fails validation: %s", strings.Join(report.GetFailures(), "; ")))
	}

	data, err := zipFiles(files)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("zip export: %w", err))
	}
	return connect.NewResponse(&kinematicsv1.ExportResponse{Zip: data, FileName: fileName, Report: report}), nil
}

// packageFiles builds spec and lays out the package zip: the spec, its sources, and kinematics/.
func packageFiles(spec *kinematicsv1.KinematicsSpec, sources fs.FS) (map[string][]byte, *kinematicsv1.ValidationReport, error) {
	out, err := Build(spec, sources)
	if err != nil {
		return nil, nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("build kinematics: %w", err))
	}
	report := ValidateSpec(out.Files[ModelFileName], spec)
	if len(report.GetFailures()) > 0 {
		return nil, report, nil
	}
	if err := out.AddGoLoader("kinematics", RegenerateCommand(SpecFileName, "kinematics")); err != nil {
		return nil, nil, connect.NewError(connect.CodeInternal, fmt.Errorf("add go loader: %w", err))
	}
	specBytes, err := MarshalSpec(spec)
	if err != nil {
		return nil, nil, connect.NewError(connect.CodeInternal, fmt.Errorf("marshal spec: %w", err))
	}

	files := map[string][]byte{SpecFileName: specBytes}
	for _, link := range spec.GetLinks() {
		data, err := fs.ReadFile(sources, link.GetMeshPath())
		if err != nil {
			return nil, nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("read mesh file %q: %w", link.GetMeshPath(), err))
		}
		files[link.GetMeshPath()] = data
	}
	for name, data := range out.Files {
		files["kinematics/"+name] = data
	}
	return files, report, nil
}

// moduleFiles scaffolds a module around spec and prefixes every path with the module name.
func moduleFiles(
	spec *kinematicsv1.KinematicsSpec,
	sources fs.FS,
	opts ScaffoldOptions,
) (map[string][]byte, *kinematicsv1.ValidationReport, error) {
	if _, err := Build(spec, sources); err != nil {
		return nil, nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("build kinematics: %w", err))
	}
	out, err := Scaffold(spec, sources, opts)
	if err != nil {
		return nil, nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("scaffold module: %w", err))
	}
	report := ValidateSpec(out.Files["kinematics/"+ModelFileName], spec)
	if len(report.GetFailures()) > 0 {
		return nil, report, nil
	}
	files := make(map[string][]byte, len(out.Files))
	for name, data := range out.Files {
		files[opts.ModuleName+"/"+name] = data
	}
	return files, report, nil
}

// Import reads a zip back into a spec and the sources it references. A zip with no kinematics.json is
// CodeNotFound. A malformed zip, or one with two at the same shallowest depth, is CodeInvalidArgument. A mesh file the zip lacks is listed
// in missing_sources, not an error.
func (s *KinematicsService) Import(
	ctx context.Context,
	req *connect.Request[kinematicsv1.ImportRequest],
) (*connect.Response[kinematicsv1.ImportResponse], error) {
	if len(req.Msg.GetZip()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("zip is required"))
	}
	resp, err := importZip(req.Msg.GetZip())
	if errors.Is(err, errNoSpecInZip) {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("import zip: %w", err))
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("import zip: %w", err))
	}
	return connect.NewResponse(resp), nil
}

// ImportURDF converts an uploaded URDF, or a ROS description package holding a URDF or xacro files,
// into a spec and its mesh files. Xacro expands in process, and a feature outside its subset names
// itself and the external `xacro` command in the error. Every input problem is CodeInvalidArgument.
func (s *KinematicsService) ImportURDF(
	ctx context.Context,
	req *connect.Request[kinematicsv1.ImportURDFRequest],
) (*connect.Response[kinematicsv1.ImportURDFResponse], error) {
	files, err := urdfUploadFS(req.Msg)
	if err != nil {
		return nil, err
	}
	urdfPath := req.Msg.GetUrdfPath()
	if urdfPath == "" {
		urdfPath, err = urdf.FindURDF(files)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("find URDF: %w", err))
		}
	}
	imported, err := urdf.Convert(files, urdf.Options{URDFPath: urdfPath, TCPLink: req.Msg.GetTcpLink()})
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("import URDF: %w", err))
	}
	return connect.NewResponse(&kinematicsv1.ImportURDFResponse{
		Spec: imported.Spec, Sources: imported.Meshes, Report: imported.Report,
	}), nil
}

// urdfUploadFS returns the upload's files, or the entries of its zip, as a filesystem.
func urdfUploadFS(req *kinematicsv1.ImportURDFRequest) (fs.FS, error) {
	switch {
	case len(req.GetZip()) > 0 && len(req.GetFiles()) > 0:
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("set files or zip, not both"))
	case len(req.GetZip()) > 0:
		entries, err := readZipFiles(req.GetZip())
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("read zip: %w", err))
		}
		return sourcesFS(entries)
	case len(req.GetFiles()) > 0:
		return sourcesFS(req.GetFiles())
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("files or zip is required"))
	}
}

// Pose returns the request spec's joint frames at the request's inputs, as BuildResponse.frames
// carries them. A missing spec, a spec Build rejects, or inputs whose length differs from the model's
// DoF is CodeInvalidArgument.
func (s *KinematicsService) Pose(
	ctx context.Context,
	req *connect.Request[kinematicsv1.PoseRequest],
) (*connect.Response[kinematicsv1.PoseResponse], error) {
	spec := req.Msg.GetSpec()
	if spec == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("spec is required"))
	}
	if err := checkBuildable(spec); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("build kinematics: %w", err))
	}
	order, err := inputOrder(spec)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("build kinematics: %w", err))
	}
	if dof := len(order); len(req.Msg.GetInputs()) != dof {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			fmt.Errorf("inputs has %d values, but the model has %d degrees of freedom", len(req.Msg.GetInputs()), dof))
	}
	frames := jointFrames(spec, jointValues(spec, order, req.Msg.GetInputs()))
	return connect.NewResponse(&kinematicsv1.PoseResponse{Frames: frames}), nil
}
