// Package trianglebench measures how collision-mesh triangle count affects
// collision-check time and serialized model size, to justify the per-link
// triangle warning limit. It is test-only.
package trianglebench

import (
	"encoding/base64"
	"fmt"
	"math"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

// triangleTargets are the approximate triangle counts benchmarked.
var triangleTargets = []int{12, 100, 500, 1000, 2000, 5000, 10000, 20000, 50000}

const sphereRadiusMM = 100.0

// sphereTriangles builds a closed UV sphere of radius r whose triangle count
// is close to target. It returns the triangles; len() is the actual count.
func sphereTriangles(target int, r float64) []*spatialmath.Triangle {
	rings := int(math.Round(math.Sqrt(float64(target)/4))) + 1
	if rings < 2 {
		rings = 2
	}
	segs := int(math.Round(float64(target) / float64(2*(rings-1))))
	if segs < 3 {
		segs = 3
	}
	pt := func(i, j int) r3.Vector {
		phi := math.Pi * float64(i) / float64(rings)
		th := 2 * math.Pi * float64(j%segs) / float64(segs)
		return r3.Vector{X: r * math.Sin(phi) * math.Cos(th), Y: r * math.Sin(phi) * math.Sin(th), Z: r * math.Cos(phi)}
	}
	var tris []*spatialmath.Triangle
	for i := 0; i < rings; i++ {
		for j := 0; j < segs; j++ {
			a, b, c, d := pt(i, j), pt(i, j+1), pt(i+1, j), pt(i+1, j+1)
			if i != 0 {
				tris = append(tris, spatialmath.NewTriangle(a, c, b))
			}
			if i != rings-1 {
				tris = append(tris, spatialmath.NewTriangle(b, c, d))
			}
		}
	}
	return tris
}

func newSphere(target int, offset r3.Vector) *spatialmath.Mesh {
	return spatialmath.NewMesh(spatialmath.NewPoseFromPoint(offset), sphereTriangles(target, sphereRadiusMM), "bench")
}

func newBox(offset r3.Vector) spatialmath.Geometry {
	b, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(offset), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
	if err != nil {
		panic(err)
	}
	return b
}

// BenchmarkMeshVsBox measures Mesh.CollidesWith and Mesh.DistanceFrom between
// an N-triangle sphere (radius 100 mm) and a 100 mm cube. "hit" places the cube
// overlapping the sphere surface, "miss" places it 20 mm clear of the surface.
// The BVH is built before the timer starts, so the numbers are steady-state
// query cost, not first-use build cost.
func BenchmarkMeshVsBox(b *testing.B) {
	cases := map[string]r3.Vector{"hit": {X: 120}, "miss": {X: 220}}
	for _, n := range triangleTargets {
		mesh := newSphere(n, r3.Vector{})
		tris := len(mesh.Triangles())
		for _, name := range []string{"hit", "miss"} {
			box := newBox(cases[name])
			if _, _, err := mesh.CollidesWith(box, 0); err != nil {
				b.Fatal(err)
			}
			b.Run(fmt.Sprintf("CollidesWith/%s/tris=%d", name, tris), func(b *testing.B) {
				for i := 0; i < b.N; i++ {
					if _, _, err := mesh.CollidesWith(box, 0); err != nil {
						b.Fatal(err)
					}
				}
			})
			b.Run(fmt.Sprintf("DistanceFrom/%s/tris=%d", name, tris), func(b *testing.B) {
				for i := 0; i < b.N; i++ {
					if _, err := mesh.DistanceFrom(box); err != nil {
						b.Fatal(err)
					}
				}
			})
		}
	}
}

// BenchmarkMeshVsMesh measures Mesh.CollidesWith and Mesh.DistanceFrom between
// two N-triangle spheres. "hit" offsets the second sphere by 150 mm (shells
// intersect), "miss" by 250 mm (50 mm gap). BVHs are built before timing.
func BenchmarkMeshVsMesh(b *testing.B) {
	cases := map[string]r3.Vector{"hit": {X: 150}, "miss": {X: 250}}
	for _, n := range triangleTargets {
		mesh := newSphere(n, r3.Vector{})
		tris := len(mesh.Triangles())
		for _, name := range []string{"hit", "miss"} {
			other := newSphere(n, cases[name])
			if _, _, err := mesh.CollidesWith(other, 0); err != nil {
				b.Fatal(err)
			}
			b.Run(fmt.Sprintf("CollidesWith/%s/tris=%d", name, tris), func(b *testing.B) {
				for i := 0; i < b.N; i++ {
					if _, _, err := mesh.CollidesWith(other, 0); err != nil {
						b.Fatal(err)
					}
				}
			})
			b.Run(fmt.Sprintf("DistanceFrom/%s/tris=%d", name, tris), func(b *testing.B) {
				for i := 0; i < b.N; i++ {
					if _, err := mesh.DistanceFrom(other); err != nil {
						b.Fatal(err)
					}
				}
			})
		}
	}
}

// TestModelSize logs, for each N, the PLY bytes RDK serializes via ToProtobuf
// and the base64 length of those bytes (how SVA JSON carries mesh_data inline).
// Run with: go test -run TestModelSize -v ./kinematics/internal/trianglebench/
func TestModelSize(t *testing.T) {
	for _, n := range triangleTargets {
		mesh := newSphere(n, r3.Vector{})
		ply := mesh.ToProtobuf().GetMesh().GetMesh()
		b64 := base64.StdEncoding.EncodedLen(len(ply))
		t.Logf("tris=%d ply_bytes=%d base64_bytes=%d", len(mesh.Triangles()), len(ply), b64)
	}
}
