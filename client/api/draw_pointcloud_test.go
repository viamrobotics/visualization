package api

import (
	"testing"

	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/test"
)

// runDrawPointCloudTest loads a point cloud, draws it with the given colors and options, and validates the result.
func runDrawPointCloudTest(t *testing.T, filename string, label string, colors []draw.Color, downscalingThreshold float64) {
	t.Helper()

	pc, err := pointcloud.NewFromFile(filename, pointcloud.BasicType)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, pc, test.ShouldNotBeNil)

	uuid, err := DrawPointCloud(DrawPointCloudOptions{
		Label:                label,
		PointCloud:           pc,
		Colors:               colors,
		DownscalingThreshold: downscalingThreshold,
	})
	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuid, test.ShouldNotBeNil)
}

func TestDrawPointCloud(t *testing.T) {
	startTestServer(t)

	t.Run("DrawPointClouds", func(t *testing.T) {
		pc1, err := pointcloud.NewFromFile("../data/octagon.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		drawing1, err := DrawPointCloud(DrawPointCloudOptions{Label: "octagon", PointCloud: pc1})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing1, test.ShouldNotBeNil)

		pc2, err := pointcloud.NewFromFile("../data/Zaghetto.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		drawing2, err := DrawPointCloud(DrawPointCloudOptions{Label: "Zaghetto", PointCloud: pc2})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing2, test.ShouldNotBeNil)

		pc3, err := pointcloud.NewFromFile("../data/simple.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		drawing3, err := DrawPointCloud(DrawPointCloudOptions{Label: "simple", PointCloud: pc3})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing3, test.ShouldNotBeNil)

		pc4, err := pointcloud.NewFromFile("../data/boat.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		drawing4, err := DrawPointCloud(DrawPointCloudOptions{Label: "boat", PointCloud: pc4})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing4, test.ShouldNotBeNil)
	})

	t.Run("DrawSingleColorPointCloud", func(t *testing.T) {
		runDrawPointCloudTest(
			t,
			"../data/octagon.pcd",
			"octagon_single_color",
			[]draw.Color{draw.ColorFromName("red")},
			0,
		)
	})

	t.Run("DrawPaletteColorPointCloud", func(t *testing.T) {
		palette := []draw.Color{
			draw.ColorFromName("blue"),
			draw.ColorFromName("cyan"),
			draw.ColorFromName("green"),
			draw.ColorFromName("lime"),
			draw.ColorFromName("yellow"),
			draw.ColorFromName("gold"),
			draw.ColorFromName("orange"),
			draw.ColorFromName("orangered"),
			draw.ColorFromName("red"),
			draw.ColorFromName("purple"),
		}

		runDrawPointCloudTest(
			t,
			"../data/Zaghetto.pcd",
			"Zaghetto_palette",
			palette,
			0,
		)
	})

	t.Run("DrawPerPointColorPointCloud", func(t *testing.T) {
		pc, err := pointcloud.NewFromFile("../data/simple.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		colors := make([]draw.Color, pc.Size())
		for i := range colors {
			t := float64(i) / float64(pc.Size()-1)
			var r, g, b uint8
			switch {
			case t < 0.25:
				localT := t / 0.25
				r = 0
				g = uint8(255 * localT)
				b = 255
			case t < 0.5:
				localT := (t - 0.25) / 0.25
				r = 0
				g = 255
				b = uint8(255 * (1 - localT))
			case t < 0.75:
				localT := (t - 0.5) / 0.25
				r = uint8(255 * localT)
				g = 255
				b = 0
			default:
				localT := (t - 0.75) / 0.25
				r = 255
				g = uint8(255 * (1 - localT))
				b = 0
			}

			colors[i] = draw.ColorFromRGB(r, g, b)
		}

		runDrawPointCloudTest(
			t,
			"../data/Zaghetto.pcd",
			"simple_per_point",
			colors,
			0,
		)
	})

	t.Run("DrawPointCloudWithDownscaling", func(t *testing.T) {
		runDrawPointCloudTest(
			t,
			"../data/Zaghetto.pcd",
			"boat_downscaled",
			[]draw.Color{},
			25.0,
		)
	})
}
