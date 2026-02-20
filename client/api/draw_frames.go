package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/referenceframe"
)

// DrawFramesOptions configures a DrawFrames call.
type DrawFramesOptions struct {
	// A unique identifier for the frames group. Can be empty.
	ID string

	// The frames to draw.
	Frames []referenceframe.Frame
}

// DrawFrames draws multiple frames in the visualizer.
// Each frame is rendered as a coordinate system with optional geometry.
// Returns the UUIDs of all drawn transforms, or an error if the server is not running or the drawing fails.
func DrawFrames(options DrawFramesOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	uuids := make([][]byte, 0)

	for _, frame := range options.Frames {
		// Get the frame's pose using Transform with nil inputs for static frames
		pose, err := frame.Transform(nil)
		if err != nil {
			return nil, fmt.Errorf("failed to get transform for frame %s: %w", frame.Name(), err)
		}

		// Draw the frame's geometry if it has one
		geometries, err := frame.Geometries(nil)
		if err != nil {
			return nil, fmt.Errorf("failed to get geometries for frame %s: %w", frame.Name(), err)
		}

		opts := []draw.DrawableOption{draw.WithPose(pose)}
		if options.ID != "" {
			opts = append(opts, draw.WithID(options.ID))
		}

		if geometries != nil && len(geometries.Geometries()) > 0 {
			// Frame has geometries - draw them
			for _, geometry := range geometries.Geometries() {
				drawnGeometry, err := draw.NewDrawnGeometry(geometry)
				if err != nil {
					return nil, fmt.Errorf("failed to create drawn geometry: %w", err)
				}
				transform, err := drawnGeometry.Draw("", opts...)
				if err != nil {
					return nil, fmt.Errorf("failed to create transform: %w", err)
				}

				req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Transform{Transform: transform}})
				resp, err := client.AddEntity(context.Background(), req)
				if err != nil {
					return nil, fmt.Errorf("AddEntity RPC failed for frame %s: %w", frame.Name(), err)
				}
				uuids = append(uuids, resp.Msg.Uuid)
			}
		} else {
			config := draw.NewDrawConfig(frame.Name(), opts...)
			transform := draw.NewTransform(
				config.UUID,
				config.Name,
				config.Parent,
				config.Pose,
				nil,
				nil,
			)

			req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Transform{Transform: transform}})
			resp, err := client.AddEntity(context.Background(), req)
			if err != nil {
				return nil, fmt.Errorf("AddTransform RPC failed for frame %s: %w", frame.Name(), err)
			}
			uuids = append(uuids, resp.Msg.Uuid)
		}
	}

	return uuids, nil
}
