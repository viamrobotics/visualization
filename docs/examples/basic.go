// Package main is a small standalone example that exercises the
// motion-tools client/api package. It draws a box, a line, a ring of pose
// arrows, and a pair of reference frames, then animates the box in place.
//
// The visualizer must be running: make up
//
// Run with:
//
//	go run ./docs/examples/basic.go
package main

import (
	"log"
	"math"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

func main() {
	// Start from a clean scene so successive runs don't accumulate drawings.
	if _, err := api.RemoveAll(); err != nil {
		log.Fatalf("RemoveAll: %v", err)
	}

	if err := api.SetCamera(api.SetCameraPoseOptions{
		Position: r3.Vector{X: 3500, Y: 3500, Z: 2500},
		LookAt:   r3.Vector{X: 0, Y: 0, Z: 300},
		Animate:  true,
	}); err != nil {
		log.Fatalf("SetCamera: %v", err)
	}

	// Draw a purple box at the origin. The ID is reused by the animation loop
	// below so each DrawGeometry call updates this entity in place rather than
	// creating a new one.
	if _, err := api.DrawGeometry(api.DrawGeometryOptions{
		ID:       "spinning-box",
		Name:     "spinning-box",
		Geometry: mustBox(r3.Vector{Z: 300}, 0),
		Color:    draw.ColorFromName("purple"),
	}); err != nil {
		log.Fatalf("DrawGeometry: %v", err)
	}

	// Trace a square on the ground around the box.
	if _, err := api.DrawLine(api.DrawLineOptions{
		Name: "square",
		Positions: []r3.Vector{
			{X: -1200, Y: -1200},
			{X: 1200, Y: -1200},
			{X: 1200, Y: 1200},
			{X: -1200, Y: 1200},
			{X: -1200, Y: -1200},
		},
		Colors:    []draw.Color{draw.ColorFromName("cyan")},
		LineWidth: 20,
		DotSize:   40,
	}); err != nil {
		log.Fatalf("DrawLine: %v", err)
	}

	// Arrange twelve arrows in a ring, colored with a cycling palette.
	const count = 12
	poses := make([]spatialmath.Pose, count)
	for i := range poses {
		theta := float64(i) * 2 * math.Pi / float64(count)
		poses[i] = spatialmath.NewPose(
			r3.Vector{X: 1800 * math.Cos(theta), Y: 1800 * math.Sin(theta), Z: 300},
			&spatialmath.OrientationVectorDegrees{OX: math.Cos(theta), OY: math.Sin(theta)},
		)
	}
	if _, err := api.DrawPosesAsArrows(api.DrawPosesAsArrowsOptions{
		Name:  "arrow-ring",
		Poses: poses,
		Colors: []draw.Color{
			draw.ColorFromName("red"),
			draw.ColorFromName("orange"),
			draw.ColorFromName("yellow"),
			draw.ColorFromName("green"),
			draw.ColorFromName("blue"),
			draw.ColorFromName("purple"),
		},
	}); err != nil {
		log.Fatalf("DrawPosesAsArrows: %v", err)
	}

	// Show two reference frames sitting off-origin. Frames without geometry
	// render as an axes helper.
	frameA, err := referenceframe.NewStaticFrame("frame-a", spatialmath.NewPose(
		r3.Vector{X: 0, Y: -2000, Z: 0},
		&spatialmath.OrientationVectorDegrees{OZ: 1},
	))
	if err != nil {
		log.Fatalf("NewStaticFrame a: %v", err)
	}
	frameB, err := referenceframe.NewStaticFrame("frame-b", spatialmath.NewPose(
		r3.Vector{X: 0, Y: 2000, Z: 800},
		&spatialmath.OrientationVectorDegrees{Theta: 45, OZ: 1},
	))
	if err != nil {
		log.Fatalf("NewStaticFrame b: %v", err)
	}
	if _, err := api.DrawFrames(api.DrawFramesOptions{
		Frames: []referenceframe.Frame{frameA, frameB},
	}); err != nil {
		log.Fatalf("DrawFrames: %v", err)
	}

	// Animate the box by re-drawing it with the same ID.
	for i := 0; i < 120; i++ {
		geom := mustBox(
			r3.Vector{Z: 300 + 200*math.Sin(float64(i)/10)},
			float64(i)*3,
		)
		if _, err := api.DrawGeometry(api.DrawGeometryOptions{
			ID:       "spinning-box",
			Name:     "spinning-box",
			Geometry: geom,
			Color:    draw.ColorFromName("purple"),
		}); err != nil {
			log.Fatalf("DrawGeometry update: %v", err)
		}
		time.Sleep(33 * time.Millisecond)
	}

	// Leave the scene up so it can be inspected. Uncomment to clear it.
	// if _, err := api.RemoveAll(); err != nil {
	// 	log.Fatalf("RemoveAll: %v", err)
	// }
}

func mustBox(center r3.Vector, thetaDeg float64) spatialmath.Geometry {
	box, err := spatialmath.NewBox(
		spatialmath.NewPose(
			center,
			&spatialmath.OrientationVectorDegrees{Theta: thetaDeg, OZ: 1},
		),
		r3.Vector{X: 400, Y: 400, Z: 400},
		"box",
	)
	if err != nil {
		log.Fatalf("NewBox: %v", err)
	}
	return box
}
