package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"
)

// TestFakeServiceHarness covers the harness the rest of this package's tests
// stand on: that server.Start's attach path really points GetClient at the fake,
// that requests arrive, and that a queued error surfaces to the caller.
func TestFakeServiceHarness(t *testing.T) {
	t.Run("routes calls to the fake", func(t *testing.T) {
		fake := startFake(t)

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "harness",
			Positions: []r3.Vector{{X: 0}, {X: 1000}},
		})

		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldResemble, fallbackUUID)
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 1)
	})

	t.Run("hands out queued uuids in order", func(t *testing.T) {
		fake := startFake(t)
		fake.uuids = [][]byte{{0xaa}, {0xbb}}

		first, err := DrawLine(DrawLineOptions{Name: "a", Positions: []r3.Vector{{}, {X: 1}}})
		test.That(t, err, test.ShouldBeNil)
		second, err := DrawLine(DrawLineOptions{Name: "b", Positions: []r3.Vector{{}, {X: 1}}})
		test.That(t, err, test.ShouldBeNil)

		test.That(t, first, test.ShouldResemble, []byte{0xaa})
		test.That(t, second, test.ShouldResemble, []byte{0xbb})
	})

	t.Run("surfaces a queued RPC error", func(t *testing.T) {
		fake := startFake(t)
		fake.errs["AddEntity"] = errRPCBoom

		_, err := DrawLine(DrawLineOptions{Name: "boom", Positions: []r3.Vector{{}, {X: 1}}})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntity RPC failed")
		test.That(t, err.Error(), test.ShouldContainSubstring, "boom")
	})

	t.Run("leaves the singleton clean for the next test", func(t *testing.T) {
		requireNoServer(t)
	})
}
