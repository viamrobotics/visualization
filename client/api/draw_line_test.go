package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/test"
)

// fourPointLine gives the color switches a position count that is neither 1 nor
// a palette length, so per-vertex and palette cases stay distinguishable.
var fourPointLine = []r3.Vector{
	{X: 0}, {X: 1000}, {X: 2000}, {X: 3000},
}

func TestDrawLinePositions(t *testing.T) {
	fake := startFake(t)

	_, err := DrawLine(DrawLineOptions{
		Name:      "positions",
		Positions: []r3.Vector{{X: 1, Y: 2, Z: 3}, {X: 4, Y: 5, Z: 6}},
	})
	test.That(t, err, test.ShouldBeNil)

	line := fake.onlyAddedDrawing(t).GetPhysicalObject().GetLine()
	test.That(t, line, test.ShouldNotBeNil)
	test.That(
		t,
		decodeFloats(t, line.GetPositions()),
		test.ShouldResemble,
		[]float32{1, 2, 3, 4, 5, 6},
	)
}

// Colors selects between four branches on count: none, one shared, one per
// vertex, and anything else cycled as a palette. Each lands as a different
// number of RGB triplets in metadata.
func TestDrawLineColorBranches(t *testing.T) {
	red := draw.ColorFromRGB(255, 0, 0)
	green := draw.ColorFromRGB(0, 255, 0)

	for _, tc := range []struct {
		name       string
		colors     []draw.Color
		wantColors []byte
	}{
		{
			name:       "no colors uses the default",
			colors:     nil,
			wantColors: []byte{0, 0, 255},
		},
		{
			name:       "one color is shared across segments",
			colors:     []draw.Color{red},
			wantColors: []byte{255, 0, 0},
		},
		{
			name:   "one color per vertex is sent verbatim",
			colors: []draw.Color{red, green, red, green},
			wantColors: []byte{
				255, 0, 0,
				0, 255, 0,
				255, 0, 0,
				0, 255, 0,
			},
		},
		{
			name:   "a shorter palette cycles to the vertex count",
			colors: []draw.Color{red, green},
			wantColors: []byte{
				255, 0, 0,
				0, 255, 0,
				255, 0, 0,
				0, 255, 0,
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawLine(DrawLineOptions{
				Name:      "colors",
				Positions: fourPointLine,
				Colors:    tc.colors,
			})
			test.That(t, err, test.ShouldBeNil)

			metadata := fake.onlyAddedDrawing(t).GetMetadata()
			test.That(t, metadata.GetColors(), test.ShouldResemble, tc.wantColors)
		})
	}
}

// DotColors follows the same count rules, and falls back to Colors when empty so
// dots and segments share a palette by default.
func TestDrawLineDotColorBranches(t *testing.T) {
	red := draw.ColorFromRGB(255, 0, 0)
	blue := draw.ColorFromRGB(0, 0, 255)

	for _, tc := range []struct {
		name          string
		colors        []draw.Color
		dotColors     []draw.Color
		wantDotColors []byte
	}{
		{
			name:          "neither set uses the dot default",
			wantDotColors: []byte{0, 0, 139},
		},
		{
			name:          "empty DotColors falls back to Colors",
			colors:        []draw.Color{red},
			wantDotColors: []byte{255, 0, 0},
		},
		{
			name:          "DotColors overrides Colors",
			colors:        []draw.Color{red},
			dotColors:     []draw.Color{blue},
			wantDotColors: []byte{0, 0, 255},
		},
		{
			name:      "one dot color per vertex",
			dotColors: []draw.Color{red, blue, red, blue},
			wantDotColors: []byte{
				255, 0, 0,
				0, 0, 255,
				255, 0, 0,
				0, 0, 255,
			},
		},
		{
			name:      "a shorter dot palette cycles",
			dotColors: []draw.Color{red, blue},
			wantDotColors: []byte{
				255, 0, 0,
				0, 0, 255,
				255, 0, 0,
				0, 0, 255,
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawLine(DrawLineOptions{
				Name:      "dots",
				Positions: fourPointLine,
				Colors:    tc.colors,
				DotColors: tc.dotColors,
			})
			test.That(t, err, test.ShouldBeNil)

			line := fake.onlyAddedDrawing(t).GetPhysicalObject().GetLine()
			test.That(t, line.GetDotColors(), test.ShouldResemble, tc.wantDotColors)
		})
	}
}

// Width and size are only forwarded when positive, and the draw layer fills the
// documented defaults in their place rather than leaving the fields unset.
func TestDrawLineWidthAndDotSize(t *testing.T) {
	for _, tc := range []struct {
		name      string
		lineWidth float32
		dotSize   float32
		wantWidth float32
		wantDot   float32
	}{
		{name: "zero uses the defaults", wantWidth: 5, wantDot: 10},
		{name: "line width is forwarded", lineWidth: 50, wantWidth: 50, wantDot: 10},
		{name: "dot size is forwarded", dotSize: 200, wantWidth: 5, wantDot: 200},
		{
			name:      "both are forwarded",
			lineWidth: 25,
			dotSize:   75,
			wantWidth: 25,
			wantDot:   75,
		},
		{
			// The guard is `> 0`, so a negative never reaches the draw layer.
			name:      "a negative width falls back to the default",
			lineWidth: -10,
			wantWidth: 5,
			wantDot:   10,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawLine(DrawLineOptions{
				Name:      "sizes",
				Positions: twoPointLine,
				LineWidth: tc.lineWidth,
				DotSize:   tc.dotSize,
			})
			test.That(t, err, test.ShouldBeNil)

			line := fake.onlyAddedDrawing(t).GetPhysicalObject().GetLine()
			test.That(t, line.GetLineWidth(), test.ShouldEqual, tc.wantWidth)
			test.That(t, line.GetDotSize(), test.ShouldEqual, tc.wantDot)
		})
	}
}

func TestDrawLineRejections(t *testing.T) {
	t.Run("a non-ascii name is rejected before the client is touched", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawLine(DrawLineOptions{Name: "café", Positions: twoPointLine})

		// Not ErrVisualizerNotRunning: validation runs first, so the name error
		// wins even with no visualizer at all.
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "not ascii")
	})

	t.Run("no visualizer is reported as such", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawLine(DrawLineOptions{Name: "ok", Positions: twoPointLine})

		test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
	})

	t.Run("a single position cannot form a line", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{Name: "short", Positions: []r3.Vector{{}}})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "failed to create line")
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
	})

	t.Run("no positions cannot form a line", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{Name: "empty"})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
	})

	t.Run("an RPC failure is wrapped, not swallowed", func(t *testing.T) {
		fake := startFake(t)
		fake.errs["AddEntity"] = errRPCBoom

		uuid, err := DrawLine(DrawLineOptions{Name: "rpc", Positions: twoPointLine})

		test.That(t, uuid, test.ShouldBeNil)
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntity RPC failed")
	})
}

func TestDrawLineReturnsTheServerUUID(t *testing.T) {
	fake := startFake(t)
	fake.uuids = [][]byte{{0xde, 0xad, 0xbe, 0xef}}

	uuid, err := DrawLine(DrawLineOptions{Name: "returned", Positions: twoPointLine})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuid, test.ShouldResemble, []byte{0xde, 0xad, 0xbe, 0xef})
}
