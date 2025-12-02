package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viam-labs/motion-tools/gen/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
)

var (
	// DefaultSceneCamera is the default scene camera, defaults to a perspective camera with a position of [3000, 3000, 3000] and a look_at of [0, 0, 0]
	DefaultSceneCamera = &SceneCamera{
		// Top-down view: directly above origin (in mm)
		Position: r3.Vector{X: 3000, Y: 3000, Z: 3000},
		// Look at the origin
		LookAt:            r3.Vector{X: 0, Y: 0, Z: 0},
		PerspectiveCamera: &drawv1.PerspectiveCamera{},
	}

	// DefaultGridEnabled is the default enabled state of the grid, defaults to true
	DefaultGridEnabled = true
	// DefaultGridCellSize is the default cell size of the grid in millimeters, defaults to 0.5
	DefaultGridCellSize float32 = 500.0
	// DefaultGridSectionSize is the default section size of the grid in millimeters, defaults to 10.0
	DefaultGridSectionSize float32 = 10000.0
	// DefaultGridFadeDistance is the default fade distance of the grid in millimeters, defaults to 25.0
	DefaultGridFadeDistance float32 = 25000.0
)

// SceneCamera represents a scene camera
type SceneCamera struct {
	// The position of the camera in millimeters
	Position r3.Vector
	// The look at point of the camera in millimeters
	LookAt r3.Vector
	// Whether to animate the camera
	Animated bool
	// The perspective camera configuration
	PerspectiveCamera *drawv1.PerspectiveCamera
	// The orthographic camera configuration
	OrthographicCamera *drawv1.OrthographicCamera
}

// NewSceneCamera creates a new SceneCamera
func NewSceneCamera(position r3.Vector, lookAt r3.Vector, animate bool) *SceneCamera {
	return &SceneCamera{
		Position:          position,
		LookAt:            lookAt,
		Animated:          animate,
		PerspectiveCamera: &drawv1.PerspectiveCamera{},
	}
}

// Perspective sets the perspective camera configuration
func (camera *SceneCamera) Perspective(perspectiveCamera *drawv1.PerspectiveCamera) *SceneCamera {
	camera.PerspectiveCamera = perspectiveCamera
	return camera
}

// Orthographic sets the orthographic camera configuration
func (camera *SceneCamera) Orthographic(orthographicCamera *drawv1.OrthographicCamera) *SceneCamera {
	camera.OrthographicCamera = orthographicCamera
	return camera
}

// Animate sets the animate flag
func (camera *SceneCamera) Animate(animate bool) *SceneCamera {
	camera.Animated = animate
	return camera
}

// ToProto converts a SceneCamera to a protobuf SceneCamera
func (camera *SceneCamera) ToProto() *drawv1.SceneCamera {
	position := &commonv1.Vector3{X: camera.Position.X, Y: camera.Position.Y, Z: camera.Position.Z}
	lookAt := &commonv1.Vector3{X: camera.LookAt.X, Y: camera.LookAt.Y, Z: camera.LookAt.Z}

	if camera.PerspectiveCamera != nil {
		return &drawv1.SceneCamera{
			Position:   position,
			LookAt:     lookAt,
			Animated:   &camera.Animated,
			CameraType: &drawv1.SceneCamera_PerspectiveCamera{},
		}
	}

	return &drawv1.SceneCamera{
		Position:   position,
		LookAt:     lookAt,
		Animated:   &camera.Animated,
		CameraType: &drawv1.SceneCamera_OrthographicCamera{},
	}
}

// SceneMetadata represents the metadata of a scene
type SceneMetadata struct {
	SceneCamera      *SceneCamera
	Grid             bool
	GridCellSize     float32
	GridSectionSize  float32
	GridFadeDistance float32
	PointSize        float32
	PointColor       *Color
	LineWidth        float32
	LineDotSize      float32
	RenderArmModels  drawv1.RenderArmModels
	RenderShapes     []drawv1.RenderShapes
	Units            Units
}

