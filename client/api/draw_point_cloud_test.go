package api

import (
	"testing"
	"time"

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

		n := float32(pc.Size())
		colors := make([]draw.Color, pc.Size())
		for i := range colors {
			t := float32(i) / n
			colors[i] = draw.ColorFromHSV(t, 0.5+0.5*t, 1.0)
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

func TestDrawPointCloudUpdating(t *testing.T) {
	startTestServer(t)

	t.Run("DrawPointCloudUpdating", func(t *testing.T) {
		pc, err := pointcloud.NewFromFile("../data/octagon.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		palette := []draw.Color{
			draw.ColorFromName("red"),
			draw.ColorFromName("cyan"),
			draw.ColorFromName("yellow"),
			draw.ColorFromName("lime"),
			draw.ColorFromName("blue"),
			draw.ColorFromName("orange"),
			draw.ColorFromName("purple"),
		}

		for i := range 100 {
			uuid, err := DrawPointCloud(DrawPointCloudOptions{
				ID:         "updating",
				Label:      "DrawPointCloud updating",
				PointCloud: pc,
				Colors:     []draw.Color{palette[i%len(palette)]},
			})
			test.That(t, err, test.ShouldBeNil)
			test.That(t, uuid, test.ShouldNotBeNil)
			time.Sleep(16 * time.Millisecond)
		}
	})
}
