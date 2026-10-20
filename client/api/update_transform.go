package api

import (
	"github.com/viamrobotics/visualization/draw"
)

// UpdateTransformOptions configures an UpdateTransform call.
type UpdateTransformOptions struct {
	// UUID identifies the transform to update. Required.
	UUID []byte
	// Update names the fields to change. Fields left nil keep their stored values.
	Update draw.TransformUpdate
}

// UpdateTransform changes some of a stored transform's fields, leaving the rest alone.
// Shorthand for UpdateEntity with a draw.TransformUpdate. See UpdateEntity for details.
func UpdateTransform(options UpdateTransformOptions) error {
	return UpdateEntity(UpdateEntityOptions{UUID: options.UUID, Update: options.Update})
}

// UpdateDrawingOptions configures an UpdateDrawing call.
type UpdateDrawingOptions struct {
	// UUID identifies the drawing to update. Required.
	UUID []byte
	// Update names the fields to change. Fields left nil keep their stored values.
	Update draw.DrawingUpdate
}

// UpdateDrawing changes some of a stored drawing's fields, leaving the rest alone.
// Shorthand for UpdateEntity with a draw.DrawingUpdate. See UpdateEntity for details.
func UpdateDrawing(options UpdateDrawingOptions) error {
	return UpdateEntity(UpdateEntityOptions{UUID: options.UUID, Update: options.Update})
}
