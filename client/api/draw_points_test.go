package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/test"
)

var fourPoints = []r3.Vector{{X: 0}, {X: 100}, {X: 200}, {X: 300}}

func TestDrawPointsPositions(t *testing.T) {
	fake := startFake(t)

	_, err := DrawPoints(DrawPointsOptions{
		Name:      "points",
		Positions: []r3.Vector{{X: 1, Y: 2, Z: 3}},
	})
	test.That(t, err, test.ShouldBeNil)

	points := fake.onlyAddedDrawing(t).GetPhysicalObject().GetPoints()
	test.That(t, points, test.ShouldNotBeNil)
	test.That(t, decodeFloats(t, points.GetPositions()), test.ShouldResemble, []float32{1, 2, 3})
}

// The color switch has the same four arms as DrawLine, but no-colors takes the
// explicit DefaultPointColor rather than falling through to the draw layer.
func TestDrawPointsColorBranches(t *testing.T) {
	red := draw.ColorFromRGB(255, 0, 0)
	green := draw.ColorFromRGB(0, 255, 0)

	for _, tc := range []struct {
		name       string
		colors     []draw.Color
		wantLength int
	}{
		{name: "no colors uses the default", colors: nil, wantLength: 3},
		{name: "one color is shared", colors: []draw.Color{red}, wantLength: 3},
		{
			name:       "one color per point",
			colors:     []draw.Color{red, green, red, green},
			wantLength: 12,
		},
		{name: "a shorter palette cycles", colors: []draw.Color{red, green}, wantLength: 12},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawPoints(DrawPointsOptions{
				Name:      "colors",
				Positions: fourPoints,
				Colors:    tc.colors,
			})
			test.That(t, err, test.ShouldBeNil)

			colors := fake.onlyAddedDrawing(t).GetMetadata().GetColors()
			test.That(t, colors, test.ShouldHaveLength, tc.wantLength)
		})
	}
}

func TestDrawPointsDefaultColorIsGray(t *testing.T) {
	fake := startFake(t)

	_, err := DrawPoints(DrawPointsOptions{Name: "gray", Positions: fourPoints})
	test.That(t, err, test.ShouldBeNil)

	expected := []byte{
		draw.DefaultPointColor.R,
		draw.DefaultPointColor.G,
		draw.DefaultPointColor.B,
	}
	test.That(t, fake.onlyAddedDrawing(t).GetMetadata().GetColors(), test.ShouldResemble, expected)
}

func TestDrawPointsSize(t *testing.T) {
	for _, tc := range []struct {
		name string
		size float32
		want float32
	}{
		{name: "zero uses the default", size: 0, want: 10},
		{name: "a size is forwarded", size: 250, want: 250},
		{name: "a negative falls back to the default", size: -5, want: 10},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawPoints(DrawPointsOptions{
				Name:      "size",
				Positions: fourPoints,
				PointSize: tc.size,
			})
			test.That(t, err, test.ShouldBeNil)

			points := fake.onlyAddedDrawing(t).GetPhysicalObject().GetPoints()
			test.That(t, points.GetPointSize(), test.ShouldEqual, tc.want)
		})
	}
}

func TestDrawPointsRejections(t *testing.T) {
	t.Run("a non-ascii name is rejected first", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawPoints(DrawPointsOptions{Name: "café", Positions: fourPoints})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "not ascii")
	})

	t.Run("no visualizer is reported as such", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawPoints(DrawPointsOptions{Name: "ok", Positions: fourPoints})

		test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
	})

	t.Run("empty positions cannot form points", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPoints(DrawPointsOptions{Name: "empty"})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "failed to create points")
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
	})

	t.Run("an RPC failure is wrapped", func(t *testing.T) {
		fake := startFake(t)
		fake.errs["AddEntity"] = errRPCBoom

		_, err := DrawPoints(DrawPointsOptions{Name: "rpc", Positions: fourPoints})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntity RPC failed")
	})
}

// ChunkSize > 0 takes a different path entirely: one AddEntity carrying a chunks
// descriptor, then UpdateEntity per remaining chunk.
func TestDrawPointsChunkedDelivery(t *testing.T) {
	t.Run("declares the chunk geometry up front", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPoints(DrawPointsOptions{
			Name:      "chunked",
			Positions: fourPoints,
			ChunkSize: 2,
		})
		test.That(t, err, test.ShouldBeNil)

		chunks := fake.onlyAddedDrawing(t).GetMetadata().GetChunks()
		test.That(t, chunks, test.ShouldNotBeNil)
		test.That(t, chunks.GetChunkSize(), test.ShouldEqual, uint32(2))
		test.That(t, chunks.GetTotal(), test.ShouldEqual, uint32(4))
		// float32 xyz per point.
		test.That(t, chunks.GetStride(), test.ShouldEqual, uint32(12))
	})

	t.Run("sends the remaining chunks as updates", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPoints(DrawPointsOptions{
			Name:      "chunked",
			Positions: fourPoints,
			ChunkSize: 2,
		})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(t, fake.addEntity, test.ShouldHaveLength, 1)
		test.That(t, fake.updateEntity, test.ShouldNotBeEmpty)
	})

	t.Run("a chunk size at or above the total still chunks", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPoints(DrawPointsOptions{
			Name:      "one-chunk",
			Positions: fourPoints,
			ChunkSize: 100,
		})
		test.That(t, err, test.ShouldBeNil)

		chunks := fake.onlyAddedDrawing(t).GetMetadata().GetChunks()
		test.That(t, chunks, test.ShouldNotBeNil)
		test.That(t, chunks.GetChunkSize(), test.ShouldEqual, uint32(100))
	})

	t.Run("zero leaves the payload unchunked", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPoints(DrawPointsOptions{
			Name:      "unchunked",
			Positions: fourPoints,
			ChunkSize: 0,
		})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, fake.onlyAddedDrawing(t).GetMetadata().GetChunks(), test.ShouldBeNil)
		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(t, fake.updateEntity, test.ShouldBeEmpty)
	})

	t.Run("OnProgress is called and reaches completion", func(t *testing.T) {
		startFake(t)

		var reports []draw.ChunkProgress
		_, err := DrawPoints(DrawPointsOptions{
			Name:       "progress",
			Positions:  fourPoints,
			ChunkSize:  2,
			OnProgress: func(p draw.ChunkProgress) { reports = append(reports, p) },
		})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, reports, test.ShouldNotBeEmpty)
		last := reports[len(reports)-1]
		test.That(t, last.Sent, test.ShouldEqual, last.Total)
	})

	t.Run("a nil OnProgress is not a nil call", func(t *testing.T) {
		startFake(t)

		_, err := DrawPoints(DrawPointsOptions{
			Name:       "no-progress",
			Positions:  fourPoints,
			ChunkSize:  2,
			OnProgress: nil,
		})

		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("a build failure is reported before any RPC", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPoints(DrawPointsOptions{Name: "empty", ChunkSize: 2})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
	})
}
