package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
)

var (
	// DefaultSceneCamera is the default camera configuration with a perspective view from position
	// [3000, 3000, 3000]mm looking at the origin. Provides an isometric-style view of the scene.
	DefaultSceneCamera = SceneCamera{
		Position:          r3.Vector{X: 3000, Y: 3000, Z: 3000}, // Position in millimeters
		LookAt:            r3.Vector{X: 0, Y: 0, Z: 0},          // Look at origin
		Animated:          false,
		PerspectiveCamera: &drawv1.PerspectiveCamera{},
	}

	// DefaultGridEnabled specifies whether the grid is visible by default.
	DefaultGridEnabled = true
	// DefaultGridCellSize is the default grid cell size in millimeters (500mm = 0.5m).
	DefaultGridCellSize float32 = 500.0
	// DefaultGridSectionSize is the default grid section size in millimeters (10000mm = 10m).
	DefaultGridSectionSize float32 = 10000.0
	// DefaultGridFadeDistance is the default distance at which the grid fades out (25000mm = 25m).
	DefaultGridFadeDistance float32 = 25000.0
)

// SceneCamera configures the viewpoint for rendering a 3D scene. Supports both perspective
// and orthographic projection modes. Exactly one of PerspectiveCamera or OrthographicCamera must be set.
type SceneCamera struct {
	// Position is the camera location in millimeters (world coordinates).
	Position r3.Vector
	// LookAt is the point the camera is aimed at in millimeters (world coordinates).
	LookAt r3.Vector
	// Animated enables camera rotation animation when true.
	Animated bool
	// PerspectiveCamera configures perspective projection (objects appear smaller with distance).
	PerspectiveCamera *drawv1.PerspectiveCamera
	// OrthographicCamera configures orthographic projection (parallel projection, no perspective).
	OrthographicCamera *drawv1.OrthographicCamera
}

// sceneCameraConfig is a configuration for a scene camera
type sceneCameraConfig struct {
	animated           bool
	perspectiveCamera  *drawv1.PerspectiveCamera
	orthographicCamera *drawv1.OrthographicCamera
}

// newSceneCameraConfig creates a new scene camera configuration
//
// Returns the scene camera configuration
func newSceneCameraConfig() *sceneCameraConfig {
	return &sceneCameraConfig{
		perspectiveCamera: &drawv1.PerspectiveCamera{},
	}
}

// sceneCameraOption is a function that configures a scene camera configuration
type sceneCameraOption func(*sceneCameraConfig)

// WithPerspectiveCamera creates a camera option that configures perspective projection.
func WithPerspectiveCamera(perspectiveCamera *drawv1.PerspectiveCamera) sceneCameraOption {
	return func(config *sceneCameraConfig) {
		config.perspectiveCamera = perspectiveCamera
	}
}

// WithOrthographicCamera creates a camera option that configures orthographic projection.
func WithOrthographicCamera(orthographicCamera *drawv1.OrthographicCamera) sceneCameraOption {
	return func(config *sceneCameraConfig) {
		config.orthographicCamera = orthographicCamera
	}
}

// WithAnimated creates a camera option that enables or disables camera rotation animation.
func WithAnimated(animated bool) sceneCameraOption {
	return func(config *sceneCameraConfig) {
		config.animated = animated
	}
}

// NewSceneCamera creates a new camera configuration with the specified position and look-at point
// (both in millimeters). By default, creates a perspective camera.
func NewSceneCamera(position r3.Vector, lookAt r3.Vector, options ...sceneCameraOption) SceneCamera {
	config := newSceneCameraConfig()
	for _, option := range options {
		option(config)
	}

	return SceneCamera{
		Position:           position,
		LookAt:             lookAt,
		Animated:           config.animated,
		PerspectiveCamera:  config.perspectiveCamera,
		OrthographicCamera: config.orthographicCamera,
	}
}

// ToProto converts the SceneCamera to its Protocol Buffer representation for serialization.
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

// SceneMetadata contains global configuration for rendering a 3D scene, including camera settings,
// grid display options, default rendering styles, and visibility flags for different shape types.
type SceneMetadata struct {
	SceneCamera      SceneCamera
	Grid             bool
	GridCellSize     float32
	GridSectionSize  float32
	GridFadeDistance float32
	PointSize        float32
	PointColor       Color
	LineWidth        float32
	LinePointSize    float32
	RenderArmModels  drawv1.RenderArmModels
	RenderShapes     []drawv1.RenderShapes
}

// sceneMetadataConfig is a configuration for a scene metadata
type sceneMetadataConfig struct {
	sceneCamera      SceneCamera
	grid             bool
	gridCellSize     float32
	gridSectionSize  float32
	gridFadeDistance float32
	pointSize        float32
	pointColor       Color
	lineWidth        float32
	linePointSize    float32
	renderArmModels  drawv1.RenderArmModels
	renderShapes     []drawv1.RenderShapes
}

