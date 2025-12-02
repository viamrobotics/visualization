package draw

import (
	"fmt"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang/geo/r3"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

const fixturesDir = "__snapshots__"

func init() {
	rand.Seed(time.Now().UnixNano())
}

// TestSnapshotBox generates a snapshot showcasing a voxel cabin built with boxes using a frame system
func TestSnapshotBox(t *testing.T) {
	snapshot := NewPassSnapshot()
	snapshot.SceneMetadata().SetSceneCameraPosition(r3.Vector{X: 4000, Y: -4000, Z: 3000})
	snapshot.SceneMetadata().SetSceneCameraLookAt(r3.Vector{X: 0, Y: 0, Z: 500})

	voxelSize := r3.Vector{X: 500, Y: 500, Z: 500}

	woodColor := NewColor().ByName("saddlebrown").SetAlpha(1)    // wood
	roofColor := NewColor().ByName("maroon").SetAlpha(1)         // roof
	windowColor := NewColor().ByName("blue").SetAlpha(0.5)       // window
	doorColor := NewColor().ByName("sienna").SetAlpha(1)         // door
	chimneyColor := NewColor().ByName("darkgray").SetAlpha(1)    // chimney
	benchColor := NewColor().ByName("lightgray").SetAlpha(1)     // bench
	chestColor := NewColor().ByName("darkgoldenrod").SetAlpha(1) // chest
	furnitureColor := NewColor().ByName("peru").SetAlpha(1)      // furniture

	// Create frame system and house root frame
	fs := referenceframe.NewEmptyFrameSystem("world")
	houseFrame, _ := referenceframe.NewStaticFrame("house", spatialmath.NewZeroPose())
	fs.AddFrame(houseFrame, fs.World())

	// Helper to add a voxel frame
	// The frame's pose positions it relative to parent, geometry is at frame origin
	addVoxelFrame := func(parent referenceframe.Frame, name string, x, y, z int) {
		// Frame pose relative to parent
		framePose := spatialmath.NewPoseFromPoint(r3.Vector{
			X: float64(x * 500),
			Y: float64(y * 500),
			Z: float64(z * 500),
		})
		// Geometry at the frame's origin
		voxel, _ := spatialmath.NewBox(
			spatialmath.NewZeroPose(),
			voxelSize,
			name,
		)
		frame, _ := referenceframe.NewStaticFrameWithGeometry(name, framePose, voxel)
		fs.AddFrame(frame, parent)
	}

	// Create floor parent frame (origin at the corner of the floor)
	floorOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -4 * 500, Y: -3 * 500, Z: 0})
	floorParent, _ := referenceframe.NewStaticFrame("floor", floorOrigin)
	fs.AddFrame(floorParent, houseFrame)

	// Floor voxels (positioned relative to floor origin)
	for x := 0; x < 8; x++ {
		for y := 0; y < 6; y++ {
			addVoxelFrame(floorParent, fmt.Sprintf("floor_voxel_%d_%d", x, y), x, y, 0)
		}
	}

	// Create walls parent frame (origin at corner of the walls at ground level)
	wallsOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -4 * 500, Y: -3 * 500, Z: 1 * 500})
	wallsParent, _ := referenceframe.NewStaticFrame("walls", wallsOrigin)
	fs.AddFrame(wallsParent, houseFrame)

	// Front wall (Y = 0 relative to walls origin) with door opening
	for x := 0; x < 8; x++ {
		for z := 0; z < 4; z++ {
			// Skip door opening (originally at x=-1 to 0, z=1-2 in world, now x=3-4, z=0-1 in walls frame)
			if !(z <= 1 && x >= 3 && x <= 4) {
				addVoxelFrame(wallsParent, fmt.Sprintf("front_wall_%d_%d", x, z), x, 0, z)
			}
		}
	}

	// Back wall (Y = 5 relative to walls origin) - skip window positions
	for x := 0; x < 8; x++ {
		for z := 0; z < 4; z++ {
			// Skip window positions (originally at x=-1 to 0, z=2 in world, now x=3-4, z=1 in walls frame)
			if !(z == 1 && x >= 3 && x <= 4) {
				addVoxelFrame(wallsParent, fmt.Sprintf("back_wall_%d_%d", x, z), x, 5, z)
			}
		}
	}

	// Left wall (X = 0 relative to walls origin) - skip window position
	for y := 0; y < 6; y++ {
		for z := 0; z < 4; z++ {
			// Skip window position (originally at y=0, z=2 in world, now y=3, z=1 in walls frame)
			if !(z == 1 && y == 3) {
				addVoxelFrame(wallsParent, fmt.Sprintf("left_wall_%d_%d", y, z), 0, y, z)
			}
		}
	}

	// Right wall (X = 7 relative to walls origin)
	for y := 0; y < 6; y++ {
		for z := 0; z < 4; z++ {
			addVoxelFrame(wallsParent, fmt.Sprintf("right_wall_%d_%d", y, z), 7, y, z)
		}
	}

	// Create windows parent frame (origin at first window position)
	windowsOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -1 * 500, Y: 2 * 500, Z: 2 * 500})
	windowsParent, _ := referenceframe.NewStaticFrame("windows", windowsOrigin)
	fs.AddFrame(windowsParent, houseFrame)

	// Back wall windows (relative to windows origin)
	addVoxelFrame(windowsParent, "back_window_1", 0, 0, 0)
	addVoxelFrame(windowsParent, "back_window_2", 1, 0, 0)

	// Left wall window (relative to windows origin)
	addVoxelFrame(windowsParent, "left_window", -3, -2, 0)

	// Create roof parent frame (origin at corner of the roof base)
	roofOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -5 * 500, Y: -4 * 500, Z: 5 * 500})
	roofParent, _ := referenceframe.NewStaticFrame("roof", roofOrigin)
	fs.AddFrame(roofParent, houseFrame)

	// Roof layer 1 (base layer, relative to roof origin)
	for x := 0; x < 10; x++ {
		for y := 0; y < 8; y++ {
			addVoxelFrame(roofParent, fmt.Sprintf("roof_1_%d_%d", x, y), x, y, 0)
		}
	}
	// Roof layer 2
	for x := 1; x < 9; x++ {
		for y := 1; y < 7; y++ {
			addVoxelFrame(roofParent, fmt.Sprintf("roof_2_%d_%d", x, y), x, y, 1)
		}
	}
	// Roof layer 3
	for x := 2; x < 8; x++ {
		for y := 2; y < 6; y++ {
			addVoxelFrame(roofParent, fmt.Sprintf("roof_3_%d_%d", x, y), x, y, 2)
		}
	}
	// Roof peak
	for x := 3; x < 7; x++ {
		for y := 3; y < 5; y++ {
			addVoxelFrame(roofParent, fmt.Sprintf("roof_peak_%d_%d", x, y), x, y, 3)
		}
	}

	// Create door parent frame (origin at door position)
	doorOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: 1 * 500, Y: -5 * 500, Z: 1 * 500})
	doorParent, _ := referenceframe.NewStaticFrame("door", doorOrigin)
	fs.AddFrame(doorParent, houseFrame)

	// Door voxels (1x2x2 grid, relative to door origin)
	addVoxelFrame(doorParent, "door_1", 0, 0, 0)
	addVoxelFrame(doorParent, "door_2", 0, 1, 0)
	addVoxelFrame(doorParent, "door_3", 0, 0, 1)
	addVoxelFrame(doorParent, "door_4", 0, 1, 1)

	// Create chimney parent frame (origin at chimney base)
	chimneyOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: 2 * 500, Y: 1 * 500, Z: 6 * 500})
	chimneyParent, _ := referenceframe.NewStaticFrame("chimney", chimneyOrigin)
	fs.AddFrame(chimneyParent, houseFrame)

	// Chimney voxels (vertical stack, relative to chimney origin)
	addVoxelFrame(chimneyParent, "chimney_1", 0, 0, 0)
	addVoxelFrame(chimneyParent, "chimney_2", 0, 0, 1)
	addVoxelFrame(chimneyParent, "chimney_3", 0, 0, 2)
	addVoxelFrame(chimneyParent, "chimney_4", 0, 0, 3)

	// Create table parent frame (origin at table position)
	tableOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -1 * 500, Y: 0, Z: 1 * 500})
	tableParent, _ := referenceframe.NewStaticFrame("table", tableOrigin)
	fs.AddFrame(tableParent, houseFrame)

	// Table voxels (2 blocks side by side, relative to table origin)
	addVoxelFrame(tableParent, "table_1", 0, 0, 0)
	addVoxelFrame(tableParent, "table_2", 1, 0, 0)

	// Create bench parent frame (origin at bench position)
	benchOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -3 * 500, Y: -2 * 500, Z: 1 * 500})
	benchParent, _ := referenceframe.NewStaticFrame("bench", benchOrigin)
	fs.AddFrame(benchParent, houseFrame)

	// Bench voxels (2 blocks stacked vertically, relative to bench origin)
	addVoxelFrame(benchParent, "bench_1", 0, 0, 0)
	addVoxelFrame(benchParent, "bench_2", 0, 0, 1)

	// Chest frame (single geometry at origin)
	chestOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: 2 * 500, Y: 1 * 500, Z: 1 * 500})
	chestVoxel, _ := spatialmath.NewBox(
		spatialmath.NewZeroPose(),
		voxelSize,
		"chest",
	)
	chestFrame, _ := referenceframe.NewStaticFrameWithGeometry("chest", chestOrigin, chestVoxel)
	fs.AddFrame(chestFrame, houseFrame)

	// Create color map for the frame system
	// Include "house" so the entire frame hierarchy is rendered
	frameColors := map[string]*Color{
		"house":   woodColor, // Root frame needs a color for hierarchy
		"floor":   woodColor,
		"walls":   woodColor,
		"windows": windowColor,
		"roof":    roofColor,
		"door":    doorColor,
		"chimney": chimneyColor,
		"table":   furnitureColor,
		"bench":   benchColor,
		"chest":   chestColor,
	}

	// Draw the frame system
	inputs := referenceframe.FrameSystemInputs{}
	_, err := snapshot.DrawFrameSystemGeometries(fs, inputs, frameColors)
	if err != nil {
		t.Fatal(err)
	}

	writeSnapshot(t, snapshot, "snapshot_box.json")
}

