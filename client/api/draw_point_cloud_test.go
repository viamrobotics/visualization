package api

import (
	"testing"

	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/test"
)

func testPointCloud(t *testing.T) pointcloud.PointCloud {
	t.Helper()
	cloud, err := pointcloud.NewFromFile("../data/simple.pcd", pointcloud.BasicType)
	test.That(t, err, test.ShouldBeNil)
	return cloud
}

func TestDrawPointCloudSendsATransform(t *testing.T) {
	fake := startFake(t)

	_, err := DrawPointCloud(DrawPointCloudOptions{
		Name:       "cloud",
		PointCloud: testPointCloud(t),
	})
	test.That(t, err, test.ShouldBeNil)

	// A point cloud travels as a Transform, unlike DrawPoints which sends a Drawing.
	transform := fake.onlyAddedTransform(t)
	test.That(t, transform.GetReferenceFrame(), test.ShouldEqual, "cloud")
}

// Unlike buildPoints, buildPointCloud adds no color option at all when Colors is
// empty, leaving the default to the draw layer rather than naming it here.
func TestDrawPointCloudColorBranches(t *testing.T) {
	cloud := testPointCloud(t)
	red := draw.ColorFromRGB(255, 0, 0)
	green := draw.ColorFromRGB(0, 255, 0)

	t.Run("no colors leaves the draw layer's default", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPointCloud(DrawPointCloudOptions{Name: "default", PointCloud: cloud})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, fake.onlyAddedTransform(t), test.ShouldNotBeNil)
	})

	t.Run("one color is shared across the cloud", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "single",
			PointCloud: cloud,
			Colors:     []draw.Color{red},
		})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, fake.onlyAddedTransform(t), test.ShouldNotBeNil)
	})

	t.Run("one color per point", func(t *testing.T) {
		fake := startFake(t)

		colors := make([]draw.Color, cloud.Size())
		for i := range colors {
			colors[i] = red
		}

		_, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "per-point",
			PointCloud: cloud,
			Colors:     colors,
		})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, fake.addEntityCount(), test.ShouldEqual, 1)
	})

	t.Run("a shorter palette cycles", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "palette",
			PointCloud: cloud,
			Colors:     []draw.Color{red, green},
		})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, fake.addEntityCount(), test.ShouldEqual, 1)
	})
}

func TestDrawPointCloudRejectsANegativeDownscalingThreshold(t *testing.T) {
	fake := startFake(t)

	_, err := DrawPointCloud(DrawPointCloudOptions{
		Name:                 "negative",
		PointCloud:           testPointCloud(t),
		DownscalingThreshold: -1,
	})

	// The guard is `> 0`, so a negative never reaches the draw layer and the
	// cloud is drawn undownscaled rather than rejected.
	test.That(t, err, test.ShouldBeNil)
	test.That(t, fake.addEntityCount(), test.ShouldEqual, 1)
}

func TestDrawPointCloudRejections(t *testing.T) {
	t.Run("a non-ascii name is rejected first", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawPointCloud(DrawPointCloudOptions{Name: "café"})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "not ascii")
	})

	t.Run("no visualizer is reported as such", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawPointCloud(DrawPointCloudOptions{Name: "ok"})

		test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
	})

	t.Run("an RPC failure is wrapped", func(t *testing.T) {
		fake := startFake(t)
		fake.errs["AddEntity"] = errRPCBoom

		_, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "rpc",
			PointCloud: testPointCloud(t),
		})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntity RPC failed")
	})
}

func TestDrawPointCloudChunkedDelivery(t *testing.T) {
	// Where the chunks descriptor rides is draw's business and covered by its own
	// tests. What client/api owns is the choice of path, so these assert on the
	// RPC pattern the choice produces.
	t.Run("sends the remaining chunks as updates", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "chunked",
			PointCloud: testPointCloud(t),
			ChunkSize:  2,
		})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(t, fake.addEntity, test.ShouldHaveLength, 1)
		test.That(t, fake.updateEntity, test.ShouldNotBeEmpty)
	})

	t.Run("zero leaves the cloud unchunked", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "unchunked",
			PointCloud: testPointCloud(t),
			ChunkSize:  0,
		})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(t, fake.updateEntity, test.ShouldBeEmpty)
	})

	t.Run("OnProgress reaches completion", func(t *testing.T) {
		startFake(t)

		var reports []draw.ChunkProgress
		_, err := DrawPointCloud(DrawPointCloudOptions{
			Name:       "progress",
			PointCloud: testPointCloud(t),
			ChunkSize:  2,
			OnProgress: func(p draw.ChunkProgress) { reports = append(reports, p) },
		})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, reports, test.ShouldNotBeEmpty)
		last := reports[len(reports)-1]
		test.That(t, last.Sent, test.ShouldEqual, last.Total)
	})
}
