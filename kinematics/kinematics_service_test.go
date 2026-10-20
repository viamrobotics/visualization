package kinematics

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"connectrpc.com/connect"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
	"github.com/viamrobotics/visualization/kinematics/v1/kinematicsv1connect"
)

func newKinematicsClient(t *testing.T) kinematicsv1connect.KinematicsServiceClient {
	t.Helper()
	mux := http.NewServeMux()
	mux.Handle(kinematicsv1connect.NewKinematicsServiceHandler(NewKinematicsService()))
	server := httptest.NewUnstartedServer(h2c.NewHandler(mux, &http2.Server{}))
	server.Start()
	t.Cleanup(server.Close)
	return kinematicsv1connect.NewKinematicsServiceClient(server.Client(), server.URL)
}

func fixtureRequestParts(t *testing.T) (*kinematicsv1.KinematicsSpec, map[string][]byte) {
	t.Helper()
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	sources := map[string][]byte{}
	for _, name := range []string{"cube-300mm.stl", "sphere-100mm.stl"} {
		data, err := os.ReadFile(filepath.Join("testdata", name))
		test.That(t, err, test.ShouldBeNil)
		sources[name] = data
	}
	return spec, sources
}

func frameNames(transforms []*commonpb.Transform) []string {
	names := make([]string, 0, len(transforms))
	for _, tr := range transforms {
		names = append(names, tr.GetReferenceFrame())
	}
	return names
}

func TestKinematicsServiceBuild(t *testing.T) {
	client := newKinematicsClient(t)
	spec, sources := fixtureRequestParts(t)
	ctx := context.Background()

	first, err := client.Build(ctx, connect.NewRequest(&kinematicsv1.BuildRequest{Spec: spec, Sources: sources}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, first.Msg.GetReport().GetFailures(), test.ShouldBeEmpty)
	test.That(t, len(first.Msg.GetModelJson()), test.ShouldBeGreaterThan, 0)
	test.That(t, frameNames(first.Msg.GetFrames()), test.ShouldResemble, []string{RootFrameID, "frame", "cup", "tcp"})

	second, err := client.Build(ctx, connect.NewRequest(&kinematicsv1.BuildRequest{Spec: spec, Sources: sources}))
	test.That(t, err, test.ShouldBeNil)
	seen := map[string]bool{}
	for i, tr := range first.Msg.GetFrames() {
		test.That(t, bytes.Equal(tr.GetUuid(), second.Msg.GetFrames()[i].GetUuid()), test.ShouldBeTrue)
		test.That(t, len(tr.GetUuid()), test.ShouldEqual, 16)
		seen[string(tr.GetUuid())] = true
	}
	test.That(t, len(seen), test.ShouldEqual, 4)
}

func TestKinematicsServiceBuildVisualMeshes(t *testing.T) {
	client := newKinematicsClient(t)
	spec, sources := fixtureRequestParts(t)
	resp, err := client.Build(context.Background(), connect.NewRequest(&kinematicsv1.BuildRequest{
		Spec: spec, Sources: sources, IncludeVisualMeshes: true,
	}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, frameNames(resp.Msg.GetFrames()), test.ShouldResemble,
		[]string{RootFrameID, "frame", "cup", "tcp", "frame visual", "cup visual"})

	want := map[string]int{"cup visual": 960, "frame visual": 12}
	for _, tr := range resp.Msg.GetFrames()[4:] {
		test.That(t, tr.GetPoseInObserverFrame().GetReferenceFrame(), test.ShouldEqual, strings.TrimSuffix(tr.GetReferenceFrame(), " visual"))
		meshProto := tr.GetPhysicalObject().GetMesh()
		test.That(t, meshProto, test.ShouldNotBeNil)
		mesh, err := spatialmath.NewMeshFromProto(spatialmath.NewZeroPose(), meshProto, tr.GetReferenceFrame())
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(mesh.Triangles()), test.ShouldEqual, want[tr.GetReferenceFrame()])
	}
}

func TestKinematicsServiceBuildRejections(t *testing.T) {
	client := newKinematicsClient(t)
	ctx := context.Background()

	t.Run("unspecified unit", func(t *testing.T) {
		spec, sources := fixtureRequestParts(t)
		spec.Links[0].MeshUnit = kinematicsv1.LengthUnit_LENGTH_UNIT_UNSPECIFIED
		_, err := client.Build(ctx, connect.NewRequest(&kinematicsv1.BuildRequest{Spec: spec, Sources: sources}))
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})
	t.Run("escaping mesh file key", func(t *testing.T) {
		spec, sources := fixtureRequestParts(t)
		sources["../escape.stl"] = []byte("x")
		_, err := client.Build(ctx, connect.NewRequest(&kinematicsv1.BuildRequest{Spec: spec, Sources: sources}))
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})
	t.Run("missing spec", func(t *testing.T) {
		_, err := client.Build(ctx, connect.NewRequest(&kinematicsv1.BuildRequest{}))
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})
}

func TestKinematicsServiceExportPackage(t *testing.T) {
	client := newKinematicsClient(t)
	spec, sources := fixtureRequestParts(t)
	ctx := context.Background()
	req := func() *connect.Request[kinematicsv1.ExportRequest] {
		return connect.NewRequest(&kinematicsv1.ExportRequest{
			Spec: spec, Sources: sources, Kind: kinematicsv1.ExportKind_EXPORT_KIND_PACKAGE,
		})
	}

	first, err := client.Export(ctx, req())
	test.That(t, err, test.ShouldBeNil)
	test.That(t, first.Msg.GetFileName(), test.ShouldEqual, "fixture-tool-kinematics.zip")
	test.That(t, first.Msg.GetReport().GetFailures(), test.ShouldBeEmpty)

	var names []string
	for name := range readZip(t, first.Msg.GetZip()) {
		names = append(names, name)
	}
	sort.Strings(names)
	test.That(t, names, test.ShouldResemble, []string{
		"cube-300mm.stl", "kinematics.json", "kinematics/kinematics.go", "kinematics/model.json", "sphere-100mm.stl",
	})

	second, err := client.Export(ctx, req())
	test.That(t, err, test.ShouldBeNil)
	test.That(t, bytes.Equal(first.Msg.GetZip(), second.Msg.GetZip()), test.ShouldBeTrue)
}

func TestKinematicsServiceExportModule(t *testing.T) {
	stubRDKBuildInfo(t)
	client := newKinematicsClient(t)
	spec, sources := fixtureRequestParts(t)
	ctx := context.Background()

	_, err := client.Export(ctx, connect.NewRequest(&kinematicsv1.ExportRequest{
		Spec: spec, Sources: sources, Kind: kinematicsv1.ExportKind_EXPORT_KIND_MODULE,
	}))
	test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)

	_, err = client.Export(ctx, connect.NewRequest(&kinematicsv1.ExportRequest{Spec: spec, Sources: sources}))
	test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)

	resp, err := client.Export(ctx, connect.NewRequest(&kinematicsv1.ExportRequest{
		Spec: spec, Sources: sources, Kind: kinematicsv1.ExportKind_EXPORT_KIND_MODULE, Namespace: "acme",
	}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, resp.Msg.GetFileName(), test.ShouldEqual, "fixture-tool.zip")
	files := readZip(t, resp.Msg.GetZip())
	test.That(t, files, test.ShouldContainKey, "fixture-tool/go.mod")
	test.That(t, files, test.ShouldContainKey, "fixture-tool/meta.json")
	for name := range files {
		test.That(t, name, test.ShouldStartWith, "fixture-tool/")
	}
}
