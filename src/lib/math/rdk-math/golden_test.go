package rdkmath

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"go.viam.com/test"
)

// goldenDir holds the files the TypeScript golden test suites in src/lib/math/__tests__
// check themselves against.
const goldenDir = "testdata"

// writeGolden serializes payload to goldenDir/name
func writeGolden(t *testing.T, name string, payload any) {
	t.Helper()

	err := os.MkdirAll(goldenDir, 0o755)
	test.That(t, err, test.ShouldBeNil)

	encoded, err := json.MarshalIndent(payload, "", "\t")
	test.That(t, err, test.ShouldBeNil)

	err = os.WriteFile(filepath.Join(goldenDir, name), append(encoded, '\n'), 0o644)
	test.That(t, err, test.ShouldBeNil)
}

// goldenQuaternion names the components of a quat.Number, whose own fields are Real/Imag/Jmag/Kmag.
// Three.js orders a quaternion (x, y, z, w) and RDK writes the scalar first, so spelling each one
// out is for consistency.
type goldenQuaternion struct {
	W float64 `json:"w"`
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

func quatOf(w, x, y, z float64) *goldenQuaternion {
	return &goldenQuaternion{W: w, X: x, Y: y, Z: z}
}
