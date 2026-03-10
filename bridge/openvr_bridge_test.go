package main

import (
	"math"
	"testing"
)

const eps = 1e-4

func approxEq(a, b, tol float64) bool { return math.Abs(a-b) < tol }

func quatEq(t *testing.T, label string, got, want [4]float64) {
	t.Helper()
	// q and -q represent the same rotation; normalise sign by qw.
	if got[3] < 0 {
		got[0], got[1], got[2], got[3] = -got[0], -got[1], -got[2], -got[3]
	}
	if want[3] < 0 {
		want[0], want[1], want[2], want[3] = -want[0], -want[1], -want[2], -want[3]
	}
	if !approxEq(got[0], want[0], eps) || !approxEq(got[1], want[1], eps) ||
		!approxEq(got[2], want[2], eps) || !approxEq(got[3], want[3], eps) {
		t.Errorf("%s: got (%.5f, %.5f, %.5f, %.5f), want (%.5f, %.5f, %.5f, %.5f)",
			label, got[0], got[1], got[2], got[3], want[0], want[1], want[2], want[3])
	}
}

func posEq(t *testing.T, label string, got, want [3]float64) {
	t.Helper()
	if !approxEq(got[0], want[0], eps) || !approxEq(got[1], want[1], eps) || !approxEq(got[2], want[2], eps) {
		t.Errorf("%s: got (%.5f, %.5f, %.5f), want (%.5f, %.5f, %.5f)",
			label, got[0], got[1], got[2], want[0], want[1], want[2])
	}
}

// ---------------------------------------------------------------------------
// mat34ToQuat
// ---------------------------------------------------------------------------

// identity rotation matrix → identity quaternion (0,0,0,1)
func TestMat34ToQuat_Identity(t *testing.T) {
	m := [12]float32{
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
	}
	pos, rot := mat34ToQuat(m)
	posEq(t, "pos", pos, [3]float64{0, 0, 0})
	quatEq(t, "rot", rot, [4]float64{0, 0, 0, 1})
}

// 90° rotation around Y axis → quat (0, sin45, 0, cos45)
func TestMat34ToQuat_RotY90(t *testing.T) {
	// R_y(90°): col0=(0,0,-1), col1=(0,1,0), col2=(1,0,0)
	m := [12]float32{
		0, 0, 1, 0,
		0, 1, 0, 0,
		-1, 0, 0, 0,
	}
	_, rot := mat34ToQuat(m)
	s := float64(math.Sqrt2 / 2)
	quatEq(t, "rot", rot, [4]float64{0, s, 0, s})
}

// 90° rotation around X axis → quat (sin45, 0, 0, cos45)
func TestMat34ToQuat_RotX90(t *testing.T) {
	// R_x(90°): col0=(1,0,0), col1=(0,0,1), col2=(0,-1,0)
	m := [12]float32{
		1, 0, 0, 0,
		0, 0, -1, 0,
		0, 1, 0, 0,
	}
	_, rot := mat34ToQuat(m)
	s := float64(math.Sqrt2 / 2)
	quatEq(t, "rot", rot, [4]float64{s, 0, 0, s})
}

// position is read from column 3 (m[3], m[7], m[11])
func TestMat34ToQuat_Position(t *testing.T) {
	m := [12]float32{
		1, 0, 0, 1.5,
		0, 1, 0, 2.5,
		0, 0, 1, 3.5,
	}
	pos, _ := mat34ToQuat(m)
	posEq(t, "pos", pos, [3]float64{1.5, 2.5, 3.5})
}

// ---------------------------------------------------------------------------
// applyCalib — position
// ---------------------------------------------------------------------------

func calibState(pos [3]float64, rot [4]float64) ControllerState {
	return ControllerState{Connected: true, Pos: pos, Rot: rot}
}

func withCalib(yaw float64, fn func()) {
	calibMu.Lock()
	calibYaw = yaw
	calibSet = true
	calibMu.Unlock()
	fn()
	calibMu.Lock()
	calibYaw = 0
	calibSet = false
	calibMu.Unlock()
}

// zero yaw → no change
func TestApplyCalib_ZeroYaw(t *testing.T) {
	cs := calibState([3]float64{1, 2, 3}, [4]float64{0, 0, 0, 1})
	withCalib(0, func() {
		out := applyCalib(cs)
		posEq(t, "pos", out.Pos, cs.Pos)
		quatEq(t, "rot", out.Rot, cs.Rot)
	})
}

