package client

import (
	"encoding/json"

	"github.com/viam-labs/motion-tools/client/colorutil"
	"google.golang.org/protobuf/encoding/protojson"

	"go.viam.com/rdk/spatialmath"
)

// DrawGeometry draws a geometry in the visualizer.
//
// Labels must be unique within a world. Calling DrawGeometry with labels that
// already exist will instead update the pose of that geometry. Only poses can be updated,
// geometries must be cleared if their shape is to change.
//
// Parameters:
//   - geometry: a geometry
//   - color: a corresponding color
func DrawGeometry(geometry spatialmath.Geometry, color string) error {
	data, err := protojson.Marshal(geometry.ToProtobuf())
	if err != nil {
		return err
	}

	finalJSON, err := json.Marshal(map[string]interface{}{
		"geometry": json.RawMessage(data),
		"color":    colorutil.NamedColorToHex(color),
	})
	if err != nil {
		return err
	}

	return postHTTP(finalJSON, "json", "geometry")
}
