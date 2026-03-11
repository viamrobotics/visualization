package main

import (
	"math"
	"testing"

	"github.com/go-gl/mathgl/mgl64"
)

const eps = 1e-4

func approxEq(a, b, tol float64) bool { return math.Abs(a-b) < tol }

func quatEq(t *testing.T, label string, got, want mgl64.Quat) {
	t.Helper()
	// q and -q represent the same rotation; normalise sign by W.
	if got.W < 0 {
		got.W = -got.W
		got.V = got.V.Mul(-1)
	}
	if want.W < 0 {
		want.W = -want.W
		want.V = want.V.Mul(-1)
	}
	if !approxEq(got.V[0], want.V[0], eps) || !approxEq(got.V[1], want.V[1], eps) ||
		!approxEq(got.V[2], want.V[2], eps) || !approxEq(got.W, want.W, eps) {
		t.Errorf("%s: got (%.5f, %.5f, %.5f, %.5f), want (%.5f, %.5f, %.5f, %.5f)",
			label, got.V[0], got.V[1], got.V[2], got.W, want.V[0], want.V[1], want.V[2], want.W)
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
// mat34ToMat4
// ---------------------------------------------------------------------------

// identity rotation matrix → identity Mat4 (rotation part)
func TestMat34ToMat4_Identity(t *testing.T) {
	m := [12]float32{
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
	}
	mat := mat34ToMat4(m)
	pos := [3]float64{mat.At(0, 3), mat.At(1, 3), mat.At(2, 3)}
	posEq(t, "pos", pos, [3]float64{0, 0, 0})
	q := mgl64.Mat4ToQuat(mat).Normalize()
	quatEq(t, "rot", q, mgl64.Quat{W: 1})
}

// 90° rotation around Y axis
func TestMat34ToMat4_RotY90(t *testing.T) {
	m := [12]float32{
		0, 0, 1, 0,
		0, 1, 0, 0,
		-1, 0, 0, 0,
	}
	mat := mat34ToMat4(m)
	q := mgl64.Mat4ToQuat(mat).Normalize()
	s := math.Sqrt2 / 2
	quatEq(t, "rot", q, mgl64.Quat{W: s, V: mgl64.Vec3{0, s, 0}})
}

// 90° rotation around X axis
func TestMat34ToMat4_RotX90(t *testing.T) {
	m := [12]float32{
		1, 0, 0, 0,
		0, 0, -1, 0,
		0, 1, 0, 0,
	}
	mat := mat34ToMat4(m)
	q := mgl64.Mat4ToQuat(mat).Normalize()
	s := math.Sqrt2 / 2
	quatEq(t, "rot", q, mgl64.Quat{W: s, V: mgl64.Vec3{s, 0, 0}})
}

// position is read from column 3
func TestMat34ToMat4_Position(t *testing.T) {
	m := [12]float32{
		1, 0, 0, 1.5,
		0, 1, 0, 2.5,
		0, 0, 1, 3.5,
	}
	mat := mat34ToMat4(m)
	pos := [3]float64{mat.At(0, 3), mat.At(1, 3), mat.At(2, 3)}
	posEq(t, "pos", pos, [3]float64{1.5, 2.5, 3.5})
}

// ---------------------------------------------------------------------------
// applyCalib — position
// ---------------------------------------------------------------------------

func calibState(pos [3]float64, mat mgl64.Mat4) ControllerState {
	return ControllerState{Connected: true, Pos: pos, Mat: mat}
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
	cs := calibState([3]float64{1, 2, 3}, mgl64.Ident4())
	withCalib(0, func() {
		out := applyCalib(cs)
		posEq(t, "pos", out.Pos, cs.Pos)
	})
}

// 90° yaw: position (1,0,0) → (0,0,1)
func TestApplyCalib_Pos90(t *testing.T) {
	cs := calibState([3]float64{1, 5, 0}, mgl64.Ident4())
	withCalib(math.Pi/2, func() {
		out := applyCalib(cs)
		posEq(t, "pos", out.Pos, [3]float64{0, 5, 1})
	})
}

// 180° yaw: position (1,0,0) → (-1,0,0)
func TestApplyCalib_Pos180(t *testing.T) {
	cs := calibState([3]float64{1, 0, 0}, mgl64.Ident4())
	withCalib(math.Pi, func() {
		out := applyCalib(cs)
		posEq(t, "pos", out.Pos, [3]float64{-1, 0, 0})
	})
}

// calib rotation must not affect Y component of position
func TestApplyCalib_YUnchanged(t *testing.T) {
	cs := calibState([3]float64{3, 7, 2}, mgl64.Ident4())
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

func TestComputeCalibYaw_RoundTrip(t *testing.T) {
	// Build a Y-rotation matrix for 45°.
	angle := math.Pi / 4
	m := mgl64.HomogRotate3DY(angle)

	yaw, ok := computeCalibYaw(m)
	if !ok {
		t.Fatal("computeCalibYaw returned ok=false")
	}

	// Apply the computed yaw to a unit position on the X axis.
	cs := calibState([3]float64{1, 0, 0}, mgl64.Ident4())
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
// Mat4 vector rotation (replaces qRotateVec tests)
// ---------------------------------------------------------------------------

func TestMat4RotateVec_Identity(t *testing.T) {
	v := mgl64.Ident4().Mul4x1(mgl64.Vec4{1, 2, 3, 0})
	if !approxEq(v[0], 1, eps) || !approxEq(v[1], 2, eps) || !approxEq(v[2], 3, eps) {
		t.Errorf("got (%.5f, %.5f, %.5f), want (1, 2, 3)", v[0], v[1], v[2])
	}
}

func TestMat4RotateVec_90Z(t *testing.T) {
	// 90° around Z: (1,0,0) → (0,1,0)
	m := mgl64.HomogRotate3DZ(math.Pi / 2)
	v := m.Mul4x1(mgl64.Vec4{1, 0, 0, 0})
	if !approxEq(v[0], 0, eps) || !approxEq(v[1], 1, eps) || !approxEq(v[2], 0, eps) {
		t.Errorf("got (%.5f, %.5f, %.5f), want (0, 1, 0)", v[0], v[1], v[2])
	}
}

func TestMat4RotateVec_90X(t *testing.T) {
	// 90° around X: (0,1,0) → (0,0,1)
	m := mgl64.HomogRotate3DX(math.Pi / 2)
	v := m.Mul4x1(mgl64.Vec4{0, 1, 0, 0})
	if !approxEq(v[0], 0, eps) || !approxEq(v[1], 0, eps) || !approxEq(v[2], 1, eps) {
		t.Errorf("got (%.5f, %.5f, %.5f), want (0, 0, 1)", v[0], v[1], v[2])
	}
}

func TestMat4RotateVec_180Y(t *testing.T) {
	// 180° around Y: (1,0,0) → (-1,0,0)
	m := mgl64.HomogRotate3DY(math.Pi)
	v := m.Mul4x1(mgl64.Vec4{1, 0, 0, 0})
	if !approxEq(v[0], -1, eps) || !approxEq(v[1], 0, eps) || !approxEq(v[2], 0, eps) {
		t.Errorf("got (%.5f, %.5f, %.5f), want (-1, 0, 0)", v[0], v[1], v[2])
	}
}

// ---------------------------------------------------------------------------
// Similarity transform T * M * T^-1 (replaces transformToRobotFrame tests)
// ---------------------------------------------------------------------------

func similarityTransform(m, t mgl64.Mat4) mgl64.Mat4 {
	return t.Mul4(m).Mul4(t.Inv())
}

func TestSimilarityTransform_IdentityT(t *testing.T) {
	// T=identity: T*M*T^-1 = M
	T := mgl64.Ident4()
	M := mgl64.HomogRotate3DX(math.Pi / 2)
	got := mgl64.Mat4ToQuat(similarityTransform(M, T)).Normalize()
	want := mgl64.Mat4ToQuat(M).Normalize()
	quatEq(t, "rot", got, want)
}

func TestSimilarityTransform_IdentityM(t *testing.T) {
	// M=identity: T*I*T^-1 = I
	T := mgl64.HomogRotate3DZ(math.Pi / 2)
	M := mgl64.Ident4()
	got := mgl64.Mat4ToQuat(similarityTransform(M, T)).Normalize()
	quatEq(t, "rot", got, mgl64.Quat{W: 1})
}

func TestSimilarityTransform_Conjugation(t *testing.T) {
	// T = 90° around Z, M = 90° around X
	// T*M*T^-1 should be 90° around Y (Z rotates X axis to Y axis)
	T := mgl64.HomogRotate3DZ(math.Pi / 2)
	M := mgl64.HomogRotate3DX(math.Pi / 2)
	got := mgl64.Mat4ToQuat(similarityTransform(M, T)).Normalize()
	want := mgl64.Mat4ToQuat(mgl64.HomogRotate3DY(math.Pi / 2)).Normalize()
	quatEq(t, "rot", got, want)
}

// ---------------------------------------------------------------------------
// steamVRTransform constant
// ---------------------------------------------------------------------------

func TestSteamVRTransform_Value(t *testing.T) {
	// steamVRTransform = rotZ(-90°) * rotX(90°)
	rotX := mgl64.HomogRotate3DX(math.Pi / 2)
	rotZ := mgl64.HomogRotate3DZ(-math.Pi / 2)
	want := mgl64.Mat4ToQuat(rotZ.Mul4(rotX)).Normalize()
	got := mgl64.Mat4ToQuat(steamVRTransform).Normalize()
	quatEq(t, "steamVRTransform", got, want)
}

func TestSteamVRTransform_BasisVectors(t *testing.T) {
	// Without calibration (user facing SteamVR -Z):
	//   -Z → +X (forward), +Y → +Z (up), +X → -Y (right)

	// Room +Y (0,1,0) → Robot +Z (0,0,1)
	v := steamVRTransform.Mul4x1(mgl64.Vec4{0, 1, 0, 0})
	if !approxEq(v[0], 0, eps) || !approxEq(v[1], 0, eps) || !approxEq(v[2], 1, eps) {
		t.Errorf("Room+Y: got (%.5f, %.5f, %.5f), want (0, 0, 1)", v[0], v[1], v[2])
	}

	// Room -Z (0,0,-1) → Robot +X (1,0,0) [forward]
	v = steamVRTransform.Mul4x1(mgl64.Vec4{0, 0, -1, 0})
	if !approxEq(v[0], 1, eps) || !approxEq(v[1], 0, eps) || !approxEq(v[2], 0, eps) {
		t.Errorf("Room-Z: got (%.5f, %.5f, %.5f), want (1, 0, 0)", v[0], v[1], v[2])
	}

	// Room +X (1,0,0) → Robot -Y (0,-1,0) [right]
	v = steamVRTransform.Mul4x1(mgl64.Vec4{1, 0, 0, 0})
	if !approxEq(v[0], 0, eps) || !approxEq(v[1], -1, eps) || !approxEq(v[2], 0, eps) {
		t.Errorf("Room+X: got (%.5f, %.5f, %.5f), want (0, -1, 0)", v[0], v[1], v[2])
	}
}

// ---------------------------------------------------------------------------
// quatToOVDeg
// ---------------------------------------------------------------------------

func TestQuatToOVDeg_Identity(t *testing.T) {
	ox, oy, oz, th := quatToOVDeg(mgl64.Quat{W: 1})
	if !approxEq(ox, 0, eps) || !approxEq(oy, 0, eps) || !approxEq(oz, 1, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, 0, 1)", ox, oy, oz)
	}
	if !approxEq(th, 0, eps) {
		t.Errorf("theta: got %.5f, want 0", th)
	}
}

func TestQuatToOVDeg_180Z(t *testing.T) {
	ox, oy, oz, th := quatToOVDeg(mgl64.Quat{W: 0, V: mgl64.Vec3{0, 0, 1}})
	if !approxEq(ox, 0, eps) || !approxEq(oy, 0, eps) || !approxEq(oz, 1, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, 0, 1)", ox, oy, oz)
	}
	if !approxEq(math.Abs(th), 180, eps) {
		t.Errorf("theta: got %.5f, want ±180", th)
	}
}

func TestQuatToOVDeg_90Y(t *testing.T) {
	s := math.Sqrt2 / 2
	ox, oy, oz, th := quatToOVDeg(mgl64.Quat{W: s, V: mgl64.Vec3{0, s, 0}})
	if !approxEq(ox, 1, eps) || !approxEq(oy, 0, eps) || !approxEq(oz, 0, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (1, 0, 0)", ox, oy, oz)
	}
	if !approxEq(th, 0, eps) {
		t.Errorf("theta: got %.5f, want 0", th)
	}
}

func TestQuatToOVDeg_90X(t *testing.T) {
	s := math.Sqrt2 / 2
	ox, oy, oz, th := quatToOVDeg(mgl64.Quat{W: s, V: mgl64.Vec3{s, 0, 0}})
	if !approxEq(ox, 0, eps) || !approxEq(oy, -1, eps) || !approxEq(oz, 0, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, -1, 0)", ox, oy, oz)
	}
	if !approxEq(th, 90, eps) {
		t.Errorf("theta: got %.5f, want 90", th)
	}
}

func TestQuatToOVDeg_Neg90X(t *testing.T) {
	s := math.Sqrt2 / 2
	ox, oy, oz, th := quatToOVDeg(mgl64.Quat{W: s, V: mgl64.Vec3{-s, 0, 0}})
	if !approxEq(ox, 0, eps) || !approxEq(oy, 1, eps) || !approxEq(oz, 0, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, 1, 0)", ox, oy, oz)
	}
	if !approxEq(th, -90, eps) {
		t.Errorf("theta: got %.5f, want -90", th)
	}
}

