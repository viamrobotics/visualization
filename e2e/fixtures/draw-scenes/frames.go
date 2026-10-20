package main

import (
	"fmt"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// framesDraw draws six frames in two groups.
//
// The first covers the three shapes a frame can carry: none, which renders as
// bare axes, a sphere, and a labelled capsule whose label the visualizer
// suffixes with its geometry name. The second covers the `Colors` map, which
// only applies to a frame that carries a geometry, so the uncolored frame in
// it renders as plain axes.
func framesDraw(sceneEnv) error {
	if err := drawShapedFrames(); err != nil {
		return err
	}
	return drawColoredFrames()
}

func drawShapedFrames() error {
	axesFrame, err := referenceframe.NewStaticFrame("DrawFrames Axes", spatialmath.NewPose(
		r3.Vector{X: 1001, Y: 1, Z: 1},
		&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
	))
	if err != nil {
		return fmt.Errorf("building the axes frame: %w", err)
	}

	sphere, err := spatialmath.NewSphere(
		spatialmath.NewPose(
			r3.Vector{X: 0, Y: 0, Z: 0},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		100,
		"",
	)
	if err != nil {
		return fmt.Errorf("building the sphere: %w", err)
	}

	sphereFrame, err := referenceframe.NewStaticFrameWithGeometry(
		"DrawFrames Sphere",
		spatialmath.NewPose(
			r3.Vector{X: 1501, Y: 0, Z: 0},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		sphere,
	)
	if err != nil {
		return fmt.Errorf("building the sphere frame: %w", err)
	}

	capsule, err := spatialmath.NewCapsule(
		spatialmath.NewPose(
			r3.Vector{X: 0, Y: 0, Z: 0},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		102,
		300,
		"Capsule",
	)
	if err != nil {
		return fmt.Errorf("building the capsule: %w", err)
	}

	capsuleFrame, err := referenceframe.NewStaticFrameWithGeometry("DrawFrames Capsule", spatialmath.NewPose(
		r3.Vector{X: 2002, Y: 3, Z: 200},
		&spatialmath.OrientationVectorDegrees{Theta: 90, OX: 1, OY: 0, OZ: 1},
	), capsule)
	if err != nil {
		return fmt.Errorf("building the capsule frame: %w", err)
	}

	return drawFrames("shaped", api.DrawFramesOptions{
		Frames: []referenceframe.Frame{axesFrame, sphereFrame, capsuleFrame},
	})
}

func drawColoredFrames() error {
	box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "Box")
	if err != nil {
		return fmt.Errorf("building the box: %w", err)
	}
	redFrame, err := referenceframe.NewStaticFrameWithGeometry(
		"DrawFrames Red",
		spatialmath.NewPose(r3.Vector{X: 500, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OZ: 1}),
		box,
	)
	if err != nil {
		return fmt.Errorf("building the red frame: %w", err)
	}

	sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 75, "Sphere")
	if err != nil {
		return fmt.Errorf("building the sphere: %w", err)
	}
	blueFrame, err := referenceframe.NewStaticFrameWithGeometry(
		"DrawFrames Blue",
		spatialmath.NewPose(r3.Vector{X: -500, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OZ: 1}),
		sphere,
	)
	if err != nil {
		return fmt.Errorf("building the blue frame: %w", err)
	}

	// No geometry, so the colors map has nothing to tint and it renders as bare axes.
	defaultFrame, err := referenceframe.NewStaticFrame(
		"DrawFrames Default",
		spatialmath.NewPose(r3.Vector{X: 0, Y: 500, Z: 0}, &spatialmath.OrientationVectorDegrees{OZ: 1}),
	)
	if err != nil {
		return fmt.Errorf("building the default frame: %w", err)
	}

	return drawFrames("colored", api.DrawFramesOptions{
		Frames: []referenceframe.Frame{redFrame, blueFrame, defaultFrame},
		Colors: map[string]draw.Color{
			"DrawFrames Red":  draw.ColorFromName("red"),
			"DrawFrames Blue": draw.ColorFromName("blue"),
		},
	})
}

func drawFrames(group string, options api.DrawFramesOptions) error {
	uuids, err := api.DrawFrames(options)
	if err != nil {
		return fmt.Errorf("drawing the %s frames: %w", group, err)
	}
	if len(uuids) != len(options.Frames) {
		return fmt.Errorf("expected %d %s frames, drew %d", len(options.Frames), group, len(uuids))
	}
	return nil
}
