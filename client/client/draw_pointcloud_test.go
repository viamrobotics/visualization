package client

import (
	"testing"

	"go.viam.com/rdk/pointcloud"
	"go.viam.com/test"
)

func TestDrawPointCloud(t *testing.T) {
	t.Run("DrawPointCloud", func(t *testing.T) {
		pc1, err := pointcloud.NewFromFile("../data/octagon.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		pc2, err := pointcloud.NewFromFile("../data/Zaghetto.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		pc3, err := pointcloud.NewFromFile("../data/simple.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)

		test.That(t, DrawPointCloud("octagon", pc1, &[3]uint8{0, 255, 0}), test.ShouldBeNil)
		test.That(t, DrawPointCloud("Zaghetto", pc2, nil), test.ShouldBeNil)
		test.That(t, DrawPointCloud("simple", pc3, nil), test.ShouldBeNil)
	})

}
