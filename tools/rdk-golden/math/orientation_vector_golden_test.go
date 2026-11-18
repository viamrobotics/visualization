package rdkmath

import (
	"math"
	"testing"

	"go.viam.com/test"
	"gonum.org/v1/gonum/num/quat"

	sm "go.viam.com/rdk/spatialmath"

	"rdk-golden/goldenfile"
)

// orientationVectorGoldenName is read by src/lib/math/__tests__/orientationVectorGolden.spec.ts.
const orientationVectorGoldenName = "orientation_vector_golden.json"

// goldenOrientationVector carries an orientation vector with theta in radians, matching the
// TypeScript class's native units.
type goldenOrientationVector struct {
	Th float64 `json:"th"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	Z  float64 `json:"z"`
}

type goldenEulerAngles struct {
	Roll  float64 `json:"roll"`
	Pitch float64 `json:"pitch"`
	Yaw   float64 `json:"yaw"`
}

// vectorGoldenCase records what RDK derives from an orientation vector.
type vectorGoldenCase struct {
	Name              string                   `json:"name"`
	OrientationVector *goldenOrientationVector `json:"orientationVector"`
	Quaternion        *goldenQuaternion        `json:"quaternion"`
	EulerAngles       *goldenEulerAngles       `json:"eulerAngles"`
}

// quaternionGoldenCase records the orientation vector RDK reads out of a quaternion.
type quaternionGoldenCase struct {
	Name              string                   `json:"name"`
	Quaternion        *goldenQuaternion        `json:"quaternion"`
	OrientationVector *goldenOrientationVector `json:"orientationVector"`
}

// normalizeGoldenCase records what Normalize does to a vector in place.
type normalizeGoldenCase struct {
	Name       string                   `json:"name"`
	Input      *goldenOrientationVector `json:"input"`
	Normalized *goldenOrientationVector `json:"normalized"`
}

type orientationVectorGoldenFile struct {
	Source         string                 `json:"source"`
	FromVector     []vectorGoldenCase     `json:"fromVector"`
	FromQuaternion []quaternionGoldenCase `json:"fromQuaternion"`
	Normalize      []normalizeGoldenCase  `json:"normalize"`
}

type fromVectorCase struct {
	name          string
	input         *sm.OrientationVector
	expectedQuat  *goldenQuaternion
	expectedEuler *goldenEulerAngles
}

type fromQuaternionCase struct {
	name     string
	input    quat.Number
	expected *goldenOrientationVector
}

type normalizeCase struct {
	name     string
	input    *sm.OrientationVector
	expected *goldenOrientationVector
}

// TestOrientationVectorGolden is a hand port of: OrientationVector.Quaternion, QuatToOV,
// and OrientationVector.Normalize.
//
// Values come from spatialmath/quat_test.go, orientation_test.go and rotationMatrix_test.go, and
// each case names the test it was taken from.
func TestOrientationVectorGolden(t *testing.T) {
	golden := orientationVectorGoldenFile{
		Source: "go.viam.com/rdk spatialmath OrientationVector.Quaternion, QuatToOV and OrientationVector.Normalize",
	}

	for _, testCase := range fromVectorCases() {
		t.Run("fromVector/"+testCase.name, func(t *testing.T) {
			input := snapshotVector(testCase.input)

			quaternion := quatOf(0, 0, 0, 0)
			q := testCase.input.Quaternion()
			quaternion = quatOf(q.Real, q.Imag, q.Jmag, q.Kmag)

			ea := testCase.input.EulerAngles()
			eulerAngles := &goldenEulerAngles{Roll: ea.Roll, Pitch: ea.Pitch, Yaw: ea.Yaw}

			assertQuaternion(t, quaternion, testCase.expectedQuat)
			assertEulerAngles(t, eulerAngles, testCase.expectedEuler)

			golden.FromVector = append(golden.FromVector, vectorGoldenCase{
				Name:              testCase.name,
				OrientationVector: input,
				Quaternion:        quaternion,
				EulerAngles:       eulerAngles,
			})
		})
	}

	for _, testCase := range fromQuaternionCases() {
		t.Run("fromQuaternion/"+testCase.name, func(t *testing.T) {
			ov := sm.QuatToOV(testCase.input)
			resolved := snapshotVector(ov)

			assertVector(t, resolved, testCase.expected)

			golden.FromQuaternion = append(golden.FromQuaternion, quaternionGoldenCase{
				Name:              testCase.name,
				Quaternion:        quatOf(testCase.input.Real, testCase.input.Imag, testCase.input.Jmag, testCase.input.Kmag),
				OrientationVector: resolved,
			})
		})
	}

	for _, testCase := range normalizeCases() {
		t.Run("normalize/"+testCase.name, func(t *testing.T) {
			input := snapshotVector(testCase.input)

			testCase.input.Normalize()
			normalized := snapshotVector(testCase.input)

			assertVector(t, normalized, testCase.expected)

			golden.Normalize = append(golden.Normalize, normalizeGoldenCase{
				Name:       testCase.name,
				Input:      input,
				Normalized: normalized,
			})
		})
	}

	goldenfile.Write(t, orientationVectorGoldenName, golden)
}

// ov45x and its partners are orientation_test.go's testing rotations.
var (
	ov45xTheta = math.Pi / 2
	ov45x      = func() *sm.OrientationVector { return ov(ov45xTheta, 0, -math.Sqrt2/2, math.Sqrt2/2) }
	q45x       = quat.Number{Real: math.Cos(math.Pi / 8), Imag: math.Sin(math.Pi / 8)}
)

// poleRadiusVector is TestOrientationVectorPoleRadius's value, which sits inside
// orientationVectorPoleRadius of a pole while still carrying a longitude. Since rdk#6630 that
// longitude both tilts the vector and shifts theta, so dropping it is falsifiable here.
func poleRadiusVector() *sm.OrientationVector {
	return ov(90.2029644505*math.Pi/180, 0.0050164674, 0.0079070413, 0.9999561559)
}

// ur20UpperArmVector is a UR20's upper_arm_link pose in its shoulder_link, as a machine reported it.
// Calibrated UR models stack near-parallel joints, so their link-to-link poses sit inside the pole radius.
func ur20UpperArmVector() *sm.OrientationVector {
	return ov(-108.79060721785683*math.Pi/180, -0.0013887496528351834, 0.00047251491064207585, 0.9999989240514509)
}

// ur20ForearmVector is the same machine's forearm_link pose in its upper_arm_link.
func ur20ForearmVector() *sm.OrientationVector {
	return ov(-64.83545731335221*math.Pi/180, 0.0007329661345321388, 0.0003443538100672928, 0.9999996720904959)
}

// southPoleRadiusVector mirrors the north-pole cases below -Z, where rdk adds the longitude to theta
// instead of subtracting it.
func southPoleRadiusVector() *sm.OrientationVector {
	return ov(1, 0.003, -0.004, -math.Sqrt(1-0.003*0.003-0.004*0.004))
}

func fromVectorCases() []fromVectorCase {
	return []fromVectorCase{
		{
			name:          "45 degrees about x, from testCompatibility",
			input:         ov45x(),
			expectedQuat:  quatOf(q45x.Real, q45x.Imag, q45x.Jmag, q45x.Kmag),
			expectedEuler: eulerOf(math.Pi/4, 0, 0),
		},
		{
			name:          "inside the pole radius with a longitude, from TestOrientationVectorPoleRadius",
			input:         poleRadiusVector(),
			expectedQuat:  quatOf(0.70584550898089, -0.0010138888433254124, 0.00457100337056847, 0.7083503338102609),
			expectedEuler: eulerOf(0.0050446241395586885, 0.007889303242108046, 1.5743586241508256),
		},
		{
			name:          "inside the north pole radius, a UR20 upper arm in its shoulder",
			input:         ur20UpperArmVector(),
			expectedQuat:  quatOf(0.5821894594263212, 0.0004270170433806911, -0.0005963478170048587, -0.8130528244576818),
			expectedEuler: eulerOf(0.0014669347233686738, 2.2780081505277245e-16, -1.89875429119551),
		},
		{
			name:          "inside the north pole radius, a UR20 forearm in its upper arm",
			input:         ur20ForearmVector(),
			expectedQuat:  quatOf(0.8441620185179808, -0.00034181242700261896, 0.0002170691521135112, -0.5360879802205005),
			expectedEuler: eulerOf(-0.0008098265518321487, 5.3907377538327856e-17, -1.1315922021542326),
		},
		{
			name:          "inside the south pole radius with a longitude",
			input:         southPoleRadiusVector(),
			expectedQuat:  quatOf(0.002275232030194584, 0.47942404038768993, 0.877579819423441, -0.001036030053491365),
			expectedEuler: eulerOf(3.1412294453346825, 0.004986811525711155, 2.14159174796235),
		},

		{
			name:          "about +X, from TestQuatConversion",
			input:         ov(2.47208, 1, 0, 0),
			expectedQuat:  quatOf(0.23231217785607852, 0.6678555622436378, 0.23231217785607847, 0.667855562243638),
			expectedEuler: eulerOf(1.5707963267948961, -0.9012836732051033, 1.5707963267948966),
		},
		{
			name:          "about -X, from TestQuatConversion",
			input:         ov(2.47208, -1, 0, 0),
			expectedQuat:  quatOf(-0.667855562243638, -0.23231217785607844, 0.667855562243638, 0.23231217785607855),
			expectedEuler: eulerOf(1.5707963267948966, -0.9012836732051034, -1.5707963267948966),
		},
		{
			name:          "about +Y, from TestQuatConversion",
			input:         ov(2.47208, 0, 1, 0),
			expectedQuat:  quatOf(-0.30797568060138236, 0.3079756806013824, 0.6365147132298791, 0.6365147132298793),
			expectedEuler: eulerOf(1.5707963267948961, -0.9012836732051037, 3.141592653589793),
		},
		{
			name:          "about -Y, from TestQuatConversion",
			input:         ov(2.47208, 0, -1, 0),
			expectedQuat:  quatOf(0.6365147132298792, 0.6365147132298792, -0.30797568060138225, 0.3079756806013825),
			expectedEuler: eulerOf(1.5707963267948963, -0.9012836732051034, 0),
		},
		{
			name:          "at a small angle that once tripped the pole epsilon, from TestQuatConversion",
			input:         ov(0.02, 0.5048437942940054, 0.5889844266763397, 0.631054742867507),
			expectedQuat:  quatOf(0.8166322122704431, -0.1755596602541314, 0.3919839719397981, 0.38553754851640015),
			expectedEuler: eulerOf(0.024578862161217196, 0.8876383934765243, 0.8938566434762582),
		},
		{
			name:          "that once gave trouble, at theta zero, from TestQuatConversion",
			input:         ov(0, -0.32439089809469324, -0.9441256803955101, -0.05828588895294498),
			expectedQuat:  quatOf(0.3986572455869837, 0.5920660484957303, 0.42261180614734833, -0.5585064512291035),
			expectedEuler: eulerOf(3.141592653589793, 1.5124773853816689, 1.2398445277366923),
		},
		{
			name:          "that once gave trouble, rotated, from TestQuatConversion",
			input:         ov(-0.5732162806942777, -0.32439089809469324, -0.9441256803955101, -0.05828588895294498),
			expectedQuat:  quatOf(0.22450535384545364, 0.44844214211454825, 0.5727500237033498, -0.6484245535282075),
			expectedEuler: eulerOf(-1.678038034932634, 0.9949517355145595, 2.720591506214572),
		},

		{
			name:          "at the north pole, rotated, from TestOVConversionPoles",
			input:         ov(2.47208, 0, 0, 1),
			expectedQuat:  quatOf(0.3285390326284968, 0, 0, 0.9444903938312615),
			expectedEuler: eulerOf(0, 0, 2.47208),
		},
		{
			name:          "at the north pole, unrotated, from TestOVConversionPoles",
			input:         ov(0, 0, 0, 1),
			expectedQuat:  quatOf(1, 0, 0, 0),
			expectedEuler: eulerOf(0, 0, 0),
		},
		{
			name:          "at the north pole, rotated the other way, from TestOVConversionPoles",
			input:         ov(-2.47208, 0, 0, 1),
			expectedQuat:  quatOf(0.3285390326284968, -0, 0, -0.9444903938312615),
			expectedEuler: eulerOf(-0, 0, -2.47208),
		},
		{
			name:          "at the north pole, rotated under a radian, from TestOVConversionPoles",
			input:         ov(-0.78, 0, 0, 1),
			expectedQuat:  quatOf(0.9249090598573131, -0, 0, -0.3801884151231614),
			expectedEuler: eulerOf(-0, 0, -0.78),
		},
		{
			name:          "at the south pole, rotated, from TestOVConversionPoles",
			input:         ov(2.47208, 0, 0, -1),
			expectedQuat:  quatOf(2.0117213735172796e-17, 0.9444903938312615, 0.3285390326284968, 5.783335688154379e-17),
			expectedEuler: eulerOf(3.141592653589793, -9.602752015579763e-17, 0.6695126535897932),
		},
		{
			name:          "at the south pole, unrotated, from TestOVConversionPoles",
			input:         ov(0, 0, 0, -1),
			expectedQuat:  quatOf(6.123233995736757e-17, 0, 1, 0),
			expectedEuler: eulerOf(3.141592653589793, 1.2246467991473515e-16, 3.141592653589793),
		},
		{
			name:          "at the south pole, rotated the other way, from TestOVConversionPoles",
			input:         ov(-2.47208, 0, 0, -1),
			expectedQuat:  quatOf(2.0117213735172796e-17, -0.9444903938312615, 0.3285390326284968, -5.783335688154379e-17),
			expectedEuler: eulerOf(-3.141592653589793, -9.602752015579763e-17, -0.6695126535897932),
		},
		{
			name:          "at the south pole, rotated under a radian, from TestOVConversionPoles",
			input:         ov(-0.78, 0, 0, -1),
			expectedQuat:  quatOf(5.663434598283223e-17, -0.3801884151231614, 0.9249090598573131, -2.327982628267421e-17),
			expectedEuler: eulerOf(-3.141592653589793, 8.706179887972545e-17, -2.3615926535897933),
		},

		{
			name:          "with a vector 999 long, from TestOVNormalize",
			input:         ov(0, 999, 0, 0),
			expectedQuat:  quatOf(0.7071067811865476, 0, 0.7071067811865475, 0),
			expectedEuler: eulerOf(0, 1.5707963267948966, 0),
		},
		{
			name:          "with a vector half a unit long, from TestOVNormalize",
			input:         ov(0, 0.5, 0, 0),
			expectedQuat:  quatOf(0.7071067811865476, 0, 0.7071067811865475, 0),
			expectedEuler: eulerOf(0, 1.5707963267948966, 0),
		},

		{
			name:          "left entirely unset, from TestQuatDefault",
			input:         ov(0, 0, 0, 0),
			expectedQuat:  quatOf(1, 0, 0, 0),
			expectedEuler: eulerOf(0, 0, 0),
		},
	}
}

func fromQuaternionCases() []fromQuaternionCase {
	return []fromQuaternionCase{
		{
			name:     "a 45 degree turn about x, from testCompatibility",
			input:    q45x,
			expected: vectorOf(ov45xTheta, 0, -math.Sqrt2/2, math.Sqrt2/2),
		},

		{
			name:     "identity, from rmQuatSamples",
			input:    quat.Number{Real: 1},
			expected: vectorOf(0, 0, 0, 1),
		},
		{
			name:     "x90, from rmQuatSamples",
			input:    quat.Number{Real: math.Sqrt2 / 2, Imag: math.Sqrt2 / 2},
			expected: vectorOf(1.5707963267948966, 0, -1.0000000000000002, -4.266421588589642e-17),
		},
		{
			name:     "y90, from rmQuatSamples",
			input:    quat.Number{Real: math.Sqrt2 / 2, Jmag: math.Sqrt2 / 2},
			expected: vectorOf(0, 1.0000000000000002, 0, -4.266421588589642e-17),
		},
		{
			name:     "z90, from rmQuatSamples",
			input:    quat.Number{Real: math.Sqrt2 / 2, Kmag: math.Sqrt2 / 2},
			expected: vectorOf(1.5707963267948966, 0, 0, 1.0000000000000002),
		},
		{
			name:     "z180, from rmQuatSamples",
			input:    quat.Number{Kmag: 1},
			expected: vectorOf(-3.141592653589793, 0, 0, 1),
		},
		{
			name:     "zyx_30_45_60, from rmQuatSamples",
			input:    (&sm.EulerAngles{Roll: math.Pi / 6, Pitch: math.Pi / 4, Yaw: math.Pi / 3}).Quaternion(),
			expected: vectorOf(0.46364760900080615, 0.7391989197401165, 0.2803300858899107, 0.6123724356957945),
		},

		{
			name:     "a quarter turn about -X, from TestQuatConversion",
			input:    quat.Number{Real: 0.7071067811865476, Imag: -0.7071067811865476},
			expected: vectorOf(-1.5707963267948966, 0, 1.0000000000000002, -4.266421588589642e-17),
		},
		{
			name:     "about -Y, from TestQuatConversion",
			input:    quat.Number{Real: 0.96, Jmag: -0.28},
			expected: vectorOf(-3.141592653589793, -0.5376000000000001, 0, 0.8432),
		},
		{
			name:     "about -Z, from TestQuatConversion",
			input:    quat.Number{Real: 0.96, Kmag: -0.28},
			expected: vectorOf(-0.5675882184166557, 0, 0, 0.9999999999999999),
		},
		{
			name:     "at a negative theta, from TestQuatConversion",
			input:    quat.Number{Real: 0.96, Imag: -0.28},
			expected: vectorOf(-1.5707963267948966, 0, 0.5376000000000001, 0.8432),
		},
		{
			name:     "at the complementary angle, from TestQuatConversion",
			input:    quat.Number{Real: 0.96, Imag: 0.28},
			expected: vectorOf(1.5707963267948966, 0, -0.5376000000000001, 0.8432),
		},
		{
			name:     "at an odd angle, from TestQuatConversion",
			input:    quat.Number{Real: 0.5, Imag: -0.5, Jmag: -0.5, Kmag: -0.5},
			expected: vectorOf(-3.141592653589793, 0, 1, 0),
		},

		{
			name:     "inside the north pole radius with a longitude, from TestOrientationVectorPoleRadius",
			input:    quat.Number{Real: 0.70584550898089, Imag: -0.0010138888433254124, Jmag: 0.00457100337056847, Kmag: 0.7083503338102609},
			expected: vectorOf(1.5743387247206224, 0.00501646740007242, 0.00790704130011415, 0.9999561559151995),
		},
		{
			name:     "inside the north pole radius, a UR20 upper arm in its shoulder",
			input:    quat.Number{Real: 0.5821894594263212, Imag: 0.0004270170433806911, Jmag: -0.0005963478170048587, Kmag: -0.8130528244576818},
			expected: vectorOf(-1.8987542911955098, -0.0013887496528487296, 0.00047251491064668533, 0.9999989240514517),
		},
		{
			name:     "inside the south pole radius with a longitude",
			input:    quat.Number{Real: 0.002275232030194584, Imag: 0.47942404038768993, Jmag: 0.877579819423441, Kmag: -0.001036030053491365},
			expected: vectorOf(1, 0.0029999999999933747, -0.003999999999991169, -0.9999874999218736),
		},
	}
}

func normalizeCases() []normalizeCase {
	return []normalizeCase{
		{
			name:     "a vector 999 long, from TestOVNormalize",
			input:    ov(0, 999, 0, 0),
			expected: vectorOf(0, 1, 0, 0),
		},
		{
			name:     "a vector half a unit long, from TestOVNormalize",
			input:    ov(0, 0.5, 0, 0),
			expected: vectorOf(0, 1, 0, 0),
		},
		{
			name:     "a vector left entirely unset, from TestQuatDefault",
			input:    ov(0, 0, 0, 0),
			expected: vectorOf(0, 0, 0, 1),
		},
		{
			name:     "a vector already very nearly a unit, from TestOrientationVectorPoleRadius",
			input:    poleRadiusVector(),
			expected: vectorOf(1.5743387247206226, 0.00501646740007625, 0.007907041300120187, 0.9999561559151993),
		},
	}
}

func snapshotVector(v *sm.OrientationVector) *goldenOrientationVector {
	return &goldenOrientationVector{Th: v.Theta, X: v.OX, Y: v.OY, Z: v.OZ}
}

func assertVector(t *testing.T, actual, expected *goldenOrientationVector) {
	t.Helper()

	test.That(t, expected, test.ShouldNotBeNil)
	test.That(t, actual.Th, test.ShouldAlmostEqual, expected.Th, quaternionTolerance)
	test.That(t, actual.X, test.ShouldAlmostEqual, expected.X, quaternionTolerance)
	test.That(t, actual.Y, test.ShouldAlmostEqual, expected.Y, quaternionTolerance)
	test.That(t, actual.Z, test.ShouldAlmostEqual, expected.Z, quaternionTolerance)
}

func assertEulerAngles(t *testing.T, actual, expected *goldenEulerAngles) {
	t.Helper()

	test.That(t, expected, test.ShouldNotBeNil)
	test.That(t, actual.Roll, test.ShouldAlmostEqual, expected.Roll, quaternionTolerance)
	test.That(t, actual.Pitch, test.ShouldAlmostEqual, expected.Pitch, quaternionTolerance)
	test.That(t, actual.Yaw, test.ShouldAlmostEqual, expected.Yaw, quaternionTolerance)
}

func vectorOf(th, x, y, z float64) *goldenOrientationVector {
	return &goldenOrientationVector{Th: th, X: x, Y: y, Z: z}
}

func eulerOf(roll, pitch, yaw float64) *goldenEulerAngles {
	return &goldenEulerAngles{Roll: roll, Pitch: pitch, Yaw: yaw}
}
