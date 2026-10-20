package colladamesh

import (
	"fmt"
)

type scene struct {
	doc        *document
	geometries map[string]*geometry
	nodes      map[string]*node
	// local caches each geometry's triangles, which instancing places many times.
	local map[string][]corners
}

func newScene(doc *document) *scene {
	s := &scene{
		doc:        doc,
		geometries: map[string]*geometry{},
		nodes:      map[string]*node{},
		local:      map[string][]corners{},
	}
	for i := range doc.Geometries {
		s.geometries[doc.Geometries[i].ID] = &doc.Geometries[i]
	}
	for i := range doc.LibraryNodes {
		s.indexNode(&doc.LibraryNodes[i])
	}
	for i := range doc.VisualScenes {
		for j := range doc.VisualScenes[i].Nodes {
			s.indexNode(&doc.VisualScenes[i].Nodes[j])
		}
	}
	return s
}

func (s *scene) indexNode(n *node) {
	if n.ID != "" {
		s.nodes[n.ID] = n
	}
	for i := range n.children {
		s.indexNode(&n.children[i])
	}
}

// placedTriangles returns the triangles of the scene's visual scene, with node transforms applied
// and the document unit not yet applied.
func (s *scene) placedTriangles() ([]corners, error) {
	roots, found, err := s.rootNodes()
	if err != nil {
		return nil, err
	}
	if !found {
		var all []corners
		for i := range s.doc.Geometries {
			triangles, err := s.geometryTriangles(s.doc.Geometries[i].ID, "")
			if err != nil {
				return nil, err
			}
			all = append(all, triangles...)
		}
		return all, nil
	}

	var placed []corners
	for i := range roots {
		if err := s.walk(&roots[i], identity(), map[string]bool{}, &placed); err != nil {
			return nil, err
		}
	}
	return placed, nil
}

// rootNodes picks the instanced visual scene, else the first one. found is false when the
// document has no visual scene at all.
func (s *scene) rootNodes() (nodes []node, found bool, err error) {
	if instance := s.doc.Scene.VisualScene; instance != nil {
		id := referencedID(instance.URL)
		for i := range s.doc.VisualScenes {
			if s.doc.VisualScenes[i].ID == id {
				return s.doc.VisualScenes[i].Nodes, true, nil
			}
		}
		return nil, false, fmt.Errorf("colladamesh: <instance_visual_scene> has unresolved url %q", instance.URL)
	}
	if len(s.doc.VisualScenes) > 0 {
		return s.doc.VisualScenes[0].Nodes, true, nil
	}
	return nil, false, nil
}

func (s *scene) walk(n *node, parent matrix, instancing map[string]bool, placed *[]corners) error {
	if n.ID != "" {
		if instancing[n.ID] {
			return fmt.Errorf("colladamesh: <node id=%q> contains itself", n.ID)
		}
		instancing[n.ID] = true
		defer delete(instancing, n.ID)
	}

	world := parent.times(n.local)
	for _, url := range n.geometryURLs {
		triangles, err := s.geometryTriangles(referencedID(url), n.ID)
		if err != nil {
			return err
		}
		for _, triangle := range triangles {
			*placed = append(*placed, corners{world.apply(triangle[0]), world.apply(triangle[1]), world.apply(triangle[2])})
		}
	}
	for _, url := range n.nodeURLs {
		target, ok := s.nodes[referencedID(url)]
		if !ok {
			return fmt.Errorf("colladamesh: <instance_node> of <node id=%q> has unresolved url %q", n.ID, url)
		}
		if err := s.walk(target, world, instancing, placed); err != nil {
			return err
		}
	}
	for i := range n.children {
		if err := s.walk(&n.children[i], world, instancing, placed); err != nil {
			return err
		}
	}
	return nil
}

func (s *scene) geometryTriangles(id, nodeID string) ([]corners, error) {
	if triangles, ok := s.local[id]; ok {
		return triangles, nil
	}
	g, ok := s.geometries[id]
	if !ok {
		return nil, fmt.Errorf("colladamesh: <instance_geometry> of <node id=%q> has unresolved url %q", nodeID, id)
	}
	triangles, err := g.triangles()
	if err != nil {
		return nil, err
	}
	s.local[id] = triangles
	return triangles, nil
}
