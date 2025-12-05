package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestProtos(t *testing.T) {
	t.Run("poseToProtobuf", func(t *testing.T) {
		pose := spatialmath.NewPose(r3.Vector{X: 1, Y: 2, Z: 3}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 45.0})
		proto := poseToProtobuf(pose)
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.GetX(), test.ShouldAlmostEqual, 1, 0.001)
		test.That(t, proto.GetY(), test.ShouldAlmostEqual, 2, 0.001)
		test.That(t, proto.GetZ(), test.ShouldAlmostEqual, 3, 0.001)
		test.That(t, proto.GetOX(), test.ShouldAlmostEqual, 0, 0.001)
		test.That(t, proto.GetOY(), test.ShouldAlmostEqual, 0, 0.001)
		test.That(t, proto.GetOZ(), test.ShouldAlmostEqual, 1, 0.001)
		test.That(t, proto.GetTheta(), test.ShouldAlmostEqual, 45.0, 0.001)
	})

	t.Run("poseInFrameToProtobuf", func(t *testing.T) {
		pose := spatialmath.NewPose(r3.Vector{X: 1, Y: 2, Z: 3}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 45.0})
		proto := poseInFrameToProtobuf(pose, "world")
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.GetReferenceFrame(), test.ShouldEqual, "world")
		test.That(t, proto.GetPose(), test.ShouldNotBeNil)
		test.That(t, proto.GetPose().GetX(), test.ShouldAlmostEqual, 1, 0.001)
		test.That(t, proto.GetPose().GetY(), test.ShouldAlmostEqual, 2, 0.001)
		test.That(t, proto.GetPose().GetZ(), test.ShouldAlmostEqual, 3, 0.001)
	})

	t.Run("geometryToProtobuf", func(t *testing.T) {
		box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
		test.That(t, err, test.ShouldBeNil)
		proto := geometryToProtobuf(box)
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.GetBox(), test.ShouldNotBeNil)
		test.That(t, proto.GetBox().GetDimsMm().GetX(), test.ShouldAlmostEqual, 100, 0.001)
		test.That(t, proto.GetBox().GetDimsMm().GetY(), test.ShouldAlmostEqual, 100, 0.001)
		test.That(t, proto.GetBox().GetDimsMm().GetZ(), test.ShouldAlmostEqual, 100, 0.001)

		sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 100, "sphere")
		test.That(t, err, test.ShouldBeNil)
		proto = geometryToProtobuf(sphere)
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.GetSphere(), test.ShouldNotBeNil)
		test.That(t, proto.GetSphere().GetRadiusMm(), test.ShouldAlmostEqual, 100, 0.001)

		capsule, err := spatialmath.NewCapsule(spatialmath.NewZeroPose(), 100, 300, "capsule")
		test.That(t, err, test.ShouldBeNil)
		proto = geometryToProtobuf(capsule)
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.GetCapsule(), test.ShouldNotBeNil)
		test.That(t, proto.GetCapsule().GetRadiusMm(), test.ShouldAlmostEqual, 100, 0.001)
		test.That(t, proto.GetCapsule().GetLengthMm(), test.ShouldAlmostEqual, 300, 0.001)
	})
}
