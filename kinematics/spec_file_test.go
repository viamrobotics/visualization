package kinematics

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"go.viam.com/test"
	"google.golang.org/protobuf/proto"
)

func TestLoadSpec(t *testing.T) {
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, len(spec.GetLinks()), test.ShouldEqual, 2)
	test.That(t, spec.GetLinks()[0].GetId(), test.ShouldEqual, "frame")
	test.That(t, spec.GetLinks()[1].GetId(), test.ShouldEqual, "cup")
	test.That(t, spec.GetLinks()[1].GetMaxTriangles(), test.ShouldEqual, 200)
	test.That(t, spec.GetTcpPose().GetZ(), test.ShouldEqual, 400)

	t.Run("lowerCamelCase parses equal", func(t *testing.T) {
		raw, err := os.ReadFile(filepath.Join("testdata", SpecFileName))
		test.That(t, err, test.ShouldBeNil)
		camel := string(raw)
		for snake, c := range map[string]string{
			"mesh_path":     "meshPath",
			"mesh_unit":     "meshUnit",
			"max_triangles": "maxTriangles",
			"tcp_pose":      "tcpPose",
			"o_z":           "oZ",
		} {
			camel = strings.ReplaceAll(camel, "\""+snake+"\"", "\""+c+"\"")
		}
		test.That(t, camel, test.ShouldNotEqual, string(raw))
		path := filepath.Join(t.TempDir(), "camel.json")
		test.That(t, os.WriteFile(path, []byte(camel), 0o600), test.ShouldBeNil)
		got, err := LoadSpec(path)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, proto.Equal(got, spec), test.ShouldBeTrue)
	})

	t.Run("missing file", func(t *testing.T) {
		_, err := LoadSpec(filepath.Join(t.TempDir(), "nope.json"))
		test.That(t, errors.Is(err, fs.ErrNotExist), test.ShouldBeTrue)
	})

	t.Run("unknown field is an error", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "typo.json")
		test.That(t, os.WriteFile(path, []byte(`{"nmae": "x"}`), 0o600), test.ShouldBeNil)
		_, err := LoadSpec(path)
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, path)
	})
}

func TestMarshalSpec(t *testing.T) {
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)

	first, err := MarshalSpec(spec)
	test.That(t, err, test.ShouldBeNil)
	second, err := MarshalSpec(spec)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(first), test.ShouldEqual, string(second))

	test.That(t, string(first), test.ShouldContainSubstring, `"mesh_path"`)
	test.That(t, string(first), test.ShouldNotContainSubstring, `"meshPath"`)
	test.That(t, strings.HasSuffix(string(first), "}\n"), test.ShouldBeTrue)

	path := filepath.Join(t.TempDir(), SpecFileName)
	test.That(t, os.WriteFile(path, first, 0o600), test.ShouldBeNil)
	got, err := LoadSpec(path)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, proto.Equal(got, spec), test.ShouldBeTrue)
}
