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
	"go.viam.com/rdk/spatialmath"
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

	// Scale specifies the scaling factors for each axis. If zero, defaults to (1,1,1).
	Scale r3.Vector
}

// DrawGLTF draws a GLTF model in the visualizer.
// Calling DrawGLTF with an ID that already exists will instead update the model in the parent frame.
// Returns the UUID of the drawn model, or an error if the server is not running or the drawing fails.
func DrawGLTF(options DrawGLTFOptions) ([]byte, error) {
	err := isASCIIPrintable(options.Name)
	if err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	// Read the file
	data, err := os.ReadFile(options.FilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read GLTF file: %w", err)
	}

	// Create model asset
	asset, err := draw.NewBinaryModelAsset("model/gltf-binary", data, draw.WithModelAssetSizeBytes(uint64(len(data))))
	if err != nil {
		return nil, fmt.Errorf("failed to create model asset: %w", err)
	}

	// Build model with options
	var model *draw.Model
	scale := options.Scale
	if scale.X == 0 && scale.Y == 0 && scale.Z == 0 {
		scale = r3.Vector{X: 1, Y: 1, Z: 1}
	}

	model, err = draw.NewModel(draw.WithModelAssets(asset), draw.WithModelScale(scale))
	if err != nil {
		return nil, fmt.Errorf("failed to create model: %w", err)
	}

	parent := options.Parent
	if parent == "" {
		parent = "world"
	}

	drawing := model.Draw(options.ID, options.Name, parent, spatialmath.NewZeroPose())
	req := connect.NewRequest(&drawv1.AddDrawingRequest{Drawing: drawing.ToProto()})
	resp, err := client.AddDrawing(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddDrawing RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
