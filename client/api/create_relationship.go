package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// CreateRelationship creates or replaces a directed relationship from sourceUUID to targetUUID.
// The type_ parameter is a free-form string (e.g. "HoverLink") and indexMapping is an optional
// filtrex expression (defaults to "index" on the server when empty).
func CreateRelationship(sourceUUID, targetUUID []byte, type_ string, indexMapping string) error {
	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	rel := &drawv1.Relationship{
		TargetUuid: targetUUID,
		Type:       type_,
	}
	if indexMapping != "" {
		rel.IndexMapping = &indexMapping
	}

	req := connect.NewRequest(&drawv1.CreateRelationshipRequest{
		SourceUuid:   sourceUUID,
		Relationship: rel,
	})
	if _, err := client.CreateRelationship(context.Background(), req); err != nil {
		return fmt.Errorf("CreateRelationship failed: %w", err)
	}
	return nil
}