func createBody(
	t *testing.T,
	snapshot *PassSnapshot,
	name string,
	parent string,
	orbitRadius float64,
	orbitAngle float64,
	bodyRadius float64,
	color *Color,
) *commonv1.Transform {
	t.Helper()

	angleRad := orbitAngle * math.Pi / 180.0
	x := orbitRadius * math.Cos(angleRad)
	y := orbitRadius * math.Sin(angleRad)

	orbit, err := snapshot.DrawFrame("", name+"-orbit", parent, spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: 0}), nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	geometry, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), bodyRadius, name)
	if err != nil {
		t.Fatal(err)
	}

	_, err = snapshot.DrawGeometry(geometry, spatialmath.NewZeroPose(), orbit.ReferenceFrame, color)
	if err != nil {
		t.Fatal(err)
	}

	return orbit
}

func createRings(t *testing.T, snapshot *PassSnapshot, parent string, radius float64, color *Color) *commonv1.Transform {
	t.Helper()

	diameter := radius * 2.0
	box, err := spatialmath.NewBox(
		spatialmath.NewZeroPose(),
		r3.Vector{X: diameter, Y: diameter, Z: 10},
		parent+"-rings",
	)
	if err != nil {
		t.Fatal(err)
	}

	pose := spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 0})
	transform, err := snapshot.DrawGeometry(box, pose, parent, color)
	if err != nil {
		t.Fatal(err)
	}

	return transform
}

