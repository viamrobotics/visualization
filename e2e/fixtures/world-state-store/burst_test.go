package main

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	commonpb "go.viam.com/api/common/v1"
	pb "go.viam.com/api/service/worldstatestore/v1"
	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/resource"
	"go.viam.com/rdk/services/worldstatestore"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

// newBurstTestStore builds a TestStore with numTransforms bare transforms,
// skipping populateTestData's PLY/PCD fixtures, which burst does not need.
func newBurstTestStore(t *testing.T, numTransforms int) *TestStore {
	t.Helper()

	streamCtx, cancel := context.WithCancel(context.Background())
	s := &TestStore{
		Named:               (&resource.Config{Name: "burst-test"}).ResourceName().AsNamed(),
		logger:              logging.NewTestLogger(t),
		transforms:          make(map[string]*commonpb.Transform),
		streamCtx:           streamCtx,
		cancel:              cancel,
		subs:                make(map[chan worldstatestore.TransformChange]struct{}),
		pointCloudPositions: make(map[string][]float32),
		pointCloudColors:    make(map[string][]byte),
		pointCloudChunkSize: make(map[string]int),
	}
	t.Cleanup(func() { _ = s.Close(context.Background()) })

	for i := range numTransforms {
		raw, err := uuid.New().MarshalBinary()
		test.That(t, err, test.ShouldBeNil)
		s.transforms[string(raw)] = &commonpb.Transform{
			Uuid:           raw,
			ReferenceFrame: fmt.Sprintf("burst-transform-%d", i),
			PoseInObserverFrame: &commonpb.PoseInFrame{
				Pose: spatialmath.PoseToProtobuf(spatialmath.NewZeroPose()),
			},
		}
	}

	return s
}

// subscribeBurst subscribes to transform changes and drains them onto a
// buffered channel so tests can assert on counts with a timeout instead of a sleep.
func subscribeBurst(t *testing.T, s *TestStore) <-chan worldstatestore.TransformChange {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	stream, err := s.StreamTransformChanges(ctx, nil)
	test.That(t, err, test.ShouldBeNil)

	out := make(chan worldstatestore.TransformChange, 100000)
	go func() {
		defer close(out)
		for {
			change, err := stream.Next()
			if err != nil {
				return
			}
			out <- change
		}
	}()
	return out
}

// collectN reads exactly n changes from ch, failing the test if timeout elapses first.
func collectN(t *testing.T, ch <-chan worldstatestore.TransformChange, n int, timeout time.Duration) []worldstatestore.TransformChange {
	t.Helper()

	deadline := time.After(timeout)
	collected := make([]worldstatestore.TransformChange, 0, n)
	for len(collected) < n {
		select {
		case change := <-ch:
			collected = append(collected, change)
		case <-deadline:
			t.Fatalf("timed out waiting for %d changes, got %d", n, len(collected))
		}
	}
	return collected
}

func TestBurst(t *testing.T) {
	t.Run("EmitsRoundRobinUpdatesAcrossTicks", func(t *testing.T) {
		numTransforms := 3
		count, ticks := 5, 3
		s := newBurstTestStore(t, numTransforms)
		out := subscribeBurst(t, s)

		resp, err := s.DoCommand(context.Background(), map[string]any{
			"command":   "burst",
			"count":     float64(count),
			"period_ms": 10.0,
			"ticks":     float64(ticks),
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp["transforms"], test.ShouldEqual, numTransforms)

		changes := collectN(t, out, count*ticks, 2*time.Second)

		perUUID := make(map[string]int)
		for _, change := range changes {
			test.That(t, change.ChangeType, test.ShouldEqual, pb.TransformChangeType_TRANSFORM_CHANGE_TYPE_UPDATED)
			test.That(t, change.UpdatedFields, test.ShouldResemble, []string{"poseInObserverFrame.pose"})
			perUUID[string(change.Transform.Uuid)]++
		}
		test.That(t, perUUID, test.ShouldHaveLength, numTransforms)
		for _, perTransform := range perUUID {
			test.That(t, perTransform, test.ShouldEqual, count*ticks/numTransforms)
		}
	})

	t.Run("SecondBurstStopsTheFirst", func(t *testing.T) {
		s := newBurstTestStore(t, 2)
		out := subscribeBurst(t, s)

		// The long-running burst's period is well outside the window before it
		// gets superseded below, so it is guaranteed not to have ticked yet:
		// superseding it here exercises cancellation with a deterministic count,
		// rather than racing the long burst's own ticker.
		_, err := s.DoCommand(context.Background(), map[string]any{
			"command":   "burst",
			"count":     1.0,
			"period_ms": 200.0,
			"ticks":     100000.0,
		})
		test.That(t, err, test.ShouldBeNil)

		// Wait for the first burst goroutine to enter its select loop before
		// starting the second, so the cancellation is deterministic.
		select {
		case <-s.burstStarted:
		case <-time.After(time.Second):
			t.Fatal("first burst goroutine did not start within timeout")
		}

		_, err = s.DoCommand(context.Background(), map[string]any{
			"command":   "burst",
			"count":     1.0,
			"period_ms": 10.0,
			"ticks":     3.0,
		})
		test.That(t, err, test.ShouldBeNil)

		// The short burst must deliver exactly 3 events and then go quiet: the
		// long burst was cancelled before it ever ticked.
		afterSecondStart := 0
		// Three of the short burst's periods with nothing arriving means the long one is gone.
		quietWindow := 3 * 10 * time.Millisecond
		quiet := time.NewTimer(quietWindow)
		defer quiet.Stop()
	countingLoop:
		for {
			select {
			case <-out:
				afterSecondStart++
				quiet.Reset(quietWindow)
			case <-quiet.C:
				break countingLoop
			case <-time.After(2 * time.Second):
				t.Fatalf("timed out waiting for short burst to go quiet, saw %d events", afterSecondStart)
			}
		}
		test.That(t, afterSecondStart, test.ShouldEqual, 3)
	})

	t.Run("CloseStopsARunningBurst", func(t *testing.T) {
		s := newBurstTestStore(t, 2)
		out := subscribeBurst(t, s)

		_, err := s.DoCommand(context.Background(), map[string]any{
			"command":   "burst",
			"count":     1.0,
			"period_ms": 10.0,
			"ticks":     100000.0,
		})
		test.That(t, err, test.ShouldBeNil)

		// Wait for the burst goroutine to enter its select loop before closing,
		// so Close exercises cancellation of an active loop rather than one that
		// has not yet started.
		select {
		case <-s.burstStarted:
		case <-time.After(time.Second):
			t.Fatal("burst goroutine did not start within timeout")
		}
		test.That(t, s.Close(context.Background()), test.ShouldBeNil)

		// Drain whatever arrived before Close, then confirm the channel closes
		// (StreamTransformChanges tears down subscriptions on Close) instead of
		// continuing to deliver events.
		timeout := time.After(2 * time.Second)
	drainLoop:
		for {
			select {
			case _, ok := <-out:
				if !ok {
					break drainLoop
				}
			case <-timeout:
				t.Fatal("timed out waiting for subscription channel to close after Close")
			}
		}
	})
}
