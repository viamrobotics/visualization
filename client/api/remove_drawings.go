package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// RemoveDrawings clears all drawn Drawings from the visualizer.
// Returns the number of Drawings removed, or an error if the server is not running or the removal fails.
func RemoveDrawings() (int32, error) {
	client := server.GetClient()
	if client == nil {
		return 0, ErrVisualizerNotRunning
	}

	req := connect.NewRequest(&drawv1.RemoveAllDrawingsRequest{})
	resp, err := client.RemoveAllDrawings(context.Background(), req)
	if err != nil {
		return 0, fmt.Errorf("RemoveAll failed: %w", err)
	}

	return resp.Msg.Count, nil
}
