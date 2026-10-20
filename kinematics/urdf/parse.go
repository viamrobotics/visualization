package urdf

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

type urdfRobot struct {
	XMLName       xml.Name           `xml:"robot"`
	Name          string             `xml:"name,attr"`
	Links         []urdfLink         `xml:"link"`
	Joints        []urdfJoint        `xml:"joint"`
	Transmissions []urdfTransmission `xml:"transmission"`
	Gazebos       []urdfGazebo       `xml:"gazebo"`
	Controls      []urdfControl      `xml:"ros2_control"`
}

type urdfPresence struct{}

type urdfLink struct {
	Name       string        `xml:"name,attr"`
	Inertial   *urdfPresence `xml:"inertial"`
	Visuals    []urdfShape   `xml:"visual"`
	Collisions []urdfShape   `xml:"collision"`
}

type urdfShape struct {
	Origin   *urdfOrigin  `xml:"origin"`
	Geometry urdfGeometry `xml:"geometry"`
}

type urdfGeometry struct {
	Box *struct {
		Size string `xml:"size,attr"`
	} `xml:"box"`
	Sphere *struct {
		Radius string `xml:"radius,attr"`
	} `xml:"sphere"`
	Cylinder *struct {
		Radius string `xml:"radius,attr"`
		Length string `xml:"length,attr"`
	} `xml:"cylinder"`
	Mesh *struct {
		Filename string `xml:"filename,attr"`
		Scale    string `xml:"scale,attr"`
	} `xml:"mesh"`
}

type urdfOrigin struct {
	XYZ string `xml:"xyz,attr"`
	RPY string `xml:"rpy,attr"`
}

type urdfJoint struct {
	Name   string `xml:"name,attr"`
	Type   string `xml:"type,attr"`
	Parent struct {
		Link string `xml:"link,attr"`
	} `xml:"parent"`
	Child struct {
		Link string `xml:"link,attr"`
	} `xml:"child"`
	Origin *urdfOrigin `xml:"origin"`
	Axis   *struct {
		XYZ string `xml:"xyz,attr"`
	} `xml:"axis"`
	Limit *struct {
		Lower string `xml:"lower,attr"`
		Upper string `xml:"upper,attr"`
	} `xml:"limit"`
	Mimic *struct {
		Joint      string `xml:"joint,attr"`
		Multiplier string `xml:"multiplier,attr"`
		Offset     string `xml:"offset,attr"`
	} `xml:"mimic"`
}

type urdfTransmission struct {
	Name   string `xml:"name,attr"`
	Joints []struct {
		Name string `xml:"name,attr"`
	} `xml:"joint"`
}

type urdfGazebo struct {
	Reference string `xml:"reference,attr"`
}

type urdfControl struct {
	Name string `xml:"name,attr"`
}

func parseURDF(data []byte) (*urdfRobot, error) {
	var robot urdfRobot
	if err := xml.Unmarshal(data, &robot); err != nil {
		return nil, fmt.Errorf("parse URDF: %w", err)
	}
	return &robot, nil
}

// parseFloats reads n whitespace-separated numbers. An empty string yields fallback.
func parseFloats(text string, count int, fallback []float64, what string) ([]float64, error) {
	fields := strings.Fields(text)
	if len(fields) == 0 {
		return fallback, nil
	}
	if len(fields) != count {
		return nil, fmt.Errorf("%s %q needs %d numbers", what, text, count)
	}
	values := make([]float64, count)
	for i, field := range fields {
		value, err := strconv.ParseFloat(field, 64)
		if err != nil {
			return nil, fmt.Errorf("%s %q: %w", what, text, err)
		}
		values[i] = value
	}
	return values, nil
}

func parseNumber(text string, fallback float64, what string) (float64, error) {
	values, err := parseFloats(text, 1, []float64{fallback}, what)
	if err != nil {
		return 0, err
	}
	return values[0], nil
}

// pose returns the origin in millimetres. A nil origin, or a missing xyz or rpy, means zero. URDF's
// rpy is fixed-axis roll about X, then pitch about Y, then yaw about Z, which is RDK's EulerAngles.
func (origin *urdfOrigin) pose() (spatialmath.Pose, error) {
	if origin == nil {
		return spatialmath.NewZeroPose(), nil
	}
	zero := []float64{0, 0, 0}
	xyz, err := parseFloats(origin.XYZ, 3, zero, "origin xyz")
	if err != nil {
		return nil, err
	}
	rpy, err := parseFloats(origin.RPY, 3, zero, "origin rpy")
	if err != nil {
		return nil, err
	}
	const millimetresPerMetre = 1000
	return spatialmath.NewPose(
		r3.Vector{X: xyz[0] * millimetresPerMetre, Y: xyz[1] * millimetresPerMetre, Z: xyz[2] * millimetresPerMetre},
		&spatialmath.EulerAngles{Roll: rpy[0], Pitch: rpy[1], Yaw: rpy[2]},
	), nil
}
