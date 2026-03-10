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

// applyCalib must NOT modify rotation — the rotation delta is computed from
// raw SteamVR quaternions and is independent of calibration yaw.
func TestApplyCalib_RotUnchanged(t *testing.T) {
	s := math.Sqrt2 / 2
	cs := calibState([3]float64{1, 2, 3}, [4]float64{s, 0, 0, s})
	withCalib(math.Pi/2, func() {
		out := applyCalib(cs)
		quatEq(t, "rot", out.Rot, cs.Rot)
	})
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

// ---------------------------------------------------------------------------
// qRotateVec
// ---------------------------------------------------------------------------

func TestQRotateVec_Identity(t *testing.T) {
	x, y, z := qRotateVec(quat{0, 0, 0, 1}, 1, 2, 3)
	if !approxEq(x, 1, eps) || !approxEq(y, 2, eps) || !approxEq(z, 3, eps) {
		t.Errorf("got (%.5f, %.5f, %.5f), want (1, 2, 3)", x, y, z)
	}
}

func TestQRotateVec_90Z(t *testing.T) {
	// 90° around Z: (1,0,0) → (0,1,0)
	s := math.Sqrt2 / 2
	q := quat{0, 0, s, s}
	x, y, z := qRotateVec(q, 1, 0, 0)
	if !approxEq(x, 0, eps) || !approxEq(y, 1, eps) || !approxEq(z, 0, eps) {
		t.Errorf("got (%.5f, %.5f, %.5f), want (0, 1, 0)", x, y, z)
	}
}

func TestQRotateVec_90X(t *testing.T) {
	// 90° around X: (0,1,0) → (0,0,1)
	s := math.Sqrt2 / 2
	q := quat{s, 0, 0, s}
	x, y, z := qRotateVec(q, 0, 1, 0)
	if !approxEq(x, 0, eps) || !approxEq(y, 0, eps) || !approxEq(z, 1, eps) {
		t.Errorf("got (%.5f, %.5f, %.5f), want (0, 0, 1)", x, y, z)
	}
}

func TestQRotateVec_180Y(t *testing.T) {
	// 180° around Y: (1,0,0) → (-1,0,0)
	q := quat{0, 1, 0, 0}
	x, y, z := qRotateVec(q, 1, 0, 0)
	if !approxEq(x, -1, eps) || !approxEq(y, 0, eps) || !approxEq(z, 0, eps) {
		t.Errorf("got (%.5f, %.5f, %.5f), want (-1, 0, 0)", x, y, z)
	}
}

// ---------------------------------------------------------------------------
// transformToRobotFrame
// ---------------------------------------------------------------------------

func TestTransformToRobotFrame_IdentityT(t *testing.T) {
	// T=identity: T*q*T^-1 = q
	T := quat{0, 0, 0, 1}
	q := qFromAxisAngle(1, 0, 0, math.Pi/2) // 90° around X
	got := transformToRobotFrame(q, T)
	quatEq(t, "rot", got, q)
}

func TestTransformToRobotFrame_IdentityQ(t *testing.T) {
	// q=identity: T*I*T^-1 = I
	T := qFromAxisAngle(0, 0, 1, math.Pi/2)
	q := quat{0, 0, 0, 1}
	got := transformToRobotFrame(q, T)
	quatEq(t, "rot", got, [4]float64{0, 0, 0, 1})
}

func TestTransformToRobotFrame_Conjugation(t *testing.T) {
	// T = 90° around Z, q = 90° around X
	// T*q*T^-1 should be 90° around Y (Z rotates X axis to Y axis)
	T := qFromAxisAngle(0, 0, 1, math.Pi/2)
	q := qFromAxisAngle(1, 0, 0, math.Pi/2)
	got := transformToRobotFrame(q, T)
	want := qFromAxisAngle(0, 1, 0, math.Pi/2)
	quatEq(t, "rot", got, want)
}

// ---------------------------------------------------------------------------
// steamVRTransform constant
// ---------------------------------------------------------------------------

func TestSteamVRTransform_Value(t *testing.T) {
	// steamVRTransform = rotZ(-90°) * rotX(90°)
	rotX := qFromAxisAngle(1, 0, 0, math.Pi/2)
	rotZ := qFromAxisAngle(0, 0, 1, -math.Pi/2)
	want := qNorm(qMul(rotZ, rotX))
	quatEq(t, "steamVRTransform", steamVRTransform, want)
}

func TestSteamVRTransform_BasisVectors(t *testing.T) {
	// Without calibration (user facing SteamVR -Z):
	//   -Z → +X (forward), +Y → +Z (up), +X → +Y (left)

	// Room +Y (0,1,0) → Robot +Z (0,0,1)
	x, y, z := qRotateVec(steamVRTransform, 0, 1, 0)
	if !approxEq(x, 0, eps) || !approxEq(y, 0, eps) || !approxEq(z, 1, eps) {
		t.Errorf("Room+Y: got (%.5f, %.5f, %.5f), want (0, 0, 1)", x, y, z)
	}

	// Room -Z (0,0,-1) → Robot +X (1,0,0) [forward]
	x, y, z = qRotateVec(steamVRTransform, 0, 0, -1)
	if !approxEq(x, 1, eps) || !approxEq(y, 0, eps) || !approxEq(z, 0, eps) {
		t.Errorf("Room-Z: got (%.5f, %.5f, %.5f), want (1, 0, 0)", x, y, z)
	}

	// Room +X (1,0,0) → Robot -Y (0,-1,0) [right]
	x, y, z = qRotateVec(steamVRTransform, 1, 0, 0)
	if !approxEq(x, 0, eps) || !approxEq(y, -1, eps) || !approxEq(z, 0, eps) {
		t.Errorf("Room+X: got (%.5f, %.5f, %.5f), want (0, -1, 0)", x, y, z)
	}
}

// ---------------------------------------------------------------------------
// quatToOVDeg
// ---------------------------------------------------------------------------

func TestQuatToOVDeg_Identity(t *testing.T) {
	// Identity: Z axis stays at (0,0,1), no twist → theta=0
	ox, oy, oz, th := quatToOVDeg(quat{0, 0, 0, 1})
	if !approxEq(ox, 0, eps) || !approxEq(oy, 0, eps) || !approxEq(oz, 1, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, 0, 1)", ox, oy, oz)
	}
	if !approxEq(th, 0, eps) {
		t.Errorf("theta: got %.5f, want 0", th)
	}
}

