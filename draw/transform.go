package draw

import (
	"encoding/base64"

	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
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
	fields["colors"] = structpb.NewStringValue(base64.StdEncoding.EncodeToString(packColors(metadata.Colors)))
	fields["color_format"] = structpb.NewNumberValue(float64(drawv1.ColorFormat_COLOR_FORMAT_RGB))

	if opacity, uniform := metadata.opacitySummary(); uniform {
		fields["opacities"] = structpb.NewStringValue(base64.StdEncoding.EncodeToString([]byte{opacity}))
	} else {
		fields["opacities"] = structpb.NewStringValue(base64.StdEncoding.EncodeToString(packOpacities(metadata.Colors)))
	}

	fields["show_axes_helper"] = structpb.NewBoolValue(metadata.ShowAxesHelper)

	return &structpb.Struct{Fields: fields}
}

// StructToMetadata converts a Protocol Buffer structpb.Struct to a Metadata object.
// Returns an error if the metadata cannot be converted.
func StructToMetadata(structPb *structpb.Struct) (Metadata, error) {
	metadata := NewMetadata()
	if structPb.Fields["colors"] == nil {
		return metadata, nil
	}

	colorsBytes, err := base64.StdEncoding.DecodeString(structPb.Fields["colors"].GetStringValue())
	if err != nil {
		return NewMetadata(), err
	}

	var opacitiesBytes []byte
	if structPb.Fields["opacities"] != nil {
		opacitiesBytes, err = base64.StdEncoding.DecodeString(structPb.Fields["opacities"].GetStringValue())
		if err != nil {
			return NewMetadata(), err
		}
	}

	metadata.SetColors(unpackColors(colorsBytes, opacitiesBytes))

	if structPb.Fields["show_axes_helper"] != nil {
		show := structPb.Fields["show_axes_helper"].GetBoolValue()
		metadata.SetShowAxesHelper(show)
	}

	return metadata, nil
}
