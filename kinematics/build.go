// Package kinematics compiles link mesh files into an RDK kinematic model a Viam module can
// return from Kinematics, and validates that model the way a robot would load it.
package kinematics

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"go.viam.com/rdk/spatialmath"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// ModelFileName is the model's file name inside an Output.
const ModelFileName = "model.json"

// TCPFrameID is the id of the geometry-less link Build emits at the spec's TCP pose. It is
// the model's only TCP frame.
const TCPFrameID = "tcp"

// RootFrameID is the id of the preview frame every joint, link, and the TCP hang off when they have no
// parent joint. Joint and link ids may not use it.
const RootFrameID = "root"

// TriangleWarningLimit is the collision mesh triangle count above which a link is reported as too heavy.
const TriangleWarningLimit = 5000

// Output is a built model: file names relative to the output directory, mapped to their bytes.
type Output struct {
	Files map[string][]byte
}

// Build compiles spec into an RDK SVA kinematics model with every mesh inline. sources resolves
// each link's mesh_path, so it is rooted at the spec file's directory. Output is deterministic:
// the same spec and sources produce the same bytes.
func Build(spec *kinematicsv1.KinematicsSpec, sources fs.FS) (*Output, error) {
	if err := checkBuildable(spec); err != nil {
		return nil, err
	}

	geometries := make(map[string]*spatialmath.GeometryConfig, len(spec.GetLinks()))
	for _, link := range spec.GetLinks() {
		if link.GetPrimitive() != nil {
			geometry, err := primitiveGeometry(link)
			if err != nil {
				return nil, fmt.Errorf("build collision geometry: %w", err)
			}
			geometries[link.GetId()] = geometry
			continue
		}
		source, err := loadMeshFile(sources, link)
		if err != nil {
			return nil, fmt.Errorf("load link mesh: %w", err)
		}
		geometry, err := collisionGeometry(link, source)
		if err != nil {
			return nil, fmt.Errorf("build collision geometry: %w", err)
		}
		geometries[link.GetId()] = geometry
	}

	data, err := emitModel(spec, geometries)
	if err != nil {
		return nil, fmt.Errorf("emit model: %w", err)
	}
	return &Output{Files: map[string][]byte{ModelFileName: data}}, nil
}

// checkBuildable runs every check on spec that needs no mesh files.
func checkBuildable(spec *kinematicsv1.KinematicsSpec) error {
	if spec.GetName() == "" {
		return errors.New("name is required")
	}
	if len(spec.GetLinks()) == 0 {
		return errors.New("links: at least one link is required")
	}
	return checkSpec(spec)
}

// WriteDir writes every file in o under dir, creating dir if needed.
func (o *Output) WriteDir(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create output dir %q: %w", dir, err)
	}
	names := make([]string, 0, len(o.Files))
	for name := range o.Files {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		target := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return fmt.Errorf("create dir for %q: %w", target, err)
		}
		if err := os.WriteFile(target, o.Files[name], 0o644); err != nil {
			return fmt.Errorf("write %q: %w", target, err)
		}
	}
	return nil
}

