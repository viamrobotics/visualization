package draw

import (
	"sync"
	"testing"
	"time"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/test"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

func changeFor(name string, changeType drawv1.EntityChangeType) *drawv1.StreamEntityChangesResponse {
	return &drawv1.StreamEntityChangesResponse{
		ChangeType: changeType,
		Entity: &drawv1.StreamEntityChangesResponse_Transform{
			Transform: &commonv1.Transform{ReferenceFrame: name},
		},
	}
}

func frameNames(msgs []*drawv1.StreamEntityChangesResponse) []string {
	names := make([]string, 0, len(msgs))
	for _, msg := range msgs {
		names = append(names, msg.GetTransform().GetReferenceFrame())
	}
	return names
}

func TestEntitySubscriber_PreservesOrder(t *testing.T) {
	sub := newEntitySubscriber()

	for _, name := range []string{"a", "b", "c"} {
		sub.push(changeFor(name, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED))
	}

	msgs, overflow, closed := sub.take()
	test.That(t, overflow, test.ShouldBeFalse)
	test.That(t, closed, test.ShouldBeFalse)
	test.That(t, frameNames(msgs), test.ShouldResemble, []string{"a", "b", "c"})
}

func TestEntitySubscriber_TakeDrainsAndSwaps(t *testing.T) {
	sub := newEntitySubscriber()
	sub.push(changeFor("a", drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED))

	msgs, _, _ := sub.take()
	test.That(t, msgs, test.ShouldHaveLength, 1)

	// A second take with nothing queued must not block and must not repeat the first batch.
	msgs, _, _ = sub.take()
	test.That(t, msgs, test.ShouldHaveLength, 0)
}

func TestEntitySubscriber_NilPushIsIgnored(t *testing.T) {
	sub := newEntitySubscriber()
	sub.push(nil)

	msgs, _, _ := sub.take()
	test.That(t, msgs, test.ShouldHaveLength, 0)
}

func TestEntitySubscriber_QueuesFarBeyondAnyChannelBuffer(t *testing.T) {
	sub := newEntitySubscriber()

	// A bulk clear plus redraw of a large scene is thousands of events published in one lock
	// hold, with no chance for the consumer to drain in between.
	const burst = 5000
	for range burst {
		sub.push(changeFor("burst", drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED))
	}

	msgs, overflow, _ := sub.take()
	test.That(t, overflow, test.ShouldBeFalse)
	test.That(t, msgs, test.ShouldHaveLength, burst)
}

func TestEntitySubscriber_OverflowSignalsResync(t *testing.T) {
	sub := newEntitySubscriber()

	for range maxPendingEntityChanges + 1 {
		sub.push(changeFor("x", drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED))
	}

	msgs, overflow, _ := sub.take()
	test.That(t, overflow, test.ShouldBeTrue)
	test.That(t, msgs, test.ShouldHaveLength, 0)
}

func TestEntitySubscriber_PushAfterOverflowIsDropped(t *testing.T) {
	sub := newEntitySubscriber()

	for range maxPendingEntityChanges + 1 {
		sub.push(changeFor("x", drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED))
	}
	sub.push(changeFor("after", drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED))

	// Once overflowed the subscriber stays overflowed until the stream tears it down, so the
	// consumer cannot mistake a partial queue for a complete one.
	msgs, overflow, _ := sub.take()
	test.That(t, overflow, test.ShouldBeTrue)
	test.That(t, msgs, test.ShouldHaveLength, 0)
}

func TestEntitySubscriber_CloseWakesWaitingConsumer(t *testing.T) {
	sub := newEntitySubscriber()

	woke := make(chan struct{})
	go func() {
		<-sub.notify
		close(woke)
	}()

	sub.close()

	select {
	case <-woke:
	case <-time.After(2 * time.Second):
		t.Fatal("close did not wake the consumer")
	}

	_, _, closed := sub.take()
	test.That(t, closed, test.ShouldBeTrue)
}

func TestEntitySubscriber_ConcurrentPushAndTake(t *testing.T) {
	sub := newEntitySubscriber()

	const pushers = 4
	const perPusher = 500

	var wg sync.WaitGroup
	wg.Add(pushers)
	for range pushers {
		go func() {
			defer wg.Done()
			for range perPusher {
				sub.push(changeFor("concurrent", drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED))
			}
		}()
	}

	// Drain the way the real stream loop does, waiting on notify rather than spinning on take.
	// A signal can be coalesced away when the buffer is already full, but the sender always
	// leaves one pending, so a waiter is guaranteed at least one more wake after any push.
	done := make(chan int)
	go func() {
		received := 0
		for received < pushers*perPusher {
			select {
			case <-sub.notify:
			case <-time.After(5 * time.Second):
				done <- received
				return
			}
			msgs, _, _ := sub.take()
			received += len(msgs)
		}
		done <- received
	}()

	wg.Wait()

	select {
	case received := <-done:
		test.That(t, received, test.ShouldEqual, pushers*perPusher)
	case <-time.After(5 * time.Second):
		t.Fatal("consumer did not receive every pushed change")
	}
}

func TestSceneSubscriber_KeepsOnlyLatest(t *testing.T) {
	sub := newSceneSubscriber()

	sub.push(&drawv1.StreamSceneChangesResponse{SceneMetadata: &drawv1.SceneMetadata{}})
	latest := &drawv1.StreamSceneChangesResponse{SceneMetadata: &drawv1.SceneMetadata{}}
	sub.push(latest)

	msg, closed := sub.take()
	test.That(t, closed, test.ShouldBeFalse)
	test.That(t, msg, test.ShouldEqual, latest)

	msg, _ = sub.take()
	test.That(t, msg, test.ShouldBeNil)
}
