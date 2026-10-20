package api

import (
	"testing"

	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

// A cubic curve needs four control points and len(points)+degree+1 knots.
func testNurbs(t *testing.T) ([]spatialmath.Pose, []float64) {
	t.Helper()
	return testPoses(4), []float64{0, 0, 0, 0, 1, 1, 1, 1}
}

func TestDrawNurbsSendsADrawing(t *testing.T) {
	fake := startFake(t)
	points, knots := testNurbs(t)

	_, err := DrawNurbs(DrawNurbsOptions{Name: "curve", ControlPoints: points, Knots: knots})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.onlyAddedDrawing(t).GetPhysicalObject().GetNurbs(), test.ShouldNotBeNil)
}

// Degree, Weights and LineWidth are each forwarded only when set, so the draw
// layer's defaults apply otherwise.
func TestDrawNurbsOptionalFields(t *testing.T) {
	points, knots := testNurbs(t)

	for _, tc := range []struct {
		name      string
		degree    int32
		weights   []float64
		lineWidth float32
		wantErr   bool
	}{
		{name: "all defaults"},
		{name: "an explicit cubic degree", degree: 3},
		{name: "uniform weights", weights: []float64{1, 1, 1, 1}},
		{name: "a line width", lineWidth: 25},
		{name: "a non-positive degree falls back to the default", degree: -1},
		{name: "a wrong weight count is rejected", weights: []float64{1, 1}, wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawNurbs(DrawNurbsOptions{
				Name:          "curve",
				ControlPoints: points,
				Knots:         knots,
				Degree:        tc.degree,
				Weights:       tc.weights,
				LineWidth:     tc.lineWidth,
			})

			if tc.wantErr {
				test.That(t, err, test.ShouldNotBeNil)
				test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
				return
			}
			test.That(t, err, test.ShouldBeNil)
			test.That(t, fake.addEntityCount(), test.ShouldEqual, 1)
		})
	}
}

func TestDrawNurbsRejections(t *testing.T) {
	points, knots := testNurbs(t)

	t.Run("a non-ascii name is rejected first", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawNurbs(DrawNurbsOptions{
			Name: "café", ControlPoints: points, Knots: knots,
		})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "not ascii")
	})

	t.Run("no visualizer is reported as such", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawNurbs(DrawNurbsOptions{Name: "ok", ControlPoints: points, Knots: knots})

		test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
	})

	t.Run("a mismatched knot count is rejected", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawNurbs(DrawNurbsOptions{
			Name:          "bad-knots",
			ControlPoints: points,
			Knots:         []float64{0, 1},
		})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "failed to create NURBS curve")
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
	})

	t.Run("no control points is rejected", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawNurbs(DrawNurbsOptions{Name: "empty"})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
	})

	t.Run("an RPC failure is wrapped", func(t *testing.T) {
		fake := startFake(t)
		fake.errs["AddEntity"] = errRPCBoom

		_, err := DrawNurbs(DrawNurbsOptions{Name: "rpc", ControlPoints: points, Knots: knots})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntity RPC failed")
	})
}
