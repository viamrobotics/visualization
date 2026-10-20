package main

import (
	"fmt"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// geometriesDraw sends all five geometry kinds in one batch, which is the only
// scene that puts a mesh and an octree on screen next to the primitives.
func geometriesDraw(env sceneEnv) error {
	box, err := spatialmath.NewBox(
		spatialmath.NewPose(
			r3.Vector{X: 1001, Y: 1, Z: 1},
			&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
		),
		r3.Vector{X: 101, Y: 100, Z: 200},
		"DrawGeometries Box",
	)
	if err != nil {
		return fmt.Errorf("building the box: %w", err)
	}

	sphere, err := spatialmath.NewSphere(
		spatialmath.NewPose(
			r3.Vector{X: 1501, Y: 0, Z: 0},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		100,
		"DrawGeometries Sphere",
	)
	if err != nil {
		return fmt.Errorf("building the sphere: %w", err)
	}

	capsule, err := spatialmath.NewCapsule(
		spatialmath.NewPose(
			r3.Vector{X: 2002, Y: 3, Z: 200},
			&spatialmath.OrientationVectorDegrees{Theta: 90, OX: 1, OY: 0, OZ: 1},
		),
		102,
		300,
		"DrawGeometries Capsule",
	)
	if err != nil {
		return fmt.Errorf("building the capsule: %w", err)
	}

	mesh, err := spatialmath.NewMeshFromPLYFile(env.data("lod_500.ply"))
	if err != nil {
		return fmt.Errorf("loading the mesh: %w", err)
	}

	meshInWorld, ok := mesh.Transform(spatialmath.NewPose(
		r3.Vector{X: 2800, Y: 10, Z: -200},
		&spatialmath.OrientationVectorDegrees{Theta: 180, OX: 0, OY: 0, OZ: 1},
	)).(*spatialmath.Mesh)
	if !ok {
		return fmt.Errorf("transforming the mesh did not return a mesh")
	}
	meshInWorld.SetLabel("DrawGeometries Mesh")

	pc, err := pointcloud.NewFromFile(env.data("Zaghetto.pcd"), pointcloud.BasicType)
	if err != nil {
		return fmt.Errorf("loading the point cloud: %w", err)
	}
	octree, err := pointcloud.ToBasicOctree(pc, 0)
	if err != nil {
		return fmt.Errorf("building the octree: %w", err)
	}
	octree.SetLabel("DrawGeometries PointCloud")

	geometries := referenceframe.NewGeometriesInFrame("world", []spatialmath.Geometry{
		box, sphere, capsule, meshInWorld, octree,
	})

	uuids, err := api.DrawGeometriesInFrame(api.DrawGeometriesInFrameOptions{
		Geometries: geometries,
		Colors: []draw.Color{
			draw.ColorFromHex("#EF9A9A"),
			draw.ColorFromHex("#EF5350"),
			draw.ColorFromHex("#F44336"),
			draw.ColorFromName("lime"),
			draw.ColorFromName("red"),
		},
		DownscalingThreshold: 25,
	})
	if err != nil {
		return fmt.Errorf("drawing the geometries: %w", err)
	}
	if len(uuids) != 5 {
		return fmt.Errorf("expected 5 geometries, drew %d", len(uuids))
	}

	return nil
}