// TestSnapshotSphere generates a snapshot showcasing a complete solar system with all planets and moons
func TestSnapshotSphere(t *testing.T) {
	snapshot := NewPassSnapshot()
	snapshot.SceneMetadata().SetSceneCameraPosition(r3.Vector{X: 40000, Y: 40000, Z: 30000})
	snapshot.SceneMetadata().SetSceneCameraLookAt(r3.Vector{X: 0, Y: 0, Z: 0})

	sunOrbit, err := snapshot.DrawFrame("", "sun-orbit", "world", spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 2000}), nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	sunGeometry, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 2000, "sun")
	if err != nil {
		t.Fatal(err)
	}

	_, err = snapshot.DrawGeometry(sunGeometry, spatialmath.NewZeroPose(), sunOrbit.ReferenceFrame, NewColor().ByName("orange"))
	if err != nil {
		t.Fatal(err)
	}

	createBody(t, snapshot, "mercury", sunOrbit.ReferenceFrame, 4000, 10, 350, NewColor().ByName("dimgray"))
	createBody(t, snapshot, "venus", sunOrbit.ReferenceFrame, 6000, 50, 700, NewColor().ByName("wheat"))

	earth := createBody(t, snapshot, "earth", sunOrbit.ReferenceFrame, 8000, 95, 750, NewColor().ByName("dodgerblue"))
	createBody(t, snapshot, "moon", earth.ReferenceFrame, 1400, 135, 200, NewColor().ByName("silver"))

	mars := createBody(t, snapshot, "mars", sunOrbit.ReferenceFrame, 10000, 175, 500, NewColor().ByName("orangered"))
	createBody(t, snapshot, "phobos", mars.ReferenceFrame, 900, 45, 75, NewColor().ByName("dimgray"))
	createBody(t, snapshot, "deimos", mars.ReferenceFrame, 1200, 225, 60, NewColor().ByName("darkgray"))

	jupiter := createBody(t, snapshot, "jupiter", sunOrbit.ReferenceFrame, 14000, 250, 1500, NewColor().ByName("tan"))
	createBody(t, snapshot, "io", jupiter.ReferenceFrame, 2100, 0, 200, NewColor().ByName("orange"))
	createBody(t, snapshot, "europa", jupiter.ReferenceFrame, 2400, 90, 175, NewColor().ByName("azure"))
	createBody(t, snapshot, "ganymede", jupiter.ReferenceFrame, 2700, 180, 250, NewColor().ByName("slategray"))
	createBody(t, snapshot, "callisto", jupiter.ReferenceFrame, 3000, 270, 225, NewColor().ByName("darkslategray"))

	saturn := createBody(t, snapshot, "saturn", sunOrbit.ReferenceFrame, 18000, 315, 1300, NewColor().ByName("palegoldenrod"))
	createRings(t, snapshot, saturn.ReferenceFrame, 1600, NewColor().ByName("palegoldenrod"))
	createBody(t, snapshot, "rhea", saturn.ReferenceFrame, 2100, 110, 125, NewColor().ByName("gainsboro"))
	createBody(t, snapshot, "enceladus", saturn.ReferenceFrame, 1850, 200, 100, NewColor().ByName("snow"))
	createBody(t, snapshot, "mimas", saturn.ReferenceFrame, 1700, 290, 90, NewColor().ByName("silver"))

	uranus := createBody(t, snapshot, "uranus", sunOrbit.ReferenceFrame, 22000, 25, 900, NewColor().ByName("paleturquoise"))
	createRings(t, snapshot, uranus.ReferenceFrame, 1100, NewColor().ByName("paleturquoise"))
	createBody(t, snapshot, "titania", uranus.ReferenceFrame, 1900, 0, 150, NewColor().ByName("lightslategray"))
	createBody(t, snapshot, "oberon", uranus.ReferenceFrame, 2100, 90, 140, NewColor().ByName("gray"))
	createBody(t, snapshot, "umbriel", uranus.ReferenceFrame, 1700, 180, 125, NewColor().ByName("dimgray"))
	createBody(t, snapshot, "ariel", uranus.ReferenceFrame, 1550, 270, 130, NewColor().ByName("darkgray"))

	neptune := createBody(t, snapshot, "neptune", sunOrbit.ReferenceFrame, 26000, 110, 850, NewColor().ByName("royalblue"))
	createRings(t, snapshot, neptune.ReferenceFrame, 950, NewColor().ByName("royalblue"))
	createBody(t, snapshot, "triton", neptune.ReferenceFrame, 1800, 200, 200, NewColor().ByName("lavender"))

	pluto := createBody(t, snapshot, "pluto", sunOrbit.ReferenceFrame, 30000, 195, 225, NewColor().ByName("tan"))
	createBody(t, snapshot, "charon", pluto.ReferenceFrame, 750, 90, 125, NewColor().ByName("gray"))

	createBody(t, snapshot, "ceres", sunOrbit.ReferenceFrame, 11500, 140, 175, NewColor().ByName("rosybrown"))

	writeSnapshot(t, snapshot, "snapshot_sphere.json")
}

// TestSnapshotCapsule generates a snapshot of a city simulation with plots, buildings, and citizens
func TestSnapshotCapsule(t *testing.T) {
	snapshot := NewPassSnapshot()
	snapshot.SceneMetadata().SetSceneCameraPosition(r3.Vector{X: 15000, Y: -15000, Z: 12000})
	snapshot.SceneMetadata().SetSceneCameraLookAt(r3.Vector{X: 0, Y: 0, Z: 2000})

	roadColor := NewColor().ByName("darkgray").SetAlpha(1)
	grassColor := NewColor().ByName("green").SetAlpha(1)
	concreteColor := NewColor().ByName("lightgray").SetAlpha(1)
	buildingColors := []*Color{
		NewColor().ByName("beige").SetAlpha(1),
		NewColor().ByName("lightblue").SetAlpha(1),
		NewColor().ByName("lavender").SetAlpha(1),
		NewColor().ByName("lightyellow").SetAlpha(1),
	}
	citizenColor := NewColor().ByName("purple").SetAlpha(1)

	plotSize := 3000.0     // Each plot is 3m x 3m (scaled up)
	plotThickness := 200.0 // Thick enough to cover axes helper gizmo
	gridSize := 8          // 8x8 grid

	// Create frame system
	fs := referenceframe.NewEmptyFrameSystem("world")
	rootFrame, _ := referenceframe.NewStaticFrame("root", spatialmath.NewZeroPose())
	fs.AddFrame(rootFrame, fs.World())

	// Create color map
	frameColors := map[string]*Color{
		"root":   grassColor, // Default color
		"people": citizenColor,
	}

	// Create city plots in a grid
	for i := 0; i < gridSize; i++ {
		for j := 0; j < gridSize; j++ {
			x := float64(i-gridSize/2) * plotSize
			y := float64(j-gridSize/2) * plotSize

			plotName := fmt.Sprintf("plot_%d_%d", i, j)

			// Determine plot type (roads, grass, concrete)
			var plotColor *Color
			isRoad := (i == gridSize/2 || j == gridSize/2)  // Cross roads through center
			isConcrete := !isRoad && (i%2 == 0 && j%2 == 0) // Some plots are concrete

			if isRoad {
				plotColor = roadColor
			} else if isConcrete {
				plotColor = concreteColor
			} else {
				plotColor = grassColor
			}

			// Create plot frame at its position
			plotPose := spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: plotThickness / 2.0})
			plot, _ := spatialmath.NewBox(
				spatialmath.NewZeroPose(),
				r3.Vector{X: plotSize, Y: plotSize, Z: plotThickness},
				plotName,
			)
			plotFrame, _ := referenceframe.NewStaticFrameWithGeometry(plotName, plotPose, plot)
			fs.AddFrame(plotFrame, rootFrame)
			frameColors[plotName] = plotColor

			// Add buildings on some non-road plots
			if !isRoad && rand.Float64() < 0.4 { // 40% chance of building
				buildingHeight := 2000.0 + rand.Float64()*6000.0 // Random height 2-8m
				buildingWidth := 2000.0 + rand.Float64()*800.0   // Random width 2-2.8m
				buildingDepth := 2000.0 + rand.Float64()*800.0   // Random depth 2-2.8m
				buildingColor := buildingColors[rand.Intn(len(buildingColors))]
				buildingName := plotName + "_building"

				// Building frame is positioned relative to its plot
				buildingPose := spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: plotThickness/2.0 + buildingHeight/2.0})
				building, _ := spatialmath.NewBox(
					spatialmath.NewZeroPose(),
					r3.Vector{X: buildingWidth, Y: buildingDepth, Z: buildingHeight},
					buildingName,
				)
				buildingFrame, _ := referenceframe.NewStaticFrameWithGeometry(buildingName, buildingPose, building)
				fs.AddFrame(buildingFrame, plotFrame)
				frameColors[buildingName] = buildingColor
			}
		}
	}

	// Create people parent frame
	peopleFrame, _ := referenceframe.NewStaticFrame("people", spatialmath.NewZeroPose())
	fs.AddFrame(peopleFrame, rootFrame)

	numCitizens := 150 // Many citizens walking around
	citizenHeight := 200.0
	cityBounds := (float64(gridSize)/2.0 - 0.5) * plotSize

	for i := 0; i < numCitizens; i++ {
		x := (rand.Float64()*2.0 - 1.0) * cityBounds
		y := (rand.Float64()*2.0 - 1.0) * cityBounds
		z := plotThickness + citizenHeight/2.0 // Standing on top of ground plots

		rotation := rand.Float64() * 360.0
		personName := fmt.Sprintf("person_%d", i)

		// Person frame at their position
		personPose := spatialmath.NewPose(
			r3.Vector{X: x, Y: y, Z: z},
			&spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: rotation},
		)
		citizen, _ := spatialmath.NewCapsule(
			spatialmath.NewZeroPose(),
			50.0,          // Radius (body width) - 100mm diameter
			citizenHeight, // Height (person height) - small but visible
			personName,
		)
		personFrame, _ := referenceframe.NewStaticFrameWithGeometry(personName, personPose, citizen)
		fs.AddFrame(personFrame, peopleFrame)
		frameColors[personName] = citizenColor
	}

	// Draw the frame system
	inputs := referenceframe.FrameSystemInputs{}
	_, err := snapshot.DrawFrameSystemGeometries(fs, inputs, frameColors)
	if err != nil {
		t.Fatal(err)
	}

	writeSnapshot(t, snapshot, "snapshot_capsule.json")
}