// ToProto converts a SceneMetadata to a protobuf SceneMetadata
func (metadata *SceneMetadata) ToProto() *drawv1.SceneMetadata {
	return &drawv1.SceneMetadata{
		SceneCamera:      metadata.SceneCamera.ToProto(),
		Grid:             &metadata.Grid,
		GridCellSize:     &metadata.GridCellSize,
		GridSectionSize:  &metadata.GridSectionSize,
		GridFadeDistance: &metadata.GridFadeDistance,
		PointSize:        &metadata.PointSize,
		PointColor:       []float32{metadata.PointColor.R, metadata.PointColor.G, metadata.PointColor.B, metadata.PointColor.A},
		LineWidth:        &metadata.LineWidth,
		LineDotSize:      &metadata.LineDotSize,
		RenderArmModels:  &metadata.RenderArmModels,
		RenderShapes:     metadata.RenderShapes,
	}
}

// NewSceneMetadata creates a new SceneMetadata
func NewSceneMetadata(units Units) SceneMetadata {
	sceneCamera := DefaultSceneCamera
	gridCellSize := DefaultGridCellSize
	gridSectionSize := DefaultGridSectionSize
	gridFadeDistance := DefaultGridFadeDistance
	pointSize := DefaultPointSize
	lineWidth := DefaultLineWidth
	lineDotSize := DefaultPointSize

	metadata := SceneMetadata{
		SceneCamera:      sceneCamera,
		Grid:             DefaultGridEnabled,
		GridCellSize:     gridCellSize,
		GridSectionSize:  gridSectionSize,
		GridFadeDistance: gridFadeDistance,
		PointSize:        pointSize,
		PointColor:       DefaultPointColor,
		LineWidth:        lineWidth,
		LineDotSize:      lineDotSize,
		RenderArmModels:  drawv1.RenderArmModels_RENDER_ARM_MODELS_COLLIDERS_AND_MODEL,
		RenderShapes:     []drawv1.RenderShapes{drawv1.RenderShapes_RENDER_SHAPES_ARROWS, drawv1.RenderShapes_RENDER_SHAPES_POINTS, drawv1.RenderShapes_RENDER_SHAPES_LINES, drawv1.RenderShapes_RENDER_SHAPES_MODEL},
		Units:            units,
	}

	if units == UnitsM {
		metadata.toMeters()
	}

	return metadata
}

// SetSceneCameraPosition sets the position of the scene camera, in millimeters
func (metadata *SceneMetadata) SetSceneCameraPosition(position r3.Vector) {
	if metadata.Units == UnitsM {
		position = vectorToMeters(position)
	}

	metadata.SceneCamera.Position = position
}

// SetSceneCameraLookAt sets the look at point of the scene camera, in millimeters
func (metadata *SceneMetadata) SetSceneCameraLookAt(lookAt r3.Vector) {
	if metadata.Units == UnitsM {
		lookAt = vectorToMeters(lookAt)
	}

	metadata.SceneCamera.LookAt = lookAt
}

// SetPerspectiveSceneCamera sets the perspective camera configuration
func (metadata *SceneMetadata) SetPerspectiveSceneCamera(perspectiveCamera *drawv1.PerspectiveCamera) {
	metadata.SceneCamera.PerspectiveCamera = perspectiveCamera
}

// SetOrthographicSceneCamera sets the orthographic camera configuration
func (metadata *SceneMetadata) SetOrthographicSceneCamera(orthographicCamera *drawv1.OrthographicCamera) {
	metadata.SceneCamera.OrthographicCamera = orthographicCamera
}

// SetGrid sets the enabled state of the grid
func (metadata *SceneMetadata) SetGrid(grid bool) {
	metadata.Grid = grid
}

// SetGridCellSize sets the cell size of the grid, in millimeters
func (metadata *SceneMetadata) SetGridCellSize(gridCellSize float32) {
	if metadata.Units == UnitsM {
		gridCellSize = float32ToMeters(gridCellSize)
	}

	metadata.GridCellSize = gridCellSize
}

// SetGridSectionSize sets the section size of the grid, in millimeters
func (metadata *SceneMetadata) SetGridSectionSize(gridSectionSize float32) {
	if metadata.Units == UnitsM {
		gridSectionSize = float32ToMeters(gridSectionSize)
	}

	metadata.GridSectionSize = gridSectionSize
}

// SetGridFadeDistance sets the fade distance of the grid, in millimeters
func (metadata *SceneMetadata) SetGridFadeDistance(gridFadeDistance float32) {
	if metadata.Units == UnitsM {
		gridFadeDistance = float32ToMeters(gridFadeDistance)
	}

	metadata.GridFadeDistance = gridFadeDistance
}

