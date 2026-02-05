package client

import (
	"testing"

	"go.viam.com/rdk/pointcloud"
	"go.viam.com/test"
)

func TestHover(t *testing.T) {
	t.Run("TestHover", func(t *testing.T) {
		poses := generateSpherePoses(10_000, 1000, 1500, 1500, -300)

		test.That(t, DrawPoses(poses, []string{"yellow", "red"}, true), test.ShouldBeNil)

		pcd, err := pointcloud.NewFromFile("../data/boat.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		test.That(t, DrawPointCloud("boat", pcd, nil), test.ShouldBeNil)
	})
}
