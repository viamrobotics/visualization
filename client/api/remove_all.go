package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// RemoveAll clears all drawn items from the visualizer.
// Returns the number of items removed, or an error if the server is not running or the removal fails.
func RemoveAll() (int32, error) {
	client := server.GetClient()
	if client == nil {
		return 0, fmt.Errorf("server is not running; call server.Start() first")
	}

	req := connect.NewRequest(&drawv1.RemoveAllRequest{})
	resp, err := client.RemoveAll(context.Background(), req)
	if err != nil {
		return 0, fmt.Errorf("RemoveAll failed: %w", err)
	}

	return resp.Msg.TransformCount + resp.Msg.DrawingCount, nil
}
