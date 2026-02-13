package api

import (
	"bufio"
	"context"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	"google.golang.org/protobuf/proto"
)

// Record starts recording all drawing operations to the specified file.
// The recording starts from a clean state (all existing objects are removed).
// Call StopRecord() to finish recording.
func Record(filename string) error {
	// Clear the scene before recording to ensure the recording is self-contained
	_, err := RemoveAll()
	if err != nil {
		return fmt.Errorf("failed to clear scene before recording: %w", err)
	}

	// Get the recorder from the server
	recorder := server.GetRecorder()
	if recorder == nil {
		return fmt.Errorf("server is not running; call server.Start() first")
	}

	// Start recording to the specified file
	err = recorder.StartRecording(filename)
	if err != nil {
		return fmt.Errorf("failed to start recording: %w", err)
	}

	return nil
}

// StopRecord stops the current recording session.
func StopRecord() {
	recorder := server.GetRecorder()
	if recorder != nil {
		recorder.StopRecording()
	}
}

// Replay replays a previously recorded session from the specified file.
// The playbackSpeed parameter controls replay speed (1.0 = normal, 2.0 = 2x, 0.5 = half speed).
// The scene is cleared before replay to match the recording's initial state.
func Replay(filename string, playbackSpeed float64) error {
	// Stop any active recording
	recorder := server.GetRecorder()
	if recorder != nil && recorder.IsRecording() {
		StopRecord()
	}

	// Clear the scene before replaying to match recording's initial state
	_, err := RemoveAll()
	if err != nil {
		return fmt.Errorf("failed to clear scene before replay: %w", err)
	}

	client := server.GetClient()
	if client == nil {
		return fmt.Errorf("server is not running; call server.Start() first")
	}

	// Open the recording file
	file, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("failed to open recording file: %w", err)
	}
	defer file.Close()

	// Read and replay the file line by line
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "sleep: ") {
			// Parse sleep duration and apply playback speed
			durNanosStr := strings.TrimPrefix(line, "sleep: ")
			durNanos, err := strconv.ParseInt(durNanosStr, 10, 64)
			if err != nil {
				return fmt.Errorf("failed to parse sleep duration: %w", err)
			}

			// Adjust sleep duration by playback speed (higher speed = shorter sleep)
			adjustedDuration := time.Duration(float64(durNanos) / playbackSpeed)
			time.Sleep(adjustedDuration)
		} else {
			// This is a procedure line followed by hex-encoded payload
			procedure := line

			if !scanner.Scan() {
				return io.EOF
			}

			payload, err := hex.DecodeString(scanner.Text())
			if err != nil {
				return fmt.Errorf("failed to decode payload: %w", err)
			}

			// Replay the call through the Connect client
			if err := replayCall(client, procedure, payload); err != nil {
				return fmt.Errorf("failed to replay %s: %w", procedure, err)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading recording file: %w", err)
	}

	return nil
}

// replayCall deserializes a recorded RPC request and replays it through the Connect client.
func replayCall(client drawv1connect.DrawServiceClient, procedure string, payload []byte) error {
	ctx := context.Background()

	switch procedure {
	case drawv1connect.DrawServiceAddTransformProcedure:
		var msg drawv1.AddTransformRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.AddTransform(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceUpdateTransformProcedure:
		var msg drawv1.UpdateTransformRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.UpdateTransform(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceRemoveTransformProcedure:
		var msg drawv1.RemoveTransformRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.RemoveTransform(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceRemoveAllTransformsProcedure:
		var msg drawv1.RemoveAllTransformsRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.RemoveAllTransforms(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceAddDrawingProcedure:
		var msg drawv1.AddDrawingRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.AddDrawing(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceUpdateDrawingProcedure:
		var msg drawv1.UpdateDrawingRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.UpdateDrawing(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceRemoveDrawingProcedure:
		var msg drawv1.RemoveDrawingRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.RemoveDrawing(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceRemoveAllDrawingsProcedure:
		var msg drawv1.RemoveAllDrawingsRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.RemoveAllDrawings(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceSetSceneMetadataProcedure:
		var msg drawv1.SetSceneMetadataRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.SetSceneMetadata(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceRemoveAllProcedure:
		var msg drawv1.RemoveAllRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.RemoveAll(ctx, connect.NewRequest(&msg))
		return err

	default:
		return fmt.Errorf("unknown procedure: %s", procedure)
	}
}
