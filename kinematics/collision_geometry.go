package kinematics

import (
	"fmt"
	"math"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// minDecimationTriangles is the smallest triangle budget handed to decimation.
const minDecimationTriangles = 12

// collisionGeometry returns the geometry config link's collision field asks for, in the mesh
// file's frame. source is the mesh file from loadMeshFile. A mesh result carries PLY bytes inline.
func collisionGeometry(link *kinematicsv1.Link, source *spatialmath.Mesh) (*spatialmath.GeometryConfig, error) {
	switch link.GetCollision() {
	case kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX:
		minPt, maxPt, ok := meshBounds(source)
		if !ok {
			return nil, fmt.Errorf("link %q: mesh file has no triangles", link.GetId())
		}
		extent := maxPt.Sub(minPt)
		return &spatialmath.GeometryConfig{
			Type:              spatialmath.BoxType,
			X:                 extent.X,
			Y:                 extent.Y,
			Z:                 extent.Z,
			TranslationOffset: minPt.Add(maxPt).Mul(0.5),
			Label:             link.GetId(),
		}, nil
	case kinematicsv1.CollisionShape_COLLISION_SHAPE_MESH, kinematicsv1.CollisionShape_COLLISION_SHAPE_UNSPECIFIED:
		mesh := source
		target := int(link.GetMaxTriangles())
		if target > 0 && target < len(source.Triangles()) {
			target = max(target, minDecimationTriangles)
			decimated, err := source.ConservativeDecimate(target)
			if err != nil {
				return nil, fmt.Errorf("link %q: decimate collision mesh to %d triangles: %w", link.GetId(), target, err)
			}
			mesh = decimated
		}
		return &spatialmath.GeometryConfig{
			Type:            spatialmath.MeshType,
			MeshData:        mesh.TrianglesToPLYBytes(false),
			MeshContentType: "ply",
			Label:           link.GetId(),
		}, nil
	default:
		return nil, fmt.Errorf("link %q: unsupported collision shape %v", link.GetId(), link.GetCollision())
	}
}

// meshBounds returns the axis-aligned bounds of mesh's triangles. ok is false for an empty mesh.
func meshBounds(mesh *spatialmath.Mesh) (minPt, maxPt r3.Vector, ok bool) {
	minPt = r3.Vector{X: math.Inf(1), Y: math.Inf(1), Z: math.Inf(1)}
	maxPt = r3.Vector{X: math.Inf(-1), Y: math.Inf(-1), Z: math.Inf(-1)}
	for _, tri := range mesh.Triangles() {
		for _, p := range tri.Points() {
			ok = true
			minPt = r3.Vector{X: math.Min(minPt.X, p.X), Y: math.Min(minPt.Y, p.Y), Z: math.Min(minPt.Z, p.Z)}
			maxPt = r3.Vector{X: math.Max(maxPt.X, p.X), Y: math.Max(maxPt.Y, p.Y), Z: math.Max(maxPt.Z, p.Z)}
		}
	}
	return minPt, maxPt, ok
}
