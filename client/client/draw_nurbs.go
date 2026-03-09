package client

import (
	"encoding/json"

	"github.com/viam-labs/motion-tools/client/colorutil"
	"github.com/viam-labs/motion-tools/client/shapes"
	"github.com/viam-labs/motion-tools/draw"
	"google.golang.org/protobuf/encoding/protojson"

	"go.viam.com/rdk/spatialmath"
)

// DrawNurbs draws a nurbs curve in the visualizer.
//
// Parameters:
//   - nurbs: A nurbs curve
//   - color: The color of the line
//   - name: A unique label for the curve
func DrawNurbs(nurbs shapes.Nurbs, color string, name string) error {
	rgbColor, err := colorutil.NamedColorToRGB(color)
	if err != nil {
		return err
	}
	drawNurbs, err := draw.NewNurbs(nurbs.ControlPts, nurbs.Knots, draw.WithNurbsDegree(int32(nurbs.Degree)), draw.WithNurbsWeights(nurbs.Weights), draw.WithNurbsColors(draw.NewColor(draw.WithRGB(rgbColor[0], rgbColor[1], rgbColor[2]))))
	if err != nil {
		return err
	}

	json, err := nurbsToJSON(drawNurbs, name)
	if err != nil {
		return err
	}

	return postHTTP(json, "json", "nurbs")
}

func nurbsToJSON(drawNurbs *draw.Nurbs, name string) ([]byte, error) {

	poseData := make([]json.RawMessage, len(drawNurbs.ControlPoints))
	for i, pose := range drawNurbs.ControlPoints {
		data, err := protojson.Marshal(spatialmath.PoseToProtobuf(pose))
		if err != nil {
			return nil, err
		}
		poseData[i] = json.RawMessage(data)
	}

	return json.Marshal(map[string]interface{}{
		"ControlPts": poseData,
		"Degree":     drawNurbs.Degree,
		"Weights":    drawNurbs.Weights,
		"Knots":      drawNurbs.Knots,
		"Color":      drawNurbs.Colors[0].ToHex(),
		"Name":       name,
	})
}