// TestSnapshotArrows generates a snapshot showcasing arrow drawings
// Creates three geometries (box, sphere, capsule) with arrows pointing to their surfaces
func TestSnapshotArrows(t *testing.T) {
	snapshot := NewPassSnapshot()
	snapshot.SceneMetadata().SetSceneCameraPosition(r3.Vector{X: 2000, Y: 2000, Z: 1500})
	snapshot.SceneMetadata().SetSceneCameraLookAt(r3.Vector{X: 0, Y: 0, Z: 0})

	// 1. Create a box geometry at origin
	boxPose := spatialmath.NewPoseFromPoint(r3.Vector{X: -800, Y: 0, Z: 300})
	box, err := spatialmath.NewBox(
		spatialmath.NewZeroPose(),
		r3.Vector{X: 400, Y: 400, Z: 400},
		"test-box",
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = snapshot.DrawGeometry(box, boxPose, "world", NewColor().SetRGBA(0.8, 0.2, 0.2, 0.7))
	if err != nil {
		t.Fatal(err)
	}

	// Create thousands of arrows pointing to box faces
	var boxArrowPoses []spatialmath.Pose
	boxHalfSize := 200.0    // half of 400mm
	numArrowsPerFace := 500 // 500 arrows per face = 3000 total arrows
	faces := []struct {
		normal r3.Vector
		offset r3.Vector
	}{
		{r3.Vector{X: 0, Y: 0, Z: -1}, r3.Vector{X: 0, Y: 0, Z: boxHalfSize + 150}}, // Top
		{r3.Vector{X: 0, Y: 0, Z: 1}, r3.Vector{X: 0, Y: 0, Z: -boxHalfSize - 150}}, // Bottom
		{r3.Vector{X: 0, Y: -1, Z: 0}, r3.Vector{X: 0, Y: boxHalfSize + 150, Z: 0}}, // Front (+Y)
		{r3.Vector{X: 0, Y: 1, Z: 0}, r3.Vector{X: 0, Y: -boxHalfSize - 150, Z: 0}}, // Back (-Y)
		{r3.Vector{X: -1, Y: 0, Z: 0}, r3.Vector{X: boxHalfSize + 150, Y: 0, Z: 0}}, // Right (+X)
		{r3.Vector{X: 1, Y: 0, Z: 0}, r3.Vector{X: -boxHalfSize - 150, Y: 0, Z: 0}}, // Left (-X)
	}

	for _, face := range faces {
		gridSize := int(math.Sqrt(float64(numArrowsPerFace)))
		spacing := (boxHalfSize * 2) / float64(gridSize+1)

		for i := 0; i < gridSize; i++ {
			for j := 0; j < gridSize; j++ {
				var pos r3.Vector
				if face.normal.Z != 0 {
					pos = r3.Vector{
						X: -boxHalfSize + float64(i+1)*spacing,
						Y: -boxHalfSize + float64(j+1)*spacing,
						Z: face.offset.Z,
					}
				} else if face.normal.Y != 0 {
					pos = r3.Vector{
						X: -boxHalfSize + float64(i+1)*spacing,
						Y: face.offset.Y,
						Z: -boxHalfSize + float64(j+1)*spacing,
					}
				} else {
					pos = r3.Vector{
						X: face.offset.X,
						Y: -boxHalfSize + float64(i+1)*spacing,
						Z: -boxHalfSize + float64(j+1)*spacing,
					}
				}

				boxArrowPoses = append(boxArrowPoses, spatialmath.NewPose(
					boxPose.Point().Add(pos),
					&spatialmath.OrientationVectorDegrees{OX: face.normal.X, OY: face.normal.Y, OZ: face.normal.Z},
				))
			}
		}
	}

	_, err = snapshot.DrawArrows("box-surface-arrows", "world", spatialmath.NewZeroPose(), boxArrowPoses, []*Color{NewColor().ByName("red")})
	if err != nil {
		t.Fatal(err)
	}

	// 2. Create a sphere geometry
	spherePose := spatialmath.NewPoseFromPoint(r3.Vector{X: 800, Y: 0, Z: 300})
	sphere, err := spatialmath.NewSphere(
		spatialmath.NewZeroPose(),
		250,
		"test-sphere",
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = snapshot.DrawGeometry(sphere, spherePose, "world", NewColor().ByName("green"))
	if err != nil {
		t.Fatal(err)
	}

	// Create thousands of arrows pointing radially inward to sphere surface
	var sphereArrowPoses []spatialmath.Pose
	sphereCenter := r3.Vector{X: 800, Y: 0, Z: 300}
	sphereRadius := 250.0
	numSphereArrows := 2000 // 2000 arrows around the sphere

	for i := 0; i < numSphereArrows; i++ {
		theta := 2 * math.Pi * float64(i) / ((1 + math.Sqrt(5)) / 2) // Golden angle
		y := 1 - (2*float64(i)+1)/float64(numSphereArrows)           // Distribute from -1 to 1
		radiusAtY := math.Sqrt(1 - y*y)

		x := radiusAtY * math.Cos(theta)
		z := radiusAtY * math.Sin(theta)

		arrowDistance := sphereRadius + 150
		arrowPos := r3.Vector{
			X: sphereCenter.X + x*arrowDistance,
			Y: sphereCenter.Y + y*arrowDistance,
			Z: sphereCenter.Z + z*arrowDistance,
		}

		direction := r3.Vector{
			X: sphereCenter.X - arrowPos.X,
			Y: sphereCenter.Y - arrowPos.Y,
			Z: sphereCenter.Z - arrowPos.Z,
		}.Normalize()

		sphereArrowPoses = append(sphereArrowPoses, spatialmath.NewPose(
			arrowPos,
			&spatialmath.OrientationVectorDegrees{OX: direction.X, OY: direction.Y, OZ: direction.Z},
		))
	}

	_, err = snapshot.DrawArrows("sphere-surface-arrows", "world", spatialmath.NewZeroPose(), sphereArrowPoses, []*Color{NewColor().ByName("green")})
	if err != nil {
		t.Fatal(err)
	}

	// 3. Create a capsule geometry
	capsulePose := spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 800})
	capsule, err := spatialmath.NewCapsule(
		spatialmath.NewZeroPose(),
		150,
		600,
		"test-capsule",
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = snapshot.DrawGeometry(capsule, capsulePose, "world", NewColor().ByName("blue"))
	if err != nil {
		t.Fatal(err)
	}

	// Create thousands of arrows pointing to capsule surface
	var capsuleArrowPoses []spatialmath.Pose
	capsuleCenter := r3.Vector{X: 0, Y: 0, Z: 800}
	capsuleRadius := 150.0
	capsuleLength := 600.0
	numCapsuleArrows := 3000 // 3000 arrows around the capsule

	numRings := 50
	arrowsPerRing := numCapsuleArrows / numRings

	for ring := 0; ring < numRings; ring++ {
		zOffset := -capsuleLength/2 + float64(ring)*(capsuleLength/float64(numRings-1))

		for i := 0; i < arrowsPerRing; i++ {
			angle := float64(i) * 2 * math.Pi / float64(arrowsPerRing)

			var radialDistance float64
			if math.Abs(zOffset) > capsuleLength/2-capsuleRadius {
				capZ := math.Abs(zOffset) - (capsuleLength/2 - capsuleRadius)
				radialDistance = math.Sqrt(capsuleRadius*capsuleRadius - capZ*capZ)
			} else {
				radialDistance = capsuleRadius
			}

			arrowDistance := radialDistance + 150
			x := capsuleCenter.X + arrowDistance*math.Cos(angle)
			y := capsuleCenter.Y + arrowDistance*math.Sin(angle)
			z := capsuleCenter.Z + zOffset

			direction := r3.Vector{
				X: capsuleCenter.X - x,
				Y: capsuleCenter.Y - y,
				Z: 0,
			}.Normalize()

			capsuleArrowPoses = append(capsuleArrowPoses, spatialmath.NewPose(
				r3.Vector{X: x, Y: y, Z: z},
				&spatialmath.OrientationVectorDegrees{OX: direction.X, OY: direction.Y, OZ: direction.Z},
			))
		}
	}

	_, err = snapshot.DrawArrows("capsule-surface-arrows", "world", spatialmath.NewZeroPose(), capsuleArrowPoses, []*Color{NewColor().ByName("blue")})
	if err != nil {
		t.Fatal(err)
	}

	writeSnapshot(t, snapshot, "snapshot_arrows.json")
}

// TestSnapshotLine generates a snapshot showcasing lines navigating around obstacles
// Creates boxes and spheres scattered around with various paths weaving through them
func TestSnapshotLine(t *testing.T) {
	snapshot := NewPassSnapshot()
	snapshot.SceneMetadata().SetSceneCameraPosition(r3.Vector{X: 8000, Y: 8000, Z: 6000})
	snapshot.SceneMetadata().SetSceneCameraLookAt(r3.Vector{X: 0, Y: 0, Z: 1000})

	obstacleColors := []*Color{
		NewColor().ByName("red"),
		NewColor().ByName("green"),
		NewColor().ByName("blue"),
		NewColor().ByName("yellow"),
		NewColor().ByName("magenta"),
		NewColor().ByName("cyan"),
	}

	numObstacles := 15
	for i := range numObstacles {
		x := (rand.Float64()*2.0 - 1.0) * 3000.0
		y := (rand.Float64()*2.0 - 1.0) * 3000.0
		z := rand.Float64()*1500.0 + 500.0

		size := 300.0 + rand.Float64()*400.0
		color := obstacleColors[rand.Intn(len(obstacleColors))]

		if rand.Float64() < 0.5 {
			box, err := spatialmath.NewBox(
				spatialmath.NewZeroPose(),
				r3.Vector{X: size, Y: size, Z: size},
				fmt.Sprintf("obstacle-box-%d", i),
			)
			if err != nil {
				t.Fatal(err)
			}

			_, err = snapshot.DrawGeometry(box, spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: z}), "world", color)
			if err != nil {
				t.Fatal(err)
			}
		} else {
			sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), size/2.0, fmt.Sprintf("obstacle-sphere-%d", i))
			if err != nil {
				t.Fatal(err)
			}
			_, err = snapshot.DrawGeometry(sphere, spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: z}), "world", color)
			if err != nil {
				t.Fatal(err)
			}
		}
	}

	lineColors := []*Color{
		NewColor().ByName("red"),
		NewColor().ByName("green"),
		NewColor().ByName("blue"),
		NewColor().ByName("orange"),
		NewColor().ByName("magenta"),
	}

	// Path 1: Smooth winding path with many points
	var path1 []r3.Vector
	numPoints1 := 100
	for i := 0; i < numPoints1; i++ {
		t := float64(i) / float64(numPoints1-1)
		x := (t*2.0 - 1.0) * 4000.0
		y := math.Sin(t*math.Pi*4) * 2000.0
		z := 500.0 + math.Sin(t*math.Pi*2)*500.0
		path1 = append(path1, r3.Vector{X: x, Y: y, Z: z})
	}
	_, err := snapshot.DrawLine("smooth-path", "world", spatialmath.NewZeroPose(), path1, []*Color{lineColors[0]}, 15.0, 10.0)
	if err != nil {
		t.Fatal(err)
	}

	// Path 2: Zigzag path with fewer points (more angular)
	var path2 []r3.Vector
	numPoints2 := 15
	for i := range numPoints2 {
		t := float64(i) / float64(numPoints2-1)
		x := math.Cos(t*math.Pi*2) * 3000.0
		y := math.Sin(t*math.Pi*2) * 3000.0
		z := 1000.0 + float64(i%2)*800.0
		path2 = append(path2, r3.Vector{X: x, Y: y, Z: z})
	}
	_, err = snapshot.DrawLine("zigzag-path", "world", spatialmath.NewZeroPose(), path2, []*Color{lineColors[1]}, 20.0, 10.0)
	if err != nil {
		t.Fatal(err)
	}

	// Path 3: Spiral path with medium smoothness
	var path3 []r3.Vector
	numPoints3 := 50
	for i := range numPoints3 {
		t := float64(i) / float64(numPoints3-1)
		angle := t * math.Pi * 6
		radius := 3500.0 * (1.0 - t*0.7)
		x := math.Cos(angle) * radius
		y := math.Sin(angle) * radius
		z := 200.0 + t*2000.0
		path3 = append(path3, r3.Vector{X: x, Y: y, Z: z})
	}
	_, err = snapshot.DrawLine("spiral-path", "world", spatialmath.NewZeroPose(), path3, []*Color{lineColors[2]}, 12.0, 10.0)
	if err != nil {
		t.Fatal(err)
	}

	// Path 4: Straight diagonal path with very few points
	var path4 []r3.Vector
	path4 = append(path4, r3.Vector{X: -3500, Y: -3500, Z: 300})
	path4 = append(path4, r3.Vector{X: -1000, Y: 0, Z: 800})
	path4 = append(path4, r3.Vector{X: 1000, Y: 1500, Z: 1200})
	path4 = append(path4, r3.Vector{X: 3500, Y: 3500, Z: 500})
	_, err = snapshot.DrawLine("straight-path", "world", spatialmath.NewZeroPose(), path4, []*Color{lineColors[3]}, 25.0, 10.0)
	if err != nil {
		t.Fatal(err)
	}

	// Path 5: Helix path spiraling upward
	var path5 []r3.Vector
	numPoints5 := 80
	radius := 2000.0
	height := 3000.0
	numTurns := 3.0
	for i := range numPoints5 {
		t := float64(i) / float64(numPoints5-1)
		angle := t * math.Pi * 2 * numTurns
		x := math.Cos(angle) * radius
		y := math.Sin(angle) * radius
		z := 500.0 + t*height
		path5 = append(path5, r3.Vector{X: x, Y: y, Z: z})
	}
	_, err = snapshot.DrawLine("helix-path", "world", spatialmath.NewZeroPose(), path5, []*Color{lineColors[4]}, 18.0, 10.0)
	if err != nil {
		t.Fatal(err)
	}

	writeSnapshot(t, snapshot, "snapshot_line.json")
}

