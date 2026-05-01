package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// CreateRelationshipOptions configures a CreateRelationship call.
type CreateRelationshipOptions struct {
	// SourceUUID identifies the entity the relationship originates from.
	SourceUUID []byte

	// TargetUUID identifies the entity the relationship points to.
	TargetUUID []byte

	// Type is a free-form string identifying the relationship kind (e.g. "HoverLink").
	Type string

	// IndexMapping is an optional filtrex expression. Empty defaults to the
	// server's "index" mapping.
	IndexMapping string
}

// CreateRelationship creates or replaces a directed relationship from
// options.SourceUUID to options.TargetUUID.
func CreateRelationship(options CreateRelationshipOptions) error {
	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	rel := &drawv1.Relationship{
		TargetUuid: options.TargetUUID,
		Type:       options.Type,
	}
	if options.IndexMapping != "" {
		rel.IndexMapping = &options.IndexMapping
	}

	req := connect.NewRequest(&drawv1.CreateRelationshipRequest{
		SourceUuid:   options.SourceUUID,
		Relationship: rel,
	})
	if _, err := client.CreateRelationship(context.Background(), req); err != nil {
		return fmt.Errorf("CreateRelationship failed: %w", err)
	}
	return nil
}
