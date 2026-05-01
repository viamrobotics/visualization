package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// DeleteRelationshipOptions configures a DeleteRelationship call.
type DeleteRelationshipOptions struct {
	// SourceUUID identifies the entity the relationship originates from.
	SourceUUID []byte

	// TargetUUID identifies the entity the relationship points to.
	TargetUUID []byte
}

// DeleteRelationship removes the directed relationship from options.SourceUUID
// to options.TargetUUID.
func DeleteRelationship(options DeleteRelationshipOptions) error {
	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	req := connect.NewRequest(&drawv1.DeleteRelationshipRequest{
		SourceUuid: options.SourceUUID,
		TargetUuid: options.TargetUUID,
	})
	if _, err := client.DeleteRelationship(context.Background(), req); err != nil {
		return fmt.Errorf("DeleteRelationship failed: %w", err)
	}
	return nil
}