// TestSnapshotPoints generates a snapshot showcasing points shapes
func TestSnapshotPoints(t *testing.T) {
	snapshot := NewPassSnapshot()
	snapshot.SceneMetadata().SetSceneCameraPosition(r3.Vector{X: 8000, Y: 8000, Z: 6000})
	snapshot.SceneMetadata().SetSceneCameraLookAt(r3.Vector{X: 0, Y: 0, Z: 1000})

	pointSize := float32(50.0)

	// 1. Single color point cloud in a grid (100mm spacing between points)
	var gridPoints []r3.Vector
	for x := -1000.0; x <= 1000.0; x += 100.0 {
		for y := -1000.0; y <= 1000.0; y += 100.0 {
			for z := 0.0; z <= 2000.0; z += 100.0 {
				gridPoints = append(gridPoints, r3.Vector{X: x, Y: y, Z: z})
			}
		}
	}

	_, err := snapshot.DrawPoints("grid-points", "world", spatialmath.NewZeroPose(), gridPoints, []*Color{NewColor().ByName("red")}, pointSize)
	if err != nil {
		t.Fatal(err)
	}

	// 2. Per-point colored points in a sphere (1200mm radius, ~100mm average spacing)
	var spherePoints []r3.Vector
	var sphereColors []*Color
	numPoints := 10000
	radius := 1200.0

	for i := 0; i < numPoints; i++ {
		theta := rand.Float64() * 2 * math.Pi
		phi := math.Acos(2*rand.Float64() - 1)
		r := radius * math.Cbrt(rand.Float64())

		x := r * math.Sin(phi) * math.Cos(theta)
		y := r * math.Sin(phi) * math.Sin(theta)
		z := r * math.Cos(phi)

		spherePoints = append(spherePoints, r3.Vector{X: x + 4000, Y: y, Z: z + 1200})
		hue := math.Mod(theta/(2*math.Pi), 1.0)
		sphereColors = append(sphereColors, NewColor().FromHSV(float32(hue), 1.0, 1.0))
	}

	_, err = snapshot.DrawPoints("sphere-points", "world", spatialmath.NewZeroPose(), spherePoints, sphereColors, pointSize)
	if err != nil {
		t.Fatal(err)
	}

	// 3. Parametric surface (wave) - 100mm spacing between points\
	var wavePoints []r3.Vector
	for x := -5000.0; x <= 5000.0; x += 100.0 {
		for y := -5000.0; y <= 5000.0; y += 100.0 {
			dist := math.Sqrt(x*x + y*y)
			z := 500 * math.Sin(dist/1000) * math.Exp(-dist/10000)
			wavePoints = append(wavePoints, r3.Vector{X: x - 8000, Y: y, Z: z + 1000})
		}
	}

	_, err = snapshot.DrawPoints("wave-points", "world", spatialmath.NewZeroPose(), wavePoints, []*Color{NewColor().ByName("blue")}, pointSize)
	if err != nil {
		t.Fatal(err)
	}

	writeSnapshot(t, snapshot, "snapshot_points.json")
}