func TestQuatToOVDeg_90Z(t *testing.T) {
	s := math.Sqrt2 / 2
	ox, oy, oz, th := quatToOVDeg(mgl64.Quat{W: s, V: mgl64.Vec3{0, 0, s}})
	if !approxEq(ox, 0, eps) || !approxEq(oy, 0, eps) || !approxEq(oz, 1, eps) {
		t.Errorf("axis: got (%.5f, %.5f, %.5f), want (0, 0, 1)", ox, oy, oz)
	}
	if !approxEq(th, 90, eps) {
		t.Errorf("theta: got %.5f, want 90", th)
	}
}

// ---------------------------------------------------------------------------
// quatToOVDeg — Viam reference test vectors
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

// q helper: builds mgl64.Quat from (x, y, z, w) for brevity.
func q(x, y, z, w float64) mgl64.Quat {
	return mgl64.Quat{W: w, V: mgl64.Vec3{x, y, z}}
}

func TestQuatToOVDeg_ViamRef(t *testing.T) {
	rad2deg := 180.0 / math.Pi

	// Case 1: quat(0.707, 0, 0, 0.707) → OV(0, -1, 0, π/2)
	ox, oy, oz, th := quatToOVDeg(q(0.7071067811865476, 0, 0, 0.7071067811865476))
	ovEq(t, "case1", ox, oy, oz, th, 0, -1, 0, 1.5707963267948966*rad2deg)

	// Case 2: quat(-0.707, 0, 0, 0.707) → OV(0, 1, 0, -π/2)
	ox, oy, oz, th = quatToOVDeg(q(-0.7071067811865476, 0, 0, 0.7071067811865476))
	ovEq(t, "case2", ox, oy, oz, th, 0, 1, 0, -1.5707963267948966*rad2deg)

	// Case 3: quat(0, -0.28, 0, 0.96) → OV(-0.5376, 0, 0.8432, -π)
	ox, oy, oz, th = quatToOVDeg(q(0, -0.28, 0, 0.96))
	ovEq(t, "case3", ox, oy, oz, th, -0.5376, 0, 0.8432, -math.Pi*rad2deg)

	// Case 4: quat(0, 0, -0.28, 0.96) → OV(0, 0, 1, -0.5676 rad)
	ox, oy, oz, th = quatToOVDeg(q(0, 0, -0.28, 0.96))
	ovEq(t, "case4", ox, oy, oz, th, 0, 0, 1, -0.5675882184166557*rad2deg)

	// Case 5: quat(-0.28, 0, 0, 0.96) → OV(0, 0.5376, 0.8432, -π/2)
	ox, oy, oz, th = quatToOVDeg(q(-0.28, 0, 0, 0.96))
	ovEq(t, "case5", ox, oy, oz, th, 0, 0.5376, 0.8432, -1.5707963267948966*rad2deg)

	// Case 6: quat(0.28, 0, 0, 0.96) → OV(0, -0.5376, 0.8432, π/2)
	ox, oy, oz, th = quatToOVDeg(q(0.28, 0, 0, 0.96))
	ovEq(t, "case6", ox, oy, oz, th, 0, -0.5376, 0.8432, 1.5707963267948966*rad2deg)

	// Case 7: quat(-0.5, -0.5, -0.5, 0.5) → OV(0, 1, 0, -π)
	ox, oy, oz, th = quatToOVDeg(q(-0.5, -0.5, -0.5, 0.5))
	ovEq(t, "case7", ox, oy, oz, th, 0, 1, 0, -math.Pi*rad2deg)

	// Case 8: arbitrary quat → OV(0.5048, 0.5890, 0.6311, 0.02 rad)
	ox, oy, oz, th = quatToOVDeg(q(-0.17555966025413142, 0.39198397193979817, 0.3855375485164001, 0.816632212270443))
	ovEq(t, "case8", ox, oy, oz, th, 0.5048437942940054, 0.5889844266763397, 0.631054742867507, 0.02*rad2deg)
}
