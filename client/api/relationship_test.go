package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/google/uuid"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

var entityIDNamespace = uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

func entityUUIDFromID(id string) []byte {
	derived := uuid.NewSHA1(entityIDNamespace, []byte(id))
	return derived[:]
}

func TestRelationships(t *testing.T) {
	startTestServer(t)

	const sourceID = "rel-source"
	const targetID = "rel-target"

	createEntities := func(t *testing.T) {
		t.Helper()

		sourceBox, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: -300, Y: 0, Z: 300},
				&spatialmath.OrientationVectorDegrees{OZ: 1},
			),
			r3.Vector{X: 200, Y: 200, Z: 200},
			sourceID,
		)
		test.That(t, err, test.ShouldBeNil)
		_, err = DrawGeometry(DrawGeometryOptions{
			ID:       sourceID,
			Geometry: sourceBox,
			Color:    draw.ColorFromName("red"),
		})
		test.That(t, err, test.ShouldBeNil)

		targetBox, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 300, Y: 0, Z: 300},
				&spatialmath.OrientationVectorDegrees{OZ: 1},
			),
			r3.Vector{X: 200, Y: 200, Z: 200},
			targetID,
		)
		test.That(t, err, test.ShouldBeNil)
		_, err = DrawGeometry(DrawGeometryOptions{
			ID:       targetID,
			Geometry: targetBox,
			Color:    draw.ColorFromName("blue"),
		})
		test.That(t, err, test.ShouldBeNil)
	}

	t.Run("Setup", func(t *testing.T) {
		createEntities(t)
	})

	t.Run("CreateRelationship", func(t *testing.T) {
		err := CreateRelationship(CreateRelationshipOptions{
			SourceUUID:   entityUUIDFromID(sourceID),
			TargetUUID:   entityUUIDFromID(targetID),
			Type:         "HoverLink",
			IndexMapping: "index",
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("DeleteRelationship", func(t *testing.T) {
		err := DeleteRelationship(DeleteRelationshipOptions{
			SourceUUID: entityUUIDFromID(sourceID),
			TargetUUID: entityUUIDFromID(targetID),
		})
		test.That(t, err, test.ShouldBeNil)
	})
}