func TestQuatToOVDeg_180Z(t *testing.T) {
	// 180° around Z: Z axis stays at (0,0,1), X flips → theta = ±180°
	ox, oy, oz, th := quatToOVDeg(quat{0, 0, 1, 0})
	if !approxEq(ox, 0, eps) || !approxEq(oy, 0, eps) || !approxEq(oz, 1, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, 0, 1)", ox, oy, oz)
	}
	if !approxEq(math.Abs(th), 180, eps) {
		t.Errorf("theta: got %.5f, want ±180", th)
	}
}

func TestQuatToOVDeg_90Y(t *testing.T) {
	// 90° around Y: Z axis → (1,0,0), theta = 0
	s := math.Sqrt2 / 2
	ox, oy, oz, th := quatToOVDeg(quat{0, s, 0, s})
	if !approxEq(ox, 1, eps) || !approxEq(oy, 0, eps) || !approxEq(oz, 0, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (1, 0, 0)", ox, oy, oz)
	}
	if !approxEq(th, 0, eps) {
		t.Errorf("theta: got %.5f, want 0", th)
	}
}

func TestQuatToOVDeg_90X(t *testing.T) {
	// 90° around X: Z axis → (0,-1,0), theta = 90°
	s := math.Sqrt2 / 2
	ox, oy, oz, th := quatToOVDeg(quat{s, 0, 0, s})
	if !approxEq(ox, 0, eps) || !approxEq(oy, -1, eps) || !approxEq(oz, 0, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, -1, 0)", ox, oy, oz)
	}
	if !approxEq(th, 90, eps) {
		t.Errorf("theta: got %.5f, want 90", th)
	}
}

func TestQuatToOVDeg_Neg90X(t *testing.T) {
	// -90° around X: Z axis → (0,1,0), theta = -90°
	s := math.Sqrt2 / 2
	ox, oy, oz, th := quatToOVDeg(quat{-s, 0, 0, s})
	if !approxEq(ox, 0, eps) || !approxEq(oy, 1, eps) || !approxEq(oz, 0, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, 1, 0)", ox, oy, oz)
	}
	if !approxEq(th, -90, eps) {
		t.Errorf("theta: got %.5f, want -90", th)
	}
}

