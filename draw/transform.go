package draw

import (
	"encoding/base64"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"google.golang.org/protobuf/types/known/structpb"
)

// NewTransform creates a Viam Transform representing an object in 3D space.
func NewTransform(config *DrawConfig, geometry spatialmath.Geometry, metadataOpts ...DrawMetadataOption) *commonv1.Transform {
	poseInFrame := poseInFrameToProtobuf(config.Pose, config.Parent)
	transform := &commonv1.Transform{
		Uuid:                config.UUID,
		ReferenceFrame:      config.Name,
		PoseInObserverFrame: poseInFrame,
	}

	metadataOpts = append([]DrawMetadataOption{WithMetadataAxesHelper(config.ShowAxesHelper)}, metadataOpts...)
	metadata := NewMetadata(metadataOpts...)
	transform.Metadata = MetadataToStruct(metadata)
	if geometry != nil {
		transform.PhysicalObject = geometryToProtobuf(geometry)
	}

	return transform
}

// MetadataToStruct converts drawing Metadata to a Protocol Buffer structpb.Struct.
// Returns an error if the metadata cannot be converted.
func MetadataToStruct(metadata Metadata) *structpb.Struct {
	fields := make(map[string]*structpb.Value)
	encoded := base64.StdEncoding.EncodeToString(packColors(metadata.Colors))
	fields["colors"] = structpb.NewStringValue(encoded)

	fields["show_axes_helper"] = structpb.NewBoolValue(metadata.ShowAxesHelper)

	return &structpb.Struct{Fields: fields}
}

// StructToMetadata converts a Protocol Buffer structpb.Struct to a Metadata object.
// Returns an error if the metadata cannot be converted.
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

	if structPb.Fields["show_axes_helper"] != nil {
		show := structPb.Fields["show_axes_helper"].GetBoolValue()
		metadata.SetShowAxesHelper(show)
	}

	return metadata, nil
}