// checkSpec validates ids, joint fields, and the joint tree.
func checkSpec(spec *kinematicsv1.KinematicsSpec) error {
	seen := make(map[string]string, len(spec.GetLinks())+len(spec.GetJoints()))
	claim := func(field, id string) error {
		switch {
		case id == "":
			return fmt.Errorf("%s is required", field)
		case id == TCPFrameID:
			return fmt.Errorf("%s %q is reserved for the TCP frame", field, id)
		case id == RootFrameID:
			return fmt.Errorf("%s %q is reserved for the preview root frame", field, id)
		case strings.HasSuffix(id, originSuffix):
			return fmt.Errorf("%s %q is reserved: ids ending in %q name the static links generated for joints", field, id, originSuffix)
		case seen[id] != "":
			return fmt.Errorf("%s %q is a duplicate of %s", field, id, seen[id])
		}
		seen[id] = field
		return nil
	}
	for i, link := range spec.GetLinks() {
		if err := claim(fmt.Sprintf("links[%d].id", i), link.GetId()); err != nil {
			return err
		}
	}
	for i, joint := range spec.GetJoints() {
		if err := claim(fmt.Sprintf("joints[%d].id", i), joint.GetId()); err != nil {
			return err
		}
	}
	if spec.GetName() == TCPFrameID {
		return fmt.Errorf("name %q is reserved for the TCP frame", spec.GetName())
	}
	for i, link := range spec.GetLinks() {
		if spec.GetName() == visualFrameName(link.GetId()) {
			return fmt.Errorf("name %q is the same as the visual mesh frame of links[%d].id %q", spec.GetName(), i, link.GetId())
		}
	}
	// Generated origin links share the id namespace.
	for i, joint := range spec.GetJoints() {
		if other, ok := seen[jointOriginID(joint.GetId())]; ok {
			return fmt.Errorf("%s collides with %q, the origin link generated for joints[%d].id %q",
				other, jointOriginID(joint.GetId()), i, joint.GetId())
		}
	}

	joints := make(map[string]*kinematicsv1.Joint, len(spec.GetJoints()))
	for _, joint := range spec.GetJoints() {
		joints[joint.GetId()] = joint
	}
	needJoint := func(field, id string) error {
		if _, ok := joints[id]; !ok {
			return fmt.Errorf("%s %q is not a joint", field, id)
		}
		return nil
	}

	for i, joint := range spec.GetJoints() {
		field := fmt.Sprintf("joints[%d]", i)
		if _, err := jointType(joint.GetType()); err != nil {
			return fmt.Errorf("%s.type: %w", field, err)
		}
		if axis := joint.GetAxis(); axis.GetX() == 0 && axis.GetY() == 0 && axis.GetZ() == 0 {
			return fmt.Errorf("%s.axis must be non-zero", field)
		}
		if mimic := joint.GetMimic(); mimic != nil {
			if err := needJoint(field+".mimic.joint", mimic.GetJoint()); err != nil {
				return err
			}
			if mimic.GetJoint() == joint.GetId() {
				return fmt.Errorf("%s.mimic.joint %q mimics itself", field, mimic.GetJoint())
			}
			if joints[mimic.GetJoint()].GetMimic() != nil {
				return fmt.Errorf("%s.mimic.joint %q is itself a mimic joint", field, mimic.GetJoint())
			}
		} else if joint.GetLower() > joint.GetUpper() {
			return fmt.Errorf("%s.lower %v is greater than upper %v", field, joint.GetLower(), joint.GetUpper())
		}
		if joint.GetParent() != "" {
			if err := needJoint(field+".parent", joint.GetParent()); err != nil {
				return err
			}
		}
	}
	for i, link := range spec.GetLinks() {
		if err := checkLinkShape(fmt.Sprintf("links[%d]", i), link); err != nil {
			return err
		}
		if link.GetParent() != "" {
			if err := needJoint(fmt.Sprintf("links[%d].parent", i), link.GetParent()); err != nil {
				return err
			}
		}
	}
	if spec.GetTcpParent() != "" {
		if err := needJoint("tcp_parent", spec.GetTcpParent()); err != nil {
			return err
		}
	}

	for i, joint := range spec.GetJoints() {
		for hops, cur := 0, joint; cur.GetParent() != ""; hops++ {
			if hops > len(joints) {
				return fmt.Errorf("joints[%d].parent: joint %q is in a parent cycle", i, joint.GetId())
			}
			cur = joints[cur.GetParent()]
		}
	}
	return nil
}

// checkLinkShape checks that link has exactly one of mesh_path or primitive, and that a primitive link
// sets no mesh field.
func checkLinkShape(field string, link *kinematicsv1.Link) error {
	prim := link.GetPrimitive()
	switch {
	case prim == nil && link.GetMeshPath() == "":
		return fmt.Errorf("%s needs a mesh_path or a primitive", field)
	case prim == nil:
		return nil
	case link.GetMeshPath() != "":
		return fmt.Errorf("%s sets both mesh_path and primitive. Use one", field)
	case link.GetMeshUnit() != kinematicsv1.LengthUnit_LENGTH_UNIT_UNSPECIFIED:
		return fmt.Errorf("%s.mesh_unit must be unset for a primitive link", field)
	case link.GetCollision() != kinematicsv1.CollisionShape_COLLISION_SHAPE_UNSPECIFIED:
		return fmt.Errorf("%s.collision must be unset for a primitive link", field)
	case link.GetMaxTriangles() != 0:
		return fmt.Errorf("%s.max_triangles must be unset for a primitive link", field)
	}
	return checkPrimitive(field, prim)
}
