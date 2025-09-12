package client

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/colorutil"
	"github.com/viam-labs/motion-tools/client/shapes"
	"google.golang.org/protobuf/encoding/protojson"

	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/robot"
	"go.viam.com/rdk/spatialmath"

	"github.com/viam-labs/motion-tools/mutils"
)

/**
A lot of these methods pack requests into single float32 arrays to be sent to the viz client.

Why? And why not use protobuf? Why this approach is fast, and faster than protobuf for this case:

1. Zero-copy decoding with Float32Array
We're're streaming raw float32 data.
The JS client reads it directly using new Float32Array(buffer), which requires no parsing or allocation beyond the typed array.
This is basically as fast as it gets in JavaScript for numerical data.
Protobuf Decoding requires parsing the wire format (varints, field tags, lengths).
Constructs JS objects, maps, and arrays.
Typically incurs significant GC overhead on large binary blobs.
Cannot be memory-mapped or used as typed arrays without full decode.

2. Compact, predictable layout
This layout is tightly packed: label -> header -> positions -> colors.
We control the alignment and know exactly how to read it — no extra metadata or tags.
Protobuf adds field numbers, wire types, and nested descriptors — even for flat data.

3. JS performance is optimal for typed arrays
Browsers (especially Chrome/V8) heavily optimize TypedArray access.
Avoiding object instantiation helps stay in fast paths of the JIT.
*/

// DefaultColorMap is a list of sensible colors to cycle between
// this is also the "Set1" colormap in Matplotlib
var DefaultColorMap = []string{"#E41A1C", "#377EB8", "#4DAF4A", "#984EA3", "#FF7F00", "#FFFF33", "#A65628", "#F781BF", "#999999"}

type colorChooser struct {
	count int
}

func (cc *colorChooser) next() string {
	c := DefaultColorMap[cc.count%len(DefaultColorMap)]
	cc.count++
	return c
}

var (
	url = "http://localhost:3000/"
)

const (
	pointsType = 0
	posesType  = 1
	lineType   = 2
)

func hexToRGB(input string) ([3]uint8, error) {
	var rgb [3]uint8

	hexStr := colorutil.NamedColorToHex(input)
	hexStr = strings.TrimPrefix(hexStr, "#")
	if len(hexStr) != 6 {
		return rgb, errors.New("invalid hex color string")
	}

	bytes, err := hex.DecodeString(hexStr)
	if err != nil || len(bytes) != 3 {
		return rgb, err
	}

	copy(rgb[:], bytes)
	return rgb, nil
}

func isASCIIPrintable(label string) error {
	if !utf8.ValidString(label) {
		return errors.New("label is not valid utf-8")
	}

	if len(label) > 100 {
		return errors.New("label is too long (max 100 characters)")
	}
	for _, r := range label {
		if r > 127 || r < 32 {
			return errors.New("label is not ascii")
		}
	}
	return nil
}

func postHTTP(data []byte, content string, endpoint string) error {
	// Make a defensive copy so caller's slice can be safely reused.
	payload := make([]byte, len(data))
	copy(payload, data)

	if recordFile != nil {
		if lastDraw.IsZero() {
			// If this is the first draw command for a recording, we only need to note the
			// time. There's no need to add a sleep.
			lastDraw = time.Now()
		} else {
			// Calculate the time since the last frame. We only want to capture user sleeps between
			// `Draw*` calls. Thus we will only write out a sleep operation if the time is
			// "significant". We do this "significance" check because a single `Draw` command (e.g:
			// DrawFrameSystem) often results in many small `postHTTP` calls. The time between these
			// HTTP calls is not intended to be captured by the user.
			timeSinceFrame := time.Since(lastDraw)
			if timeSinceFrame > 10*time.Millisecond {
				fmt.Fprintf(recordFile, "sleep: %v\n", timeSinceFrame.Nanoseconds())
			}
			defer func() {
				// Because we only want to capture user sleeps calls to drawing, we update the
				// `lastDraw` time after each response is received. This is to have updating the
				// `lastDraw` time better track calls to `Draw*` (e.g: `DrawFrameSystem`)
				// methods. Most `postHTTP` calls take 1-10ms. And a single `DrawFrameSystem` can be
				// dozens of `postHTTP` calls. We do not want to turn a 100ms user sleep into a
				// forced 150+ms wait between frames because of the number of smaller `postHTTP`
				// that had to be made.
				lastDraw = time.Now()
			}()
		}

		fmt.Fprintf(recordFile, "%v\n", endpoint)
		fmt.Fprintf(recordFile, "%v\n", content)
		fmt.Fprintf(recordFile, "%v\n", hex.EncodeToString(payload))
	}

	resp, err := http.Post(url+endpoint, "application/"+content, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("HTTP post unsuccessful: %s", resp.Status)
	}
	return nil
}

