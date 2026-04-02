package draw

import (
	"encoding/base64"

	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
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
	fields["colors"] = structpb.NewStringValue(base64.StdEncoding.EncodeToString(packColors(metadata.Colors)))
	fields["color_format"] = structpb.NewNumberValue(float64(drawv1.ColorFormat_COLOR_FORMAT_RGB))

	if opacity, uniform := metadata.opacitySummary(); uniform {
		fields["opacities"] = structpb.NewStringValue(base64.StdEncoding.EncodeToString([]byte{opacity}))
	} else {
		fields["opacities"] = structpb.NewStringValue(base64.StdEncoding.EncodeToString(packOpacities(metadata.Colors)))
	}

	return &structpb.Struct{Fields: fields}, nil
}

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
	return metadata, nil
}
