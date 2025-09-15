package client

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"
)

func TestSetCameraPose(t *testing.T) {
	t.Run("SetCameraPose", func(t *testing.T) {
		position := r3.Vector{X: 10000., Y: 20000., Z: 10000.}
		lookAt := r3.Vector{X: 100., Y: 500., Z: 800.}
		test.That(t, SetCameraPose(position, lookAt, true), test.ShouldBeNil)
	})
}