// SetURL sets the url for communicating with the visualizer.
// This is useful when using multiple visualizer windows, or when drawing
// to a visualizer on another computer.
//
// The port should be :3000, which is the port of the drawing server.
//
// Parameters:
//   - preferredURL: a url string
func SetURL(preferredURL string) {
	if !strings.HasSuffix(preferredURL, "/") {
		preferredURL += "/"
	}
	url = preferredURL
}

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

// DrawGeometries draws a list of geometries in the visualizer.
//
// Labels must be unique within a world. Calling DrawGeometries with labels that
// already exist will instead update the pose of that geometry. Only poses can be updated,
// geometries must be cleared if their shape is to change.
//
// Parameters:
//   - geometriesInFrame: a list of geometries
//   - colors: a list of corresponding colors for each geometry
func DrawGeometries(geometriesInFrame *referenceframe.GeometriesInFrame, colors []string) error {
	geometries := make([]json.RawMessage, len(geometriesInFrame.Geometries()))

	for i, geo := range geometriesInFrame.Geometries() {
		data, err := protojson.Marshal(geo.ToProtobuf())
		if err != nil {
			return err
		}
		geometries[i] = json.RawMessage(data)
	}

	result, err := json.Marshal(map[string]interface{}{
		"geometries": geometries,
		"colors":     colorutil.NamedColorsToHexes(colors),
		"parent":     geometriesInFrame.Parent(),
	})

	if err != nil {
		return err
	}

	return postHTTP(result, "json", "geometries")
}

// DrawLine draws a line in the visualizer.
//
// Parameters:
//   - label: an identifier string used for reference in the treeview.
//   - points: a list of poses, each representing a point in the line
//   - color: An optional color of the line
//   - dotColor: An optional color for dots for each vertex in the line
func DrawLine(label string, points []spatialmath.Pose, color *[3]uint8, dotColor *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
	}

	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	nPoints := len(points)

	// total floats:
	// 1 (type) + 1 (label length) + labelLen + 1 (nPoints) + 3 (default color)
	// + 3 (default dot color) + 3*nPoints (positions)
	total := 1 + 1 + labelLen + 1 + 3 + 3 + nPoints*3
	data := make([]float32, 0, total)

	data = append(data, float32(lineType), float32(labelLen))
	for _, b := range labelBytes {
		data = append(data, float32(b))
	}

	// Set to -1 by default to communicate intentionally no color
	// Allows users to set default colors in the web app.
	finalColor := [3]float32{-255., -255., -255.}
	if color != nil {
		finalColor[0] = float32(color[0])
		finalColor[1] = float32(color[1])
		finalColor[2] = float32(color[2])
	}

	finalDotColor := [3]float32{-255., -255., -255.}
	if dotColor != nil {
		finalDotColor[0] = float32(dotColor[0])
		finalDotColor[1] = float32(dotColor[1])
		finalDotColor[2] = float32(dotColor[2])
	}

	data = append(data,
		float32(nPoints),
		finalColor[0]/255.0,
		finalColor[1]/255.0,
		finalColor[2]/255.0,
		finalDotColor[0]/255.0,
		finalDotColor[1]/255.0,
		finalDotColor[2]/255.0,
	)

	for _, pose := range points {
		point := pose.Point()
		data = append(data,
			float32(point.X)/1000.0,
			float32(point.Y)/1000.0,
			float32(point.Z)/1000.0,
		)
	}

	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "line")
}

