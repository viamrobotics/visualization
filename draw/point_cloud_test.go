package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/test"
)

func createTestPointCloud(t *testing.T, points []r3.Vector) pointcloud.PointCloud {
	t.Helper()
	pc := pointcloud.NewBasicPointCloud(len(points))
	for _, p := range points {
		if err := pc.Set(p, pointcloud.NewBasicData()); err != nil {
			t.Fatal(err)
		}
	}
	return pc
}

func TestNewDrawnPointCloud(t *testing.T) {
	t.Run("WithoutOptions", func(t *testing.T) {
		points := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		pc := createTestPointCloud(t, points)

		drawnPC, err := NewDrawnPointCloud(pc)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawnPC, test.ShouldNotBeNil)
		test.That(t, drawnPC.PointCloud, test.ShouldEqual, pc)
		test.That(t, drawnPC.Colors, test.ShouldBeNil)
	})

	t.Run("WithSingleColor", func(t *testing.T) {
		points := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		pc := createTestPointCloud(t, points)
		color := NewColor(WithName("red"))

		drawnPC, err := NewDrawnPointCloud(pc, WithSinglePointCloudColor(color))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawnPC, test.ShouldNotBeNil)
		test.That(t, len(drawnPC.Colors), test.ShouldEqual, 1)
		test.That(t, drawnPC.Colors[0], test.ShouldResemble, color)
	})

	t.Run("WithPerPointColors", func(t *testing.T) {
		points := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		pc := createTestPointCloud(t, points)
		colors := []Color{
			NewColor(WithName("red")),
			NewColor(WithName("green")),
			NewColor(WithName("blue")),
		}

		drawnPC, err := NewDrawnPointCloud(pc, WithPerPointCloudColors(colors...))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawnPC, test.ShouldNotBeNil)
		test.That(t, len(drawnPC.Colors), test.ShouldEqual, 3)
		test.That(t, drawnPC.Colors, test.ShouldResemble, colors)
	})

	t.Run("WithColorPalette", func(t *testing.T) {
		points := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
			{X: 0, Y: 0, Z: 1},
			{X: 1, Y: 1, Z: 0},
		}
		pc := createTestPointCloud(t, points)
		palette := []Color{
			NewColor(WithName("red")),
			NewColor(WithName("blue")),
		}

		drawnPC, err := NewDrawnPointCloud(pc, WithPointCloudColorPalette(palette, 5))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawnPC, test.ShouldNotBeNil)
		test.That(t, len(drawnPC.Colors), test.ShouldEqual, 5)
		// Verify the palette repeats correctly
		test.That(t, drawnPC.Colors[0], test.ShouldResemble, palette[0])
		test.That(t, drawnPC.Colors[1], test.ShouldResemble, palette[1])
		test.That(t, drawnPC.Colors[2], test.ShouldResemble, palette[0])
		test.That(t, drawnPC.Colors[3], test.ShouldResemble, palette[1])
		test.That(t, drawnPC.Colors[4], test.ShouldResemble, palette[0])
	})

	t.Run("WithValidDownscaling", func(t *testing.T) {
		points := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		pc := createTestPointCloud(t, points)

		drawnPC, err := NewDrawnPointCloud(pc, WithPointCloudDownscaling(5.0))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawnPC, test.ShouldNotBeNil)
		test.That(t, drawnPC.PointCloud, test.ShouldNotBeNil)
	})

	t.Run("WithInvalidDownscaling", func(t *testing.T) {
		points := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		pc := createTestPointCloud(t, points)

		drawnPC, err := NewDrawnPointCloud(pc, WithPointCloudDownscaling(-1.0))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "downscaling threshold must be greater than or equal to 0")
		test.That(t, drawnPC, test.ShouldBeNil)
	})
}
