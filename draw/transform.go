package draw

import (
	"encoding/base64"

	"github.com/google/uuid"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"google.golang.org/protobuf/types/known/structpb"
)

// NewTransform creates a Transform with optional geometry and optional metadata
// If units is nil, uses mm
func NewTransform(
	id string,
	name string,
	parent string,
	pose spatialmath.Pose,
	geometry spatialmath.Geometry,
	metadata *structpb.Struct,
	units Units,
) (*commonv1.Transform, error) {
	var idBytes []byte
	if id == "" {
		newId := uuid.New()
		idBytes = newId[:]
	} else {
		parsedId, err := uuid.Parse(id)
		if err != nil {
			return nil, err
		}
		idBytes = parsedId[:]
	}

	poseInFrame := poseInFrameToProtobuf(pose, parent, units)
	transform := &commonv1.Transform{
		Uuid:                idBytes,
		ReferenceFrame:      name,
		PoseInObserverFrame: poseInFrame,
		Metadata:            metadata,
	}

	// Only set PhysicalObject if geometry is provided
	if geometry != nil {
		transform.PhysicalObject = geometryToProtobuf(geometry, units)
	}

	return transform, nil
}

// MetadataToStruct converts drawing metadata (colors/alphas) into a Struct
func MetadataToStruct(metadata *Metadata) (*structpb.Struct, error) {
	fields := make(map[string]*structpb.Value)

	if metadata.Colors != nil {
		encoded := base64.StdEncoding.EncodeToString(packColors(metadata.Colors))
		fields["colors"] = structpb.NewStringValue(encoded)
	}

	return &structpb.Struct{Fields: fields}, nil
}
