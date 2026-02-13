package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// RemoveTransforms clears all drawn transforms from the visualizer.
// Returns the number of transforms removed, or an error if the server is not running or the removal fails.
func RemoveTransforms() (int32, error) {
	client := server.GetClient()
	if client == nil {
		return 0, ErrVisualizerNotRunning
	}

	req := connect.NewRequest(&drawv1.RemoveAllTransformsRequest{})
	resp, err := client.RemoveAllTransforms(context.Background(), req)
	if err != nil {
		return 0, fmt.Errorf("RemoveAll failed: %w", err)
	}

	return resp.Msg.Count, nil
}
