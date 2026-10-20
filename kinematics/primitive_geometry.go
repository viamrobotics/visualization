package kinematics

import (
	"fmt"
	"math"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// primitiveGeometry returns the geometry config for link's primitive, centred on the link's own frame.
// A cylinder becomes a closed mesh, because RDK cannot serialize its own cylinder.
// Dimensions are checked by checkPrimitive, which runs before any geometry is built.
func primitiveGeometry(link *kinematicsv1.Link) (*spatialmath.GeometryConfig, error) {
	switch shape := link.GetPrimitive().GetShape().(type) {
	case *kinematicsv1.Primitive_Box_:
		return &spatialmath.GeometryConfig{
			Type: spatialmath.BoxType, X: shape.Box.GetX(), Y: shape.Box.GetY(), Z: shape.Box.GetZ(), Label: link.GetId(),
		}, nil
	case *kinematicsv1.Primitive_Sphere_:
		return &spatialmath.GeometryConfig{Type: spatialmath.SphereType, R: shape.Sphere.GetRadius(), Label: link.GetId()}, nil
	case *kinematicsv1.Primitive_Capsule_:
		return &spatialmath.GeometryConfig{
			Type: spatialmath.CapsuleType, R: shape.Capsule.GetRadius(), L: shape.Capsule.GetLength(), Label: link.GetId(),
		}, nil
	case *kinematicsv1.Primitive_Cylinder_:
		mesh := cylinderMesh(shape.Cylinder.GetRadius(), shape.Cylinder.GetLength(), link.GetId())
		return &spatialmath.GeometryConfig{
			Type: spatialmath.MeshType, MeshData: mesh.TrianglesToPLYBytes(false), MeshContentType: "ply", Label: link.GetId(),
		}, nil
	default:
		return nil, fmt.Errorf("link %q: primitive has no shape", link.GetId())
	}
}

// checkPrimitive checks a link's primitive dimensions. field is the link's field path, such as "links[0]".
func checkPrimitive(field string, p *kinematicsv1.Primitive) error {
	positive := func(name string, v float64) error {
		if !(v > 0) {
			return fmt.Errorf("%s.primitive.%s must be positive, got %v", field, name, v)
		}
		return nil
	}
	switch shape := p.GetShape().(type) {
	case *kinematicsv1.Primitive_Box_:
		for name, v := range map[string]float64{"box.x": shape.Box.GetX(), "box.y": shape.Box.GetY(), "box.z": shape.Box.GetZ()} {
			if err := positive(name, v); err != nil {
				return err
			}
		}
	case *kinematicsv1.Primitive_Sphere_:
		return positive("sphere.radius", shape.Sphere.GetRadius())
	case *kinematicsv1.Primitive_Capsule_:
		if err := positive("capsule.radius", shape.Capsule.GetRadius()); err != nil {
			return err
		}
		if err := positive("capsule.length", shape.Capsule.GetLength()); err != nil {
			return err
		}
		if shape.Capsule.GetLength() < 2*shape.Capsule.GetRadius() {
			return fmt.Errorf("%s.primitive.capsule.length %v must be at least twice the radius, %v, because it includes both end caps",
				field, shape.Capsule.GetLength(), 2*shape.Capsule.GetRadius())
		}
	case *kinematicsv1.Primitive_Cylinder_:
		if err := positive("cylinder.radius", shape.Cylinder.GetRadius()); err != nil {
			return err
		}
		return positive("cylinder.length", shape.Cylinder.GetLength())
	default:
		return fmt.Errorf("%s.primitive must set one of box, sphere, capsule, or cylinder", field)
	}
	return nil
}

// primitiveExtent is the axis-aligned extent of p in millimetres, with capsule and cylinder axes along Z.
func primitiveExtent(p *kinematicsv1.Primitive) r3.Vector {
	switch shape := p.GetShape().(type) {
	case *kinematicsv1.Primitive_Box_:
		return r3.Vector{X: shape.Box.GetX(), Y: shape.Box.GetY(), Z: shape.Box.GetZ()}
	case *kinematicsv1.Primitive_Sphere_:
		d := 2 * shape.Sphere.GetRadius()
		return r3.Vector{X: d, Y: d, Z: d}
	case *kinematicsv1.Primitive_Capsule_:
		d := 2 * shape.Capsule.GetRadius()
		return r3.Vector{X: d, Y: d, Z: shape.Capsule.GetLength()}
	case *kinematicsv1.Primitive_Cylinder_:
		d := 2 * shape.Cylinder.GetRadius()
		return r3.Vector{X: d, Y: d, Z: shape.Cylinder.GetLength()}
	default:
		return r3.Vector{}
	}
}

// primitiveFromConfig describes a model geometry as a primitive. ok is false for a mesh or any other type.
func primitiveFromConfig(cfg *spatialmath.GeometryConfig) (p *kinematicsv1.Primitive, ok bool) {
	switch cfg.Type {
	case spatialmath.BoxType:
		return &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Box_{Box: &kinematicsv1.Primitive_Box{X: cfg.X, Y: cfg.Y, Z: cfg.Z}}}, true
	case spatialmath.SphereType:
		return &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Sphere_{Sphere: &kinematicsv1.Primitive_Sphere{Radius: cfg.R}}}, true
	case spatialmath.CapsuleType:
		return &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Capsule_{Capsule: &kinematicsv1.Primitive_Capsule{Radius: cfg.R, Length: cfg.L}}}, true
	case spatialmath.CylinderType:
		return &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Cylinder_{Cylinder: &kinematicsv1.Primitive_Cylinder{Radius: cfg.R, Length: cfg.L}}}, true
	default:
		return nil, false
	}
}

// cylinderSegments is the number of sides of the closed mesh a cylinder primitive becomes.
const cylinderSegments = 32

// cylinderMesh returns a closed mesh of a cylinder along Z, centred on the origin, whose polygon
// circumscribes the true circle: vertices sit at radius/cos(pi/n), so every edge midpoint is on
// the circle and the mesh never under-approximates it. RDK's Cylinder.ToProtobuf panics, and a robot
// serializes every geometry through it, so the model and the scene preview both carry this mesh.
func cylinderMesh(radius, length float64, label string) *spatialmath.Mesh {
	circumradius := radius / math.Cos(math.Pi/cylinderSegments)
	top, bottom := r3.Vector{Z: length / 2}, r3.Vector{Z: -length / 2}
	ring := func(i int) (t, b r3.Vector) {
		angle := 2 * math.Pi * float64(i%cylinderSegments) / cylinderSegments
		x, y := circumradius*math.Cos(angle), circumradius*math.Sin(angle)
		return r3.Vector{X: x, Y: y, Z: top.Z}, r3.Vector{X: x, Y: y, Z: bottom.Z}
	}
	triangles := make([]*spatialmath.Triangle, 0, 4*cylinderSegments)
	for i := range cylinderSegments {
		t0, b0 := ring(i)
		t1, b1 := ring(i + 1)
		triangles = append(triangles,
			spatialmath.NewTriangle(b0, b1, t1), spatialmath.NewTriangle(b0, t1, t0),
			spatialmath.NewTriangle(top, t0, t1), spatialmath.NewTriangle(bottom, b1, b0))
	}
	return spatialmath.NewMesh(spatialmath.NewZeroPose(), triangles, label)
}
