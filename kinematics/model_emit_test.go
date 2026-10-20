package kinematics

import (
	"encoding/json"
	"testing"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func TestEmitModel(t *testing.T) {
	spec := &kinematicsv1.KinematicsSpec{
		Name: "tool",
		Links: []*kinematicsv1.Link{
			{Id: "a", Origin: &commonpb.Pose{X: 1, Y: 2, Z: 3, OZ: 1}},
			{Id: "b"},
		},
		TcpPose: &commonpb.Pose{Z: 10, OZ: 1},
	}
	geometries := map[string]*spatialmath.GeometryConfig{
		"a": {Type: spatialmath.BoxType, X: 1, Y: 1, Z: 1, TranslationOffset: r3.Vector{Z: 5}},
	}
	data, err := emitModel(spec, geometries)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, data[len(data)-1], test.ShouldEqual, byte('\n'))

	var cfg referenceframe.ModelConfigJSON
	test.That(t, json.Unmarshal(data, &cfg), test.ShouldBeNil)
	test.That(t, cfg.KinParamType, test.ShouldEqual, "SVA")
	test.That(t, cfg.OutputFrames, test.ShouldResemble, []string{"tcp"})
	test.That(t, len(cfg.Links), test.ShouldEqual, 3)
	test.That(t, cfg.Links[0].ID, test.ShouldEqual, "a")
	test.That(t, cfg.Links[1].ID, test.ShouldEqual, "b")
	test.That(t, cfg.Links[2].ID, test.ShouldEqual, TCPFrameID)
	// The origin travels in the geometry offset, composed with the box center. The link stays at the base.
	test.That(t, cfg.Links[0].Translation, test.ShouldResemble, r3.Vector{})
	test.That(t, cfg.Links[0].Geometry.TranslationOffset.X, test.ShouldAlmostEqual, 1, 1e-9)
	test.That(t, cfg.Links[0].Geometry.TranslationOffset.Y, test.ShouldAlmostEqual, 2, 1e-9)
	test.That(t, cfg.Links[0].Geometry.TranslationOffset.Z, test.ShouldAlmostEqual, 8, 1e-9)
	test.That(t, cfg.Links[1].Geometry, test.ShouldBeNil)
	test.That(t, cfg.Links[1].Translation.Z, test.ShouldAlmostEqual, 0, 1e-9)
	test.That(t, cfg.Links[2].Translation.Z, test.ShouldAlmostEqual, 10, 1e-9)
}

func TestEmitModelJoints(t *testing.T) {
	spec := &kinematicsv1.KinematicsSpec{
		Name:  "chain",
		Links: []*kinematicsv1.Link{{Id: "tip", Parent: "wrist", Origin: &commonpb.Pose{X: 130, OZ: 1}}},
		Joints: []*kinematicsv1.Joint{
			{
				Id: "shoulder", Type: kinematicsv1.JointType_JOINT_TYPE_REVOLUTE,
				Origin: &commonpb.Pose{X: 100, OZ: 1}, Axis: &commonpb.Vector3{Z: 1}, Lower: -90, Upper: 90,
			},
			{
				Id: "wrist", Type: kinematicsv1.JointType_JOINT_TYPE_PRISMATIC, Parent: "shoulder",
				Origin: &commonpb.Pose{X: 125, Y: 7, OZ: 1}, Axis: &commonpb.Vector3{X: 1}, Lower: 0, Upper: 20,
			},
			{
				Id: "follower", Type: kinematicsv1.JointType_JOINT_TYPE_PRISMATIC,
				Origin: &commonpb.Pose{OZ: 1}, Axis: &commonpb.Vector3{X: 1}, Lower: 3, Upper: 9,
				Mimic: &kinematicsv1.Mimic{Joint: "wrist", Offset: 2},
			},
		},
		TcpParent: "wrist",
		TcpPose:   &commonpb.Pose{X: 135, Y: 7, OZ: 1},
	}
	data, err := emitModel(spec, nil)
	test.That(t, err, test.ShouldBeNil)
	var cfg referenceframe.ModelConfigJSON
	test.That(t, json.Unmarshal(data, &cfg), test.ShouldBeNil)

	ids := []string{}
	for _, l := range cfg.Links {
		ids = append(ids, l.ID)
	}
	test.That(t, ids, test.ShouldResemble, []string{"shoulder_origin", "wrist_origin", "follower_origin", "tip", TCPFrameID})
	link := func(id string) referenceframe.LinkConfig {
		for _, l := range cfg.Links {
			if l.ID == id {
				return l
			}
		}
		t.Fatalf("link %q missing", id)
		return referenceframe.LinkConfig{}
	}
	test.That(t, link("shoulder_origin").Parent, test.ShouldEqual, "")
	test.That(t, link("shoulder_origin").Translation.X, test.ShouldAlmostEqual, 100, 1e-9)
	// wrist sits at x 125 y 7 in the assembly frame, which is 25 and 7 in the shoulder's frame.
	test.That(t, link("wrist_origin").Parent, test.ShouldEqual, "shoulder")
	test.That(t, link("wrist_origin").Translation.X, test.ShouldAlmostEqual, 25, 1e-9)
	test.That(t, link("wrist_origin").Translation.Y, test.ShouldAlmostEqual, 7, 1e-9)
	test.That(t, link("tip").Parent, test.ShouldEqual, "wrist")
	test.That(t, link("tip").Translation, test.ShouldResemble, r3.Vector{})
	test.That(t, link(TCPFrameID).Parent, test.ShouldEqual, "wrist")
	test.That(t, link(TCPFrameID).Translation.X, test.ShouldAlmostEqual, 10, 1e-9)

	test.That(t, cfg.Joints, test.ShouldHaveLength, 3)
	test.That(t, cfg.Joints[0].ID, test.ShouldEqual, "shoulder")
	test.That(t, cfg.Joints[0].Type, test.ShouldEqual, "revolute")
	test.That(t, cfg.Joints[0].Parent, test.ShouldEqual, "shoulder_origin")
	test.That(t, cfg.Joints[0].Min, test.ShouldEqual, -90)
	test.That(t, cfg.Joints[0].Max, test.ShouldEqual, 90)
	test.That(t, cfg.Joints[1].Parent, test.ShouldEqual, "wrist_origin")
	test.That(t, cfg.Joints[1].Type, test.ShouldEqual, "prismatic")

	follower := cfg.Joints[2]
	test.That(t, follower.Min, test.ShouldEqual, 0)
	test.That(t, follower.Max, test.ShouldEqual, 0)
	test.That(t, follower.Mimic, test.ShouldNotBeNil)
	test.That(t, follower.Mimic.Joint, test.ShouldEqual, "wrist")
	test.That(t, follower.Mimic.ValueMultiplier, test.ShouldEqual, 1)
	test.That(t, follower.Mimic.ValueOffset, test.ShouldEqual, 2)
}
