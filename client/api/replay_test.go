package api

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/test"
)

func recordingPath(t *testing.T) string {
	t.Helper()
	return filepath.Join(t.TempDir(), "session.rec")
}

// Recording is wired through the same interceptor the attach path installs, so a
// record and replay round trip runs entirely against the fake.
func TestRecordAndReplayRoundTrip(t *testing.T) {
	fake := startFake(t)
	path := recordingPath(t)

	test.That(t, Record(path), test.ShouldBeNil)
	_, err := DrawLine(DrawLineOptions{Name: "recorded", Positions: twoPointLine})
	test.That(t, err, test.ShouldBeNil)
	StopRecord()

	contents, err := os.ReadFile(path)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, contents, test.ShouldNotBeEmpty)

	before := fake.addEntityCount()
	test.That(t, Replay(path, 1), test.ShouldBeNil)
	test.That(t, fake.addEntityCount(), test.ShouldBeGreaterThan, before)
}

// Record clears the scene first so the file describes a session that starts
// empty.
func TestRecordClearsTheSceneFirst(t *testing.T) {
	fake := startFake(t)

	test.That(t, Record(recordingPath(t)), test.ShouldBeNil)
	StopRecord()

	test.That(t, fake.removeAll, test.ShouldHaveLength, 1)
}

// The RemoveAll comes before the recorder lookup, so no visualizer surfaces as a
// clear failure wrapping ErrVisualizerNotRunning rather than the bare error.
func TestRecordWithoutAVisualizer(t *testing.T) {
	requireNoServer(t)

	err := Record(recordingPath(t))

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "failed to clear scene before recording")
	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestRecordReportsAnUnwritableFile(t *testing.T) {
	startFake(t)

	err := Record(filepath.Join(t.TempDir(), "no-such-dir", "session.rec"))

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "failed to start recording")
}

func TestStopRecordIsANoOpWhenNothingIsRecording(t *testing.T) {
	startFake(t)

	// Twice, to prove the second call is not an error or a panic either.
	StopRecord()
	StopRecord()
}

func TestStopRecordWithoutAVisualizerIsANoOp(t *testing.T) {
	requireNoServer(t)

	StopRecord()
}

func TestReplayClearsTheSceneFirst(t *testing.T) {
	fake := startFake(t)
	path := recordingPath(t)
	test.That(t, os.WriteFile(path, nil, 0o600), test.ShouldBeNil)

	test.That(t, Replay(path, 1), test.ShouldBeNil)

	test.That(t, fake.removeAll, test.ShouldHaveLength, 1)
}

func TestReplayRejections(t *testing.T) {
	t.Run("no visualizer is reported through the clear", func(t *testing.T) {
		requireNoServer(t)

		err := Replay(recordingPath(t), 1)

		test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
	})

	t.Run("a missing file is reported as an open failure", func(t *testing.T) {
		startFake(t)

		err := Replay(filepath.Join(t.TempDir(), "absent.rec"), 1)

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "failed to open recording file")
	})

	t.Run("a malformed sleep line is reported", func(t *testing.T) {
		startFake(t)
		path := recordingPath(t)
		test.That(t, os.WriteFile(path, []byte("sleep: not-a-number\n"), 0o600), test.ShouldBeNil)

		err := Replay(path, 1)

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "failed to parse sleep duration")
	})

	t.Run("a non-hex payload is reported", func(t *testing.T) {
		startFake(t)
		path := recordingPath(t)
		body := "/draw.v1.DrawService/AddEntity\nnot-hex\n"
		test.That(t, os.WriteFile(path, []byte(body), 0o600), test.ShouldBeNil)

		err := Replay(path, 1)

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "failed to decode payload")
	})

	t.Run("a procedure line with no payload ends the replay", func(t *testing.T) {
		startFake(t)
		path := recordingPath(t)
		body := "/draw.v1.DrawService/AddEntity\n"
		test.That(t, os.WriteFile(path, []byte(body), 0o600), test.ShouldBeNil)

		err := Replay(path, 1)

		test.That(t, err, test.ShouldNotBeNil)
	})

	t.Run("an unknown procedure is named in the error", func(t *testing.T) {
		startFake(t)
		path := recordingPath(t)
		body := "/draw.v1.DrawService/NotAThing\n00\n"
		test.That(t, os.WriteFile(path, []byte(body), 0o600), test.ShouldBeNil)

		err := Replay(path, 1)

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "unknown procedure")
	})
}

// The recorder captures every unary RPC, but replayCall's switch has no
// AddEntities arm. So any session that drew a frame system, a world state, a
// robot, or a batch of geometries records fine and then fails to replay.
//
// This pins the gap rather than endorsing it. Add the AddEntities case and this
// test fails, at which point it should assert a successful replay.
func TestReplayCannotHandleRecordedBatchCalls(t *testing.T) {
	startFake(t)
	path := recordingPath(t)

	test.That(t, Record(path), test.ShouldBeNil)
	_, err := DrawFrames(DrawFramesOptions{
		Frames: []referenceframe.Frame{testAxesFrame(t, "recorded-frame")},
	})
	test.That(t, err, test.ShouldBeNil)
	StopRecord()

	err = Replay(path, 1)

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "unknown procedure")
	test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntities")
}

// Playback speed only scales sleeps, so a file with no sleep lines replays the
// same at any speed.
func TestReplaySpeedDoesNotChangeTheCalls(t *testing.T) {
	countFor := func(t *testing.T, speed float64) int {
		t.Helper()
		fake := startFake(t)
		path := recordingPath(t)

		test.That(t, Record(path), test.ShouldBeNil)
		_, err := DrawPoints(DrawPointsOptions{
			Name:      "speed",
			Positions: []r3.Vector{{X: 1}},
		})
		test.That(t, err, test.ShouldBeNil)
		StopRecord()

		before := fake.addEntityCount()
		test.That(t, Replay(path, speed), test.ShouldBeNil)
		return fake.addEntityCount() - before
	}

	var atOne, atTen int
	t.Run("real time", func(t *testing.T) { atOne = countFor(t, 1) })
	t.Run("ten times", func(t *testing.T) { atTen = countFor(t, 10) })

	test.That(t, atOne, test.ShouldEqual, atTen)
}
