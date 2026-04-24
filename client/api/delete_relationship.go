package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// DeleteRelationship removes the directed relationship from sourceUUID to targetUUID.
func DeleteRelationship(sourceUUID, targetUUID []byte) error {
	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	req := connect.NewRequest(&drawv1.DeleteRelationshipRequest{
		SourceUuid: sourceUUID,
		TargetUuid: targetUUID,
	})
	if _, err := client.DeleteRelationship(context.Background(), req); err != nil {
		return fmt.Errorf("DeleteRelationship failed: %w", err)
	}
	return nil
}
