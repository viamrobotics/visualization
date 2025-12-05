package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestNurbs(t *testing.T) {
	t.Run("DrawNurbs", func(t *testing.T) {
		controlPoints := []spatialmath.Pose{spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}), spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}), spatialmath.NewPose(r3.Vector{X: 0, Y: 1, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})}
		nurbs, err := NewNurbs(controlPoints, []float64{0, 0, 0, 0, 0}, WithNurbsDegree(1), WithNurbsWeights([]float64{1, 1, 1}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, nurbs, test.ShouldNotBeNil)
	})

	t.Run("generated weights", func(t *testing.T) {
		controlPoints := []spatialmath.Pose{spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}), spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}), spatialmath.NewPose(r3.Vector{X: 0, Y: 1, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})}
		nurbs, err := NewNurbs(controlPoints, []float64{0, 0, 0, 0, 0}, WithNurbsDegree(1), WithNurbsWeights(nil))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, nurbs, test.ShouldNotBeNil)
		test.That(t, nurbs.Weights, test.ShouldResemble, []float64{1, 1, 1})
	})
}
