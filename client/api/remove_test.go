package api

import (
	"testing"

	"go.viam.com/test"
)

// RemoveAll reports one number built from two the server sends back, which is
// the only arithmetic in the removal family.
func TestRemoveAllSumsBothCounts(t *testing.T) {
	for _, tc := range []struct {
		name       string
		transforms int32
		drawings   int32
		want       int32
	}{
		{name: "an empty scene", want: 0},
		{name: "transforms only", transforms: 3, want: 3},
		{name: "drawings only", drawings: 4, want: 4},
		{name: "both are summed", transforms: 3, drawings: 4, want: 7},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)
			fake.removeAllTransforms = tc.transforms
			fake.removeAllDrawings = tc.drawings

			count, err := RemoveAll()

			test.That(t, err, test.ShouldBeNil)
			test.That(t, count, test.ShouldEqual, tc.want)
			test.That(t, fake.removeAll, test.ShouldHaveLength, 1)
		})
	}
}

func TestRemoveDrawingsReportsTheServerCount(t *testing.T) {
	fake := startFake(t)
	fake.removeDrawingsCount = 9

	count, err := RemoveDrawings()

	test.That(t, err, test.ShouldBeNil)
	test.That(t, count, test.ShouldEqual, 9)
	test.That(t, fake.removeAllDrawing, test.ShouldHaveLength, 1)
	// Scoped: the drawing clear must not reach the transform clear.
	test.That(t, fake.removeAllTransform, test.ShouldBeEmpty)
	test.That(t, fake.removeAll, test.ShouldBeEmpty)
}

func TestRemoveTransformsReportsTheServerCount(t *testing.T) {
	fake := startFake(t)
	fake.removeTransformCount = 2

	count, err := RemoveTransforms()

	test.That(t, err, test.ShouldBeNil)
	test.That(t, count, test.ShouldEqual, 2)
	test.That(t, fake.removeAllTransform, test.ShouldHaveLength, 1)
	test.That(t, fake.removeAllDrawing, test.ShouldBeEmpty)
	test.That(t, fake.removeAll, test.ShouldBeEmpty)
}

func TestRemoveEntitySendsTheUUID(t *testing.T) {
	fake := startFake(t)

	err := RemoveEntity([]byte{0x01, 0x02})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, fake.removeEntity, test.ShouldHaveLength, 1)
	test.That(t, fake.removeEntity[0].GetUuid(), test.ShouldResemble, []byte{0x01, 0x02})
}

func TestRemoveEntityRejectsAnEmptyUUID(t *testing.T) {
	for _, tc := range []struct {
		name string
		uuid []byte
	}{
		{name: "nil", uuid: nil},
		{name: "empty slice", uuid: []byte{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			err := RemoveEntity(tc.uuid)

			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, "uuid is required")
			test.That(t, fake.removeEntity, test.ShouldBeEmpty)
		})
	}
}

// The uuid check runs before the client lookup, so a bad argument is reported as
// such even with no visualizer.
func TestRemoveEntityValidatesBeforeReachingTheClient(t *testing.T) {
	requireNoServer(t)

	err := RemoveEntity(nil)

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "uuid is required")
}

func TestRemovalsRequireAVisualizer(t *testing.T) {
	requireNoServer(t)

	_, err := RemoveAll()
	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)

	_, err = RemoveDrawings()
	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)

	_, err = RemoveTransforms()
	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)

	err = RemoveEntity([]byte{0x01})
	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestRemovalsWrapRPCFailures(t *testing.T) {
	for _, tc := range []struct {
		name      string
		procedure string
		call      func() error
		wantMsg   string
	}{
		{
			name:      "RemoveAll",
			procedure: "RemoveAll",
			call:      func() error { _, err := RemoveAll(); return err },
			wantMsg:   "RemoveAll failed",
		},
		{
			name:      "RemoveDrawings",
			procedure: "RemoveAllDrawings",
			call:      func() error { _, err := RemoveDrawings(); return err },
			wantMsg:   "RemoveAllDrawings failed",
		},
		{
			name:      "RemoveTransforms",
			procedure: "RemoveAllTransforms",
			call:      func() error { _, err := RemoveTransforms(); return err },
			wantMsg:   "RemoveAllTransforms failed",
		},
		{
			name:      "RemoveEntity",
			procedure: "RemoveEntity",
			call:      func() error { return RemoveEntity([]byte{0x01}) },
			wantMsg:   "RemoveEntity failed",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)
			fake.errs[tc.procedure] = errRPCBoom

			err := tc.call()

			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.wantMsg)
			test.That(t, err.Error(), test.ShouldContainSubstring, "boom")
		})
	}
}
