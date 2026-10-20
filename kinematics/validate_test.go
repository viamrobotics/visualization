package kinematics

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func marshalConfig(t *testing.T, cfg referenceframe.ModelConfigJSON) []byte {
	t.Helper()
	data, err := json.Marshal(cfg)
	test.That(t, err, test.ShouldBeNil)
	return data
}

func zeroOrientation(t *testing.T) *spatialmath.OrientationConfig {
	t.Helper()
	o, err := spatialmath.NewOrientationConfig(spatialmath.NewZeroOrientation())
	test.That(t, err, test.ShouldBeNil)
	return o
}

func TestValidateGarbage(t *testing.T) {
	report := Validate([]byte("not json"), "x")
	test.That(t, report, test.ShouldNotBeNil)
	test.That(t, len(report.GetFailures()), test.ShouldBeGreaterThan, 0)
	test.That(t, strings.Contains(report.GetFailures()[0], "parse"), test.ShouldBeTrue)
	test.That(t, report.GetDof(), test.ShouldEqual, 0)
}

func TestValidateTwoRoots(t *testing.T) {
	o := zeroOrientation(t)
	report := Validate(marshalConfig(t, referenceframe.ModelConfigJSON{
		Name:         "x",
		KinParamType: "SVA",
		Links: []referenceframe.LinkConfig{
			{ID: "a", Orientation: o},
			{ID: "b", Orientation: o},
		},
	}), "x")
	test.That(t, len(report.GetFailures()), test.ShouldBeGreaterThan, 0)
}

func TestValidateNoGeometry(t *testing.T) {
	report := Validate(marshalConfig(t, referenceframe.ModelConfigJSON{
		Name:         "x",
		KinParamType: "SVA",
		Links:        []referenceframe.LinkConfig{{ID: "a", Orientation: zeroOrientation(t)}},
		OutputFrames: []string{"a"},
	}), "x")
	found := false
	for _, f := range report.GetFailures() {
		found = found || strings.Contains(f, "no geometry")
	}
	test.That(t, found, test.ShouldBeTrue)
}

func TestValidateBox(t *testing.T) {
	o := zeroOrientation(t)
	data := marshalConfig(t, referenceframe.ModelConfigJSON{
		Name:         "x",
		KinParamType: "SVA",
		Links: []referenceframe.LinkConfig{{
			ID:          "a",
			Orientation: o,
			Geometry: &spatialmath.GeometryConfig{
				Type: spatialmath.BoxType, X: 10, Y: 20, Z: 30, Label: "a", OrientationOffset: *o,
			},
		}},
		OutputFrames: []string{"a"},
	})
	report := Validate(data, "x")
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	test.That(t, report.GetModelBytes(), test.ShouldEqual, len(data))
	test.That(t, len(report.GetLinks()), test.ShouldEqual, 1)
	link := report.GetLinks()[0]
	test.That(t, link.GetId(), test.ShouldEqual, "a")
	test.That(t, link.GetShape(), test.ShouldEqual, kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX)
	test.That(t, link.GetTriangles(), test.ShouldEqual, 0)
	got := r3.Vector{X: link.GetExtent().GetX(), Y: link.GetExtent().GetY(), Z: link.GetExtent().GetZ()}
	test.That(t, got, test.ShouldResemble, r3.Vector{X: 10, Y: 20, Z: 30})
}
