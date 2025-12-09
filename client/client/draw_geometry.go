package client

import (
	"encoding/json"

	"github.com/viam-labs/motion-tools/client/colorutil"
	"github.com/viam-labs/motion-tools/draw"
	commonv1 "go.viam.com/api/common/v1"
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

	rgbColor, err := colorutil.NamedColorToRGB(color)
	if err != nil {
		return err
	}
	transform, err := draw.DrawGeometry("", geometry, spatialmath.NewZeroPose(), "world", draw.NewColor(draw.WithRGB(rgbColor[0], rgbColor[1], rgbColor[2])))
	if err != nil {
		return err
	}

	json, err := transformToGeometryJSON(transform)
	if err != nil {
		return err
	}

	return postHTTP(json, "json", "geometry")
}

func transformToGeometryJSON(transform *commonv1.Transform) ([]byte, error) {
	data, err := protojson.Marshal(transform.GetPhysicalObject())
	if err != nil {
		return nil, err
	}
	colorsBytes := base64EncodedToString(transform.Metadata.Fields["colors"].GetStringValue())
	drawColor := draw.NewColor(draw.WithRGB(colorsBytes[0], colorsBytes[1], colorsBytes[2]))
	return json.Marshal(map[string]interface{}{
		"geometry": json.RawMessage(data),
		"color":    drawColor.ToHex(),
	})
}
