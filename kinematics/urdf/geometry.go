package urdf

import (
	"fmt"
	"io/fs"
	"math"
	"path"
	"strings"

	"go.viam.com/rdk/spatialmath"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

const (
	metresPerMillimetre = 0.001
	metresPerInch       = 0.0254
	scaleTolerance      = 1e-9
	millimetresPerMetre = 1000
)

// placedGeometry is one shape of a link, with its origin in the link frame.
type placedGeometry struct {
	meshPath  string
	meshUnit  kinematicsv1.LengthUnit
	primitive *kinematicsv1.Primitive
	origin    spatialmath.Pose
}

// meshExtension returns the lowercased extension of the shape's mesh, and false for a primitive.
func meshExtension(shape urdfShape) (string, bool) {
	if shape.Geometry.Mesh == nil {
		return "", false
	}
	return strings.ToLower(path.Ext(shape.Geometry.Mesh.Filename)), true
}

func isReadableMeshExtension(extension string) bool {
	return extension == ".stl" || extension == ".ply" || extension == ".obj" || extension == ".dae"
}

// isReadable reports whether the shape is a primitive or an STL, PLY, OBJ, or DAE mesh.
func isReadable(shape urdfShape) bool {
	extension, isMesh := meshExtension(shape)
	return !isMesh && shape.Geometry.hasPrimitive() || isMesh && isReadableMeshExtension(extension)
}

func (geometry urdfGeometry) hasPrimitive() bool {
	return geometry.Box != nil || geometry.Sphere != nil || geometry.Cylinder != nil
}

// meshUnitForScale maps a mesh scale attribute to the unit the file was authored in.
func meshUnitForScale(filename, scale string) (kinematicsv1.LengthUnit, error) {
	values, err := parseFloats(scale, 3, []float64{1, 1, 1}, "mesh scale")
	if err != nil {
		return 0, fmt.Errorf("mesh %q: %w", filename, err)
	}
	if math.Abs(values[0]-values[1]) > scaleTolerance || math.Abs(values[0]-values[2]) > scaleTolerance {
		return 0, fmt.Errorf("mesh %q has non-uniform scale %q, which is not supported", filename, scale)
	}
	switch {
	case math.Abs(values[0]-1) <= scaleTolerance:
		return kinematicsv1.LengthUnit_LENGTH_UNIT_METERS, nil
	case math.Abs(values[0]-metresPerMillimetre) <= scaleTolerance:
		return kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS, nil
	case math.Abs(values[0]-metresPerInch) <= scaleTolerance:
		return kinematicsv1.LengthUnit_LENGTH_UNIT_INCHES, nil
	}
	return 0, fmt.Errorf("mesh %q has scale %q, and only 1, 0.001, and 0.0254 are supported", filename, scale)
}

// place converts a readable shape, reading its mesh bytes into meshes.
func (converter *converter) place(shape urdfShape) (placedGeometry, error) {
	origin, err := shape.Origin.pose()
	if err != nil {
		return placedGeometry{}, err
	}
	placed := placedGeometry{origin: origin}
	geometry := shape.Geometry
	switch {
	case geometry.Mesh != nil:
		return converter.placeMesh(placed, geometry.Mesh.Filename, geometry.Mesh.Scale)
	case geometry.Box != nil:
		if strings.TrimSpace(geometry.Box.Size) == "" {
			return placedGeometry{}, fmt.Errorf("box size is required")
		}
		size, err := parseFloats(geometry.Box.Size, 3, nil, "box size")
		if err != nil {
			return placedGeometry{}, err
		}
		placed.primitive = &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Box_{Box: &kinematicsv1.Primitive_Box{
			X: size[0] * millimetresPerMetre, Y: size[1] * millimetresPerMetre, Z: size[2] * millimetresPerMetre,
		}}}
	case geometry.Sphere != nil:
		radius, err := requiredLength(geometry.Sphere.Radius, "sphere radius")
		if err != nil {
			return placedGeometry{}, err
		}
		placed.primitive = &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Sphere_{Sphere: &kinematicsv1.Primitive_Sphere{Radius: radius}}}
	case geometry.Cylinder != nil:
		radius, err := requiredLength(geometry.Cylinder.Radius, "cylinder radius")
		if err != nil {
			return placedGeometry{}, err
		}
		length, err := requiredLength(geometry.Cylinder.Length, "cylinder length")
		if err != nil {
			return placedGeometry{}, err
		}
		placed.primitive = &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Cylinder_{Cylinder: &kinematicsv1.Primitive_Cylinder{Radius: radius, Length: length}}}
	default:
		return placedGeometry{}, fmt.Errorf("geometry has no box, sphere, cylinder, or mesh")
	}
	return placed, nil
}

func (converter *converter) placeMesh(placed placedGeometry, filename, scale string) (placedGeometry, error) {
	unit, err := meshUnitForScale(filename, scale)
	if err != nil {
		return placedGeometry{}, err
	}
	meshPath, err := converter.resolver.resolve(filename)
	if err != nil {
		return placedGeometry{}, err
	}
	if _, loaded := converter.meshes[meshPath]; !loaded {
		data, err := fs.ReadFile(converter.files, meshPath)
		if err != nil {
			return placedGeometry{}, fmt.Errorf("read mesh %q: %w", meshPath, err)
		}
		converter.meshes[meshPath] = data
	}
	placed.meshPath = meshPath
	placed.meshUnit = unit
	return placed, nil
}

// requiredLength reads a metre length and returns it in millimetres.
func requiredLength(text, what string) (float64, error) {
	if strings.TrimSpace(text) == "" {
		return 0, fmt.Errorf("%s is required", what)
	}
	metres, err := parseNumber(text, 0, what)
	return metres * millimetresPerMetre, err
}
