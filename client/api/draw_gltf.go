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
	// ID is a stable identifier for the entity. When set, calling DrawGLTF
	// again with the same ID updates the existing entity in place; when empty,
	// each call creates a new entity with a freshly generated UUID.
	ID string
	// Name labels the entity in the visualizer. Must be ASCII printable and at
	// most 100 characters.
	Name string
	// Parent is the reference frame the model is attached to. Defaults to
	// "world" when empty.
	Parent string
	// FilePath is the local filesystem path to a .glb or .gltf file. Required.
	// The entire file is read into memory and sent inline with the AddEntity
	// RPC.
	FilePath string
	// Scale is the per-axis scaling factor applied to the model. The zero
	// value is treated as "no scaling specified" and falls back to
	// draw.DefaultModelScale (1, 1, 1). When any field is set, every field
	// must be non-zero, otherwise NewModel rejects the scale.
	Scale r3.Vector
	// Attrs carries optional shared display attributes (axes helper, default
	// visibility). Nil leaves all attributes at their defaults.
	Attrs *Attrs
}

// DrawGLTF reads a GLB/GLTF file from disk, sends its bytes to the visualizer
// inline, and renders it as a drawing. Passing an ID that already exists
// updates the previously drawn entity in place; otherwise a new entity is
// created. Returns the UUID assigned by the server.
//
// Returns an error when Name is not ASCII printable or exceeds 100 characters,
// ErrVisualizerNotRunning if no visualizer is reachable, a wrapped filesystem
// error if FilePath cannot be read, the underlying validation error if the
// model cannot be constructed (see draw.NewBinaryModelAsset, draw.NewModel —
// empty file, partial-zero Scale, etc.), or a wrapped RPC error if the
// AddEntity call fails.
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
