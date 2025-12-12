package client

import (
	"testing"

	"go.viam.com/test"
)

func TestRemoveAllSpatialObjects(t *testing.T) {
	t.Run("RemoveAllSpatialObjects", func(t *testing.T) {
		test.That(t, RemoveAllSpatialObjects(), test.ShouldBeNil)
	})
}
