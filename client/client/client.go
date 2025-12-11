package client

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/viam-labs/motion-tools/client/colorutil"
	"github.com/viam-labs/motion-tools/client/shapes"
	"github.com/viam-labs/motion-tools/draw"
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
		"Color":      drawNurbs.Color.ToHex(),
		"Name":       name,
	})
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
