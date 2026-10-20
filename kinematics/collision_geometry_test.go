package kinematics

import (
	"os"
	"testing"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func loadFixture(t *testing.T, name string) *spatialmath.Mesh {
	t.Helper()
	mesh, err := loadMeshFile(os.DirFS("testdata"), &kinematicsv1.Link{
		Id: "link", MeshPath: name, MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
	})
	test.That(t, err, test.ShouldBeNil)
	return mesh
}

func reloadGeometryMesh(t *testing.T, cfg *spatialmath.GeometryConfig) *spatialmath.Mesh {
	t.Helper()
	test.That(t, cfg.MeshContentType, test.ShouldEqual, "ply")
	mesh, err := spatialmath.NewMeshFromProto(spatialmath.NewZeroPose(), &commonpb.Mesh{Mesh: cfg.MeshData, ContentType: cfg.MeshContentType}, "x")
	test.That(t, err, test.ShouldBeNil)
	return mesh
}

func TestCollisionGeometry(t *testing.T) {
	sphere := loadFixture(t, "sphere-100mm.stl")
	sphereMin, sphereMax, _ := meshBounds(sphere)

	for _, shape := range []kinematicsv1.CollisionShape{
		kinematicsv1.CollisionShape_COLLISION_SHAPE_MESH,
		kinematicsv1.CollisionShape_COLLISION_SHAPE_UNSPECIFIED,
	} {
		t.Run("full mesh "+shape.String(), func(t *testing.T) {
			cfg, err := collisionGeometry(&kinematicsv1.Link{Id: "s", Collision: shape}, sphere)
			test.That(t, err, test.ShouldBeNil)
			test.That(t, cfg.Type, test.ShouldEqual, spatialmath.MeshType)
			test.That(t, cfg.Label, test.ShouldEqual, "s")
			mesh := reloadGeometryMesh(t, cfg)
			test.That(t, len(mesh.Triangles()), test.ShouldEqual, 960)
			minPt, maxPt, _ := meshBounds(mesh)
			extent := maxPt.Sub(minPt)
			test.That(t, extent.X, test.ShouldAlmostEqual, 100, 1e-3)
			test.That(t, extent.Y, test.ShouldAlmostEqual, 100, 1e-3)
			test.That(t, extent.Z, test.ShouldAlmostEqual, 100, 1e-3)
		})
	}

	t.Run("decimated to 200 is conservative", func(t *testing.T) {
		cfg, err := collisionGeometry(&kinematicsv1.Link{Id: "s", MaxTriangles: 200}, sphere)
		test.That(t, err, test.ShouldBeNil)
		mesh := reloadGeometryMesh(t, cfg)
		test.That(t, len(mesh.Triangles()), test.ShouldBeBetweenOrEqual, 12, 200)
		minPt, maxPt, _ := meshBounds(mesh)
		test.That(t, minPt.X, test.ShouldBeLessThanOrEqualTo, sphereMin.X+1e-6)
		test.That(t, minPt.Y, test.ShouldBeLessThanOrEqualTo, sphereMin.Y+1e-6)
		test.That(t, minPt.Z, test.ShouldBeLessThanOrEqualTo, sphereMin.Z+1e-6)
		test.That(t, maxPt.X, test.ShouldBeGreaterThanOrEqualTo, sphereMax.X-1e-6)
		test.That(t, maxPt.Y, test.ShouldBeGreaterThanOrEqualTo, sphereMax.Y-1e-6)
		test.That(t, maxPt.Z, test.ShouldBeGreaterThanOrEqualTo, sphereMax.Z-1e-6)
	})

	t.Run("tiny target is raised to 12", func(t *testing.T) {
		cfg, err := collisionGeometry(&kinematicsv1.Link{Id: "s", MaxTriangles: 5}, sphere)
		test.That(t, err, test.ShouldBeNil)
		mesh := reloadGeometryMesh(t, cfg)
		test.That(t, len(mesh.Triangles()), test.ShouldBeBetweenOrEqual, 4, 12)
	})

	t.Run("box from sphere", func(t *testing.T) {
		cfg, err := collisionGeometry(&kinematicsv1.Link{Id: "s", Collision: kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX}, sphere)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, cfg.Type, test.ShouldEqual, spatialmath.BoxType)
		test.That(t, cfg.Label, test.ShouldEqual, "s")
		test.That(t, len(cfg.MeshData), test.ShouldEqual, 0)
		test.That(t, cfg.X, test.ShouldAlmostEqual, 100, 1e-3)
		test.That(t, cfg.Y, test.ShouldAlmostEqual, 100, 1e-3)
		test.That(t, cfg.Z, test.ShouldAlmostEqual, 100, 1e-3)
		test.That(t, cfg.TranslationOffset.X, test.ShouldAlmostEqual, 0, 1e-6)
		test.That(t, cfg.TranslationOffset.Y, test.ShouldAlmostEqual, 0, 1e-6)
		test.That(t, cfg.TranslationOffset.Z, test.ShouldAlmostEqual, 0, 1e-6)
	})

	t.Run("box offset follows the AABB center", func(t *testing.T) {
		cube := loadFixture(t, "cube-300mm.stl")
		shifted := make([]*spatialmath.Triangle, 0, len(cube.Triangles()))
		for _, tri := range cube.Triangles() {
			pts := tri.Points()
			shift := r3.Vector{X: 50}
			shifted = append(shifted, spatialmath.NewTriangle(pts[0].Add(shift), pts[1].Add(shift), pts[2].Add(shift)))
		}
		mesh := spatialmath.NewMesh(spatialmath.NewZeroPose(), shifted, "c")
		cfg, err := collisionGeometry(&kinematicsv1.Link{Id: "c", Collision: kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX}, mesh)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, cfg.TranslationOffset.X, test.ShouldAlmostEqual, 50, 1e-6)
		test.That(t, cfg.X, test.ShouldAlmostEqual, 300, 1e-3)
	})
}
