package kinematics

import (
	"fmt"
	"sort"
	"strings"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// Validate loads modelJSON as RDK SVA kinematics named name, round-trips it through the
// GetKinematicsResponse a module server sends and a robot parses, and reports what the robot would
// see. It never returns nil. A model that fails any check carries every failure in the report.
func Validate(modelJSON []byte, name string) *kinematicsv1.ValidationReport {
	return validate(modelJSON, name, nil)
}

// ValidateSpec is Validate for a model compiled from spec. A box the model cannot tell from a mesh
// link's box collision shape is reported as a primitive when spec says so.
func ValidateSpec(modelJSON []byte, spec *kinematicsv1.KinematicsSpec) *kinematicsv1.ValidationReport {
	return validate(modelJSON, spec.GetName(), spec)
}

func validate(modelJSON []byte, name string, spec *kinematicsv1.KinematicsSpec) *kinematicsv1.ValidationReport {
	primitives := map[string]*kinematicsv1.Primitive{}
	for _, link := range spec.GetLinks() {
		if link.GetPrimitive() != nil {
			primitives[link.GetId()] = link.GetPrimitive()
		}
	}
	report := &kinematicsv1.ValidationReport{ModelBytes: uint64(len(modelJSON))}
	fail := func(format string, args ...any) {
		report.Failures = append(report.Failures, fmt.Sprintf(format, args...))
	}

	model, err := referenceframe.UnmarshalModelJSON(modelJSON, name)
	if err != nil {
		fail("model does not parse as SVA kinematics JSON: %v", err)
		return report
	}
	if unserializable := unserializableLinks(model, name); len(unserializable) > 0 {
		for _, failure := range unserializable {
			fail("%s", failure)
		}
		return report
	}
	robot, err := referenceframe.KinematicModelFromProtobuf(name, referenceframe.KinematicModelToProtobuf(model))
	if err != nil {
		fail("model does not survive the GetKinematics round trip: %v", err)
		return report
	}

	for _, failure := range unserializableLinks(robot, name) {
		fail("%s", failure)
	}
	report.Dof = uint32(len(robot.DoF()))
	if len(model.DoF()) != len(robot.DoF()) {
		fail("degrees of freedom change across the GetKinematics round trip: %d before, %d after", len(model.DoF()), len(robot.DoF()))
	}

	zero := make([]referenceframe.Input, len(robot.DoF()))
	pose, err := robot.Transform(zero)
	if err != nil {
		fail("TCP pose at zero inputs cannot be computed: %v", err)
	} else {
		report.TcpPose = spatialmath.PoseToProtobuf(pose)
		zeroBefore := make([]referenceframe.Input, len(model.DoF()))
		if before, err := model.Transform(zeroBefore); err == nil && !spatialmath.PoseAlmostEqual(before, pose) {
			fail("TCP pose changes across the GetKinematics round trip")
		}
	}

	report.Inputs = inputReports(robot, name)

	geoms, err := robot.Geometries(zero)
	if err != nil {
		fail("geometries at zero inputs cannot be computed: %v", err)
		return report
	}
	if before, err := model.Geometries(make([]referenceframe.Input, len(model.DoF()))); err == nil &&
		len(before.Geometries()) != len(geoms.Geometries()) {
		fail("geometry count changes across the GetKinematics round trip: %d before, %d after",
			len(before.Geometries()), len(geoms.Geometries()))
	}
	if len(geoms.Geometries()) == 0 {
		fail("model has no geometry")
	}

	prefix := name + ":"
	for _, geom := range geoms.Geometries() {
		id := strings.TrimPrefix(geom.Label(), prefix)
		link := &kinematicsv1.LinkReport{Id: id}
		if prim := primitives[id]; prim != nil {
			// A primitive the model carries as a mesh, such as a cylinder, still reports as its primitive.
			link.Primitive = prim
			link.Extent = vector3(primitiveExtent(prim))
		} else if mesh, ok := geom.(*spatialmath.Mesh); ok {
			link.Shape = kinematicsv1.CollisionShape_COLLISION_SHAPE_MESH
			link.Triangles = uint32(len(mesh.Triangles()))
			if link.Triangles > TriangleWarningLimit {
				link.OverTriangleLimit = true
				link.SuggestedMaxTriangles = TriangleWarningLimit
				report.Warnings = append(report.Warnings, fmt.Sprintf(
					"link %s: collision mesh has %d triangles, over the limit of %d. Simplify it to %d or fewer.",
					id, link.Triangles, TriangleWarningLimit, TriangleWarningLimit))
			}
			if minPt, maxPt, ok := meshBounds(mesh); ok {
				link.Extent = vector3(maxPt.Sub(minPt))
			} else {
				fail("link %q: mesh has no triangles", id)
			}
		} else {
			cfg, err := spatialmath.NewGeometryConfig(geom)
			if err != nil {
				fail("link %q: geometry cannot be described: %v", id, err)
				continue
			}
			if cfg.Type == spatialmath.BoxType {
				link.Shape = kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX
				link.Extent = vector3(r3.Vector{X: cfg.X, Y: cfg.Y, Z: cfg.Z})
			} else if prim, ok := primitiveFromConfig(cfg); ok {
				link.Primitive = prim
				link.Extent = vector3(primitiveExtent(prim))
			} else {
				fail("link %q: geometry type %q is not a mesh or a primitive", id, cfg.Type)
				continue
			}
		}
		report.Links = append(report.Links, link)
	}
	sort.SliceStable(report.Links, func(i, j int) bool { return report.Links[i].Id < report.Links[j].Id })
	return report
}

func vector3(v r3.Vector) *commonpb.Vector3 {
	return &commonpb.Vector3{X: v.X, Y: v.Y, Z: v.Z}
}

// inputReports lists one InputReport per DoF entry of robot, in input order. Limits are in RDK input
// units: millimetres for prismatic and radians for revolute.
func inputReports(robot referenceframe.Model, name string) []*kinematicsv1.InputReport {
	limits := robot.DoF()
	if len(limits) == 0 {
		return nil
	}
	types := map[string]kinematicsv1.JointType{}
	if cfg := robot.ModelConfig(); cfg != nil {
		for _, j := range cfg.Joints {
			switch j.Type {
			case "revolute":
				types[j.ID] = kinematicsv1.JointType_JOINT_TYPE_REVOLUTE
			case "prismatic":
				types[j.ID] = kinematicsv1.JointType_JOINT_TYPE_PRISMATIC
			}
		}
	}
	var names []string
	if simple, ok := robot.(interface{ MoveableFrameNames() []string }); ok {
		names = simple.MoveableFrameNames()
	}
	reports := make([]*kinematicsv1.InputReport, len(limits))
	for i, limit := range limits {
		report := &kinematicsv1.InputReport{Min: limit.Min, Max: limit.Max}
		if i < len(names) {
			report.Joint = strings.TrimPrefix(names[i], name+":")
			report.Type = types[report.Joint]
		}
		reports[i] = report
	}
	return reports
}

// unserializableLinks returns one failure per geometry of model that panics in ToProtobuf, the call a
// robot makes on every geometry it serves. RDK's cylinder is one such geometry. Each failure names
// the link.
func unserializableLinks(model referenceframe.Model, name string) []string {
	geoms, err := model.Geometries(make([]referenceframe.Input, len(model.DoF())))
	if err != nil {
		return nil
	}
	var failures []string
	for _, geom := range geoms.Geometries() {
		if message := serializePanic(geom); message != "" {
			failures = append(failures, fmt.Sprintf("link %q: geometry cannot be serialized for a robot: %s",
				strings.TrimPrefix(geom.Label(), name+":"), message))
		}
	}
	return failures
}

// serializePanic returns the recovered panic message of geom.ToProtobuf, or "" when it returns.
func serializePanic(geom spatialmath.Geometry) (message string) {
	defer func() {
		if r := recover(); r != nil {
			message = fmt.Sprint(r)
		}
	}()
	geom.ToProtobuf()
	return ""
}
