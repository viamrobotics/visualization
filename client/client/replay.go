package client

import (
	"bufio"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"
)

var lastDraw time.Time
var recordFile *os.File

// Record writes all operations between now and `StopRecord` to the input filename. Record calls
// assume it's starting from a blank state and will call `RemoveAllSpatialObjects` under the
// hood. Not clearing the state first would otherwise result in a replay file that is not entirely
// self-contained. Something would need to have existed in the browser before a file could be
// replayed to faithfully re-envision what the original recording produced.
func Record(filename string) error {
	RemoveAllSpatialObjects()

	lastDraw = time.Time{}
	var err error
	recordFile, err = os.Create(filename)
	return err
}

func StopRecord() {
	recordFile.Close()
	recordFile = nil
}

// Replay replays a prior recorded rendering from the `Record` method. playbackSpeed controls for
// how fast the recording will be played. For example, a `playbackSpeed` of 1 will use the existing
// sleep timings between frames. A playback speed of 2 will be twice as fast and 0.5 will halve the
// FPS.
func Replay(filename string, playbackSpeed float64) error {
	if recordFile != nil {
		// If we accidentally have a record file open, we'll continue to write to the replay file.
		StopRecord()
	}

	// Because `Record` removes all objects, `Replay` must do the same to faithfully re-render.
	if err := RemoveAllSpatialObjects(); err != nil {
		return err
	}

	reader, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer reader.Close()

	// Create a new scanner that splits on newlines.
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "sleep: "):
			// Sleeps are of the form: `sleep: <64bit integer in nanoseconds>`.
			durNanosStr := strings.Split(line, " ")[1]
			durNanosInt, err := strconv.ParseInt(durNanosStr, 10, 64)
			if err != nil {
				return err
			}

			// Replay the sleep factoring in the playback speed. If the playbackSpeed is 2(x), we
			// will sleep for half as long.
			time.Sleep(time.Duration(float64(durNanosInt) / playbackSpeed))
		default:
			// Non sleeps represent a single call to `postHTTP`. These come in the form:
			//   <endpoint>\n
			//   <content>\n
			//   <payload in hex>\n
			//
			// Mapping to the `postHTTP` inputs of:
			//   1) Payload in bytes
			//   2) content
			//   3) endpoint
			endpoint := line
			if !scanner.Scan() {
				return io.EOF
			}
			contentType := scanner.Text()

			if !scanner.Scan() {
				return io.EOF
			}
			payload, err := hex.DecodeString(scanner.Text())
			if err != nil {
				return fmt.Errorf("Payload not hex: %w", err)
			}

			postHTTP(payload, contentType, endpoint)
		}
	}

	return nil
}
