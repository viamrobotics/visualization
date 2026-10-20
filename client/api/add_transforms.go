package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	commonv1 "go.viam.com/api/common/v1"

	"github.com/viamrobotics/visualization/draw/v1/drawv1connect"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

// addTransforms sends every transform to the visualizer in a single AddEntities call and
// returns the assigned UUIDs in order.
//
// Batching matters for the draw helpers that emit one transform per geometry: a frame system
// with a couple hundred geometries would otherwise cost a couple hundred sequential round
// trips per redraw.
func addTransforms(client drawv1connect.DrawServiceClient, transforms []*commonv1.Transform) ([][]byte, error) {
	if len(transforms) == 0 {
		return [][]byte{}, nil
	}

	entities := make([]*drawv1.AddEntityRequest, 0, len(transforms))
	for _, transform := range transforms {
		entities = append(entities, &drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: transform},
		})
	}

	resp, err := client.AddEntities(context.Background(), connect.NewRequest(&drawv1.AddEntitiesRequest{
		Entities: entities,
	}))
	if err != nil {
		return nil, fmt.Errorf("AddEntities RPC failed: %w", err)
	}

	return resp.Msg.GetUuids(), nil
}