// SetPointSize sets the size of the points, in millimeters
func (metadata *SceneMetadata) SetPointSize(pointSize float32) {
	if metadata.Units == UnitsM {
		pointSize = float32ToMeters(pointSize)
	}

	metadata.PointSize = pointSize
}

// SetPointColor sets the color of the points
func (metadata *SceneMetadata) SetPointColor(pointColor *Color) {
	metadata.PointColor = pointColor
}

// SetLineWidth sets the width of the lines, in millimeters
func (metadata *SceneMetadata) SetLineWidth(lineWidth float32) {
	if metadata.Units == UnitsM {
		lineWidth = float32ToMeters(lineWidth)
	}

	metadata.LineWidth = lineWidth
}

// SetLineDotSize sets the size of the dots, in millimeters
func (metadata *SceneMetadata) SetLineDotSize(lineDotSize float32) {
	if metadata.Units == UnitsM {
		lineDotSize = float32ToMeters(lineDotSize)
	}

	metadata.LineDotSize = lineDotSize
}

// SetRenderArmModels sets the render arm models
func (metadata *SceneMetadata) SetRenderArmModels(renderArmModels drawv1.RenderArmModels) {
	metadata.RenderArmModels = renderArmModels
}

// SetRenderShapes sets the render shapes
func (metadata *SceneMetadata) SetRenderShapes(renderShapes []drawv1.RenderShapes) {
	metadata.RenderShapes = renderShapes
}

// Validate validates scene metadata
func (metadata *SceneMetadata) Validate() error {
	if metadata.SceneCamera != nil {
		if metadata.SceneCamera.PerspectiveCamera == nil && metadata.SceneCamera.OrthographicCamera == nil {
			return fmt.Errorf("scene camera type is nil")
		}
	}

	// Validate positive values for size-related fields
	if metadata.GridCellSize <= 0 {
		return fmt.Errorf("grid cell size must be positive, got %f", metadata.GridCellSize)
	}
	if metadata.GridSectionSize <= 0 {
		return fmt.Errorf("grid section size must be positive, got %f", metadata.GridSectionSize)
	}
	if metadata.GridFadeDistance < 0 {
		return fmt.Errorf("grid fade distance must be non-negative, got %f", metadata.GridFadeDistance)
	}
	if metadata.PointSize <= 0 {
		return fmt.Errorf("point size must be positive, got %f", metadata.PointSize)
	}
	if metadata.LineWidth <= 0 {
		return fmt.Errorf("line width must be positive, got %f", metadata.LineWidth)
	}
	if metadata.LineDotSize <= 0 {
		return fmt.Errorf("line dot size must be positive, got %f", metadata.LineDotSize)
	}

	if metadata.RenderArmModels != drawv1.RenderArmModels_RENDER_ARM_MODELS_COLLIDERS_AND_MODEL &&
		metadata.RenderArmModels != drawv1.RenderArmModels_RENDER_ARM_MODELS_COLLIDERS &&
		metadata.RenderArmModels != drawv1.RenderArmModels_RENDER_ARM_MODELS_MODEL {
		return fmt.Errorf("invalid render arm models value: %s", metadata.RenderArmModels)
	}

	for _, shape := range metadata.RenderShapes {
		if shape != drawv1.RenderShapes_RENDER_SHAPES_ARROWS &&
			shape != drawv1.RenderShapes_RENDER_SHAPES_POINTS &&
			shape != drawv1.RenderShapes_RENDER_SHAPES_LINES &&
			shape != drawv1.RenderShapes_RENDER_SHAPES_MODEL {
			return fmt.Errorf("invalid render shapes value: %s", shape)
		}
	}

	return nil
}

// toMeters converts the scene metadata to meters
func (metadata *SceneMetadata) toMeters() {
	if metadata.Units == UnitsM {
		metadata.SceneCamera.Position = vectorToMeters(metadata.SceneCamera.Position)
		metadata.SceneCamera.LookAt = vectorToMeters(metadata.SceneCamera.LookAt)
		metadata.GridCellSize = float32ToMeters(metadata.GridCellSize)
		metadata.GridSectionSize = float32ToMeters(metadata.GridSectionSize)
		metadata.GridFadeDistance = float32ToMeters(metadata.GridFadeDistance)
		metadata.PointSize = float32ToMeters(metadata.PointSize)
		metadata.LineWidth = float32ToMeters(metadata.LineWidth)
		metadata.LineDotSize = float32ToMeters(metadata.LineDotSize)
	}
}
