package api

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"

	"github.com/viamrobotics/visualization/client/server"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

// RemoveEntity removes a single drawn entity by UUID.
//
// Use this to drop entities that no longer exist rather than clearing the whole scene: the
// Draw* helpers return the UUIDs they assigned, so a redraw can diff against the previous
// batch and remove only what went away. Clearing and redrawing everything works too, but it
// publishes a change for every entity rather than only the ones that changed.
//
// Returns ErrVisualizerNotRunning if no visualizer is reachable, an error if uuid is empty,
// and a wrapped RPC error if the entity does not exist or the call fails.
func RemoveEntity(uuid []byte) error {
	if len(uuid) == 0 {
		return errors.New("uuid is required")
	}

	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	_, err := client.RemoveEntity(context.Background(), connect.NewRequest(&drawv1.RemoveEntityRequest{
		Uuid: uuid,
	}))
	if err != nil {
		return fmt.Errorf("RemoveEntity failed: %w", err)
	}

	return nil
}
