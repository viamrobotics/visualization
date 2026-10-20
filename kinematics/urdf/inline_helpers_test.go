package urdf

import (
	"fmt"
	"strings"
	"testing"
	"testing/fstest"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

const poseTolerance = 1e-6

// convertInline imports a URDF held in memory, with extra files beside it.
func convertInline(t *testing.T, urdfXML string, extra map[string]string, opts Options) (*Import, error) {
	t.Helper()
	files := fstest.MapFS{"robot.urdf": {Data: []byte(urdfXML)}}
	for name, data := range extra {
		files[name] = &fstest.MapFile{Data: []byte(data)}
	}
	return Convert(files, opts)
}

func mustConvertInline(t *testing.T, urdfXML string) *Import {
	t.Helper()
	imported, err := convertInline(t, urdfXML, nil, Options{})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	return imported
}

func robotXML(body string) string {
	return `<robot name="test">` + body + `</robot>`
}

// boxLink is a link with one box collision and no origin.
func boxLink(name string) string {
	return fmt.Sprintf(`<link name=%q><collision><geometry><box size="0.1 0.1 0.1"/></geometry></collision></link>`, name)
}

func joint(name, jointType, parent, child, inner string) string {
	return fmt.Sprintf(`<joint name=%q type=%q><parent link=%q/><child link=%q/>%s</joint>`, name, jointType, parent, child, inner)
}

func linkByID(t *testing.T, spec *kinematicsv1.KinematicsSpec, id string) *kinematicsv1.Link {
	t.Helper()
	for _, link := range spec.GetLinks() {
		if link.GetId() == id {
			return link
		}
	}
	t.Fatalf("no link %q in %v", id, linkIDs(spec))
	return nil
}

func jointByID(t *testing.T, spec *kinematicsv1.KinematicsSpec, id string) *kinematicsv1.Joint {
	t.Helper()
	for _, candidate := range spec.GetJoints() {
		if candidate.GetId() == id {
			return candidate
		}
	}
	t.Fatalf("no joint %q", id)
	return nil
}

func linkIDs(spec *kinematicsv1.KinematicsSpec) []string {
	ids := []string{}
	for _, link := range spec.GetLinks() {
		ids = append(ids, link.GetId())
	}
	return ids
}

func contains(list []string, want string) bool {
	for _, item := range list {
		if item == want {
			return true
		}
	}
	return false
}

func requireError(t *testing.T, err error, substrings ...string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected an error containing %q, got none", substrings)
	}
	for _, substring := range substrings {
		if !strings.Contains(err.Error(), substring) {
			t.Fatalf("error %q does not contain %q", err, substring)
		}
	}
}
