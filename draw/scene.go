package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viam-labs/motion-tools/gen/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
)

var (
	// DefaultSceneCamera is the default scene camera, defaults to a perspective camera with a position of [3000, 3000, 3000] and a look_at of [0, 0, 0]
	DefaultSceneCamera = SceneCamera{
		// Top-down view: directly above origin (in mm)
		Position: r3.Vector{X: 3000, Y: 3000, Z: 3000},
		// Look at the origin
		LookAt:            r3.Vector{X: 0, Y: 0, Z: 0},
		Animated:          false,
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

type sceneCameraConfig struct {
	animated           bool
	perspectiveCamera  *drawv1.PerspectiveCamera
	orthographicCamera *drawv1.OrthographicCamera
}

func newSceneCameraConfig() *sceneCameraConfig {
	return &sceneCameraConfig{
		perspectiveCamera: &drawv1.PerspectiveCamera{},
	}
}

type sceneCameraOption func(*sceneCameraConfig)

func WithPerspectiveCamera(perspectiveCamera *drawv1.PerspectiveCamera) sceneCameraOption {
	return func(config *sceneCameraConfig) {
		config.perspectiveCamera = perspectiveCamera
	}
}

func WithOrthographicCamera(orthographicCamera *drawv1.OrthographicCamera) sceneCameraOption {
	return func(config *sceneCameraConfig) {
		config.orthographicCamera = orthographicCamera
	}
}

func WithAnimated(animated bool) sceneCameraOption {
	return func(config *sceneCameraConfig) {
		config.animated = animated
	}
}

// NewSceneCamera creates a new SceneCamera
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

type sceneMetadataOption func(*sceneMetadataConfig)

func WithSceneCamera(sceneCamera SceneCamera) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.sceneCamera = sceneCamera
	}
}

func WithGrid(grid bool) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.grid = grid
	}
}

func WithGridCellSize(gridCellSize float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.gridCellSize = gridCellSize
	}
}

func WithGridSectionSize(gridSectionSize float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.gridSectionSize = gridSectionSize
	}
}

func WithGridFadeDistance(gridFadeDistance float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.gridFadeDistance = gridFadeDistance
	}
}

func WithScenePointSize(pointSize float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.pointSize = pointSize
	}
}

func WithScenePointColor(pointColor Color) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.pointColor = pointColor
	}
}

func WithSceneLineWidth(lineWidth float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.lineWidth = lineWidth
	}
}

func WithSceneLinePointSize(linePointSize float32) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.linePointSize = linePointSize
	}
}

func WithRenderArmModels(renderArmModels drawv1.RenderArmModels) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.renderArmModels = renderArmModels
	}
}

func WithRenderShapes(renderShapes []drawv1.RenderShapes) sceneMetadataOption {
	return func(config *sceneMetadataConfig) {
		config.renderShapes = renderShapes
	}
}

// NewSceneMetadata creates a new SceneMetadata
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
		LinePointSize:    &metadata.LinePointSize,
		RenderArmModels:  &metadata.RenderArmModels,
		RenderShapes:     metadata.RenderShapes,
	}
}

// Validate validates scene metadata
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
