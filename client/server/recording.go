package server

import (
	"context"
	"encoding/hex"
	"fmt"
	"os"
	"sync"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/proto"
)

// RecordingInterceptor implements connect.Interceptor to record RPC calls to a file.
// It captures unary RPC calls (not streaming) and writes them in a format that can be replayed.
type RecordingInterceptor struct {
	mu         sync.Mutex
	recordFile *os.File
	lastDraw   time.Time
}

// NewRecordingInterceptor creates a new recording interceptor.
func NewRecordingInterceptor() *RecordingInterceptor {
	return &RecordingInterceptor{}
}

// WrapUnary wraps unary RPC calls to record them when recording is active.
func (r *RecordingInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		r.mu.Lock()
		isRecording := r.recordFile != nil
		r.mu.Unlock()

		if !isRecording {
			return next(ctx, req)
		}

		r.mu.Lock()
		if r.lastDraw.IsZero() {
			r.lastDraw = time.Now()
		} else {
			timeSinceFrame := time.Since(r.lastDraw)
			// Only write sleep entries for gaps >10ms to avoid capturing
			// internal timing between calls within a single operation.
			if timeSinceFrame > 10*time.Millisecond {
				fmt.Fprintf(r.recordFile, "sleep: %v\n", timeSinceFrame.Nanoseconds())
			}
		}

		fmt.Fprintf(r.recordFile, "%v\n", req.Spec().Procedure)

		reqMsg, ok := req.Any().(proto.Message)
		if !ok {
			r.mu.Unlock()
			return nil, fmt.Errorf("request is not a proto.Message")
		}

		payload, err := proto.Marshal(reqMsg)
		if err != nil {
			r.mu.Unlock()
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}

		fmt.Fprintf(r.recordFile, "%v\n", hex.EncodeToString(payload))
		r.mu.Unlock()

		resp, err := next(ctx, req)

		r.mu.Lock()
		r.lastDraw = time.Now()
		r.mu.Unlock()

		return resp, err
	}
}

// WrapStreamingClient passes streaming client calls through without recording.
func (r *RecordingInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler passes streaming handler calls through without recording.
func (r *RecordingInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

// StartRecording begins recording RPC calls to the specified file.
func (r *RecordingInterceptor) StartRecording(filename string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.recordFile != nil {
		r.recordFile.Close()
	}

	var err error
	r.recordFile, err = os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create recording file: %w", err)
	}

	r.lastDraw = time.Time{}
	return nil
}

// StopRecording stops the current recording and closes the file.
func (r *RecordingInterceptor) StopRecording() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.recordFile != nil {
		r.recordFile.Close()
		r.recordFile = nil
	}
	r.lastDraw = time.Time{}
}

// IsRecording returns whether recording is currently active.
func (r *RecordingInterceptor) IsRecording() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.recordFile != nil
}
