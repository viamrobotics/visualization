package draw

import (
	"encoding/base64"
	"fmt"

	"github.com/google/uuid"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"google.golang.org/protobuf/types/known/structpb"
)

// transformNamespace is the namespace UUID used for deterministic transform ID generation
var transformNamespace = uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

// NewTransform creates a Viam Transform representing an object in 3D space.
func NewTransform(
	id string,
	name string,
	parent string,
	pose spatialmath.Pose,
	geometry spatialmath.Geometry,
	metadata *structpb.Struct,
) *commonv1.Transform {
	var idBytes []byte
	if id == "" {
		// If the id is empty, generate a deterministic UUID based on name and parent
		key := fmt.Sprintf("%s:%s", name, parent)
		newId := uuid.NewSHA1(transformNamespace, []byte(key))
		idBytes = newId[:]
	} else if parsedId, err := uuid.Parse(id); err == nil {
		// If the id is a UUID, use it
		idBytes = parsedId[:]
	} else {
		// If the id is not a UUID, use it to generate a new UUID
		newId := uuid.NewSHA1(transformNamespace, []byte(id))
		idBytes = newId[:]
	}

	poseInFrame := poseInFrameToProtobuf(pose, parent)
	transform := &commonv1.Transform{
		Uuid:                idBytes,
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
	// TODO: add other metadata fields

	return metadata, nil
}
