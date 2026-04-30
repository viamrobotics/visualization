package api

import (
	"math"
	"testing"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/test"
)

// runDrawPointCloudTest loads a point cloud, draws it with the given colors and options, and validates the result.
func runDrawPointCloudTest(t *testing.T, filename string, name string, colors []draw.Color, downscalingThreshold float64) {
	t.Helper()

	pc, err := pointcloud.NewFromFile(filename, pointcloud.BasicType)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, pc, test.ShouldNotBeNil)

	uuid, err := DrawPointCloud(DrawPointCloudOptions{
		Name:                 name,
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

		drawing1, err := DrawPointCloud(DrawPointCloudOptions{Name: "octagon", PointCloud: pc1})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing1, test.ShouldNotBeNil)

		pc2, err := pointcloud.NewFromFile("../data/Zaghetto.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		drawing2, err := DrawPointCloud(DrawPointCloudOptions{Name: "Zaghetto", PointCloud: pc2})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing2, test.ShouldNotBeNil)

		pc3, err := pointcloud.NewFromFile("../data/simple.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		drawing3, err := DrawPointCloud(DrawPointCloudOptions{Name: "simple", PointCloud: pc3})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing3, test.ShouldNotBeNil)

		pc4, err := pointcloud.NewFromFile("../data/boat.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		drawing4, err := DrawPointCloud(DrawPointCloudOptions{Name: "boat", PointCloud: pc4})
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
			frac := float32(i) / n
			colors[i] = draw.ColorFromHSV(frac, 0.5+0.5*frac, 1.0)
		}

		runDrawPointCloudTest(
			t,
			"../data/Zaghetto.pcd",
			"simple_per_point",
			colors,
			0,
		)
	})

	t.Run("DrawSingleColorPointCloudWithOpacity", func(t *testing.T) {
		runDrawPointCloudTest(
			t,
			"../data/octagon.pcd",
			"octagon_with_opacity",
			[]draw.Color{draw.ColorFromRGBA(0, 0, 0, 64)},
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

	t.Run("DrawPointCloudInChunks", func(t *testing.T) {
		const numPoints = 2_500_000
		pc := pointcloud.NewBasicPointCloud(numPoints)

		goldenAngle := math.Pi * (3 - math.Sqrt(5))
		for i := range numPoints {
			frac := float64(i) / float64(numPoints)
			phi := math.Acos(1 - 2*frac)
			theta := goldenAngle * float64(i)
			r := 2000.0
			_ = pc.Set(r3.Vector{
				X: r * math.Sin(phi) * math.Cos(theta),
				Y: r * math.Sin(phi) * math.Sin(theta),
				Z: r * math.Cos(phi),
			}, nil)
		}

		uuid, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "chunked_point_cloud",
			PointCloud: pc,
			Colors:     []draw.Color{draw.ColorFromName("cyan")},
			ChunkSize:  500_000,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawPointCloudInChunksWithPalette", func(t *testing.T) {
		const numPoints = 2_500_000
		pc := pointcloud.NewBasicPointCloud(numPoints)

		goldenAngle := math.Pi * (3 - math.Sqrt(5))
		for i := range numPoints {
			frac := float64(i) / float64(numPoints)
			phi := math.Acos(1 - 2*frac)
			theta := goldenAngle * float64(i)
			r := 2000.0
			_ = pc.Set(r3.Vector{
				X: r * math.Sin(phi) * math.Cos(theta),
				Y: r * math.Sin(phi) * math.Sin(theta),
				Z: r * math.Cos(phi),
			}, nil)
		}

		palette := []draw.Color{
			draw.ColorFromName("red"),
			draw.ColorFromName("orange"),
			draw.ColorFromName("yellow"),
			draw.ColorFromName("lime"),
			draw.ColorFromName("cyan"),
			draw.ColorFromName("blue"),
			draw.ColorFromName("purple"),
		}

		uuid, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "chunked_point_cloud_palette",
			PointCloud: pc,
			Colors:     palette,
			ChunkSize:  500_000,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawPointCloudInChunksWithUniformOpacity", func(t *testing.T) {
		const numPoints = 2_500_000
		pc := pointcloud.NewBasicPointCloud(numPoints)

		goldenAngle := math.Pi * (3 - math.Sqrt(5))
		for i := range numPoints {
			frac := float64(i) / float64(numPoints)
			phi := math.Acos(1 - 2*frac)
			theta := goldenAngle * float64(i)
			r := 2000.0
			_ = pc.Set(r3.Vector{
				X: r * math.Sin(phi) * math.Cos(theta),
				Y: r * math.Sin(phi) * math.Sin(theta),
				Z: r * math.Cos(phi),
			}, nil)
		}

		uuid, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "chunked_point_cloud_uniform_opacity",
			PointCloud: pc,
			Colors:     []draw.Color{draw.ColorFromName("cyan").SetAlpha(64)},
			ChunkSize:  500_000,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawPointCloudInChunksWithPerPointColors", func(t *testing.T) {
		const numPoints = 2_500_000
		pc := pointcloud.NewBasicPointCloud(numPoints)

		goldenAngle := math.Pi * (3 - math.Sqrt(5))
		for i := range numPoints {
			frac := float64(i) / float64(numPoints)
			phi := math.Acos(1 - 2*frac)
			theta := goldenAngle * float64(i)
			r := 2000.0
			_ = pc.Set(r3.Vector{
				X: r * math.Sin(phi) * math.Cos(theta),
				Y: r * math.Sin(phi) * math.Sin(theta),
				Z: r * math.Cos(phi),
			}, nil)
		}

		colors := make([]draw.Color, numPoints)
		n := float32(numPoints)
		for i := range colors {
			colors[i] = draw.ColorFromHSV(float32(i)/n, 1, 1)
		}

		uuid, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "chunked_point_cloud_per_point",
			PointCloud: pc,
			Colors:     colors,
			ChunkSize:  500_000,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
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
				Name:       "DrawPointCloud updating",
				PointCloud: pc,
				Colors:     []draw.Color{palette[i%len(palette)]},
			})
			test.That(t, err, test.ShouldBeNil)
			test.That(t, uuid, test.ShouldNotBeNil)
			time.Sleep(16 * time.Millisecond)
		}
	})
}
