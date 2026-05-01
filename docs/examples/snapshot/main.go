// Package main generates the snapshot fixture used by the docs playground.
//
// Run from the repo root to (re)produce docs/public/visualization_snapshot.json:
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
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
)

const outputPath = "docs/public/visualization_snapshot.json"

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
	if err := snapshot.DrawGeometry(
		box,
		spatialmath.NewPoseFromPoint(r3.Vector{X: -400, Y: 0, Z: 100}),
		"world",
		draw.ColorFromName("dodgerblue"),
	); err != nil {
		log.Fatalf("DrawGeometry box: %v", err)
	}

	sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 120, "sphere")
	if err != nil {
		log.Fatalf("sphere: %v", err)
	}
	if err := snapshot.DrawGeometry(
		sphere,
		spatialmath.NewPoseFromPoint(r3.Vector{X: 400, Y: 0, Z: 120}),
		"world",
		draw.ColorFromName("limegreen"),
	); err != nil {
		log.Fatalf("DrawGeometry sphere: %v", err)
	}

	capsule, err := spatialmath.NewCapsule(spatialmath.NewZeroPose(), 60, 320, "capsule")
	if err != nil {
		log.Fatalf("capsule: %v", err)
	}
	if err := snapshot.DrawGeometry(
		capsule,
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 400, Z: 160}),
		"world",
		draw.ColorFromName("darkorchid"),
	); err != nil {
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
	if err := snapshot.DrawLine(
		"sine-line",
		"world",
		spatialmath.NewZeroPose(),
		linePoints,
		draw.WithLineWidth(8),
		draw.WithSingleLineColor(draw.ColorFromName("orange")),
	); err != nil {
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
	if err := snapshot.DrawArrows(
		"arrow-ring",
		"world",
		spatialmath.NewZeroPose(),
		ring,
		draw.WithSingleArrowColor(draw.ColorFromName("crimson")),
	); err != nil {
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
