package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/test"
)

func TestSetCameraSendsPositionAndTarget(t *testing.T) {
	fake := startFake(t)

	err := SetCamera(SetCameraPoseOptions{
		Position: r3.Vector{X: 1000, Y: 2000, Z: 3000},
		LookAt:   r3.Vector{X: 10, Y: 20, Z: 30},
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.setScene, test.ShouldHaveLength, 1)
	camera := fake.setScene[0].GetSceneMetadata().GetSceneCamera()
	test.That(t, camera.GetPosition().GetX(), test.ShouldEqual, 1000.0)
	test.That(t, camera.GetPosition().GetY(), test.ShouldEqual, 2000.0)
	test.That(t, camera.GetPosition().GetZ(), test.ShouldEqual, 3000.0)
	test.That(t, camera.GetLookAt().GetX(), test.ShouldEqual, 10.0)
	test.That(t, camera.GetLookAt().GetY(), test.ShouldEqual, 20.0)
	test.That(t, camera.GetLookAt().GetZ(), test.ShouldEqual, 30.0)
}

func TestSetCameraForwardsAnimate(t *testing.T) {
	for _, animate := range []bool{true, false} {
		name := "animated"
		if !animate {
			name = "not animated"
		}
		t.Run(name, func(t *testing.T) {
			fake := startFake(t)

			err := SetCamera(SetCameraPoseOptions{Animate: animate})
			test.That(t, err, test.ShouldBeNil)

			camera := fake.setScene[0].GetSceneMetadata().GetSceneCamera()
			test.That(t, camera.GetAnimated(), test.ShouldEqual, animate)
		})
	}
}

// The camera is always sent as a perspective camera, never orthographic.
func TestSetCameraSendsAPerspectiveCamera(t *testing.T) {
	fake := startFake(t)

	err := SetCamera(SetCameraPoseOptions{})
	test.That(t, err, test.ShouldBeNil)

	camera := fake.setScene[0].GetSceneMetadata().GetSceneCamera()
	test.That(t, camera.GetPerspectiveCamera(), test.ShouldNotBeNil)
	test.That(t, camera.GetOrthographicCamera(), test.ShouldBeNil)
}

func TestResetCameraSendsThePackageDefault(t *testing.T) {
	fake := startFake(t)

	err := ResetCamera()
	test.That(t, err, test.ShouldBeNil)

	camera := fake.setScene[0].GetSceneMetadata().GetSceneCamera()
	test.That(t, camera.GetPosition().GetX(), test.ShouldEqual, draw.DefaultSceneCamera.Position.X)
	test.That(t, camera.GetPosition().GetY(), test.ShouldEqual, draw.DefaultSceneCamera.Position.Y)
	test.That(t, camera.GetPosition().GetZ(), test.ShouldEqual, draw.DefaultSceneCamera.Position.Z)
	test.That(t, camera.GetLookAt().GetX(), test.ShouldEqual, draw.DefaultSceneCamera.LookAt.X)
	// Never animated: a reset snaps.
	test.That(t, camera.GetAnimated(), test.ShouldBeFalse)
}

// Both calls replace the whole SceneMetadata, so a grid or point-size override
// from an earlier SetScene does not survive. The doc comment says so, and this
// pins it: nothing but the camera is populated.
func TestCameraCallsReplaceTheWholeSceneMetadata(t *testing.T) {
	for _, tc := range []struct {
		name string
		call func() error
	}{
		{name: "SetCamera", call: func() error { return SetCamera(SetCameraPoseOptions{}) }},
		{name: "ResetCamera", call: ResetCamera},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			test.That(t, tc.call(), test.ShouldBeNil)

			metadata := fake.setScene[0].GetSceneMetadata()
			test.That(t, metadata.GetSceneCamera(), test.ShouldNotBeNil)
			// Presence, not value: every grid override is left unset, so the
			// viewer falls back to its own defaults.
			test.That(t, metadata.Grid, test.ShouldBeNil)
			test.That(t, metadata.GridCellSize, test.ShouldBeNil)
			test.That(t, metadata.GridSectionSize, test.ShouldBeNil)
		})
	}
}

func TestCameraCallsRequireAVisualizer(t *testing.T) {
	requireNoServer(t)

	test.That(t, SetCamera(SetCameraPoseOptions{}), test.ShouldWrap, ErrVisualizerNotRunning)
	test.That(t, ResetCamera(), test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestCameraCallsWrapRPCFailures(t *testing.T) {
	for _, tc := range []struct {
		name string
		call func() error
	}{
		{name: "SetCamera", call: func() error { return SetCamera(SetCameraPoseOptions{}) }},
		{name: "ResetCamera", call: ResetCamera},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)
			fake.errs["SetScene"] = errRPCBoom

			err := tc.call()

			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, "SetScene RPC failed")
		})
	}
}
