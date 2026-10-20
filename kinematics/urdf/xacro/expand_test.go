package xacro

import (
	"encoding/xml"
	"errors"
	"io/fs"
	"os"
	"path"
	"strings"
	"testing"
	"testing/fstest"

	"go.viam.com/test"
)

const fixtureEntry = "urdf/robot.urdf.xacro"

// findInFixtures returns a FindPackage that scans files for the package.xml naming the package. It
// returns the directory rooted at the files, since a `/` path is relative to their root.
func findInFixtures(files fs.FS) func(name string) (string, error) {
	return func(name string) (string, error) {
		var found string
		err := fs.WalkDir(files, ".", func(p string, entry fs.DirEntry, err error) error {
			if err != nil || entry.IsDir() || path.Base(p) != "package.xml" {
				return err
			}
			data, err := fs.ReadFile(files, p)
			if err != nil {
				return err
			}
			var manifest struct {
				Name string `xml:"name"`
			}
			if err := xml.Unmarshal(data, &manifest); err != nil {
				return err
			}
			if manifest.Name == name {
				found = "/" + path.Dir(p)
			}
			return nil
		})
		if err == nil && found == "" {
			err = errors.New("package not found: " + name)
		}
		return found, err
	}
}

func TestExpandMatchesXacro(t *testing.T) {
	tests := []struct {
		name    string
		fixture string
		golden  string
		args    map[string]string
	}{
		{"properties with arithmetic, pi, and radians", "properties", "properties", nil},
		{"macro with default params and a block param", "macro-block", "macro-block", nil},
		{"macro library included from a macro body", "include-macro", "include-macro", nil},
		{"if and unless on arg defaults", "conditionals", "conditionals", nil},
		{"if and unless on arg overrides", "conditionals", "conditionals-off", map[string]string{"with_camera": "false", "mount_height": "2"}},
		{"one macro calling another", "nested-macros", "nested-macros", nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			files := os.DirFS("testdata/" + tc.fixture)
			got, err := Expand(files, fixtureEntry, Options{Args: tc.args, FindPackage: findInFixtures(files)})
			test.That(t, err, test.ShouldBeNil)

			want, err := os.ReadFile("testdata/" + tc.golden + ".golden.urdf")
			test.That(t, err, test.ShouldBeNil)
			test.That(t, canonicalize(t, got).diff(canonicalize(t, want), ""), test.ShouldEqual, "")
		})
	}
}

func TestExpandOutputHasNoXacro(t *testing.T) {
	files := os.DirFS("testdata/include-macro")
	got, err := Expand(files, fixtureEntry, Options{FindPackage: findInFixtures(files)})
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(got), test.ShouldNotContainSubstring, "xacro")
	test.That(t, string(got), test.ShouldNotContainSubstring, "<!--")
}

func TestExpandUnsupported(t *testing.T) {
	tests := []struct {
		name    string
		library string
		feature string
	}{
		{"load_yaml in an expression", `<link name="${xacro.load_yaml('limits.yaml')}"/>`, "xacro.load_yaml"},
		{"env directive", `<link name="$(env HOME)"/>`, "$(env)"},
		{"xacro:element", `<xacro:element xacro:name="link"/>`, "xacro:element"},
		{"xacro:attribute", `<xacro:attribute name="a" value="b"/>`, "xacro:attribute"},
		{"xacro:call", `<xacro:call macro="m"/>`, "xacro:call"},
		{"include ns", `<xacro:include filename="x.xacro" ns="x"/>`, "xacro:include ns"},
		{"property scope", `<xacro:property name="p" value="1" scope="parent"/>`, "xacro:property scope"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			files := fstest.MapFS{
				"main.xacro":      {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:include filename="parts/arm.xacro"/></robot>`)},
				"parts/arm.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro">` + tc.library + `</robot>`)},
			}
			got, err := Expand(files, "main.xacro", Options{})
			test.That(t, got, test.ShouldBeNil)

			var unsupported *UnsupportedError
			test.That(t, errors.As(err, &unsupported), test.ShouldBeTrue)
			test.That(t, unsupported.Feature, test.ShouldEqual, tc.feature)
			test.That(t, unsupported.File, test.ShouldEqual, "parts/arm.xacro")
			test.That(t, unsupported.Entry, test.ShouldEqual, "main.xacro")
			test.That(t, err.Error(), test.ShouldContainSubstring, Command("main.xacro"))
		})
	}
}

func TestExpandErrors(t *testing.T) {
	tests := []struct {
		name     string
		files    fstest.MapFS
		contains []string
	}{
		{
			"undefined macro names the macro and the file",
			fstest.MapFS{"main.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:foo/></robot>`)}},
			[]string{"foo", "main.xacro"},
		},
		{
			"include cycle names the files",
			fstest.MapFS{
				"main.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:include filename="a.xacro"/></robot>`)},
				"a.xacro":    {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:include filename="b.xacro"/></robot>`)},
				"b.xacro":    {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:include filename="/a.xacro"/></robot>`)},
			},
			[]string{"include cycle", "a.xacro", "b.xacro"},
		},
		{
			"undefined name",
			fstest.MapFS{"main.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><link name="${nope}"/></robot>`)}},
			[]string{"nope", "main.xacro"},
		},
		{
			"circular property",
			fstest.MapFS{"main.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:property name="a" value="${a}"/><link name="${a}"/></robot>`)}},
			[]string{"circular", "a"},
		},
		{
			"non-boolean condition",
			fstest.MapFS{"main.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:if value="maybe"/></robot>`)}},
			[]string{"maybe"},
		},
		{
			"unused block",
			fstest.MapFS{"main.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:macro name="m" params="a"/><xacro:m a="1"><extra/></xacro:m></robot>`)}},
			[]string{"unused block", "extra"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Expand(tc.files, "main.xacro", Options{})
			test.That(t, got, test.ShouldBeNil)
			test.That(t, err, test.ShouldNotBeNil)

			var unsupported *UnsupportedError
			test.That(t, errors.As(err, &unsupported), test.ShouldBeFalse)
			for _, want := range tc.contains {
				test.That(t, err.Error(), test.ShouldContainSubstring, want)
			}
		})
	}
}

func TestExpandDirectives(t *testing.T) {
	files := fstest.MapFS{"main.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:arg name="a" default="1"/><v pkg="$(find p)" a="$(arg a)"/></robot>`)}}

	t.Run("find returns the lookup result verbatim", func(t *testing.T) {
		got, err := Expand(files, "main.xacro", Options{Args: map[string]string{"a": "9"}, FindPackage: func(string) (string, error) { return "/some dir", nil }})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, string(got), test.ShouldContainSubstring, `pkg="/some dir" a="9"`)
	})
	t.Run("find without a lookup fails", func(t *testing.T) {
		_, err := Expand(files, "main.xacro", Options{})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, strings.Contains(err.Error(), "find p"), test.ShouldBeTrue)
	})
}
