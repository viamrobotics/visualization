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
// The scene is cleared first to ensure the recording is self-contained.
// Call StopRecord to finish recording.
func Record(filename string) error {
	if _, err := RemoveAll(); err != nil {
		return fmt.Errorf("failed to clear scene before recording: %w", err)
	}

	recorder := server.GetRecorder()
	if recorder == nil {
		return ErrVisualizerNotRunning
	}

	if err := recorder.StartRecording(filename); err != nil {
		return fmt.Errorf("failed to start recording: %w", err)
	}

	return nil
}

// StopRecord stops the current recording session.
func StopRecord() {
	if recorder := server.GetRecorder(); recorder != nil {
		recorder.StopRecording()
	}
}

// Replay replays a previously recorded session from the specified file.
// playbackSpeed controls replay speed (1.0 = normal, 2.0 = 2×, 0.5 = half speed).
// The scene is cleared before replay to match the recording's initial state.
func Replay(filename string, playbackSpeed float64) error {
	if recorder := server.GetRecorder(); recorder != nil && recorder.IsRecording() {
		StopRecord()
	}

	if _, err := RemoveAll(); err != nil {
		return fmt.Errorf("failed to clear scene before replay: %w", err)
	}

	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	file, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("failed to open recording file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "sleep: ") {
			durNanosStr := strings.TrimPrefix(line, "sleep: ")
			durNanos, err := strconv.ParseInt(durNanosStr, 10, 64)
			if err != nil {
				return fmt.Errorf("failed to parse sleep duration: %w", err)
			}
			time.Sleep(time.Duration(float64(durNanos) / playbackSpeed))
			continue
		}

		procedure := line
		if !scanner.Scan() {
			return io.EOF
		}

		payload, err := hex.DecodeString(scanner.Text())
		if err != nil {
			return fmt.Errorf("failed to decode payload: %w", err)
		}

		if err := replayCall(client, procedure, payload); err != nil {
			return fmt.Errorf("failed to replay %s: %w", procedure, err)
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
	case drawv1connect.DrawServiceAddEntityProcedure:
		var msg drawv1.AddEntityRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.AddEntity(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceUpdateEntityProcedure:
		var msg drawv1.UpdateEntityRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.UpdateEntity(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceRemoveEntityProcedure:
		var msg drawv1.RemoveEntityRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.RemoveEntity(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceSetSceneProcedure:
		var msg drawv1.SetSceneRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.SetScene(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceRemoveAllTransformsProcedure:
		var msg drawv1.RemoveAllTransformsRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.RemoveAllTransforms(ctx, connect.NewRequest(&msg))
		return err

	case drawv1connect.DrawServiceRemoveAllDrawingsProcedure:
		var msg drawv1.RemoveAllDrawingsRequest
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return err
		}
		_, err := client.RemoveAllDrawings(ctx, connect.NewRequest(&msg))
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
