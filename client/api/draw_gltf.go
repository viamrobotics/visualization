package api

import (
	"context"
	"fmt"
	"os"

	"connectrpc.com/connect"
	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// DrawGLTFOptions configures a DrawGLTF call.
type DrawGLTFOptions struct {
	// A unique identifier for the GLTF model. Can be empty.
	ID string

	// The name of the GLTF model.
	Name string

	// FilePath is the path to the .glb or .gltf file.
	FilePath string

	// The name of the parent frame. If empty, the model will be parented to the "world" frame.
	Parent string

	// Scale specifies the scaling factors for each axis. All dimensions must be non-zero.
	Scale r3.Vector

	// ShowAxesHelper controls whether the axes helper (RGB XYZ indicator) is shown on the entity.
	// If nil, defaults to DefaultDrawingShowAxesHelper.
	ShowAxesHelper *bool
}

// DrawGLTF draws a GLTF model in the visualizer.
// Calling DrawGLTF with an ID that already exists will instead update the model.
// Returns the UUID of the drawn model, or an error if the server is not running or the drawing fails.
func DrawGLTF(options DrawGLTFOptions) ([]byte, error) {
	if err := isASCIIPrintable(options.Name); err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	data, err := os.ReadFile(options.FilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read GLTF file: %w", err)
	}

	asset, err := draw.NewBinaryModelAsset("model/gltf-binary", data, draw.WithModelAssetSizeBytes(uint64(len(data))))
	if err != nil {
		return nil, fmt.Errorf("failed to create model asset: %w", err)
	}

	scale := options.Scale
	if scale.X == 0 || scale.Y == 0 || scale.Z == 0 {
		return nil, fmt.Errorf("scale dimensions must be non-zero, got %v; use (1,1,1) to apply no scaling", scale)
	}

	model, err := draw.NewModel(draw.WithModelAssets(asset), draw.WithModelScale(scale))
	if err != nil {
		return nil, fmt.Errorf("failed to create model: %w", err)
	}

	if options.Parent == "" {
		options.Parent = "world"
	}

	if options.ShowAxesHelper == nil {
		options.ShowAxesHelper = &DefaultDrawingShowAxesHelper
	}

	drawOpts := []draw.DrawableOption{draw.WithParent(options.Parent), draw.WithAxesHelper(*options.ShowAxesHelper)}
	if options.ID != "" {
		drawOpts = append(drawOpts, draw.WithID(options.ID))
	}

	drawing := model.Draw(options.Name, drawOpts...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