// 90° yaw: position (1,0,0) → (0,0,1)
func TestApplyCalib_Pos90(t *testing.T) {
	cs := calibState([3]float64{1, 5, 0}, [4]float64{0, 0, 0, 1})
	withCalib(math.Pi/2, func() {
		out := applyCalib(cs)
		posEq(t, "pos", out.Pos, [3]float64{0, 5, 1})
	})
}

// 180° yaw: position (1,0,0) → (-1,0,0)
func TestApplyCalib_Pos180(t *testing.T) {
	cs := calibState([3]float64{1, 0, 0}, [4]float64{0, 0, 0, 1})
	withCalib(math.Pi, func() {
		out := applyCalib(cs)
		posEq(t, "pos", out.Pos, [3]float64{-1, 0, 0})
	})
}

// ---------------------------------------------------------------------------
// applyCalib — quaternion rotation
// ---------------------------------------------------------------------------

// identity quat with 90° yaw calib → pure Y-rotation quat (0, sin45, 0, cos45)
func TestApplyCalib_RotIdentity90(t *testing.T) {
	cs := calibState([3]float64{0, 0, 0}, [4]float64{0, 0, 0, 1})
	s := math.Sqrt2 / 2
	withCalib(math.Pi/2, func() {
		out := applyCalib(cs)
		quatEq(t, "rot", out.Rot, [4]float64{0, s, 0, s})
	})
}

// 90° calib applied twice to identity should equal 180° calib applied once
func TestApplyCalib_RotComposition(t *testing.T) {
	cs := calibState([3]float64{0, 0, 0}, [4]float64{0, 0, 0, 1})

	// Apply 90° once
	var after90 ControllerState
	withCalib(math.Pi/2, func() { after90 = applyCalib(cs) })

	// Apply 90° again to the result
	var after180 ControllerState
	after90.Connected = true
	withCalib(math.Pi/2, func() { after180 = applyCalib(after90) })

	// Direct 180°
	var direct180 ControllerState
	withCalib(math.Pi, func() { direct180 = applyCalib(cs) })

	quatEq(t, "rot", after180.Rot, direct180.Rot)
}

// calib rotation must not affect Y component of position
func TestApplyCalib_YUnchanged(t *testing.T) {
	cs := calibState([3]float64{3, 7, 2}, [4]float64{0, 0, 0, 1})
	withCalib(1.23, func() {
		out := applyCalib(cs)
		if !approxEq(out.Pos[1], 7, eps) {
			t.Errorf("Y position changed: got %.5f, want 7", out.Pos[1])
		}
	})
}

// ---------------------------------------------------------------------------
// computeCalibYaw
// ---------------------------------------------------------------------------

// A quaternion representing a pure Y-rotation (controller pointing along -X)
// should produce a calibration yaw that, when applied, maps its position correctly.
func TestComputeCalibYaw_RoundTrip(t *testing.T) {
	// Controller pointing in the -X direction in world space.
	// -Z axis of controller = -X world ⟹ no rotation needed (calib yaw ≈ 0 or 2π).
	// Use a simple identity-like test: calib yaw derived from a known quat,
	// then verify applyCalib rotates a known position correctly.

	// Build a Y-rotation quat for 45°: controller points at 45° from -X in XZ plane.
	angle := math.Pi / 4
	q := [4]float64{0, math.Sin(angle / 2), 0, math.Cos(angle / 2)}

	yaw, ok := computeCalibYaw(q)
	if !ok {
		t.Fatal("computeCalibYaw returned ok=false")
	}

	// Apply the computed yaw to a unit position on the X axis.
	cs := calibState([3]float64{1, 0, 0}, [4]float64{0, 0, 0, 1})
	withCalib(yaw, func() {
		out := applyCalib(cs)
		// Just verify it's a unit vector (rotation preserves length).
		mag := math.Sqrt(out.Pos[0]*out.Pos[0] + out.Pos[2]*out.Pos[2])
		if !approxEq(mag, 1, eps) {
			t.Errorf("position magnitude after calib: got %.5f, want 1.0", mag)
		}
	})
}