// newSceneMetadataConfig creates a new scene metadata configuration
//
// Returns the scene metadata configuration
func newSceneMetadataConfig() *sceneMetadataConfig {
	return &sceneMetadataConfig{
		sceneCamera:      DefaultSceneCamera,
		grid:             DefaultGridEnabled,
		gridCellSize:     DefaultGridCellSize,
		gridSectionSize:  DefaultGridSectionSize,
		gridFadeDistance: DefaultGridFadeDistance,
		pointSize:        DefaultPointSize,
		pointColor:       DefaultPointColor,
		lineWidth:        DefaultLineWidth,
		linePointSize:    DefaultPointSize,
		renderArmModels:  drawv1.RenderArmModels_RENDER_ARM_MODELS_COLLIDERS_AND_MODEL,
		renderShapes:     []drawv1.RenderShapes{drawv1.RenderShapes_RENDER_SHAPES_ARROWS, drawv1.RenderShapes_RENDER_SHAPES_POINTS, drawv1.RenderShapes_RENDER_SHAPES_LINES, drawv1.RenderShapes_RENDER_SHAPES_MODEL},
	}
}

// sceneMetadataOption is a function that configures a scene metadata configuration
type sceneMetadataOption func(*sceneMetadataConfig)

// WithSceneCamera creates a metadata option that sets the scene camera configuration.
func WithSceneCamera(sceneCamera SceneCamera) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.sceneCamera = sceneCamera
	}
}

// WithGrid creates a metadata option that enables or disables the grid display.
func WithGrid(grid bool) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.grid = grid
	}
}

// WithGridCellSize creates a metadata option that sets the grid cell size in millimeters.
func WithGridCellSize(gridCellSize float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.gridCellSize = gridCellSize
	}
}

// WithGridSectionSize creates a metadata option that sets the grid section size in millimeters.
// Sections are typically rendered with thicker or differently colored lines.
func WithGridSectionSize(gridSectionSize float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.gridSectionSize = gridSectionSize
	}
}

// WithGridFadeDistance creates a metadata option that sets the distance at which the grid
// fades out in millimeters. Helps improve visibility at different scales.
func WithGridFadeDistance(gridFadeDistance float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.gridFadeDistance = gridFadeDistance
	}
}

// WithScenePointSize creates a metadata option that sets the default point size in millimeters
// for all points in the scene (can be overridden per-object).
func WithScenePointSize(pointSize float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.pointSize = pointSize
	}
}

// WithScenePointColor creates a metadata option that sets the default point color for all
// points in the scene (can be overridden per-object).
func WithScenePointColor(pointColor Color) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.pointColor = pointColor
	}
}

// WithSceneLineWidth creates a metadata option that sets the default line width in millimeters
// for all lines in the scene (can be overridden per-object).
func WithSceneLineWidth(lineWidth float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.lineWidth = lineWidth
	}
}

// WithSceneLinePointSize creates a metadata option that sets the default size in millimeters
// for vertex points on lines (can be overridden per-object).
func WithSceneLinePointSize(linePointSize float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.linePointSize = linePointSize
	}
}

// WithRenderArmModels creates a metadata option that controls how robot arm models are rendered.
// Options include showing models, colliders, or both.
func WithRenderArmModels(renderArmModels drawv1.RenderArmModels) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.renderArmModels = renderArmModels
	}
}

// WithRenderShapes creates a metadata option that specifies which shape types to render.
// By default, all shape types (arrows, points, lines, models) are rendered.
func WithRenderShapes(renderShapes []drawv1.RenderShapes) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.renderShapes = renderShapes
	}
}

// NewSceneMetadata creates a new scene metadata configuration with sensible defaults
// (grid enabled, perspective camera, etc.) that can be customized with options.
func NewSceneMetadata(options ...sceneMetadataOption) SceneMetadata {
	config := newSceneMetadataConfig()
	for _, option := range options {
		option(config)
	}

	return SceneMetadata{
		SceneCamera:      config.sceneCamera,
		Grid:             config.grid,
		GridCellSize:     config.gridCellSize,
		GridSectionSize:  config.gridSectionSize,
		GridFadeDistance: config.gridFadeDistance,
		PointSize:        config.pointSize,
		PointColor:       config.pointColor,
		LineWidth:        config.lineWidth,
		LinePointSize:    config.linePointSize,
		RenderArmModels:  config.renderArmModels,
		RenderShapes:     config.renderShapes,
	}
}

// ToProto converts the SceneMetadata to its Protocol Buffer representation for serialization.
func (metadata *SceneMetadata) ToProto() *drawv1.SceneMetadata {
	return &drawv1.SceneMetadata{
		SceneCamera:      metadata.SceneCamera.ToProto(),
		Grid:             &metadata.Grid,
		GridCellSize:     &metadata.GridCellSize,
		GridSectionSize:  &metadata.GridSectionSize,
		GridFadeDistance: &metadata.GridFadeDistance,
		PointSize:        &metadata.PointSize,
		PointColor:       packColors([]Color{metadata.PointColor}),
		LineWidth:        &metadata.LineWidth,
		LinePointSize:    &metadata.LinePointSize,
		RenderArmModels:  &metadata.RenderArmModels,
		RenderShapes:     metadata.RenderShapes,
	}
}

// Validate checks that all scene metadata values are valid. Returns an error if any values
// are out of acceptable ranges (e.g., negative sizes) or invalid enum values.
func (metadata *SceneMetadata) Validate() error {
	if metadata.SceneCamera.PerspectiveCamera == nil && metadata.SceneCamera.OrthographicCamera == nil {
		return fmt.Errorf("scene camera type is nil")
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
	if metadata.LinePointSize <= 0 {
		return fmt.Errorf("line dot size must be positive, got %f", metadata.LinePointSize)
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
