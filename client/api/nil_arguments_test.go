package api

import (
	"testing"

	"go.viam.com/rdk/referenceframe"
	"go.viam.com/test"
)

// recovered runs call and reports the value it panicked with, or nil.
func recovered(call func()) (panicked any) {
	defer func() { panicked = recover() }()
	call()
	return nil
}

// Both of these arguments are documented as required and neither is checked, so
// a nil reaches a method call on a nil value and takes the process down instead
// of returning an error. Passing nil is easy to do by accident: a frame-system
// lookup that finds nothing hands back a nil geometry.
//
// These tests pin the panic rather than endorse it. Add the nil guard and they
// fail, at which point they should become error assertions.
func TestNilRequiredArgumentsPanic(t *testing.T) {
	t.Run("DrawGeometry with a nil Geometry", func(t *testing.T) {
		startFake(t)

		panicked := recovered(func() {
			_, _ = DrawGeometry(DrawGeometryOptions{Name: "nil-geometry"})
		})

		test.That(t, panicked, test.ShouldNotBeNil)
	})

	t.Run("DrawGeometriesInFrame with nil Geometries", func(t *testing.T) {
		startFake(t)

		panicked := recovered(func() {
			_, _ = DrawGeometriesInFrame(DrawGeometriesInFrameOptions{})
		})

		test.That(t, panicked, test.ShouldNotBeNil)
	})
}

// An empty-but-not-nil GeometriesInFrame is handled properly, which is what
// makes the nil case above look like an oversight rather than a decision.
func TestDrawGeometriesInFrameRejectsAnEmptyBatch(t *testing.T) {
	fake := startFake(t)

	_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
		Geometries: referenceframe.NewGeometriesInFrame("world", nil),
	})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "no geometries to draw")
	test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
}

// The visualizer check runs before the nil dereference, so a caller with no
// visualizer gets the error rather than a crash.
func TestNilGeometryWithNoVisualizerErrorsRatherThanPanics(t *testing.T) {
	requireNoServer(t)

	panicked := recovered(func() {
		_, err := DrawGeometry(DrawGeometryOptions{Name: "x"})
		test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
	})

	test.That(t, panicked, test.ShouldBeNil)
}
