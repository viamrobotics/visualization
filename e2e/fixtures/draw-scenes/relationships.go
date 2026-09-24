package main

import (
	"fmt"

	"github.com/golang/geo/r3"
	"github.com/google/uuid"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
)

const (
	relationshipSourceID = "rel-source"
	relationshipTargetID = "rel-target"
)

// entityIDNamespace matches the namespace client/api derives an entity's UUID
// from, so these scenes can name an entity they drew in an earlier process
// without the service handing the UUID back.
var entityIDNamespace = uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

func entityUUIDFromID(id string) []byte {
	derived := uuid.NewSHA1(entityIDNamespace, []byte(id))
	return derived[:]
}

func drawRelationshipBox(id string, x float64, color string) error {
	box, err := spatialmath.NewBox(
		spatialmath.NewPose(
			r3.Vector{X: x, Y: 0, Z: 300},
			&spatialmath.OrientationVectorDegrees{OZ: 1},
		),
		r3.Vector{X: 200, Y: 200, Z: 200},
		id,
	)
	if err != nil {
		return fmt.Errorf("building %s: %w", id, err)
	}

	if _, err := api.DrawGeometry(api.DrawGeometryOptions{
		ID:       id,
		Geometry: box,
		Color:    draw.ColorFromName(color),
	}); err != nil {
		return fmt.Errorf("drawing %s: %w", id, err)
	}

	return nil
}

func relationshipsSetup(sceneEnv) error {
	if err := drawRelationshipBox(relationshipSourceID, -300, "red"); err != nil {
		return err
	}
	return drawRelationshipBox(relationshipTargetID, 300, "blue")
}

func relationshipsCreate(sceneEnv) error {
	if err := api.CreateRelationship(api.CreateRelationshipOptions{
		SourceUUID:   entityUUIDFromID(relationshipSourceID),
		TargetUUID:   entityUUIDFromID(relationshipTargetID),
		Type:         "HoverLink",
		IndexMapping: "index",
	}); err != nil {
		return fmt.Errorf("creating the relationship: %w", err)
	}
	return nil
}

func relationshipsDelete(sceneEnv) error {
	if err := api.DeleteRelationship(api.DeleteRelationshipOptions{
		SourceUUID: entityUUIDFromID(relationshipSourceID),
		TargetUUID: entityUUIDFromID(relationshipTargetID),
	}); err != nil {
		return fmt.Errorf("deleting the relationship: %w", err)
	}
	return nil
}
