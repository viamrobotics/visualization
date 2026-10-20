package draw

import (
	"sync"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

// maxPendingEntityChanges bounds how far behind a single stream subscriber may fall.
//
// The entity stream is purely incremental, so a dropped event corrupts the consumer
// permanently: a lost REMOVED leaves a ghost the server will never mention again, and a lost
// ADDED leaves a hole. Rather than drop, changes queue without limit up to this cap. A
// subscriber that exceeds it is disconnected so it reconnects and receives a fresh replay of
// the whole scene. The cap is a runaway backstop, not a normal operating point — clearing and
// redrawing a large scene is a few hundred events.
const maxPendingEntityChanges = 20_000

// entitySubscriber is one StreamEntityChanges consumer's mailbox.
//
// Publishing (push) happens on the RPC goroutine that mutated the store while it holds
// DrawService.mu. Draining (take) happens on the stream goroutine and takes no service lock.
// push never blocks, so a stalled consumer cannot stall the store.
type entitySubscriber struct {
	mu       sync.Mutex
	pending  []*drawv1.StreamEntityChangesResponse
	overflow bool
	closed   bool

	// notify is an edge-trigger with a one-slot buffer so push never blocks and the consumer
	// can select on it alongside ctx.Done. A sync.Cond would be a natural fit for the queue but
	// cannot be cancelled, which would leave the stream goroutine parked after the client goes
	// away.
	notify chan struct{}
}

func newEntitySubscriber() *entitySubscriber {
	return &entitySubscriber{notify: make(chan struct{}, 1)}
}

// signal wakes the consumer if it is waiting. Safe to call without holding sub.mu, and safe to
// call when nobody is waiting.
func (sub *entitySubscriber) signal() {
	select {
	case sub.notify <- struct{}{}:
	default:
	}
}

// push appends a change for later delivery. It never blocks and never drops silently: once the
// queue passes maxPendingEntityChanges the subscriber is marked overflowed and its backlog is
// released, which take reports so the stream can terminate and let the client resync.
func (sub *entitySubscriber) push(msg *drawv1.StreamEntityChangesResponse) {
	if msg == nil {
		return
	}

	sub.mu.Lock()
	if sub.closed || sub.overflow {
		sub.mu.Unlock()
		return
	}
	if len(sub.pending) >= maxPendingEntityChanges {
		sub.overflow = true
		sub.pending = nil
	} else {
		sub.pending = append(sub.pending, msg)
	}
	sub.mu.Unlock()

	sub.signal()
}

// take removes and returns everything queued so far. It never blocks, and an empty slice means
// the consumer should wait on notify.
func (sub *entitySubscriber) take() (msgs []*drawv1.StreamEntityChangesResponse, overflow, closed bool) {
	sub.mu.Lock()
	defer sub.mu.Unlock()

	msgs, sub.pending = sub.pending, nil
	return msgs, sub.overflow, sub.closed
}

// close marks the subscriber finished and wakes the consumer.
func (sub *entitySubscriber) close() {
	sub.mu.Lock()
	sub.closed = true
	sub.pending = nil
	sub.mu.Unlock()

	sub.signal()
}

// sceneSubscriber is one StreamSceneChanges consumer's mailbox.
//
// Scene messages are whole snapshots rather than deltas, so only the most recent one matters
// and a single latest-wins slot replaces the queue.
type sceneSubscriber struct {
	mu     sync.Mutex
	latest *drawv1.StreamSceneChangesResponse
	closed bool
	notify chan struct{}
}

func newSceneSubscriber() *sceneSubscriber {
	return &sceneSubscriber{notify: make(chan struct{}, 1)}
}

func (sub *sceneSubscriber) signal() {
	select {
	case sub.notify <- struct{}{}:
	default:
	}
}

func (sub *sceneSubscriber) push(msg *drawv1.StreamSceneChangesResponse) {
	if msg == nil {
		return
	}

	sub.mu.Lock()
	if sub.closed {
		sub.mu.Unlock()
		return
	}
	sub.latest = msg
	sub.mu.Unlock()

	sub.signal()
}

// take returns the latest scene snapshot, or nil when nothing new has arrived.
func (sub *sceneSubscriber) take() (msg *drawv1.StreamSceneChangesResponse, closed bool) {
	sub.mu.Lock()
	defer sub.mu.Unlock()

	msg, sub.latest = sub.latest, nil
	return msg, sub.closed
}

func (sub *sceneSubscriber) close() {
	sub.mu.Lock()
	sub.closed = true
	sub.latest = nil
	sub.mu.Unlock()

	sub.signal()
}