// DrawPoints draws a list of points in the visualizer.
//
// Parameters:
//   - label: an identifier string used for reference in the treeview
//   - points: a list of poses, each representing a point
//   - colors: Individual point color, optional, and will fallback to defaultColor
//   - color: an optional fallback color [R, G, B] (0–255); use nil for black
func DrawPoints(label string, points []spatialmath.Pose, colors [][3]uint8, color *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
	}

	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	nPoints := len(points)
	nColors := len(colors)

	// total floats:
	// 1 (type) + 1 (label length) + labelLen + 2 (nPoints, nColors) + 3 (default color)
	// + 3*nPoints (positions) + 3*nColors (colors)
	total := 1 + 1 + labelLen + 2 + 3 + nPoints*3 + nColors*3
	data := make([]float32, 0, total)

	data = append(data, float32(pointsType), float32(labelLen))
	for _, b := range labelBytes {
		data = append(data, float32(b))
	}

	fallbackColor := [3]uint8{0, 0, 0}
	if color == nil {
		color = &fallbackColor
	}

	data = append(data,
		float32(nPoints),
		float32(nColors),
		float32(color[0])/255.0,
		float32(color[1])/255.0,
		float32(color[2])/255.0,
	)

	for _, pose := range points {
		point := pose.Point()
		data = append(data,
			float32(point.X)/1000.0,
			float32(point.Y)/1000.0,
			float32(point.Z)/1000.0,
		)
	}

	for _, color := range colors {
		data = append(data,
			float32(color[0])/255.0,
			float32(color[1])/255.0,
			float32(color[2])/255.0,
		)
	}

	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "points")
}

// DrawPoses draws a list of poses in the visualizer as arrows.
//
// Parameters:
//   - poses: a list of poses
//   - colors: Individual arrow color
//   - arrowHeadAtPose: whether the tip of the cone of the arrow will be at the pose. default is false
func DrawPoses(poses []spatialmath.Pose, colors []string, arrowHeadAtPose bool) error {
	nPoses := len(poses)
	nColors := len(colors)
	total := 1 + 3 + nPoses*6 + nColors*3

	data := make([]float32, 0, total)

	a := 0.
	if arrowHeadAtPose {
		a = 1.
	}

	// Header
	data = append(data, float32(posesType), float32(nPoses), float32(nColors), float32(a))

	for _, pose := range poses {
		point := pose.Point()
		orientation := pose.Orientation().OrientationVectorDegrees()
		data = append(data,
			float32(point.X),
			float32(point.Y),
			float32(point.Z),
			float32(orientation.OX),
			float32(orientation.OY),
			float32(orientation.OZ))
	}

	for _, c := range colors {
		rgb, err := hexToRGB(c)
		if err != nil {
			return err
		}

		data = append(data,
			float32(rgb[0])/255.0,
			float32(rgb[1])/255.0,
			float32(rgb[2])/255.0,
		)
	}

	buf := new(bytes.Buffer)
	err := binary.Write(buf, binary.LittleEndian, data)
	if err != nil {
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "poses")
}

// DrawNurbs draws a nurbs curve in the visualizer.
//
// Parameters:
//   - nurbs: A nurbs curve
//   - color: The color of the line
//   - name: A unique label for the curve
func DrawNurbs(nurbs shapes.Nurbs, color string, name string) error {
	poseData := make([]json.RawMessage, len(nurbs.ControlPts))
	for i, pose := range nurbs.ControlPts {
		data, err := protojson.Marshal(spatialmath.PoseToProtobuf(pose))
		if err != nil {
			return err
		}
		poseData[i] = json.RawMessage(data)
	}

	wrappedData := map[string]interface{}{
		"ControlPts": poseData,
		"Degree":     nurbs.Degree,
		"Weights":    nurbs.Weights,
		"Knots":      nurbs.Knots,
		"Color":      colorutil.NamedColorToHex(color),
		"name":       name,
	}

	finalJSON, err := json.Marshal(wrappedData)
	if err != nil {
		return err
	}

	return postHTTP(finalJSON, "json", "nurbs")
}

// RemoveSpatialObjects clears a list of drawn items.
//
// Parameters:
//   - names: A list of names of items to clear
func RemoveSpatialObjects(names []string) error {
	json, err := json.Marshal(names)

	if err != nil {
		return err
	}

	return postHTTP(json, "json", "remove")
}

// RemoveAllSpatialObjects clears all drawn items from the visualizer.
//
// Parameters:
//   - names: A list of names of items to clear
func RemoveAllSpatialObjects() error {
	data := map[string]interface{}{}

	json, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return postHTTP(json, "json", "remove-all")
}

