package urdf

import (
	"fmt"
)

// linkGeometries picks the shapes that become the link's spec links. Collisions win. A link with
// none falls back to its first readable visual. A collision mesh in an unsupported format is an error.
func (converter *converter) linkGeometries(link *urdfLink) ([]placedGeometry, error) {
	usedVisual := make([]bool, len(link.Visuals))
	var shapes []urdfShape
	usedFallback := false

	if len(link.Collisions) == 0 && len(link.Visuals) == 0 {
		return nil, nil
	}
	if len(link.Collisions) == 0 {
		index := firstReadable(link.Visuals, usedVisual)
		if index < 0 {
			return nil, noGeometryError(link)
		}
		usedVisual[index] = true
		usedFallback = true
		shapes = append(shapes, link.Visuals[index])
	}
	for _, collision := range link.Collisions {
		if isReadable(collision) || collision.Geometry.Mesh == nil {
			shapes = append(shapes, collision)
			continue
		}
		extension, _ := meshExtension(collision)
		return nil, fmt.Errorf("link %q: collision mesh %q has unsupported extension %q", link.Name, collision.Geometry.Mesh.Filename, extension)
	}

	if usedFallback {
		converter.report.VisualFallbacks = append(converter.report.VisualFallbacks, link.Name)
	}
	for _, used := range usedVisual {
		if !used {
			converter.report.Dropped = append(converter.report.Dropped, "<visual> in "+link.Name)
		}
	}

	placed := make([]placedGeometry, 0, len(shapes))
	for _, shape := range shapes {
		geometry, err := converter.place(shape)
		if err != nil {
			return nil, fmt.Errorf("link %q: %w", link.Name, err)
		}
		placed = append(placed, geometry)
	}
	return placed, nil
}

func firstReadable(shapes []urdfShape, used []bool) int {
	for i, shape := range shapes {
		if !used[i] && isReadable(shape) {
			return i
		}
	}
	return -1
}

// noGeometryError explains why a link with visuals but no collision has nothing usable.
func noGeometryError(link *urdfLink) error {
	for _, visual := range link.Visuals {
		if visual.Geometry.Mesh != nil {
			extension, _ := meshExtension(visual)
			return fmt.Errorf("link %q: visual mesh %q is %q, which cannot be read, and the link has no collision or .stl, .ply, .obj, or .dae visual",
				link.Name, visual.Geometry.Mesh.Filename, extension)
		}
	}
	return fmt.Errorf("link %q: visual has no box, sphere, cylinder, or mesh", link.Name)
}
