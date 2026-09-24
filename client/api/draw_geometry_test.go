package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func testBox(t *testing.T, label string) spatialmath.Geometry {
	t.Helper()
	box, err := spatialmath.NewBox(
		spatialmath.NewZeroPose(),
		r3.Vector{X: 100, Y: 100, Z: 100},
		label,
	)
	test.That(t, err, test.ShouldBeNil)
	return box
}

func TestDrawGeometrySendsATransform(t *testing.T) {
	fake := startFake(t)

	_, err := DrawGeometry(DrawGeometryOptions{
		Name:     "my-box",
		Geometry: testBox(t, "box-label"),
		Color:    draw.ColorFromRGB(255, 0, 0),
	})
	test.That(t, err, test.ShouldBeNil)

	// A geometry travels as a Transform, not a Drawing.
	transform := fake.onlyAddedTransform(t)
	test.That(t, transform.GetReferenceFrame(), test.ShouldEqual, "my-box")
	test.That(t, transform.GetPhysicalObject(), test.ShouldNotBeNil)
}

func TestDrawGeometryRequiresAVisualizer(t *testing.T) {
	requireNoServer(t)

	_, err := DrawGeometry(DrawGeometryOptions{Name: "x", Geometry: testBox(t, "b")})

	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestDrawGeometryWrapsRPCFailures(t *testing.T) {
	fake := startFake(t)
	fake.errs["AddEntity"] = errRPCBoom

	_, err := DrawGeometry(DrawGeometryOptions{Name: "x", Geometry: testBox(t, "b")})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntity RPC failed")
}

// DrawGeometry does not run the ascii check that DrawLine and the other drawing
// calls run, so a name it would reject reaches the server instead. See
// TestNameValidationIsInconsistentAcrossTheAPI for the full split.
func TestDrawGeometryDoesNotValidateTheName(t *testing.T) {
	fake := startFake(t)

	_, err := DrawGeometry(DrawGeometryOptions{
		Name:     "café",
		Geometry: testBox(t, "box-label"),
	})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, fake.onlyAddedTransform(t).GetReferenceFrame(), test.ShouldEqual, "café")
}

// The ascii check guards six of the twelve Draw* entry points. The calls that
// derive names from RDK types are arguably fine without it, but DrawGeometry and
// DrawGeometriesInFrame take a caller-supplied name and still skip it.
func TestNameValidationIsInconsistentAcrossTheAPI(t *testing.T) {
	nonASCII := "café"

	t.Run("DrawLine rejects it", func(t *testing.T) {
		startFake(t)

		_, err := DrawLine(DrawLineOptions{Name: nonASCII, Positions: twoPointLine})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "not ascii")
	})

	t.Run("DrawPoints rejects it", func(t *testing.T) {
		startFake(t)

		_, err := DrawPoints(DrawPointsOptions{Name: nonASCII, Positions: fourPoints})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "not ascii")
	})

	t.Run("DrawGeometry accepts it", func(t *testing.T) {
		startFake(t)

		_, err := DrawGeometry(DrawGeometryOptions{
			Name:     nonASCII,
			Geometry: testBox(t, "b"),
		})

		test.That(t, err, test.ShouldBeNil)
	})
}