// TestSnapshotModel generates a snapshot showcasing model shapes with fun models
func TestSnapshotModel(t *testing.T) {
	snapshot := NewPassSnapshot()
	snapshot.SceneMetadata().SetSceneCameraPosition(r3.Vector{X: 3000, Y: 3000, Z: 2000})
	snapshot.SceneMetadata().SetSceneCameraLookAt(r3.Vector{X: 0, Y: 0, Z: 300})

	createPose := func(x, y, z float64) spatialmath.Pose {
		orientation := &spatialmath.OrientationVectorDegrees{
			OX: 1, OY: 0, OZ: 0, Theta: 90,
		}
		return spatialmath.NewPose(r3.Vector{X: x, Y: y, Z: z}, orientation)
	}

	// 1. Duck - Classic rubber duck from URL
	duckURL := "http://localhost:5173/models/Duck.glb"
	duckCache := "duck-v1"
	duckSize := uint64(120072)
	duckScale := float32(1.0)
	_, err := snapshot.DrawModelFromURL("duck", "world", createPose(-2000, -2000, 0), duckURL, duckCache, duckSize, duckScale, false)
	if err != nil {
		t.Fatal(err)
	}

	// 2. Avocado - Fresh avocado from URL
	avocadoURL := "http://localhost:5173/models/Avocado.glb"
	avocadoCache := "avocado-v1"
	avocadoSize := uint64(8110256)
	avocadoScale := float32(20.0)
	_, err = snapshot.DrawModelFromURL("avocado", "world", createPose(0, -2000, 0), avocadoURL, avocadoCache, avocadoSize, avocadoScale, false)
	if err != nil {
		t.Fatal(err)
	}

	// 3. Lantern - Medieval lantern from URL
	lanternURL := "http://localhost:5173/models/Lantern.glb"
	lanternCache := "lantern-v1"
	lanternSize := uint64(9564180)
	lanternScale := float32(0.04)
	_, err = snapshot.DrawModelFromURL("lantern", "world", createPose(2000, -2000, 0), lanternURL, lanternCache, lanternSize, lanternScale, false)
	if err != nil {
		t.Fatal(err)
	}

	// 4. Animated Box - An animated box scene from GLB data
	boxData, err := os.ReadFile(filepath.Join(".", "__fixtures__", "BoxAnimated.glb"))
	if err != nil {
		t.Fatal(err)
	}
	boxCache := "box-v1"
	boxScale := float32(1.0)
	_, err = snapshot.DrawModelFromGLB("box", "world", createPose(-2000, 2000, 600), boxData, boxCache, boxScale, true)
	if err != nil {
		t.Fatal(err)
	}

	// 5. Milk Truck - Cesium's iconic milk truck from GLB data
	milkTruckData, err := os.ReadFile(filepath.Join(".", "__fixtures__", "CesiumMilkTruck.glb"))
	if err != nil {
		t.Fatal(err)
	}
	milkTruckCache := "milktruck-v1"
	milkTruckScale := float32(0.4)
	_, err = snapshot.DrawModelFromGLB("milktruck", "world", createPose(0, 2000, 0), milkTruckData, milkTruckCache, milkTruckScale, false)
	if err != nil {
		t.Fatal(err)
	}

	// 6. Fox - Animated fox character from GLB data
	foxData, err := os.ReadFile(filepath.Join(".", "__fixtures__", "Fox.glb"))
	if err != nil {
		t.Fatal(err)
	}
	foxCache := "fox-v1"
	foxScale := float32(0.02)
	_, err = snapshot.DrawModelFromGLB("fox", "world", createPose(2000, 2000, 0), foxData, foxCache, foxScale, false)
	if err != nil {
		t.Fatal(err)
	}

	writeSnapshot(t, snapshot, "snapshot_model.json")
}

