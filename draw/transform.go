package draw

import (
	"encoding/base64"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"google.golang.org/protobuf/types/known/structpb"
)

// NewTransform creates a Viam Transform representing an object in 3D space.
// The transform will have a UUID generated from the name and parent unless a UUID option is provided.
func NewTransform(
	uuid []byte,
	name string,
	parent string,
	pose spatialmath.Pose,
	geometry spatialmath.Geometry,
	metadata *structpb.Struct,
) *commonv1.Transform {
	poseInFrame := poseInFrameToProtobuf(pose, parent)
	transform := &commonv1.Transform{
		Uuid:                uuid,
		ReferenceFrame:      name,
		PoseInObserverFrame: poseInFrame,
		Metadata:            metadata,
	}

	if geometry != nil {
		transform.PhysicalObject = geometryToProtobuf(geometry)
	}

	return transform
}

// MetadataToStruct converts drawing Metadata to a Protocol Buffer structpb.Struct suitable
// for embedding in transforms. Colors are base64-encoded for efficient transmission.
// Returns an error if the metadata cannot be converted.
func MetadataToStruct(metadata Metadata) (*structpb.Struct, error) {
	fields := make(map[string]*structpb.Value)
	encoded := base64.StdEncoding.EncodeToString(packColors(metadata.Colors))
	fields["colors"] = structpb.NewStringValue(encoded)

	return &structpb.Struct{Fields: fields}, nil
}

func StructToMetadata(structPb *structpb.Struct) (Metadata, error) {
	metadata := NewMetadata()
	if structPb.Fields["colors"] != nil {
		encoded := structPb.Fields["colors"].GetStringValue()
		colorsBytes, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return NewMetadata(), err
		}
		colors := unpackColors(colorsBytes)
		metadata.SetColors(colors)
	}

	return metadata, nil
}
