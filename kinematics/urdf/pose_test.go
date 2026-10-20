package urdf

import (
	"math"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

func TestOriginRPYIsFixedAxisRollThenPitchThenYaw(t *testing.T) {
	const roll, pitch, yaw = 0.3, -0.5, 1.1
	imported := mustConvertInline(t, robotXML(
		`<link name="base"/>`+
			`<link name="part"><collision><geometry><box size="0.1 0.1 0.1"/></geometry></collision></link>`+
			joint("mount", "fixed", "base", "part", `<origin xyz="0.1 0.2 0.3" rpy="0.3 -0.5 1.1"/>`)))

	pose := spatialmath.NewPoseFromProtobuf(linkByID(t, imported.Spec, "part").GetOrigin())
	if got := pose.Point(); math.Abs(got.X-100) > poseTolerance || math.Abs(got.Y-200) > poseTolerance || math.Abs(got.Z-300) > poseTolerance {
		t.Fatalf("translation = %v, want 100 200 300 mm", got)
	}

	// Independent expectation: R = Rz(yaw) * Ry(pitch) * Rx(roll) applied to a point.
	point := r3.Vector{X: 1, Y: 2, Z: 3}
	rolled := r3.Vector{X: point.X, Y: point.Y*math.Cos(roll) - point.Z*math.Sin(roll), Z: point.Y*math.Sin(roll) + point.Z*math.Cos(roll)}
	pitched := r3.Vector{X: rolled.X*math.Cos(pitch) + rolled.Z*math.Sin(pitch), Y: rolled.Y, Z: -rolled.X*math.Sin(pitch) + rolled.Z*math.Cos(pitch)}
	yawed := r3.Vector{X: pitched.X*math.Cos(yaw) - pitched.Y*math.Sin(yaw), Y: pitched.X*math.Sin(yaw) + pitched.Y*math.Cos(yaw), Z: pitched.Z}
	want := yawed.Add(r3.Vector{X: 100, Y: 200, Z: 300})

	got := spatialmath.TransformPointByPose(pose, point)
	if got.Sub(want).Norm() > poseTolerance {
		t.Fatalf("transformed point = %v, want %v", got, want)
	}
}

func TestPosesComposeDownTheChain(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"/>`+boxLink("a")+boxLink("b")+
			joint("j1", "fixed", "base", "a", `<origin xyz="0 0 1" rpy="0 0 1.5707963267948966"/>`)+
			joint("j2", "fixed", "a", "b", `<origin xyz="1 0 0"/>`)))

	got := spatialmath.NewPoseFromProtobuf(linkByID(t, imported.Spec, "b").GetOrigin()).Point()
	// a is yawed 90 degrees, so b's local +X lands on world +Y.
	if got.Sub(r3.Vector{X: 0, Y: 1000, Z: 1000}).Norm() > poseTolerance {
		t.Fatalf("b translation = %v, want 0 1000 1000", got)
	}
}

func TestMissingOriginPartsAndAxisDefaultToZeroAndX(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"/>`+boxLink("a")+boxLink("b")+
			joint("bare_joint", "revolute", "base", "a", `<limit lower="0" upper="1"/>`)+
			joint("xyz_only", "revolute", "a", "b", `<origin xyz="0.5 0 0"/><limit lower="0" upper="1"/>`)))

	first := jointByID(t, imported.Spec, "bare_joint")
	if first.GetOrigin().GetX() != 0 || first.GetOrigin().GetTheta() != 0 {
		t.Fatalf("missing origin = %v, want zero", first.GetOrigin())
	}
	if axis := first.GetAxis(); axis.GetX() != 1 || axis.GetY() != 0 || axis.GetZ() != 0 {
		t.Fatalf("default axis = %v, want 1 0 0", axis)
	}
	if got := jointByID(t, imported.Spec, "xyz_only").GetOrigin(); got.GetX() != 500 || got.GetTheta() != 0 {
		t.Fatalf("xyz-only origin = %v, want x 500 and no rotation", got)
	}
}
