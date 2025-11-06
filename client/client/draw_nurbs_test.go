package client

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/shapes"

	"go.viam.com/test"
)

func TestDrawNurbs(t *testing.T) {
	t.Run("DrawNurbs", func(t *testing.T) {
		nurbs := shapes.GenerateNURBS(20, 3, r3.Vector{X: 0, Y: 10000, Z: 0})

		test.That(t, DrawNurbs(nurbs, "#40E0D0", "nurbs-1"), test.ShouldBeNil)
	})
}