// SetCameraPose will set the visualizer's camera pose.
//
// Parameters:
//   - position: The camera position
//   - lookAt: The direction the camera should look at
//   - animate: Whether or not to animate to this pose
func SetCameraPose(position r3.Vector, lookAt r3.Vector, animate bool) error {
	positionM := map[string]interface{}{
		"X": position.X / 1000.0,
		"Y": position.Y / 1000.0,
		"Z": position.Z / 1000.0,
	}

	lookAtM := map[string]interface{}{
		"X": lookAt.X / 1000.0,
		"Y": lookAt.Y / 1000.0,
		"Z": lookAt.Z / 1000.0,
	}

	data := map[string]interface{}{
		"setCameraPose": true,
		"Position":      positionM,
		"LookAt":        lookAtM,
		"Animate":       animate,
	}

	json, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return postHTTP(json, "json", "camera")
}

// DrawGLTF will draw a glTF file in the visualizer.
//
// Parameters:
//   - filePath: The gltf filepath
func DrawGLTF(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}

	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url+"gltf", file)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "model/gltf-binary")
	req.ContentLength = fileInfo.Size()

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("HTTP post unsuccessful: %s", resp.Status)
	}

	return nil
}

// DrawFrameSystem will draw a frame system in the visualizer.
//
// Parameters:
//   - fs: A frame system
//   - inputs: Frame system inputs
func DrawFrameSystem(fs *referenceframe.FrameSystem, inputs referenceframe.FrameSystemInputs) error {
	frameGeomMap, err := referenceframe.FrameSystemGeometries(fs, inputs)
	if err != nil {
		return err
	}

	i := 0
	// We iterate the map of frame labels in a consistent order. Consider the case where a user
	// wants to visualize a plan by writing:
	//
	// for each `FrameSystemInputs` in the plan {
	//   RemoveAllSpatialObjects()
	//   DrawFrameSystem(fs, currentInputs)
	// }
	//
	// In this case, the set of figures in the visualization are the same. With just a few figures
	// moving from one image to the next. It's distracting to see what's happening when the colors
	// are changing with each image. Hence sorting on the label names allows us to enforce a
	// consistent color scheme for each figure when the geometry labels remain the same.
	for _, geomLabel := range slices.Sorted(maps.Keys(frameGeomMap)) {
		geoms := frameGeomMap[geomLabel]
		geometries := geoms.Geometries()
		colors := make([]string, len(geometries))
		for j := range geometries {
			colors[j] = DefaultColorMap[i%len(DefaultColorMap)]
		}
		if err = DrawGeometries(geoms, colors); err != nil {
			return err
		}
		i++
	}
	return nil
}

// DrawWorldState will draw a world state in the visualizer.
//
// Parameters:
//   - ws: A world state
//   - fs: A frame system
//   - inputs: Frame system inputs
func DrawWorldState(ws *referenceframe.WorldState, fs *referenceframe.FrameSystem, inputs referenceframe.FrameSystemInputs) error {
	geoms, err := ws.ObstaclesInWorldFrame(fs, inputs)
	if err != nil {
		return err
	}

	geometries := geoms.Geometries()
	cc := &colorChooser{}
	colors := make([]string, len(geometries))
	for i := range geometries {
		colors[i] = cc.next()
	}

	if err = DrawGeometries(geoms, colors); err != nil {
		return err
	}

	return nil
}

// DrawRobot will draw a robot in the visualizer.
//
// Parameters:
//   - ctx: A context
//   - myRobot: A robot
//   - ws: An optional world state
func DrawRobot(ctx context.Context, myRobot robot.Robot, ws *referenceframe.WorldState) error {
	fsCfg, err := myRobot.FrameSystemConfig(ctx)
	if err != nil {
		return err
	}

	rf, err := referenceframe.NewFrameSystem("foo", fsCfg.Parts, nil)
	if err != nil {
		return err
	}

	inputs, err := mutils.GetInputs(ctx, rf, myRobot)
	if err != nil {
		return err
	}

	if ws != nil {
		err = DrawWorldState(ws, rf, inputs)
		if err != nil {
			return err
		}

		for _, lif := range ws.Transforms() {
			err = DrawGeometries(referenceframe.NewGeometriesInFrame(
				lif.Parent(),
				[]spatialmath.Geometry{lif.Geometry()},
			), DefaultColorMap)
			if err != nil {
				return err
			}
		}

	}

	gifs, err := referenceframe.FrameSystemGeometries(rf, inputs)
	if err != nil {
		return nil
	}
	for _, gif := range gifs {
		err = DrawGeometries(gif, DefaultColorMap)
		if err != nil {
			return nil
		}
	}

	return nil
}