// TestSnapshotScene generates a complex scene with multiple geometry and shape types
// TestSnapshotScene recreates a real-world failed execution visualization from a sanding robot
// This snapshot demonstrates a UR20 arm with various fixtures and environment components
// TestSnapshotScene creates a snapshot based on real-world sanding robot data
// This recreates the conditions from an actual failed execution scenario
func TestSnapshotScene(t *testing.T) {
	snapshot := NewPassSnapshot()

	// Set up camera to view the entire scene
	// Position camera to view the workspace from a good angle
	snapshot.SceneMetadata().SetSceneCameraPosition(r3.Vector{X: 3000, Y: 3000, Z: 2000})
	snapshot.SceneMetadata().SetSceneCameraLookAt(r3.Vector{X: 0, Y: 0, Z: 0})

	// Create frame system with colors based on real-world setup
	frameSystem, inputs := createSandingRobotFrameSystem(t)
	frameColors := createSandingRobotFrameColors()

	// Draw the frame system with colors
	_, err := snapshot.DrawFrameSystemGeometries(frameSystem, inputs, frameColors)
	if err != nil {
		t.Fatal(err)
	}

	// Validate and save snapshot
	if err = snapshot.Validate(); err != nil {
		t.Fatal(err)
	}

	writeSnapshot(t, snapshot, "snapshot_scene.json")
}

