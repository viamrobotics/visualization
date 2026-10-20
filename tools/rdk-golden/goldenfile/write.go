// Package goldenfile writes the JSON files the TypeScript golden suites check themselves against.
package goldenfile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"go.viam.com/test"
)

// Dir is where each generator package writes its goldens, relative to that package, so the
// TypeScript suites import them from tools/rdk-golden/<package>/testdata.
const Dir = "testdata"

// Write serializes payload to Dir/name.
func Write(t *testing.T, name string, payload any) {
	t.Helper()

	err := os.MkdirAll(Dir, 0o755)
	test.That(t, err, test.ShouldBeNil)

	encoded, err := json.MarshalIndent(payload, "", "\t")
	test.That(t, err, test.ShouldBeNil)

	err = os.WriteFile(filepath.Join(Dir, name), append(encoded, '\n'), 0o644)
	test.That(t, err, test.ShouldBeNil)
}
