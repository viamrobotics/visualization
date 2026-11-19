package main

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	commonpb "go.viam.com/api/common/v1"
	"google.golang.org/protobuf/proto"
)

const (
	burstDefaultCount = 124
	burstMinCount     = 1
	burstMaxCount     = 10000

	burstDefaultPeriodMs = 700
	burstMinPeriodMs     = 10
	burstMaxPeriodMs     = 10000

	burstDefaultTicks = 10
	burstMinTicks     = 1
	burstMaxTicks     = 100000

	// burstPoseOscillationAmplitude sets how far pose.x swings per nudge, small
	// enough to stay a no-op for anything downstream that only cares about scale.
	burstPoseOscillationAmplitude = 10.0
	// burstPoseOscillationRadiansPerTick advances the sine phase per tick; with the
	// per-event phase offset it keeps consecutive deltas on one transform distinct.
	burstPoseOscillationRadiansPerTick = 0.1
)

// burst starts a background loop that repeatedly nudges the store's transforms
// and emits UPDATED events, simulating a high-throughput producer for perf
// measurement. A running burst is replaced (not stacked) by a new one.
func (s *TestStore) burst(cmd map[string]any) (map[string]any, error) {
	count, err := intField(cmd, "count", burstDefaultCount, burstMinCount, burstMaxCount)
	if err != nil {
		return nil, err
	}
	periodMs, err := intField(cmd, "period_ms", burstDefaultPeriodMs, burstMinPeriodMs, burstMaxPeriodMs)
	if err != nil {
		return nil, err
	}
	ticks, err := intField(cmd, "ticks", burstDefaultTicks, burstMinTicks, burstMaxTicks)
	if err != nil {
		return nil, err
	}

	transforms := s.orderedTransforms()
	if len(transforms) == 0 {
		return nil, fmt.Errorf("burst requires at least one transform, but the store has none")
	}

	s.startBurst(transforms, count, periodMs, ticks)

	return map[string]any{
		"started":    true,
		"count":      count,
		"period_ms":  periodMs,
		"ticks":      ticks,
		"transforms": len(transforms),
	}, nil
}

// orderedTransforms returns the store's transforms in a stable order (sorted
// by raw UUID key) so round-robin distribution is deterministic across calls.
func (s *TestStore) orderedTransforms() []*commonpb.Transform {
	s.mu.RLock()
	defer s.mu.RUnlock()

	keys := make([]string, 0, len(s.transforms))
	for k := range s.transforms {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	transforms := make([]*commonpb.Transform, 0, len(keys))
	for _, k := range keys {
		transforms = append(transforms, s.transforms[k])
	}
	return transforms
}

// startBurst cancels any previously running burst and launches the new one on
// its own goroutine, tracked by burstDone so a caller (Close, or a later
// startBurst) can wait for it to actually exit instead of leaving it dangling.
// burstStarted closes once the goroutine has entered its select loop.
func (s *TestStore) startBurst(transforms []*commonpb.Transform, count, periodMs, ticks int) {
	s.burstMu.Lock()
	if s.burstCancel != nil {
		s.burstCancel()
	}
	burstCtx, cancel := context.WithCancel(s.streamCtx)
	done := make(chan struct{})
	started := make(chan struct{})
	s.burstCancel = cancel
	s.burstDone = done
	s.burstStarted = started
	s.burstMu.Unlock()

	go func() {
		defer close(done)
		s.runBurst(burstCtx, transforms, count, periodMs, ticks, started)
	}()
}

// stopBurst cancels the running burst, if any, and blocks until its goroutine
// has actually returned.
func (s *TestStore) stopBurst() {
	s.burstMu.Lock()
	cancel := s.burstCancel
	done := s.burstDone
	s.burstMu.Unlock()

	if cancel == nil {
		return
	}
	cancel()
	<-done
}

func (s *TestStore) runBurst(ctx context.Context, transforms []*commonpb.Transform, count, periodMs, ticks int, started chan struct{}) {
	ticker := time.NewTicker(time.Duration(periodMs) * time.Millisecond)
	defer ticker.Stop()

	close(started)

	numTransforms := len(transforms)
	eventIndex := 0

	for tick := 1; tick <= ticks; tick++ {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// select can resolve to this case even when ctx was already
			// cancelled in the same instant the ticker fired; re-check
			// so a superseding burst can't leak one extra tick's events.
			if ctx.Err() != nil {
				return
			}
		}

		for i := 0; i < count; i++ {
			transform := transforms[eventIndex%numTransforms]
			s.nudgePose(transform, tick, eventIndex)
			eventIndex++
		}
	}
}

// nudgePose applies a small oscillating offset to a transform's pose.x, holding
// the store lock while mutating the pose and cloning the transform. The clone is
// broadcast after the lock is released so subscribers never race the next mutation
// on the live pointer.
func (s *TestStore) nudgePose(transform *commonpb.Transform, tick, phase int) {
	s.mu.Lock()
	pose := transform.PoseInObserverFrame.Pose
	pose.X += burstPoseOscillationAmplitude * math.Sin(float64(tick)*burstPoseOscillationRadiansPerTick+float64(phase))
	snapshot := proto.Clone(transform).(*commonpb.Transform)
	s.mu.Unlock()

	s.emitUpdate(snapshot, []string{"poseInObserverFrame.pose"})
}

// intField reads an integer command argument, applying defaultValue when absent and
// rejecting non-numeric or out-of-bounds values with the field name and bounds.
func intField(cmd map[string]any, key string, defaultValue, minimum, maximum int) (int, error) {
	raw, ok := cmd[key]
	if !ok {
		return defaultValue, nil
	}

	number, ok := raw.(float64)
	if !ok {
		return 0, fmt.Errorf("%s must be a number between %d and %d", key, minimum, maximum)
	}

	value := int(number)
	if value < minimum || value > maximum {
		return 0, fmt.Errorf("%s must be between %d and %d", key, minimum, maximum)
	}
	return value, nil
}
