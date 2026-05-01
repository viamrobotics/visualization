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

	// Scale specifies the scaling factors for each axis. Defaults to (1, 1, 1)
	// (no scaling) when omitted. If set, all three components must be non-zero.
	Scale r3.Vector

	// Attrs holds optional entity attributes (e.g. visibility).
	Attrs *Attrs
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

	modelOpts := []draw.DrawModelOption{draw.WithModelAssets(asset)}
	if options.Scale != (r3.Vector{}) {
		modelOpts = append(modelOpts, draw.WithModelScale(options.Scale))
	}

	model, err := draw.NewModel(modelOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create model: %w", err)
	}

	drawing := model.Draw(options.Name, entityAttributes(options.ID, options.Parent, options.Attrs)...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
