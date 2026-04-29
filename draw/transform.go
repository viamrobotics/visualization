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

	metadata := config.BuildMetadata(metadataOpts...)
	transform.Metadata = MetadataToStruct(metadata)

	if geometry != nil {
		transform.PhysicalObject = geometryToProtobuf(geometry)
	}

	return transform
}

// MetadataToStruct converts drawing Metadata to a Protocol Buffer structpb.Struct suitable
// for embedding in transforms.
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
	fields["invisible"] = structpb.NewBoolValue(metadata.Invisible)

	return &structpb.Struct{Fields: fields}
}

// StructToMetadata converts a Protocol Buffer structpb.Struct to a Metadata object.
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

	if v := structPb.Fields["show_axes_helper"]; v != nil {
		metadata.SetShowAxesHelper(v.GetBoolValue())
	}
	if v := structPb.Fields["invisible"]; v != nil {
		metadata.SetInvisible(v.GetBoolValue())
	}

	return metadata, nil
}

// RelationshipsFromStruct extracts the "relationships" list from a structpb.Struct
// that is used as a Transform's metadata.
func RelationshipsFromStruct(s *structpb.Struct) []*drawv1.Relationship {
	if s == nil {
		return nil
	}
	v := s.Fields["relationships"]
	if v == nil {
		return nil
	}
	lv := v.GetListValue()
	if lv == nil {
		return nil
	}

	rels := make([]*drawv1.Relationship, 0, len(lv.Values))
	for _, item := range lv.Values {
		sv := item.GetStructValue()
		if sv == nil {
			continue
		}
		rel := &drawv1.Relationship{}
		if tgt := sv.Fields["target_uuid"]; tgt != nil {
			decoded, err := base64.StdEncoding.DecodeString(tgt.GetStringValue())
			if err == nil {
				rel.TargetUuid = decoded
			}
		}
		if t := sv.Fields["type"]; t != nil {
			rel.Type = t.GetStringValue()
		}
		if im := sv.Fields["index_mapping"]; im != nil {
			s := im.GetStringValue()
			rel.IndexMapping = &s
		}
		rels = append(rels, rel)
	}
	return rels
}

// SetRelationshipsOnStruct writes the "relationships" field into a structpb.Struct
// used as a Transform's metadata.
func SetRelationshipsOnStruct(s *structpb.Struct, rels []*drawv1.Relationship) {
	if s == nil {
		return
	}
	if len(rels) == 0 {
		delete(s.Fields, "relationships")
		return
	}

	items := make([]*structpb.Value, 0, len(rels))
	for _, rel := range rels {
		fields := map[string]*structpb.Value{
			"target_uuid": structpb.NewStringValue(base64.StdEncoding.EncodeToString(rel.TargetUuid)),
			"type":        structpb.NewStringValue(rel.Type),
		}
		if rel.IndexMapping != nil {
			fields["index_mapping"] = structpb.NewStringValue(*rel.IndexMapping)
		}
		items = append(items, structpb.NewStructValue(&structpb.Struct{Fields: fields}))
	}
	s.Fields["relationships"] = structpb.NewListValue(&structpb.ListValue{Values: items})
}