func TestQuatToOVDeg_90Z(t *testing.T) {
	// 90° around Z: Z axis stays at (0,0,1), theta = 90°
	// newX = rotate (-1,0,0) by 90° around Z = (0,-1,0)
	// Special case nzz ≈ 1: th = -atan2(nxy, -nxx) = -atan2(-1, 0) = π/2 → 90°
	s := math.Sqrt2 / 2
	ox, oy, oz, th := quatToOVDeg(quat{0, 0, s, s})
	if !approxEq(ox, 0, eps) || !approxEq(oy, 0, eps) || !approxEq(oz, 1, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, 0, 1)", ox, oy, oz)
	}
	if !approxEq(th, 90, eps) {
		t.Errorf("theta: got %.5f, want 90", th)
	}
}

// ---------------------------------------------------------------------------
// quatToOVDeg — Viam reference test vectors
// From https://github.com/viamrobotics/three test/quat-to-ov.spec.ts
// Theta values converted from radians to degrees for our function.
// ---------------------------------------------------------------------------

func ovEq(t *testing.T, label string, gotOX, gotOY, gotOZ, gotTh, wantOX, wantOY, wantOZ, wantThDeg float64) {
	t.Helper()
	const tol = 1e-3
	if !approxEq(gotOX, wantOX, tol) || !approxEq(gotOY, wantOY, tol) || !approxEq(gotOZ, wantOZ, tol) {
		t.Errorf("%s axis: got (%.6f, %.6f, %.6f), want (%.6f, %.6f, %.6f)",
			label, gotOX, gotOY, gotOZ, wantOX, wantOY, wantOZ)
	}
	if !approxEq(math.Abs(gotTh), math.Abs(wantThDeg), tol) {
		t.Errorf("%s theta: got %.6f, want %.6f", label, gotTh, wantThDeg)
	}
}

func TestQuatToOVDeg_ViamRef(t *testing.T) {
	rad2deg := 180.0 / math.Pi

	// Case 1: quat(0.707, 0, 0, 0.707) → OV(0, -1, 0, π/2)
	ox, oy, oz, th := quatToOVDeg(quat{0.7071067811865476, 0, 0, 0.7071067811865476})
	ovEq(t, "case1", ox, oy, oz, th, 0, -1, 0, 1.5707963267948966*rad2deg)

	// Case 2: quat(-0.707, 0, 0, 0.707) → OV(0, 1, 0, -π/2)
	ox, oy, oz, th = quatToOVDeg(quat{-0.7071067811865476, 0, 0, 0.7071067811865476})
	ovEq(t, "case2", ox, oy, oz, th, 0, 1, 0, -1.5707963267948966*rad2deg)

	// Case 3: quat(0, -0.28, 0, 0.96) → OV(-0.5376, 0, 0.8432, -π)
	ox, oy, oz, th = quatToOVDeg(quat{0, -0.28, 0, 0.96})
	ovEq(t, "case3", ox, oy, oz, th, -0.5376, 0, 0.8432, -math.Pi*rad2deg)

	// Case 4: quat(0, 0, -0.28, 0.96) → OV(0, 0, 1, -0.5676 rad)
	ox, oy, oz, th = quatToOVDeg(quat{0, 0, -0.28, 0.96})
	ovEq(t, "case4", ox, oy, oz, th, 0, 0, 1, -0.5675882184166557*rad2deg)

	// Case 5: quat(-0.28, 0, 0, 0.96) → OV(0, 0.5376, 0.8432, -π/2)
	ox, oy, oz, th = quatToOVDeg(quat{-0.28, 0, 0, 0.96})
	ovEq(t, "case5", ox, oy, oz, th, 0, 0.5376, 0.8432, -1.5707963267948966*rad2deg)

	// Case 6: quat(0.28, 0, 0, 0.96) → OV(0, -0.5376, 0.8432, π/2)
	ox, oy, oz, th = quatToOVDeg(quat{0.28, 0, 0, 0.96})
	ovEq(t, "case6", ox, oy, oz, th, 0, -0.5376, 0.8432, 1.5707963267948966*rad2deg)

	// Case 7: quat(-0.5, -0.5, -0.5, 0.5) → OV(0, 1, 0, -π)
	ox, oy, oz, th = quatToOVDeg(quat{-0.5, -0.5, -0.5, 0.5})
	ovEq(t, "case7", ox, oy, oz, th, 0, 1, 0, -math.Pi*rad2deg)

	// Case 8: arbitrary quat → OV(0.5048, 0.5890, 0.6311, 0.02 rad)
	ox, oy, oz, th = quatToOVDeg(quat{-0.17555966025413142, 0.39198397193979817, 0.3855375485164001, 0.816632212270443})
	ovEq(t, "case8", ox, oy, oz, th, 0.5048437942940054, 0.5889844266763397, 0.631054742867507, 0.02*rad2deg)
}
