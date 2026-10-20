package kinematics

import (
	"github.com/google/uuid"
	commonpb "go.viam.com/api/common/v1"
)

const worldFrame = "world"

// transformNamespace seeds the stable transform uuids.
var transformNamespace = uuid.MustParse("5b0e0c7e-6f6e-4a52-9c1e-6d0f4a3a7b11")

// stableUUID returns the same uuid bytes for the same reference frame.
func stableUUID(referenceFrame string) []byte {
	id := uuid.NewSHA1(transformNamespace, []byte(referenceFrame))
	return id[:]
}

// frameTransform builds a transform of referenceFrame at pose relative to parent. object may be nil,
// and its own center is kept, because it is the geometry's offset within the frame.
func frameTransform(referenceFrame, parent string, pose *commonpb.Pose, object *commonpb.Geometry) *commonpb.Transform {
	return &commonpb.Transform{
		ReferenceFrame:      referenceFrame,
		PoseInObserverFrame: &commonpb.PoseInFrame{ReferenceFrame: parent, Pose: pose},
		PhysicalObject:      object,
		Uuid:                stableUUID(referenceFrame),
	}
}
