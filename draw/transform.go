package draw

import (
	"encoding/base64"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"google.golang.org/protobuf/types/known/structpb"
)

// TransformConfig is a configuration for a Transform.
type TransformConfig struct {
	uuidConfig
}

// TransformOption is a function that configures a Transform configuration.
type TransformOption func(*TransformConfig)

// newTransformConfig creates a new Transform configuration.
func newTransformConfig(name, parent string) *TransformConfig {
	return &TransformConfig{
		uuidConfig: newUuidConfig(name, parent),
	}
}

// WithUUID creates a Transform option that sets the UUID.
func WithTransformUUID(uuid []byte) TransformOption {
	return func(config *TransformConfig) {
		withUUID(uuid)(&config.uuidConfig)
	}
}

// WithTransformID creates a Transform option that sets the uuid based on the given id.
func WithTransformID(id string) TransformOption {
	return func(config *TransformConfig) {
		withID(id)(&config.uuidConfig)
	}
}

// NewTransform creates a Viam Transform representing an object in 3D space.
// The transform will have a UUID generated from the name and parent unless a UUID option is provided.
func NewTransform(
	name string,
	parent string,
	pose spatialmath.Pose,
	geometry spatialmath.Geometry,
	metadata *structpb.Struct,
	options ...TransformOption,
) *commonv1.Transform {
	config := newTransformConfig(name, parent)
	for _, option := range options {
		option(config)
	}

	poseInFrame := poseInFrameToProtobuf(pose, parent)
	transform := &commonv1.Transform{
		Uuid:                config.uuid,
		ReferenceFrame:      name,
		PoseInObserverFrame: poseInFrame,
		Metadata:            metadata,
	}

	// Only set PhysicalObject if geometry is provided
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
