package draw

import (
	"bytes"
	"compress/gzip"
	"fmt"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viamrobotics/visualization/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// Snapshot is a self-contained, serializable scene captured at a single point in
// time: a set of transforms (physical entities in the frame system), a set of
// drawings (non-physical visualizations), the scene's render metadata, and a
// stable UUID. Snapshots are produced by NewSnapshot, populated via the Draw*
// helpers, and serialized for delivery to the visualizer via MarshalJSON,
// MarshalBinary, or MarshalBinaryGzip.
type Snapshot struct {
	uuid          []byte
	transforms    []*commonv1.Transform
	drawings      []*Drawing
	sceneMetadata SceneMetadata
}

// UUID returns the snapshot's stable identifier as a 16-byte slice.
func (snapshot *Snapshot) UUID() []byte {
	return snapshot.uuid
}

// SetUUID overrides the snapshot's auto-generated UUID.
func (snapshot *Snapshot) SetUUID(id uuid.UUID) {
	snapshot.uuid = id[:]
}

func (snapshot *Snapshot) deriveEntityUUID(key string) []byte {
	var ns uuid.UUID
	copy(ns[:], snapshot.uuid)
	derived := uuid.NewSHA1(ns, []byte(key))
	return derived[:]
}

func entityKey(name, parent string) string {
	return name + ":" + parent
}

// Transforms returns the transforms (physical entities in the frame system) the
// snapshot has accumulated. The returned slice is the snapshot's own backing
// storage, so callers should not mutate it.
func (snapshot *Snapshot) Transforms() []*commonv1.Transform {
	return snapshot.transforms
}

// Drawings returns the drawings (non-physical visualizations) the snapshot has
// accumulated. The returned slice is the snapshot's own backing storage, so
// callers should not mutate it.
func (snapshot *Snapshot) Drawings() []*Drawing {
	return snapshot.drawings
}

// SceneMetadata returns the snapshot's scene-wide render configuration (camera,
// grid, default styles, and visibility flags).
func (snapshot *Snapshot) SceneMetadata() SceneMetadata {
	return snapshot.sceneMetadata
}

// ToProto converts the snapshot to a drawv1.Snapshot proto, serializing every
// drawing via Drawing.ToProto and the scene metadata via SceneMetadata.ToProto.
func (snapshot *Snapshot) ToProto() *drawv1.Snapshot {
	drawingProtos := make([]*drawv1.Drawing, len(snapshot.drawings))
	for i, drawing := range snapshot.drawings {
		drawingProtos[i] = drawing.ToProto()
	}

	return &drawv1.Snapshot{
		Transforms:    snapshot.transforms,
		Drawings:      drawingProtos,
		Uuid:          snapshot.uuid,
		SceneMetadata: snapshot.sceneMetadata.ToProto(),
	}
}

// MarshalJSON marshals the snapshot to JSON via protojson, emitting unpopulated
// fields so the output round-trips faithfully. JSON is the most human-readable
// format and is convenient for debugging. For delivery to the visualizer, prefer
// MarshalBinary or MarshalBinaryGzip.
func (snapshot *Snapshot) MarshalJSON() ([]byte, error) {
	marshaler := protojson.MarshalOptions{
		EmitUnpopulated: true,
	}

	return marshaler.Marshal(snapshot.ToProto())
}

// MarshalBinary marshals the snapshot to a compact binary protobuf payload. This
// is the recommended format when payload size matters but the consumer cannot
// decompress gzip. Otherwise prefer MarshalBinaryGzip.
func (snapshot *Snapshot) MarshalBinary() ([]byte, error) {
	return proto.Marshal(snapshot.ToProto())
}

// MarshalBinaryGzip marshals the snapshot to a gzip-compressed binary protobuf
// payload. This is the smallest of the three serialization formats and the best
// choice for transport over the network or storage on disk.
func (snapshot *Snapshot) MarshalBinaryGzip() ([]byte, error) {
	binaryData, err := snapshot.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("failed to marshal binary: %w", err)
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if _, err := gz.Write(binaryData); err != nil {
		return nil, fmt.Errorf("failed to write gzip data: %w", err)
	}
	if err := gz.Close(); err != nil {
		return nil, fmt.Errorf("failed to close gzip writer: %w", err)
	}

	return buf.Bytes(), nil
}

// NewSnapshot returns an empty Snapshot with a freshly generated UUID and the
// given scene-metadata options applied. Without any options, the snapshot uses
// the package-default scene metadata (perspective camera, grid enabled, every
// shape category visible).
func NewSnapshot(sceneOptions ...sceneMetadataOption) *Snapshot {
	uuidBytes := uuid.New()
	return &Snapshot{
		uuid:          uuidBytes[:],
		transforms:    []*commonv1.Transform{},
		drawings:      []*Drawing{},
		sceneMetadata: NewSceneMetadata(sceneOptions...),
	}
}

// Validate checks that the snapshot is well-formed: the receiver itself must be
// non-nil, the UUID must be exactly 16 bytes, the transforms and drawings slices
// must be non-nil (empty is fine), every transform must carry a reference frame
// and an observer-frame pose, every drawing must carry a name and pose, and the
// scene metadata must pass SceneMetadata.Validate. Returns the first failing
// condition wrapped with context.
func (snapshot *Snapshot) Validate() error {
	if snapshot == nil {
		return fmt.Errorf("snapshot is nil")
	}

	if len(snapshot.uuid) == 0 {
		return fmt.Errorf("snapshot UUID is empty")
	}

	if len(snapshot.uuid) != 16 {
		return fmt.Errorf("snapshot UUID must be 16 bytes, got %d", len(snapshot.uuid))
	}

	if snapshot.transforms == nil {
		return fmt.Errorf("snapshot transforms is nil")
	}

	if snapshot.drawings == nil {
		return fmt.Errorf("snapshot drawings is nil")
	}

	for i, transform := range snapshot.transforms {
		if transform == nil {
			return fmt.Errorf("transform at index %d is nil", i)
		}
		if transform.ReferenceFrame == "" {
			return fmt.Errorf("transform at index %d has empty reference frame", i)
		}
		if transform.PoseInObserverFrame == nil {
			return fmt.Errorf("transform at index %d has nil pose in observer frame", i)
		}
	}

	for i, drawing := range snapshot.drawings {
		if drawing == nil {
			return fmt.Errorf("drawing at index %d is nil", i)
		}
		if drawing.Name == "" {
			return fmt.Errorf("drawing at index %d has empty name", i)
		}
		if drawing.Pose == nil {
			return fmt.Errorf("drawing at index %d has nil pose in observer frame", i)
		}
	}

	if err := snapshot.sceneMetadata.Validate(); err != nil {
		return fmt.Errorf("invalid scene metadata: %w", err)
	}

	return nil
}

// DrawFrameSystemGeometries appends a transform per geometry in the frame system,
// evaluated at the given inputs. Returns one UUID per emitted transform.
func (snapshot *Snapshot) DrawFrameSystemGeometries(opts DrawFrameSystemGeometriesOptions) ([][]byte, error) {
	if opts.Colors == nil {
		opts.Colors = make(map[string]Color)
	}

	drawnFrameSystem := NewDrawnFrameSystem(opts.FrameSystem, opts.Inputs, WithFrameSystemColors(opts.Colors))
	if opts.ID != "" {
		drawnFrameSystem.ID = opts.ID
	} else {
		derived := snapshot.deriveEntityUUID(opts.FrameSystem.Name())
		var id uuid.UUID
		copy(id[:], derived)
		drawnFrameSystem.ID = id.String()
	}

	transforms, err := drawnFrameSystem.ToTransforms()
	if err != nil {
		return nil, err
	}

	snapshot.transforms = append(snapshot.transforms, transforms...)
	uuids := make([][]byte, len(transforms))
	for i, t := range transforms {
		uuids[i] = t.Uuid
	}
	return uuids, nil
}

// DrawFrame appends a single transform to the snapshot for a named frame attached
// to parent at pose, optionally carrying an attached geometry.
// Returns the entity UUID (16 bytes).
func (snapshot *Snapshot) DrawFrame(opts DrawFrameOptions) ([]byte, error) {
	drawOpts := snapshotDrawableOpts(opts.Name, opts.ID, opts.Parent, opts.Pose, opts.ShowAxesHelper, opts.Invisible, snapshot)
	config := NewDrawConfig(opts.Name, drawOpts...)
	transform := NewTransform(config, opts.Geometry)
	snapshot.transforms = append(snapshot.transforms, transform)
	return config.UUID, nil
}

// DrawGeometry appends a transform for the given geometry to the snapshot.
// Returns the entity UUID (16 bytes).
func (snapshot *Snapshot) DrawGeometry(opts DrawGeometryOptions) ([]byte, error) {
	name := opts.Name
	if name == "" {
		name = opts.Geometry.Label()
	}

	drawnGeometry, err := NewDrawnGeometry(opts.Geometry, WithGeometryColor(opts.Color))
	if err != nil {
		return nil, err
	}

	drawOpts := snapshotDrawableOpts(name, opts.ID, opts.Parent, opts.Pose, opts.ShowAxesHelper, opts.Invisible, snapshot)
	transform, err := drawnGeometry.Draw(name, drawOpts...)
	if err != nil {
		return nil, err
	}

	snapshot.transforms = append(snapshot.transforms, transform)
	return transform.Uuid, nil
}

// DrawArrows constructs Arrows from opts.Poses and appends the resulting drawing
// to the snapshot. Returns the entity UUID (16 bytes). Color slice count rules:
// 0 = DefaultArrowColor (green), 1 = shared, len(Poses) = per-arrow, other = palette cycle.
func (snapshot *Snapshot) DrawArrows(opts DrawArrowsOptions) ([]byte, error) {
	var arrowOpts []DrawArrowsOption
	nPoses := len(opts.Poses)
	nColors := len(opts.Colors)
	if nColors == 0 {
		arrowOpts = append(arrowOpts, WithSingleArrowColor(DefaultArrowColor))
	} else if nColors == 1 {
		arrowOpts = append(arrowOpts, WithSingleArrowColor(opts.Colors[0]))
	} else if nColors == nPoses {
		arrowOpts = append(arrowOpts, WithPerArrowColors(opts.Colors...))
	} else {
		arrowOpts = append(arrowOpts, WithArrowColorPalette(opts.Colors, nPoses))
	}

	arrows, err := NewArrows(opts.Poses, arrowOpts...)
	if err != nil {
		return nil, err
	}

	drawOpts := snapshotDrawableOpts(opts.Name, opts.ID, opts.Parent, opts.Pose, opts.ShowAxesHelper, opts.Invisible, snapshot)
	drawing := arrows.Draw(opts.Name, drawOpts...)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing.UUID, nil
}

// DrawLine constructs a Line from opts.Positions and appends the resulting drawing
// to the snapshot. Returns the entity UUID (16 bytes). Color slice count rules:
// 0 = default blue, 1 = shared, len(Positions) = per-vertex, other = palette cycle.
// DotColors follow the same rules and fall back to Colors when empty.
func (snapshot *Snapshot) DrawLine(opts DrawLineOptions) ([]byte, error) {
	posCount := len(opts.Positions)
	var lineOpts []DrawLineOption

	nColors := len(opts.Colors)
	if nColors == 1 {
		lineOpts = append(lineOpts, WithSingleLineColor(opts.Colors[0]))
	} else if nColors == posCount {
		lineOpts = append(lineOpts, WithPerLineColors(opts.Colors...))
	} else if nColors > 1 {
		lineOpts = append(lineOpts, WithLineColorPalette(opts.Colors, posCount))
	}

	nDot := len(opts.DotColors)
	if nDot == 1 {
		lineOpts = append(lineOpts, WithSingleDotColor(opts.DotColors[0]))
	} else if nDot == posCount {
		lineOpts = append(lineOpts, WithPerDotColors(opts.DotColors...))
	} else if nDot > 1 {
		lineOpts = append(lineOpts, WithDotColorPalette(opts.DotColors, posCount))
	}

	if opts.LineWidth > 0 {
		lineOpts = append(lineOpts, WithLineWidth(opts.LineWidth))
	}
	if opts.DotSize > 0 {
		lineOpts = append(lineOpts, WithDotSize(opts.DotSize))
	}

	line, err := NewLine(opts.Positions, lineOpts...)
	if err != nil {
		return nil, err
	}

	drawOpts := snapshotDrawableOpts(opts.Name, opts.ID, opts.Parent, opts.Pose, opts.ShowAxesHelper, opts.Invisible, snapshot)
	drawing := line.Draw(opts.Name, drawOpts...)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing.UUID, nil
}

// DrawModel constructs a Model and appends the resulting drawing to the snapshot.
// Returns the entity UUID (16 bytes).
func (snapshot *Snapshot) DrawModel(opts DrawModelOptions) ([]byte, error) {
	model, err := NewModel(opts.ModelOptions...)
	if err != nil {
		return nil, err
	}

	drawOpts := snapshotDrawableOpts(opts.Name, opts.ID, opts.Parent, opts.Pose, opts.ShowAxesHelper, opts.Invisible, snapshot)
	drawing := model.Draw(opts.Name, drawOpts...)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing.UUID, nil
}

// DrawPoints constructs a Points from opts.Positions and appends the resulting
// drawing to the snapshot. Returns the entity UUID (16 bytes). Color slice count
// rules: 0 = DefaultPointColor (gray), 1 = shared, len(Positions) = per-point,
// other = palette cycle.
func (snapshot *Snapshot) DrawPoints(opts DrawPointsOptions) ([]byte, error) {
	posCount := len(opts.Positions)
	nColors := len(opts.Colors)
	var pointOpts []DrawPointsOption

	if nColors == 0 {
		pointOpts = append(pointOpts, WithSinglePointColor(DefaultPointColor))
	} else if nColors == 1 {
		pointOpts = append(pointOpts, WithSinglePointColor(opts.Colors[0]))
	} else if nColors == posCount {
		pointOpts = append(pointOpts, WithPerPointColors(opts.Colors...))
	} else {
		pointOpts = append(pointOpts, WithPointColorPalette(opts.Colors, posCount))
	}

	if opts.PointSize > 0 {
		pointOpts = append(pointOpts, WithPointsSize(opts.PointSize))
	}

	points, err := NewPoints(opts.Positions, pointOpts...)
	if err != nil {
		return nil, err
	}

	drawOpts := snapshotDrawableOpts(opts.Name, opts.ID, opts.Parent, opts.Pose, opts.ShowAxesHelper, opts.Invisible, snapshot)
	drawing := points.Draw(opts.Name, drawOpts...)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing.UUID, nil
}

// snapshotDrawableOpts builds the DrawableOption slice for a single-entity
// Snapshot method. When id is non-empty the UUID is derived from that string
// and is stable across calls. When id is empty the UUID is derived from name+parent.
func snapshotDrawableOpts(
	name, id, parent string,
	pose spatialmath.Pose,
	showAxesHelper *bool,
	invisible *bool,
	snapshot *Snapshot,
) []DrawableOption {
	var opts []DrawableOption
	if parent != "" {
		opts = append(opts, WithParent(parent))
	}
	if pose != nil {
		opts = append(opts, WithPose(pose))
	}
	if id != "" {
		opts = append(opts, WithID(id))
	} else {
		opts = append(opts, WithUUID(snapshot.deriveEntityUUID(entityKey(name, parent))))
	}
	if showAxesHelper != nil {
		opts = append(opts, WithAxesHelper(*showAxesHelper))
	}
	if invisible != nil {
		opts = append(opts, WithInvisible(*invisible))
	}
	return opts
}

// DrawNurbs constructs a NURBS curve and appends the resulting drawing to the snapshot.
// Returns the entity UUID (16 bytes).
func (snapshot *Snapshot) DrawNurbs(opts DrawNurbsOptions) ([]byte, error) {
	nurbsOpts := []DrawNurbsOption{WithNurbsColors(opts.Color)}
	if opts.Degree > 0 {
		nurbsOpts = append(nurbsOpts, WithNurbsDegree(opts.Degree))
	}
	if len(opts.Weights) > 0 {
		nurbsOpts = append(nurbsOpts, WithNurbsWeights(opts.Weights))
	}
	if opts.LineWidth > 0 {
		nurbsOpts = append(nurbsOpts, WithNurbsLineWidth(opts.LineWidth))
	}

	nurbs, err := NewNurbs(opts.ControlPoints, opts.Knots, nurbsOpts...)
	if err != nil {
		return nil, err
	}

	drawOpts := snapshotDrawableOpts(opts.Name, opts.ID, opts.Parent, opts.Pose, opts.ShowAxesHelper, opts.Invisible, snapshot)
	drawing := nurbs.Draw(opts.Name, drawOpts...)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing.UUID, nil
}

// DrawPointCloud constructs a point cloud transform and appends it to the snapshot.
// Returns the entity UUID (16 bytes). Color slice count rules: 0 = cloud's own
// per-point data, 1 = shared override, PointCloud.Size() = per-point, other = palette cycle.
func (snapshot *Snapshot) DrawPointCloud(opts DrawPointCloudOptions) ([]byte, error) {
	var pcOpts []DrawPointCloudOption
	if len(opts.Colors) == 1 {
		pcOpts = append(pcOpts, WithSinglePointCloudColor(opts.Colors[0]))
	} else if len(opts.Colors) == opts.PointCloud.Size() {
		pcOpts = append(pcOpts, WithPerPointCloudColors(opts.Colors...))
	} else if len(opts.Colors) > 0 {
		pcOpts = append(pcOpts, WithPointCloudColorPalette(opts.Colors, opts.PointCloud.Size()))
	}
	if opts.DownscalingThreshold > 0 {
		pcOpts = append(pcOpts, WithPointCloudDownscaling(opts.DownscalingThreshold))
	}

	drawnPC, err := NewDrawnPointCloud(opts.PointCloud, pcOpts...)
	if err != nil {
		return nil, err
	}

	drawOpts := snapshotDrawableOpts(opts.Name, opts.ID, opts.Parent, opts.Pose, opts.ShowAxesHelper, opts.Invisible, snapshot)
	transform, err := drawnPC.Draw(opts.Name, drawOpts...)
	if err != nil {
		return nil, err
	}

	snapshot.transforms = append(snapshot.transforms, transform)
	return transform.Uuid, nil
}

// DrawGeometriesInFrame appends a transform per geometry to the snapshot.
// Returns one UUID per drawn geometry. Returns an error if Geometries is empty.
func (snapshot *Snapshot) DrawGeometriesInFrame(opts DrawGeometriesInFrameOptions) ([][]byte, error) {
	geometries := opts.Geometries.Geometries()
	if len(geometries) == 0 {
		return nil, fmt.Errorf("no geometries to draw")
	}

	colors := opts.Colors
	if len(colors) == 0 {
		colors = []Color{ColorFromName("red")}
	}

	var colorOption DrawGeometriesInFrameOption
	if len(colors) == 1 {
		colorOption = WithSingleGeometriesColor(colors[0])
	} else if len(colors) == len(geometries) {
		colorOption = WithPerGeometriesColors(colors...)
	} else {
		colorOption = WithGeometriesColorPalette(colors, len(geometries))
	}

	drawnGeometries, err := NewDrawnGeometriesInFrame(
		opts.Geometries,
		colorOption,
		WithGeometriesDownscalingThreshold(opts.DownscalingThreshold),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create drawn geometries: %w", err)
	}
	drawnGeometries.ID = opts.ID

	transforms, err := drawnGeometries.ToTransforms()
	if err != nil {
		return nil, fmt.Errorf("failed to create transforms: %w", err)
	}

	snapshot.transforms = append(snapshot.transforms, transforms...)
	uuids := make([][]byte, len(transforms))
	for i, t := range transforms {
		uuids[i] = t.Uuid
	}
	return uuids, nil
}

// DrawFrames appends a transform per frame (or per-geometry for frames with geometry)
// to the snapshot. Returns one UUID per emitted transform.
func (snapshot *Snapshot) DrawFrames(opts DrawFramesOptions) ([][]byte, error) {
	drawnFrames := NewDrawnFrames(opts.Frames, WithFramesColors(opts.Colors))
	drawnFrames.ID = opts.ID

	transforms, err := drawnFrames.ToTransforms()
	if err != nil {
		return nil, fmt.Errorf("failed to create frame transforms: %w", err)
	}

	snapshot.transforms = append(snapshot.transforms, transforms...)
	uuids := make([][]byte, len(transforms))
	for i, t := range transforms {
		uuids[i] = t.Uuid
	}
	return uuids, nil
}

// DrawWorldState resolves obstacles in the world state to the world frame and
// appends a transform per obstacle. Returns one UUID per obstacle.
func (snapshot *Snapshot) DrawWorldState(opts DrawWorldStateOptions) ([][]byte, error) {
	geoms, err := opts.WorldState.ObstaclesInWorldFrame(opts.FrameSystem, opts.Inputs)
	if err != nil {
		return nil, err
	}

	geometries := geoms.Geometries()
	var colorOption DrawGeometriesInFrameOption
	if len(opts.Colors) == 1 {
		colorOption = WithSingleGeometriesColor(opts.Colors[0])
	} else if len(opts.Colors) == len(geometries) {
		colorOption = WithPerGeometriesColors(opts.Colors...)
	} else if len(opts.Colors) > 1 {
		colorOption = WithGeometriesColorPalette(opts.Colors, len(geometries))
	} else {
		colors := ChromaticColorChooser.Get(len(geometries))
		colorOption = WithPerGeometriesColors(colors...)
	}

	drawnGeometries, err := NewDrawnGeometriesInFrame(geoms, colorOption)
	if err != nil {
		return nil, err
	}
	drawnGeometries.ID = opts.ID

	transforms, err := drawnGeometries.ToTransforms()
	if err != nil {
		return nil, err
	}

	snapshot.transforms = append(snapshot.transforms, transforms...)
	uuids := make([][]byte, len(transforms))
	for i, t := range transforms {
		uuids[i] = t.Uuid
	}
	return uuids, nil
}

// DrawGeometryOptions configures a Snapshot.DrawGeometry call.
type DrawGeometryOptions struct {
	// ID is a stable identifier. When set, re-calling with the same ID derives a
	// stable UUID. When empty, the UUID is derived from Name and Parent.
	ID string
	// Name labels the entity. When empty, the geometry's own label is used.
	Name string
	// Parent is the reference frame the geometry is attached to.
	Parent string
	// Pose is the pose of the geometry in the parent reference frame.
	Pose spatialmath.Pose
	// Geometry is the spatial geometry to render. Required.
	Geometry spatialmath.Geometry
	// Color is the render color for the geometry.
	Color Color
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool
	// Invisible hides the entity by default. Nil defaults to false.
	Invisible *bool
}

// DrawLineOptions configures a Snapshot.DrawLine call.
type DrawLineOptions struct {
	// ID is a stable identifier. Empty derives the UUID from Name and Parent.
	ID string
	// Name labels the entity in the visualizer.
	Name string
	// Parent is the reference frame the line is attached to.
	Parent string
	// Pose is the pose of the line in the parent reference frame.
	Pose spatialmath.Pose
	// Positions defines the polyline vertices. Must contain at least two points.
	Positions []r3.Vector
	// Colors controls segment colors. Empty = default blue, 1 = shared, len(Positions) =
	// per-vertex, other = palette cycle.
	Colors []Color
	// DotColors controls vertex-dot colors using the same rules as Colors.
	// When empty, uses DefaultLineDotColor.
	DotColors []Color
	// LineWidth is the rendered segment thickness in mm. 0 uses DefaultLineWidth (5mm).
	LineWidth float32
	// DotSize is the rendered dot diameter in mm. 0 uses DefaultLineDotSize (10mm).
	DotSize float32
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool
	// Invisible hides the entity by default. Nil defaults to false.
	Invisible *bool
}

// DrawPointsOptions configures a Snapshot.DrawPoints call.
type DrawPointsOptions struct {
	// ID is a stable identifier. Empty derives the UUID from Name and Parent.
	ID string
	// Name labels the entity in the visualizer.
	Name string
	// Parent is the reference frame the points are attached to.
	Parent string
	// Pose is the pose of the points in the parent reference frame.
	Pose spatialmath.Pose
	// Positions are the locations of each point. Must contain at least one position.
	Positions []r3.Vector
	// Colors controls point colors. Empty = DefaultPointColor (gray), 1 = shared,
	// len(Positions) = per-point, other = palette cycle.
	Colors []Color
	// PointSize is the rendered point diameter in mm. 0 uses DefaultPointSize (10mm).
	PointSize float32
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool
	// Invisible hides the entity by default. Nil defaults to false.
	Invisible *bool
}

// DrawArrowsOptions configures a Snapshot.DrawArrows call.
type DrawArrowsOptions struct {
	// ID is a stable identifier. Empty derives the UUID from Name and Parent.
	ID string
	// Name labels the entity in the visualizer.
	Name string
	// Parent is the reference frame the arrows are attached to.
	Parent string
	// Pose is the pose of the arrows group in the parent reference frame.
	Pose spatialmath.Pose
	// Poses are the positions and orientations rendered as individual arrows. Required.
	Poses []spatialmath.Pose
	// Colors controls arrow colors. Empty = DefaultArrowColor (green), 1 = shared,
	// len(Poses) = per-arrow, other = palette cycle.
	Colors []Color
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool
	// Invisible hides the entity by default. Nil defaults to false.
	Invisible *bool
}

// DrawFrameOptions configures a Snapshot.DrawFrame call.
type DrawFrameOptions struct {
	// ID is a stable identifier. Empty derives the UUID from Name and Parent.
	ID string
	// Name is the frame name. Required.
	Name string
	// Parent is the reference frame this frame is attached to. Required.
	Parent string
	// Pose is the pose of the frame in the parent reference frame.
	Pose spatialmath.Pose
	// Geometry is an optional geometry attached to the frame.
	Geometry spatialmath.Geometry
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool
	// Invisible hides the entity by default. Nil defaults to false.
	Invisible *bool
}

// DrawModelOptions configures a Snapshot.DrawModel call.
type DrawModelOptions struct {
	// ID is a stable identifier. Empty derives the UUID from Name and Parent.
	ID string
	// Name labels the entity in the visualizer.
	Name string
	// Parent is the reference frame the model is attached to.
	Parent string
	// Pose is the pose of the model in the parent reference frame.
	Pose spatialmath.Pose
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool
	// Invisible hides the entity by default. Nil defaults to false.
	Invisible *bool
	// ModelOptions are the draw-package model primitive options (assets, scale, etc.).
	ModelOptions []DrawModelOption
}

// DrawFrameSystemGeometriesOptions configures a Snapshot.DrawFrameSystemGeometries call.
type DrawFrameSystemGeometriesOptions struct {
	// ID is an optional identifier prefix. When set, each emitted transform's
	// identity is derived from "ID:geometryLabel:parent" to prevent collisions
	// between frame systems sharing geometry labels.
	ID string
	// FrameSystem is the reference frame system to render. Required.
	FrameSystem *referenceframe.FrameSystem
	// Inputs are the frame system inputs used to resolve frame poses.
	Inputs referenceframe.FrameSystemInputs
	// Colors maps frame names to render colors. Frames absent from the map
	// inherit from their parent, falling back to magenta at the root.
	Colors map[string]Color
}

// DrawNurbsOptions configures a Snapshot.DrawNurbs call.
type DrawNurbsOptions struct {
	// ID is a stable identifier. Empty derives the UUID from Name and Parent.
	ID string
	// Name labels the entity in the visualizer.
	Name string
	// Parent is the reference frame the curve is attached to.
	Parent string
	// Pose is the pose of the curve in the parent reference frame.
	Pose spatialmath.Pose
	// ControlPoints defines the poses that influence the curve's shape. Required.
	ControlPoints []spatialmath.Pose
	// Knots is the knot vector. Length must equal len(ControlPoints) + Degree + 1.
	Knots []float64
	// Color is the render color for the curve.
	Color Color
	// Degree is the polynomial degree. 0 uses DefaultNurbsDegree (3, cubic).
	Degree int32
	// Weights sets per-control-point influence. Empty = uniform 1.0 weighting.
	Weights []float64
	// LineWidth is the rendered curve thickness in mm. 0 uses DefaultLineWidth (5mm).
	LineWidth float32
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool
	// Invisible hides the entity by default. Nil defaults to false.
	Invisible *bool
}

// DrawPointCloudOptions configures a Snapshot.DrawPointCloud call.
type DrawPointCloudOptions struct {
	// ID is a stable identifier. Empty derives the UUID from Name and Parent.
	ID string
	// Name labels the entity in the visualizer.
	Name string
	// Parent is the reference frame the cloud is attached to.
	Parent string
	// Pose is the pose of the cloud in the parent reference frame.
	Pose spatialmath.Pose
	// PointCloud is the underlying cloud to render. Required.
	PointCloud pointcloud.PointCloud
	// DownscalingThreshold keeps only points whose mutual distance exceeds this
	// threshold (mm). 0 disables downscaling.
	DownscalingThreshold float64
	// Colors controls cloud coloring. Empty = per-point color data from the cloud,
	// 1 = shared override, PointCloud.Size() = per-point, other = palette cycle.
	Colors []Color
	// ShowAxesHelper controls whether the axes helper is shown. Nil defaults to true.
	ShowAxesHelper *bool
	// Invisible hides the entity by default. Nil defaults to false.
	Invisible *bool
}

// DrawGeometriesInFrameOptions configures a Snapshot.DrawGeometriesInFrame call.
type DrawGeometriesInFrameOptions struct {
	// ID is an optional identifier prefix preventing collisions between batches
	// sharing geometry labels and parent frames.
	ID string
	// Geometries is the set of geometries to render. Required, at least one.
	Geometries *referenceframe.GeometriesInFrame
	// Colors controls geometry colors. Empty = red, 1 = shared, len(Geometries) =
	// per-geometry, other = palette cycle.
	Colors []Color
	// DownscalingThreshold reduces rendered point count for point-cloud geometries.
	// 0 disables downscaling.
	DownscalingThreshold float64
}

// DrawFramesOptions configures a Snapshot.DrawFrames call.
type DrawFramesOptions struct {
	// ID is an optional identifier prefix preventing collisions between batches
	// sharing frame or geometry names.
	ID string
	// Frames are the reference frames to render. Frames without geometry are
	// rendered as bare coordinate axes.
	Frames []referenceframe.Frame
	// Colors maps frame names to render colors. Absent frames use DefaultFrameColor (red).
	Colors map[string]Color
}

// DrawWorldStateOptions configures a Snapshot.DrawWorldState call.
type DrawWorldStateOptions struct {
	// ID is an optional identifier prefix for this batch.
	ID string
	// WorldState contains the obstacles to render. Required.
	WorldState *referenceframe.WorldState
	// FrameSystem is used to resolve obstacles in non-world frames.
	FrameSystem *referenceframe.FrameSystem
	// Inputs are the frame system inputs for evaluating frame poses.
	Inputs referenceframe.FrameSystemInputs
	// Colors controls obstacle colors. Empty = ChromaticColorChooser palette, 1 = shared,
	// obstacle count = per-obstacle, other = palette cycle.
	Colors []Color
}
