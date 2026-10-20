package kinematics

import (
	"bytes"
	"context"
	"testing"

	"connectrpc.com/connect"
	"go.viam.com/test"
	"google.golang.org/protobuf/proto"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func TestKinematicsServiceImportPackageRoundTrip(t *testing.T) {
	client := newKinematicsClient(t)
	spec, sources := fixtureRequestParts(t)
	ctx := context.Background()

	exported, err := client.Export(ctx, connect.NewRequest(&kinematicsv1.ExportRequest{
		Spec: spec, Sources: sources, Kind: kinematicsv1.ExportKind_EXPORT_KIND_PACKAGE,
	}))
	test.That(t, err, test.ShouldBeNil)

	imported, err := client.Import(ctx, connect.NewRequest(&kinematicsv1.ImportRequest{Zip: exported.Msg.GetZip()}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, proto.Equal(imported.Msg.GetSpec(), spec), test.ShouldBeTrue)
	test.That(t, imported.Msg.GetRoot(), test.ShouldEqual, "")
	test.That(t, imported.Msg.GetMissingSources(), test.ShouldBeEmpty)
	test.That(t, imported.Msg.GetSources(), test.ShouldResemble, sources)

	again, err := client.Export(ctx, connect.NewRequest(&kinematicsv1.ExportRequest{
		Spec: imported.Msg.GetSpec(), Sources: imported.Msg.GetSources(), Kind: kinematicsv1.ExportKind_EXPORT_KIND_PACKAGE,
	}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, bytes.Equal(again.Msg.GetZip(), exported.Msg.GetZip()), test.ShouldBeTrue)
}

func TestKinematicsServiceImportModule(t *testing.T) {
	stubRDKBuildInfo(t)
	client := newKinematicsClient(t)
	spec, sources := fixtureRequestParts(t)
	ctx := context.Background()

	exported, err := client.Export(ctx, connect.NewRequest(&kinematicsv1.ExportRequest{
		Spec: spec, Sources: sources, Kind: kinematicsv1.ExportKind_EXPORT_KIND_MODULE, Namespace: "acme",
	}))
	test.That(t, err, test.ShouldBeNil)

	imported, err := client.Import(ctx, connect.NewRequest(&kinematicsv1.ImportRequest{Zip: exported.Msg.GetZip()}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, imported.Msg.GetRoot(), test.ShouldEqual, "fixture-tool")
	test.That(t, imported.Msg.GetMissingSources(), test.ShouldBeEmpty)
	test.That(t, imported.Msg.GetSources(), test.ShouldNotBeEmpty)
	for meshPath := range imported.Msg.GetSources() {
		test.That(t, meshPath, test.ShouldStartWith, "cad/")
	}
}

func TestKinematicsServiceImportWithoutSpecIsNotFound(t *testing.T) {
	client := newKinematicsClient(t)
	_, err := client.Import(context.Background(), connect.NewRequest(&kinematicsv1.ImportRequest{
		Zip: mustZip(t, map[string][]byte{"a.txt": []byte("x")}),
	}))
	test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeNotFound)
}

func TestKinematicsServiceImportRejections(t *testing.T) {
	client := newKinematicsClient(t)
	ctx := context.Background()
	for name, zipBytes := range map[string][]byte{
		"empty":     nil,
		"malformed": []byte("not a zip"),
		"ambiguous": mustZip(t, map[string][]byte{"a/" + SpecFileName: []byte(`{}`), "b/" + SpecFileName: []byte(`{}`)}),
		"bad spec":  mustZip(t, map[string][]byte{SpecFileName: []byte("{nope")}),
	} {
		t.Run(name, func(t *testing.T) {
			_, err := client.Import(ctx, connect.NewRequest(&kinematicsv1.ImportRequest{Zip: zipBytes}))
			test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
		})
	}
}
