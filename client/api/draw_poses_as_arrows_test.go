package api

import (
	"testing"

	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func testPoses(count int) []spatialmath.Pose {
	poses := make([]spatialmath.Pose, count)
	for i := range poses {
		poses[i] = spatialmath.NewZeroPose()
	}
	return poses
}

func TestDrawPosesAsArrowsSendsADrawing(t *testing.T) {
	fake := startFake(t)

	_, err := DrawPosesAsArrows(DrawPosesAsArrowsOptions{Name: "arrows", Poses: testPoses(3)})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.onlyAddedDrawing(t).GetPhysicalObject().GetArrows(), test.ShouldNotBeNil)
}

func TestDrawPosesAsArrowsColorBranches(t *testing.T) {
	red := draw.ColorFromRGB(255, 0, 0)
	green := draw.ColorFromRGB(0, 255, 0)

	for _, tc := range []struct {
		name       string
		colors     []draw.Color
		wantLength int
	}{
		{name: "empty uses DefaultArrowColor", colors: nil, wantLength: 3},
		{name: "one color is shared", colors: []draw.Color{red}, wantLength: 3},
		{
			name:       "one color per pose",
			colors:     []draw.Color{red, green, red},
			wantLength: 9,
		},
		{name: "a shorter palette cycles", colors: []draw.Color{red, green}, wantLength: 9},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawPosesAsArrows(DrawPosesAsArrowsOptions{
				Name:   "colors",
				Poses:  testPoses(3),
				Colors: tc.colors,
			})
			test.That(t, err, test.ShouldBeNil)

			colors := fake.onlyAddedDrawing(t).GetMetadata().GetColors()
			test.That(t, colors, test.ShouldHaveLength, tc.wantLength)
		})
	}
}

func TestDrawPosesAsArrowsRejections(t *testing.T) {
	t.Run("a non-ascii name is rejected first", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawPosesAsArrows(DrawPosesAsArrowsOptions{Name: "café", Poses: testPoses(1)})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "not ascii")
	})

	t.Run("no visualizer is reported as such", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawPosesAsArrows(DrawPosesAsArrowsOptions{Name: "ok", Poses: testPoses(1)})

		test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
	})

	t.Run("an RPC failure is wrapped", func(t *testing.T) {
		fake := startFake(t)
		fake.errs["AddEntity"] = errRPCBoom

		_, err := DrawPosesAsArrows(DrawPosesAsArrowsOptions{Name: "rpc", Poses: testPoses(1)})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntity RPC failed")
	})
}

// No poses is accepted rather than rejected, so an empty arrows drawing is a
// legal thing to send.
func TestDrawPosesAsArrowsAcceptsNoPoses(t *testing.T) {
	fake := startFake(t)

	_, err := DrawPosesAsArrows(DrawPosesAsArrowsOptions{Name: "empty"})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, fake.addEntityCount(), test.ShouldEqual, 1)
}
