package api

import (
	"context"
	"fmt"
	"os"
	"time"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// RemoveAll clears all drawn items from the visualizer.
// Returns the number of items removed, or an error if the server is not running or the removal fails.
func RemoveAll() (int32, error) {
	// #region agent log
	{
		line := fmt.Sprintf("{\"sessionId\":\"23bd9f\",\"location\":\"remove_all.go:RemoveAll\",\"message\":\"stage1-remove-all\",\"data\":{},\"timestamp\":%d}\n", time.Now().UnixMilli())
		if f, err := os.OpenFile("/Users/devin/Projects/motion-tools/.cursor/debug-23bd9f.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil { f.WriteString(line); f.Close() }
	}
	// #endregion
	client := server.GetClient()
	if client == nil {
		return 0, ErrVisualizerNotRunning
	}

	req := connect.NewRequest(&drawv1.RemoveAllRequest{})
	resp, err := client.RemoveAll(context.Background(), req)
	if err != nil {
		return 0, fmt.Errorf("RemoveAll failed: %w", err)
	}

	return resp.Msg.TransformCount + resp.Msg.DrawingCount, nil
}
