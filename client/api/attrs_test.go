package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"
)

// twoPointLine is the smallest payload draw.NewLine accepts, so these tests can
// exercise the shared attribute path without caring about geometry.
var twoPointLine = []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 1000, Y: 0, Z: 0}}

// Every Draw* call funnels its ID, Parent, and Attrs through entityAttributes,
// so these assert the shared path once rather than once per shape.
func TestEntityAttributesOnTheWire(t *testing.T) {
	t.Run("name lands on reference_frame and the shape label", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{Name: "my-line", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)

		drawing := fake.onlyAddedDrawing(t)
		test.That(t, nameOf(drawing), test.ShouldEqual, "my-line")
		test.That(t, drawing.GetPhysicalObject().GetLabel(), test.ShouldEqual, "my-line")
	})

	t.Run("parent defaults to world", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{Name: "defaults", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, parentOf(fake.onlyAddedDrawing(t)), test.ShouldEqual, "world")
	})

	t.Run("parent sets the observer frame", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{
			Name:      "parented",
			Parent:    "arm-1",
			Positions: twoPointLine,
		})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, parentOf(fake.onlyAddedDrawing(t)), test.ShouldEqual, "arm-1")
	})

	// A uuid is always sent, generated when ID is empty. ID's job is to make it
	// stable across calls so the server updates in place.
	t.Run("a uuid is sent even without an ID", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{Name: "no-id", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, fake.onlyAddedDrawing(t).GetUuid(), test.ShouldHaveLength, 16)
	})

	t.Run("the same ID produces the same uuid across calls", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{ID: "same", Name: "a", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)
		_, err = DrawLine(DrawLineOptions{ID: "same", Name: "b", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(t, fake.addEntity, test.ShouldHaveLength, 2)
		test.That(
			t,
			fake.addEntity[0].GetDrawing().GetUuid(),
			test.ShouldResemble,
			fake.addEntity[1].GetDrawing().GetUuid(),
		)
	})

	t.Run("different IDs produce different uuids", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{ID: "one", Name: "a", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)
		_, err = DrawLine(DrawLineOptions{ID: "two", Name: "b", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(
			t,
			fake.addEntity[0].GetDrawing().GetUuid(),
			test.ShouldNotResemble,
			fake.addEntity[1].GetDrawing().GetUuid(),
		)
	})

	// With no ID the uuid derives from "name:parent", so it is stable rather than
	// fresh: repeating a call with the same name and parent upserts in place. The
	// ID doc comment on the Options structs claims a freshly generated uuid,
	// which is not what happens.
	t.Run("no ID derives a stable uuid from name and parent", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{Name: "same-name", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)
		_, err = DrawLine(DrawLineOptions{Name: "same-name", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(
			t,
			fake.addEntity[0].GetDrawing().GetUuid(),
			test.ShouldResemble,
			fake.addEntity[1].GetDrawing().GetUuid(),
		)
	})

	// Parent is part of that derivation, so the same name under two parents is
	// two entities.
	t.Run("parent participates in the derived uuid", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{Name: "n", Parent: "a", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)
		_, err = DrawLine(DrawLineOptions{Name: "n", Parent: "b", Positions: twoPointLine})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(
			t,
			fake.addEntity[0].GetDrawing().GetUuid(),
			test.ShouldNotResemble,
			fake.addEntity[1].GetDrawing().GetUuid(),
		)
	})

	// An explicit ID hashes the ID alone, so it survives a rename.
	t.Run("an explicit ID ignores name and parent", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{
			ID: "fixed", Name: "first", Parent: "a", Positions: twoPointLine,
		})
		test.That(t, err, test.ShouldBeNil)
		_, err = DrawLine(DrawLineOptions{
			ID: "fixed", Name: "second", Parent: "b", Positions: twoPointLine,
		})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(
			t,
			fake.addEntity[0].GetDrawing().GetUuid(),
			test.ShouldResemble,
			fake.addEntity[1].GetDrawing().GetUuid(),
		)
	})

	for _, tc := range []struct {
		name  string
		attrs *Attrs
		axes  *bool
		hides *bool
	}{
		{
			// Attrs documents nil ShowAxesHelper as defaulting to true, and the
			// default is materialized on the wire rather than left unset.
			name:  "nil Attrs sends the documented defaults",
			attrs: nil,
			axes:  boolPtr(true),
			hides: boolPtr(false),
		},
		{
			name:  "empty Attrs matches nil Attrs",
			attrs: &Attrs{},
			axes:  boolPtr(true),
			hides: boolPtr(false),
		},
		{
			name:  "ShowAxesHelper true is sent",
			attrs: &Attrs{ShowAxesHelper: boolPtr(true)},
			axes:  boolPtr(true),
			hides: boolPtr(false),
		},
		{
			name:  "ShowAxesHelper false is sent explicitly, not dropped",
			attrs: &Attrs{ShowAxesHelper: boolPtr(false)},
			axes:  boolPtr(false),
			hides: boolPtr(false),
		},
		{
			name:  "Invisible true is sent",
			attrs: &Attrs{Invisible: boolPtr(true)},
			axes:  boolPtr(true),
			hides: boolPtr(true),
		},
		{
			// toDrawableOptions only forwards Invisible when true, and the
			// default is false, so an explicit false is indistinguishable from
			// leaving it unset. Same result either way.
			name:  "Invisible false matches leaving it unset",
			attrs: &Attrs{Invisible: boolPtr(false)},
			axes:  boolPtr(true),
			hides: boolPtr(false),
		},
		{
			name:  "both flags travel together",
			attrs: &Attrs{ShowAxesHelper: boolPtr(true), Invisible: boolPtr(true)},
			axes:  boolPtr(true),
			hides: boolPtr(true),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawLine(DrawLineOptions{
				Name:      "attrs",
				Positions: twoPointLine,
				Attrs:     tc.attrs,
			})
			test.That(t, err, test.ShouldBeNil)

			drawing := fake.onlyAddedDrawing(t)
			test.That(t, axesHelperOf(drawing), test.ShouldResemble, tc.axes)
			test.That(t, invisibleOf(drawing), test.ShouldResemble, tc.hides)
		})
	}

	t.Run("parent and ID travel together", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawLine(DrawLineOptions{
			Name:      "everything",
			ID:        "combined",
			Parent:    "gripper",
			Positions: twoPointLine,
		})
		test.That(t, err, test.ShouldBeNil)

		drawing := fake.onlyAddedDrawing(t)
		test.That(t, nameOf(drawing), test.ShouldEqual, "everything")
		test.That(t, parentOf(drawing), test.ShouldEqual, "gripper")
		test.That(t, drawing.GetUuid(), test.ShouldHaveLength, 16)
	})
}