// createSandingRobotFrameSystem creates a frame system based on real-world sanding robot data
// All dimensions are in millimeters (mm) and will be converted to meters in the output
// These values match an actual failed execution scenario from the sanding robot
func createSandingRobotFrameSystem(t *testing.T) (*referenceframe.FrameSystem, referenceframe.FrameSystemInputs) {
	t.Helper()

	fs := referenceframe.NewEmptyFrameSystem("world")
	inputs := referenceframe.FrameSystemInputs{}

	// Base frame - from JSON: center (0, 0, -1.2m), dims (2m, 1.3m, 0.1m)
	baseGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: -1200}),
		r3.Vector{X: 2000, Y: 1300, Z: 100},
		"base",
	)
	baseFrame, _ := referenceframe.NewStaticFrameWithGeometry("base:", spatialmath.NewZeroPose(), baseGeom)
	fs.AddFrame(baseFrame, fs.World())

	// Floor - from JSON: center (0, 0, -1.36m), dims (10m, 10m, 0.01m)
	floorGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: -1360}),
		r3.Vector{X: 10000, Y: 10000, Z: 10},
		"floor",
	)
	floorFrame, _ := referenceframe.NewStaticFrameWithGeometry("floor:", spatialmath.NewZeroPose(), floorGeom)
	fs.AddFrame(floorFrame, fs.World())

	// Pedestal - from JSON: center (0, 0, -0.6m), dims (0.28m, 0.28m, 1.2m)
	pedestalGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: -600}),
		r3.Vector{X: 280, Y: 280, Z: 1200},
		"pedestal",
	)
	pedestalFrame, _ := referenceframe.NewStaticFrameWithGeometry("pedestal:", spatialmath.NewZeroPose(), pedestalGeom)
	fs.AddFrame(pedestalFrame, fs.World())

	// Wall - from JSON: center (0, -0.53m, 0), dims (10m, 0.01m, 10m)
	wallGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: -530, Z: 0}),
		r3.Vector{X: 10000, Y: 10, Z: 10000},
		"wall",
	)
	wallFrame, _ := referenceframe.NewStaticFrameWithGeometry("wall:", spatialmath.NewZeroPose(), wallGeom)
	fs.AddFrame(wallFrame, fs.World())

	// Hardtop middle wall - from JSON: center (0, 1.71m, 0), dims (5m, 0.05m, 2.5m)
	hardtopWallGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 1710, Z: 0}),
		r3.Vector{X: 5000, Y: 50, Z: 2500},
		"hardtop-middle-wall",
	)
	hardtopWallFrame, _ := referenceframe.NewStaticFrameWithGeometry("hardtop-middle-wall:", spatialmath.NewZeroPose(), hardtopWallGeom)
	fs.AddFrame(hardtopWallFrame, fs.World())

	// Computers enclosure - from JSON: center (0, -0.325m, -0.6m), dims (2.2m, 0.65m, 1.2m)
	computersGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: -325, Z: -600}),
		r3.Vector{X: 2200, Y: 650, Z: 1200},
		"computers",
	)
	computersFrame, _ := referenceframe.NewStaticFrameWithGeometry("computers:", spatialmath.NewZeroPose(), computersGeom)
	fs.AddFrame(computersFrame, fs.World())

	// Hose guide - from JSON: center (-1.236m, 0.877m, -0.375m), dims (0.07m, 0.07m, 0.09m)
	// Note: In the real data this has a complex orientation, but we're using zero pose for simplicity
	hoseGuideGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: -1236, Y: 877, Z: -375}),
		r3.Vector{X: 70, Y: 70, Z: 90},
		"hose-guide",
	)
	hoseGuideFrame, _ := referenceframe.NewStaticFrameWithGeometry("hose-guide:", spatialmath.NewZeroPose(), hoseGuideGeom)
	fs.AddFrame(hoseGuideFrame, fs.World())

	// Create simplified UR20 arm (6-DOF robot arm)
	// These are simplified representations - the real arm has complex joint transforms
	armBase := createArmLinkFrame("ur20-modular:shoulder_link", r3.Vector{X: 180, Y: 180, Z: 200})
	fs.AddFrame(armBase, baseFrame)

	upperArm := createArmLinkFrame("ur20-modular:upper_arm_link", r3.Vector{X: 150, Y: 150, Z: 700})
	fs.AddFrame(upperArm, armBase)

	forearm := createArmLinkFrame("ur20-modular:forearm_link", r3.Vector{X: 120, Y: 120, Z: 600})
	fs.AddFrame(forearm, upperArm)

	wrist1 := createArmLinkFrame("ur20-modular:wrist_1_link", r3.Vector{X: 100, Y: 100, Z: 150})
	fs.AddFrame(wrist1, forearm)

	wrist2 := createArmLinkFrame("ur20-modular:wrist_2_link", r3.Vector{X: 100, Y: 100, Z: 150})
	fs.AddFrame(wrist2, wrist1)

	wrist3 := createArmLinkFrame("ur20-modular:wrist_3_link", r3.Vector{X: 100, Y: 100, Z: 100})
	fs.AddFrame(wrist3, wrist2)

	// Sander tool - from JSON: center (-1.200m, 0.966m, -0.430m), dims (0.405m, 0.101m, 0.11m)
	// Position relative to wrist3 for simplified model
	sanderGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 55}),
		r3.Vector{X: 405, Y: 101, Z: 110},
		"sander",
	)
	sanderFrame, _ := referenceframe.NewStaticFrameWithGeometry("sander_origin", spatialmath.NewZeroPose(), sanderGeom)
	fs.AddFrame(sanderFrame, wrist3)

	// Camera sensor - from JSON: sensing-camera_origin dims (0.19m, 0.06m, 0.01m)
	// Position relative to wrist3 for simplified model
	cameraGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 50, Z: 0}),
		r3.Vector{X: 190, Y: 60, Z: 10},
		"camera",
	)
	cameraFrame, _ := referenceframe.NewStaticFrameWithGeometry("sensing-camera_origin", spatialmath.NewZeroPose(), cameraGeom)
	fs.AddFrame(cameraFrame, wrist3)

	// Compliance origin (force sensor location) - from JSON: dims (0.33m, 0.0977m, 0.01m)
	// Position relative to wrist3 for simplified model
	complianceGeom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 0}),
		r3.Vector{X: 330, Y: 97.7, Z: 10}, // mm - from the JSON data
		"compliance",
	)
	complianceFrame, _ := referenceframe.NewStaticFrameWithGeometry("compliance_origin", spatialmath.NewZeroPose(), complianceGeom)
	fs.AddFrame(complianceFrame, wrist3)

	return fs, inputs
}

// createArmLinkFrame creates a frame for an arm link with a box geometry
// Dimensions are in millimeters (mm)
func createArmLinkFrame(name string, dims r3.Vector) referenceframe.Frame {
	geom, _ := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: dims.Z / 2}),
		dims,
		name,
	)
	frame, _ := referenceframe.NewStaticFrameWithGeometry(name, spatialmath.NewZeroPose(), geom)
	return frame
}

// createSandingRobotFrameColors returns a map of frame names to colors based on the naming convention
// Colors match those used in the original sanding application
func createSandingRobotFrameColors() map[string]*Color {
	colors := make(map[string]*Color)

	armColor := NewColor().ByName("orange")
	colors["ur20-modular:shoulder_link"] = armColor
	colors["ur20-modular:upper_arm_link"] = armColor
	colors["ur20-modular:forearm_link"] = armColor
	colors["ur20-modular:wrist_1_link"] = armColor
	colors["ur20-modular:wrist_2_link"] = armColor
	colors["ur20-modular:wrist_3_link"] = armColor

	colors["sensing-camera_origin"] = NewColor().ByName("blue")
	colors["sander_origin"] = NewColor().ByName("cyan")
	colors["hose-guide:"] = NewColor().ByName("goldenrod")
	colors["wall:"] = NewColor().ByName("gray")
	colors["floor:"] = NewColor().ByName("slategray")
	colors["hardtop-middle-wall:"] = NewColor().ByName("magenta")

	// Base and pedestal - red
	colors["base:"] = NewColor().ByName("red")
	colors["pedestal:"] = NewColor().ByName("red")
	colors["computers:"] = NewColor().ByName("red")

	// Compliance origin - red
	colors["compliance_origin"] = NewColor().ByName("red")

	return colors
}

// Helper functions

func writeSnapshot(t *testing.T, snapshot *PassSnapshot, filename string) {
	t.Helper()

	dir := filepath.Join(".", fixturesDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}

	jsonBytes, err := snapshot.Marshal()
	if err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(dir, filename)
	if err := os.WriteFile(path, jsonBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	t.Logf("Successfully generated %s with %d transforms and %d drawings",
		filename, len(snapshot.Transforms()), len(snapshot.Drawings()))
}
