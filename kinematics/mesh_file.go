package kinematics

import (
	"fmt"
	"io/fs"
	"path"
	"strings"

	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"

	"github.com/viamrobotics/visualization/kinematics/internal/colladamesh"
	"github.com/viamrobotics/visualization/kinematics/internal/objmesh"
	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// millimetresPerMetre converts reader output, which follows RDK in reading vertex values as metres,
// into the millimetres RDK's own STL and PLY parsers return.
const millimetresPerMetre = 1000

// loadMeshFile reads link's mesh file from sources and returns its triangles in millimetres,
// in the mesh file's own frame, with a zero pose. The link origin is not applied here.
func loadMeshFile(sources fs.FS, link *kinematicsv1.Link) (*spatialmath.Mesh, error) {
	meshPath := link.GetMeshPath()

	extension := strings.ToLower(path.Ext(meshPath))
	switch extension {
	case ".stl", ".ply", ".obj", ".dae":
	default:
		return nil, fmt.Errorf("link %q: unsupported mesh file %q: extension must be .stl, .ply, .obj, or .dae", link.GetId(), meshPath)
	}

	// RDK reads vertices as metres and returns millimetres, so rescale from that to the declared unit.
	// A COLLADA file's own <unit meter> is applied first, so mesh_unit scales on top of it, as a URDF
	// mesh scale does in ROS.
	var scale float64
	switch link.GetMeshUnit() {
	case kinematicsv1.LengthUnit_LENGTH_UNIT_METERS:
		scale = 1
	case kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS:
		scale = 0.001
	case kinematicsv1.LengthUnit_LENGTH_UNIT_INCHES:
		scale = 0.0254
	default:
		return nil, fmt.Errorf("link %q: mesh_unit is required for %q", link.GetId(), meshPath)
	}

	data, err := fs.ReadFile(sources, meshPath)
	if err != nil {
		return nil, fmt.Errorf("link %q: read mesh file %q: %w", link.GetId(), meshPath, err)
	}

	read, err := readMeshTriangles(extension, data, link.GetId())
	if err != nil {
		return nil, fmt.Errorf("link %q: parse mesh file %q: %w", link.GetId(), meshPath, err)
	}
	return spatialmath.NewMesh(spatialmath.NewZeroPose(), scaleTriangles(read, scale), link.GetId()), nil
}

// readMeshTriangles parses data by its lowercase extension into triangles in millimetres, reading
// the file's vertex values as metres.
func readMeshTriangles(extension string, data []byte, label string) ([]*spatialmath.Triangle, error) {
	var read func([]byte) ([]*spatialmath.Triangle, error)
	switch extension {
	case ".obj":
		read = objmesh.Read
	case ".dae":
		read = colladamesh.Read
	default:
		parsed, err := spatialmath.NewMeshFromProto(
			spatialmath.NewZeroPose(),
			&commonpb.Mesh{Mesh: data, ContentType: strings.TrimPrefix(extension, ".")},
			label,
		)
		if err != nil {
			return nil, err
		}
		return parsed.Triangles(), nil
	}
	triangles, err := read(data)
	if err != nil {
		return nil, err
	}
	return scaleTriangles(triangles, millimetresPerMetre), nil
}

func scaleTriangles(triangles []*spatialmath.Triangle, scale float64) []*spatialmath.Triangle {
	scaled := make([]*spatialmath.Triangle, 0, len(triangles))
	for _, tri := range triangles {
		pts := tri.Points()
		scaled = append(scaled, spatialmath.NewTriangle(pts[0].Mul(scale), pts[1].Mul(scale), pts[2].Mul(scale)))
	}
	return scaled
}
