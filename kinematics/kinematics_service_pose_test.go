package kinematics

import (
	"bytes"
	"context"
	"errors"
	"math"
	"os"
	"path/filepath"
	"testing"

	"connectrpc.com/connect"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func gripperRequestParts(t *testing.T) (*kinematicsv1.KinematicsSpec, map[string][]byte) {
	t.Helper()
	spec, err := LoadSpec(filepath.Join("testdata", "parallel-gripper.kinematics.json"))
	test.That(t, err, test.ShouldBeNil)
	sources := map[string][]byte{}
	for _, name := range []string{"cube-300mm.stl", "finger-20x20x80mm.stl"} {
		data, err := os.ReadFile(filepath.Join("testdata", name))
		test.That(t, err, test.ShouldBeNil)
		sources[name] = data
	}
	return spec, sources
}

func transformsByFrame(transforms []*commonpb.Transform) map[string]*commonpb.Transform {
	byFrame := map[string]*commonpb.Transform{}
	for _, tr := range transforms {
		byFrame[tr.GetReferenceFrame()] = tr
	}
	return byFrame
}

func requireNear(t *testing.T, got, want float64) {
	t.Helper()
	test.That(t, math.Abs(got-want), test.ShouldBeLessThan, 1e-6)
}

func requireSameFrames(t *testing.T, got, want []*commonpb.Transform) {
	t.Helper()
	test.That(t, len(got), test.ShouldEqual, len(want))
	wantByFrame := transformsByFrame(want)
	for _, tr := range got {
		other := wantByFrame[tr.GetReferenceFrame()]
		test.That(t, other, test.ShouldNotBeNil)
		test.That(t, tr.GetPoseInObserverFrame().GetReferenceFrame(), test.ShouldEqual, other.GetPoseInObserverFrame().GetReferenceFrame())
		a, b := tr.GetPoseInObserverFrame().GetPose(), other.GetPoseInObserverFrame().GetPose()
		requireNear(t, a.GetX(), b.GetX())
		requireNear(t, a.GetY(), b.GetY())
		requireNear(t, a.GetZ(), b.GetZ())
		test.That(t, bytes.Equal(tr.GetUuid(), other.GetUuid()), test.ShouldBeTrue)
	}
}

func jointFramesOf(frames []*commonpb.Transform, spec *kinematicsv1.KinematicsSpec) []*commonpb.Transform {
	byFrame := transformsByFrame(frames)
	var joints []*commonpb.Transform
	for _, joint := range spec.GetJoints() {
		joints = append(joints, byFrame[joint.GetId()])
	}
	return joints
}

func TestKinematicsServicePose(t *testing.T) {
	client := newKinematicsClient(t)
	spec, sources := gripperRequestParts(t)
	ctx := context.Background()

	for _, inputs := range [][]float64{{0}, {40}} {
		built, err := client.Build(ctx, connect.NewRequest(&kinematicsv1.BuildRequest{Spec: spec, Sources: sources, Inputs: inputs}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, built.Msg.GetReport().GetFailures(), test.ShouldBeEmpty)

		posed, err := client.Pose(ctx, connect.NewRequest(&kinematicsv1.PoseRequest{Spec: spec, Inputs: inputs}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, frameNames(posed.Msg.GetFrames()), test.ShouldResemble, []string{"left-slide", "right-slide"})
		requireSameFrames(t, posed.Msg.GetFrames(), jointFramesOf(built.Msg.GetFrames(), spec))
	}

	// The slides sit at y +-50 at zero and move 40 mm apart, so a pose that ignored the inputs would
	// read the zero values here.
	posed, err := client.Pose(ctx, connect.NewRequest(&kinematicsv1.PoseRequest{Spec: spec, Inputs: []float64{40}}))
	test.That(t, err, test.ShouldBeNil)
	byFrame := transformsByFrame(posed.Msg.GetFrames())
	requireNear(t, byFrame["left-slide"].GetPoseInObserverFrame().GetPose().GetY(), 90)
	requireNear(t, byFrame["right-slide"].GetPoseInObserverFrame().GetPose().GetY(), -90)
}

func TestKinematicsServiceBuildInputs(t *testing.T) {
	client := newKinematicsClient(t)
	spec, sources := gripperRequestParts(t)
	ctx := context.Background()

	slideY := func(inputs []float64) (left, right float64) {
		resp, err := client.Build(ctx, connect.NewRequest(&kinematicsv1.BuildRequest{Spec: spec, Sources: sources, Inputs: inputs}))
		test.That(t, err, test.ShouldBeNil)
		byFrame := transformsByFrame(resp.Msg.GetFrames())
		return byFrame["left-slide"].GetPoseInObserverFrame().GetPose().GetY(),
			byFrame["right-slide"].GetPoseInObserverFrame().GetPose().GetY()
	}

	left, right := slideY([]float64{40})
	requireNear(t, left, 90)
	requireNear(t, right, -90)
	for _, mismatched := range [][]float64{nil, {1, 2}} {
		left, right = slideY(mismatched)
		requireNear(t, left, 50)
		requireNear(t, right, -50)
	}
}

func TestKinematicsServicePoseRejections(t *testing.T) {
	client := newKinematicsClient(t)
	spec, _ := gripperRequestParts(t)
	badName, _ := gripperRequestParts(t)
	badName.Name = TCPFrameID

	tests := []struct {
		name string
		req  *kinematicsv1.PoseRequest
	}{
		{"missing spec", &kinematicsv1.PoseRequest{Inputs: []float64{40}}},
		{"too few inputs", &kinematicsv1.PoseRequest{Spec: spec, Inputs: []float64{}}},
		{"too many inputs", &kinematicsv1.PoseRequest{Spec: spec, Inputs: []float64{1, 2}}},
		{"spec build rejects", &kinematicsv1.PoseRequest{Spec: badName, Inputs: []float64{40}}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := client.Pose(context.Background(), connect.NewRequest(tc.req))
			var connectErr *connect.Error
			test.That(t, errors.As(err, &connectErr), test.ShouldBeTrue)
			test.That(t, connectErr.Code(), test.ShouldEqual, connect.CodeInvalidArgument)
		})
	}
}
