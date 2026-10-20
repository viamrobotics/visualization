package kinematics

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"google.golang.org/protobuf/encoding/protojson"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// SpecFileName is the conventional name of a spec file, beside the sources it references.
const SpecFileName = "kinematics.json"

// LoadSpec reads a protojson spec file. Both snake_case and lowerCamelCase field names parse.
func LoadSpec(path string) (*kinematicsv1.KinematicsSpec, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read spec %q: %w", path, err)
	}
	spec := &kinematicsv1.KinematicsSpec{}
	if err := protojson.Unmarshal(data, spec); err != nil {
		return nil, fmt.Errorf("parse spec %q: %w", path, err)
	}
	return spec, nil
}

// MarshalSpec renders spec as protojson with snake_case field names, two-space indentation, and a
// trailing newline. Unlike protojson's own output, the bytes are stable for the same spec.
func MarshalSpec(spec *kinematicsv1.KinematicsSpec) ([]byte, error) {
	raw, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(spec)
	if err != nil {
		return nil, fmt.Errorf("marshal spec: %w", err)
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, raw); err != nil {
		return nil, fmt.Errorf("compact spec: %w", err)
	}
	var out bytes.Buffer
	if err := json.Indent(&out, compact.Bytes(), "", "  "); err != nil {
		return nil, fmt.Errorf("indent spec: %w", err)
	}
	out.WriteByte('\n')
	return out.Bytes(), nil
}
