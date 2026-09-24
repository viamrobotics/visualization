package api

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	"github.com/viamrobotics/visualization/client/server"
	"github.com/viamrobotics/visualization/draw"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

// UpdateEntityOptions configures an UpdateEntity call.
type UpdateEntityOptions struct {
	// UUID identifies the entity to update. Required. Draw calls return the UUIDs they
	// assigned; draw.WithID derives one deterministically from a string.
	UUID []byte
	// Update names the fields to change. Pass a draw.TransformUpdate or draw.DrawingUpdate;
	// fields left nil keep their stored values. Required.
	Update draw.EntityUpdate
}

// UpdateEntity changes some of a stored entity's fields, leaving the rest alone.
//
// Prefer this over redrawing when only part of an entity changes: a partial update is smaller
// on the wire, and the visualizer keeps its existing scene object rather than replacing it.
// The saving is largest for drawings, where a pose or color change avoids resending the whole
// payload.
//
// The field mask is derived from which fields the update sets, so callers never write proto
// field-path strings. An update that sets nothing is an error rather than a no-op, since an
// empty mask means "replace every field" and would wipe the stored entity.
//
// Returns ErrVisualizerNotRunning if no visualizer is reachable, an error if UUID or Update is
// missing or the update sets no fields, and a wrapped RPC error if the call fails. The service
// rejects updates that would change an entity's reference frame or its geometry or shape type;
// remove the entity and add a new one for those.
func UpdateEntity(options UpdateEntityOptions) error {
	if len(options.UUID) == 0 {
		return errors.New("UUID is required")
	}
	if options.Update == nil {
		return errors.New("Update is required")
	}

	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	req := &drawv1.UpdateEntityRequest{Uuid: options.UUID}
	paths, err := options.Update.ApplyTo(req)
	if err != nil {
		return err
	}
	req.UpdatedFields = &fieldmaskpb.FieldMask{Paths: paths}

	if _, err := client.UpdateEntity(context.Background(), connect.NewRequest(req)); err != nil {
		return fmt.Errorf("UpdateEntity RPC failed: %w", err)
	}

	return nil
}
