package rdkmath

import (
	"encoding/json"
	"testing"

	"github.com/golang/geo/r3"
	sm "go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

// geometryGoldenName is read by src/lib/math/__tests__/inferGeometry.spec.ts, which asserts that
// the TypeScript port of this inference agrees with what RDK resolved here.
const geometryGoldenName = "geometry_infer_golden.json"

// geometryGoldenCase pairs the wire JSON a config serializes to with the geometry type RDK
// resolved it to. An empty resolvedType means ParseConfig yielded no geometry at all.
type geometryGoldenCase struct {
	Name         string          `json:"name"`
	Geometry     json.RawMessage `json:"geometry"`
	ResolvedType string          `json:"resolvedType"`
}

type geometryGoldenFile struct {
	Source string               `json:"source"`
	Cases  []geometryGoldenCase `json:"cases"`
}

func TestGeometryInferGolden(t *testing.T) {
	translation := r3.Vector{X: 1, Y: 1, Z: 1}

	testCases := []struct {
		name   string
		config sm.GeometryConfig
		want   string
	}{
		{"declared box", sm.GeometryConfig{Type: "box", X: 1, Y: 1, Z: 1, TranslationOffset: translation}, "box"},
		{"declared box with a zero side", sm.GeometryConfig{Type: "box", X: 1, Y: 0, Z: 1}, "box"},
		{"declared sphere", sm.GeometryConfig{Type: "sphere", R: 1, TranslationOffset: translation}, "sphere"},
		{"declared capsule", sm.GeometryConfig{Type: "capsule", R: 1, L: 4}, "capsule"},
		{"declared cylinder", sm.GeometryConfig{Type: "cylinder", R: 1, L: 4}, "cylinder"},
		{"declared point", sm.GeometryConfig{Type: "point", TranslationOffset: translation}, "point"},

		{"infer box from all three dimensions", sm.GeometryConfig{X: 1, Y: 1, Z: 1}, "box"},
		{"infer box from a single dimension", sm.GeometryConfig{X: 1}, "box"},
		{"infer box before capsule", sm.GeometryConfig{X: 1, Y: 1, Z: 1, R: 1, L: 4}, "box"},
		{"infer box before sphere", sm.GeometryConfig{X: 1, Y: 1, Z: 1, R: 1}, "box"},
		{"infer capsule from length and radius", sm.GeometryConfig{R: 1, L: 4, TranslationOffset: translation}, "capsule"},
		{"infer sphere from radius", sm.GeometryConfig{R: 1}, "sphere"},
		{"infer sphere from a negative radius", sm.GeometryConfig{R: -1}, ""},
		{"infer nothing from an empty config", sm.GeometryConfig{}, ""},
	}

	golden := geometryGoldenFile{
		Source: "go.viam.com/rdk spatialmath.GeometryConfig.ParseConfig",
		Cases:  make([]geometryGoldenCase, 0, len(testCases)),
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			wire, err := json.Marshal(testCase.config)
			test.That(t, err, test.ShouldBeNil)

			test.That(t, resolveGeometryType(t, testCase.config), test.ShouldEqual, testCase.want)

			golden.Cases = append(golden.Cases, geometryGoldenCase{
				Name:         testCase.name,
				Geometry:     wire,
				ResolvedType: testCase.want,
			})
		})
	}

	writeGolden(t, geometryGoldenName, golden)
}

// resolveGeometryType reports the type RDK settles a config on, or "" when it builds no geometry.
func resolveGeometryType(t *testing.T, config sm.GeometryConfig) string {
	t.Helper()

	geometry, err := config.ParseConfig()
	if err != nil {
		return ""
	}

	resolved, err := sm.NewGeometryConfig(geometry)
	test.That(t, err, test.ShouldBeNil)
	return string(resolved.Type)
}
