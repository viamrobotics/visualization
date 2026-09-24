// Package main generates the snapshot fixture used by the docs playground.
//
// Run from the repo root to (re)produce static/visualization_snapshot.json:
//
//	go run ./docs/examples/snapshot
//
// The filename starts with `visualization_snapshot` because the visualizer's
// drag-and-drop loader (src/lib/components/FileDrop) only accepts files that
// match that prefix.
//
// The output is committed to git so the docs site builds without needing Go
// available — only regenerate when you intentionally change the fixture.
package main

import (
	"log"
	"math"
	"os"
	"path/filepath"

	"github.com/golang/geo/r3"
	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/spatialmath"
)

const outputPath = "static/visualization_snapshot.json"

func main() {
	camera := draw.NewSceneCamera(
		r3.Vector{X: 1500, Y: 1500, Z: 1200},
		r3.Vector{X: 0, Y: 0, Z: 0},
	)

	snapshot := draw.NewSnapshot(
		draw.WithSceneCamera(camera),
		draw.WithGrid(true),
		draw.WithGridCellSize(100),
	)

	box, err := spatialmath.NewBox(
		spatialmath.NewZeroPose(),
		r3.Vector{X: 200, Y: 200, Z: 200},
		"box",
	)
	if err != nil {
		log.Fatalf("box: %v", err)
	}
	if _, err := snapshot.DrawGeometry(draw.DrawGeometryOptions{
		Geometry: box,
		Pose:     spatialmath.NewPoseFromPoint(r3.Vector{X: -400, Y: 0, Z: 100}),
		Parent:   "world",
		Color:    draw.ColorFromName("dodgerblue"),
	}); err != nil {
		log.Fatalf("DrawGeometry box: %v", err)
	}

	sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 120, "sphere")
	if err != nil {
		log.Fatalf("sphere: %v", err)
	}
	if _, err := snapshot.DrawGeometry(draw.DrawGeometryOptions{
		Geometry: sphere,
		Pose:     spatialmath.NewPoseFromPoint(r3.Vector{X: 400, Y: 0, Z: 120}),
		Parent:   "world",
		Color:    draw.ColorFromName("limegreen"),
	}); err != nil {
		log.Fatalf("DrawGeometry sphere: %v", err)
	}

	capsule, err := spatialmath.NewCapsule(spatialmath.NewZeroPose(), 60, 320, "capsule")
	if err != nil {
		log.Fatalf("capsule: %v", err)
	}
	if _, err := snapshot.DrawGeometry(draw.DrawGeometryOptions{
		Geometry: capsule,
		Pose:     spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 400, Z: 160}),
		Parent:   "world",
		Color:    draw.ColorFromName("darkorchid"),
	}); err != nil {
		log.Fatalf("DrawGeometry capsule: %v", err)
	}

	// Sine-wave line at the origin level.
	linePoints := make([]r3.Vector, 0, 60)
	for i := range 60 {
		t := float64(i) / 59
		x := -500 + t*1000
		y := -500.0
		z := 50 + 80*math.Sin(t*math.Pi*4)
		linePoints = append(linePoints, r3.Vector{X: x, Y: y, Z: z})
	}
	if _, err := snapshot.DrawLine(draw.DrawLineOptions{
		Name:      "sine-line",
		Parent:    "world",
		Pose:      spatialmath.NewZeroPose(),
		Positions: linePoints,
		LineWidth: 8,
		Colors:    []draw.Color{draw.ColorFromName("orange")},
	}); err != nil {
		log.Fatalf("DrawLine: %v", err)
	}

	// Ring of arrows pointing toward the origin.
	ring := make([]spatialmath.Pose, 0, 8)
	for i := range 8 {
		theta := float64(i) * (math.Pi * 2) / 8
		radius := 350.0
		pos := r3.Vector{X: radius * math.Cos(theta), Y: radius * math.Sin(theta), Z: 60}
		// Arrow tip points back at the world origin.
		dir := pos.Mul(-1).Normalize()
		orientation := &spatialmath.OrientationVector{OX: dir.X, OY: dir.Y, OZ: dir.Z, Theta: 0}
		ring = append(ring, spatialmath.NewPose(pos, orientation))
	}
	if _, err := snapshot.DrawArrows(draw.DrawArrowsOptions{
		Name:   "arrow-ring",
		Parent: "world",
		Pose:   spatialmath.NewZeroPose(),
		Poses:  ring,
		Colors: []draw.Color{draw.ColorFromName("crimson")},
	}); err != nil {
		log.Fatalf("DrawArrows: %v", err)
	}

	bytes, err := snapshot.MarshalJSON()
	if err != nil {
		log.Fatalf("MarshalJSON: %v", err)
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		log.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(outputPath, bytes, 0o644); err != nil {
		log.Fatalf("WriteFile %s: %v", outputPath, err)
	}

	log.Printf("wrote %d bytes to %s", len(bytes), outputPath)
}
