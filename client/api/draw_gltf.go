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
	// A unique identifier for the entity. If set, drawing with the same ID updates the existing entity.
	ID string

	// The name of the entity.
	Name string

	// The parent frame name. If empty, defaults to "world".
	Parent string

	// FilePath is the path to the .glb or .gltf file.
	FilePath string

	// Scale specifies the scaling factors for each axis. All dimensions must be non-zero.
	Scale r3.Vector

	// ShowAxesHelper controls whether the axes helper is shown.
	// If nil, defaults to true.
	ShowAxesHelper *bool

	// Invisible controls whether the entity is hidden from the 3D scene by default.
	// If nil, defaults to false.
	Invisible *bool
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

	drawing := model.Draw(options.Name, entityOptions(options.ID, options.Parent, options.ShowAxesHelper, options.Invisible)...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
