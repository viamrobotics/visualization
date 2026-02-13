package draw

import (
	"fmt"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

const snapshotDir = "__snapshots__"
const fixturesDir = "fixtures"

func init() {
	rand.Seed(time.Now().UnixNano())
}

func TestNewSnapshot(t *testing.T) {
	t.Run("creates snapshot with defaults", func(t *testing.T) {
		snapshot := NewSnapshot()

		test.That(t, snapshot, test.ShouldNotBeNil)
		test.That(t, len(snapshot.UUID()), test.ShouldEqual, 16)
		test.That(t, snapshot.Transforms(), test.ShouldNotBeNil)
		test.That(t, snapshot.Drawings(), test.ShouldNotBeNil)
		test.That(t, snapshot.SceneMetadata().Grid, test.ShouldBeTrue)
	})

	t.Run("creates snapshot with custom camera", func(t *testing.T) {
		camera := NewSceneCamera(
			r3.Vector{X: 1000, Y: 2000, Z: 3000},
			r3.Vector{X: 0, Y: 0, Z: 0},
		)
		snapshot := NewSnapshot(WithSceneCamera(camera))

		test.That(t, snapshot.SceneMetadata().SceneCamera.Position, test.ShouldResemble, r3.Vector{X: 1000, Y: 2000, Z: 3000})
		test.That(t, snapshot.SceneMetadata().SceneCamera.LookAt, test.ShouldResemble, r3.Vector{X: 0, Y: 0, Z: 0})
	})

	t.Run("creates snapshot with grid disabled", func(t *testing.T) {
		snapshot := NewSnapshot(WithGrid(false))

		test.That(t, snapshot.SceneMetadata().Grid, test.ShouldBeFalse)
	})
}

func TestSnapshotValidate(t *testing.T) {
	t.Run("valid empty snapshot", func(t *testing.T) {
		snapshot := NewSnapshot()
		err := snapshot.Validate()

		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("valid snapshot with geometry", func(t *testing.T) {
		snapshot := NewSnapshot()
		box, _ := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
		err := snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", NewColor(WithName("red")))
		test.That(t, err, test.ShouldBeNil)

		err = snapshot.Validate()
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("nil snapshot", func(t *testing.T) {
		var snapshot *Snapshot
		err := snapshot.Validate()

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "snapshot is nil")
	})
}

func TestSnapshotToProto(t *testing.T) {
	t.Run("converts snapshot to proto", func(t *testing.T) {
		snapshot := NewSnapshot()
		box, _ := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
		_ = snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", NewColor(WithName("red")))

		positions := []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 100, Y: 0, Z: 0}}
		_ = snapshot.DrawPoints("points", "world", spatialmath.NewZeroPose(), positions,
			WithSinglePointColor(NewColor(WithName("blue"))))

		protoSnapshot := snapshot.ToProto()
		test.That(t, protoSnapshot, test.ShouldNotBeNil)
		test.That(t, len(protoSnapshot.Uuid), test.ShouldEqual, 16)
		test.That(t, len(protoSnapshot.Transforms), test.ShouldEqual, 1)
		test.That(t, len(protoSnapshot.Drawings), test.ShouldEqual, 1)
		test.That(t, protoSnapshot.SceneMetadata, test.ShouldNotBeNil)
	})
}

func addVoxelFrame(t *testing.T, frameSystem *referenceframe.FrameSystem, parent referenceframe.Frame, name string, x, y, z int, scale float64) {
	t.Helper()

	// Geometry pose relative to parent frame (this is what FrameSystemGeometries uses)
	geomPose := spatialmath.NewPoseFromPoint(r3.Vector{
		X: float64(x) * scale,
		Y: float64(y) * scale,
		Z: float64(z) * scale,
	})
	voxel, err := spatialmath.NewBox(
		geomPose,
		r3.Vector{X: scale, Y: scale, Z: scale},
		name,
	)
	if err != nil {
		t.Fatal(err)
	}

	// Frame at zero pose - geometry carries the offset
	frame, err := referenceframe.NewStaticFrameWithGeometry(name, spatialmath.NewZeroPose(), voxel)
	if err != nil {
		t.Fatal(err)
	}

	frameSystem.AddFrame(frame, parent)
}

func createBody(
	t *testing.T,
	snapshot *Snapshot,
	name string,
	parent string,
	orbitRadius float64,
	orbitAngle float64,
	bodyRadius float64,
	color Color,
) string {
	t.Helper()

	angleRad := orbitAngle * math.Pi / 180.0
	x := orbitRadius * math.Cos(angleRad)
	y := orbitRadius * math.Sin(angleRad)

	orbitFrameName := name + "-orbit"
	snapshot.DrawFrame("", orbitFrameName, parent, spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: 0}), nil, nil)

	geometry, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), bodyRadius, name)
	if err != nil {
		t.Fatal(err)
	}

	err = snapshot.DrawGeometry(geometry, spatialmath.NewZeroPose(), orbitFrameName, color)
	if err != nil {
		t.Fatal(err)
	}

	return orbitFrameName
}

func createRings(t *testing.T, snapshot *Snapshot, parent string, radius float64, color Color) {
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
	err = snapshot.DrawGeometry(box, pose, parent, color)
	if err != nil {
		t.Fatal(err)
	}
}

func writeSnapshot(t *testing.T, snapshot *Snapshot, filename string) {
	t.Helper()

	dir := filepath.Join(".", snapshotDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}

	// Marshal to JSON
	jsonBytes, err := snapshot.MarshalJSON()
	if err != nil {
		t.Fatal(err)
	}

	// Marshal to binary
	binaryBytes, err := snapshot.MarshalBinary()
	if err != nil {
		t.Fatal(err)
	}

	// Marshal to gzip-compressed binary
	gzipBytes, err := snapshot.MarshalBinaryGzip()
	if err != nil {
		t.Fatal(err)
	}

	// Write JSON file
	jsonPath := filepath.Join(dir, filename)
	if err := os.WriteFile(jsonPath, jsonBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	// Write binary file
	binaryFilename := strings.TrimSuffix(filename, ".json") + ".pb"
	binaryPath := filepath.Join(dir, binaryFilename)
	if err := os.WriteFile(binaryPath, binaryBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	// Write gzip-compressed binary file (replace .json with .pb.gz)
	gzipFilename := strings.TrimSuffix(filename, ".json") + ".pb.gz"
	gzipPath := filepath.Join(dir, gzipFilename)
	if err := os.WriteFile(gzipPath, gzipBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	// Log sizes for benchmarking
	t.Logf("Generated %s: %d transforms, %d drawings", filename, len(snapshot.Transforms()), len(snapshot.Drawings()))
	t.Logf("  JSON: %d bytes", len(jsonBytes))
	t.Logf("  Binary: %d bytes (%.1f%% of JSON)", len(binaryBytes), float64(len(binaryBytes))/float64(len(jsonBytes))*100)
	t.Logf("  Gzip: %d bytes (%.1f%% of JSON)", len(gzipBytes), float64(len(gzipBytes))/float64(len(jsonBytes))*100)
}

func TestGeneratingSnapshots(t *testing.T) {
	// generates a snapshot showcasing a voxel cabin built with boxes using a frame system
	t.Run("snapshot box", func(t *testing.T) {
		snapshot := NewSnapshot(
			WithSceneCamera(
				NewSceneCamera(
					r3.Vector{X: 4000, Y: -4000, Z: 3000},
					r3.Vector{X: 0, Y: 0, Z: 1000},
				),
			),
		)

		voxelScale := 500.0
		voxelSize := r3.Vector{X: voxelScale, Y: voxelScale, Z: voxelScale}

		woodColor := NewColor(WithName("saddlebrown"))                 // wood
		roofColor := NewColor(WithName("maroon"))                      // roof
		windowColor := NewColor(WithName("blue")).SetAlpha(uint8(128)) // window
		doorColor := NewColor(WithName("sienna"))                      // door
		chimneyColor := NewColor(WithName("darkgray"))                 // chimney
		benchColor := NewColor(WithName("lightgray"))                  // bench
		chestColor := NewColor(WithName("darkgoldenrod"))              // chest
		furnitureColor := NewColor(WithName("peru"))                   // furniture

		// Create frame system and house root frame
		fs := referenceframe.NewEmptyFrameSystem("world")
		houseFrame, _ := referenceframe.NewStaticFrame("house", spatialmath.NewZeroPose())
		fs.AddFrame(houseFrame, fs.World())

		// Create floor parent frame (origin at the corner of the floor)
		floorOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -4 * voxelScale, Y: -3 * voxelScale, Z: 0})
		floorParent, _ := referenceframe.NewStaticFrame("floor", floorOrigin)
		fs.AddFrame(floorParent, houseFrame)

		// Floor voxels (positioned relative to floor origin)
		for x := range 8 {
			for y := range 6 {
				addVoxelFrame(t, fs, floorParent, fmt.Sprintf("floor_voxel_%d_%d", x, y), x, y, 0, voxelScale)
			}
		}

		// Create walls parent frame (origin at corner of the walls at ground level)
		wallsOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -4 * voxelScale, Y: -3 * voxelScale, Z: 1 * voxelScale})
		wallsParent, _ := referenceframe.NewStaticFrame("walls", wallsOrigin)
		fs.AddFrame(wallsParent, houseFrame)

		// Front wall (Y = 0 relative to walls origin) with door opening
		for x := 0; x < 8; x++ {
			for z := 0; z < 4; z++ {
				// Skip door opening (originally at x=-1 to 0, z=1-2 in world, now x=3-4, z=0-1 in walls frame)
				if !(z <= 1 && x >= 3 && x <= 4) {
					addVoxelFrame(t, fs, wallsParent, fmt.Sprintf("front_wall_%d_%d", x, z), x, 0, z, voxelScale)
				}
			}
		}

		// Back wall (Y = 5 relative to walls origin) - skip window positions
		for x := 0; x < 8; x++ {
			for z := 0; z < 4; z++ {
				// Skip window positions (originally at x=-1 to 0, z=2 in world, now x=3-4, z=1 in walls frame)
				if !(z == 1 && x >= 3 && x <= 4) {
					addVoxelFrame(t, fs, wallsParent, fmt.Sprintf("back_wall_%d_%d", x, z), x, 5, z, voxelScale)
				}
			}
		}

		// Left wall (X = 0 relative to walls origin) - skip window position
		for y := 0; y < 6; y++ {
			for z := 0; z < 4; z++ {
				// Skip window position (originally at y=0, z=2 in world, now y=3, z=1 in walls frame)
				if !(z == 1 && y == 3) {
					addVoxelFrame(t, fs, wallsParent, fmt.Sprintf("left_wall_%d_%d", y, z), 0, y, z, voxelScale)
				}
			}
		}

		// Right wall (X = 7 relative to walls origin)
		for y := 0; y < 6; y++ {
			for z := 0; z < 4; z++ {
				addVoxelFrame(t, fs, wallsParent, fmt.Sprintf("right_wall_%d_%d", y, z), 7, y, z, voxelScale)
			}
		}

		// Create windows parent frame (origin at first window position)
		windowsOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -1 * 500, Y: 2 * 500, Z: 2 * 500})
		windowsParent, _ := referenceframe.NewStaticFrame("windows", windowsOrigin)
		fs.AddFrame(windowsParent, houseFrame)

		// Back wall windows (relative to windows origin)
		addVoxelFrame(t, fs, windowsParent, "back_window_1", 0, 0, 0, voxelScale)
		addVoxelFrame(t, fs, windowsParent, "back_window_2", 1, 0, 0, voxelScale)
		addVoxelFrame(t, fs, windowsParent, "back_window_2", 1, 0, 0, voxelScale)

		// Left wall window (relative to windows origin)
		addVoxelFrame(t, fs, windowsParent, "left_window", -3, -2, 0, voxelScale)

		// Create roof parent frame (origin at corner of the roof base)
		roofOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -5 * 500, Y: -4 * 500, Z: 5 * 500})
		roofParent, _ := referenceframe.NewStaticFrame("roof", roofOrigin)
		fs.AddFrame(roofParent, houseFrame)

		// Roof layer 1 (base layer, relative to roof origin)
		for x := 0; x < 10; x++ {
			for y := 0; y < 8; y++ {
				addVoxelFrame(t, fs, roofParent, fmt.Sprintf("roof_1_%d_%d", x, y), x, y, 0, voxelScale)
			}
		}
		// Roof layer 2
		for x := 1; x < 9; x++ {
			for y := 1; y < 7; y++ {
				addVoxelFrame(t, fs, roofParent, fmt.Sprintf("roof_2_%d_%d", x, y), x, y, 1, voxelScale)
			}
		}
		// Roof layer 3
		for x := 2; x < 8; x++ {
			for y := 2; y < 6; y++ {
				addVoxelFrame(t, fs, roofParent, fmt.Sprintf("roof_3_%d_%d", x, y), x, y, 2, voxelScale)
			}
		}
		// Roof peak
		for x := 3; x < 7; x++ {
			for y := 3; y < 5; y++ {
				addVoxelFrame(t, fs, roofParent, fmt.Sprintf("roof_peak_%d_%d", x, y), x, y, 3, voxelScale)
			}
		}

		// Create door parent frame (origin at door position)
		doorOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: 1 * 500, Y: -5 * 500, Z: 1 * 500})
		doorParent, _ := referenceframe.NewStaticFrame("door", doorOrigin)
		fs.AddFrame(doorParent, houseFrame)

		// Door voxels (1x2x2 grid, relative to door origin)
		addVoxelFrame(t, fs, doorParent, "door_1", 0, 0, 0, voxelScale)
		addVoxelFrame(t, fs, doorParent, "door_2", 0, 1, 0, voxelScale)
		addVoxelFrame(t, fs, doorParent, "door_3", 0, 0, 1, voxelScale)
		addVoxelFrame(t, fs, doorParent, "door_4", 0, 1, 1, voxelScale)

		// Create chimney parent frame (origin at chimney base)
		chimneyOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: 2 * 500, Y: 1 * 500, Z: 6 * 500})
		chimneyParent, _ := referenceframe.NewStaticFrame("chimney", chimneyOrigin)
		fs.AddFrame(chimneyParent, houseFrame)

		// Chimney voxels (vertical stack, relative to chimney origin)
		addVoxelFrame(t, fs, chimneyParent, "chimney_1", 0, 0, 0, voxelScale)
		addVoxelFrame(t, fs, chimneyParent, "chimney_2", 0, 0, 1, voxelScale)
		addVoxelFrame(t, fs, chimneyParent, "chimney_3", 0, 0, 2, voxelScale)
		addVoxelFrame(t, fs, chimneyParent, "chimney_4", 0, 0, 3, voxelScale)

		// Create table parent frame (origin at table position)
		tableOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -1 * 500, Y: 0, Z: 1 * 500})
		tableParent, _ := referenceframe.NewStaticFrame("table", tableOrigin)
		fs.AddFrame(tableParent, houseFrame)

		// Table voxels (2 blocks side by side, relative to table origin)
		addVoxelFrame(t, fs, tableParent, "table_1", 0, 0, 0, voxelScale)
		addVoxelFrame(t, fs, tableParent, "table_2", 1, 0, 0, voxelScale)

		// Create bench parent frame (origin at bench position)
		benchOrigin := spatialmath.NewPoseFromPoint(r3.Vector{X: -3 * 500, Y: -2 * 500, Z: 1 * 500})
		benchParent, _ := referenceframe.NewStaticFrame("bench", benchOrigin)
		fs.AddFrame(benchParent, houseFrame)

		// Bench voxels (2 blocks stacked vertically, relative to bench origin)
		addVoxelFrame(t, fs, benchParent, "bench_1", 0, 0, 0, voxelScale)
		addVoxelFrame(t, fs, benchParent, "bench_2", 0, 0, 1, voxelScale)

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
		frameColors := map[string]Color{
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
		inputs := referenceframe.NewZeroInputs(fs)
		err := snapshot.DrawFrameSystemGeometries(fs, inputs, frameColors)
		if err != nil {
			t.Fatal(err)
		}

		writeSnapshot(t, snapshot, "visualization_snapshot_box.json")

	})

	// generates a snapshot showcasing a complete solar system with all planets and moons
	t.Run("snapshot sphere", func(t *testing.T) {
		snapshot := NewSnapshot(
			WithSceneCamera(
				NewSceneCamera(
					r3.Vector{X: 40000, Y: 40000, Z: 30000},
					r3.Vector{X: 0, Y: 0, Z: 0},
				),
			),
		)

		sunOrbitFrame := "sun-orbit"
		snapshot.DrawFrame("", sunOrbitFrame, "world", spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 2000}), nil, nil)

		sunGeometry, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 2000, "sun")
		if err != nil {
			t.Fatal(err)
		}

		err = snapshot.DrawGeometry(sunGeometry, spatialmath.NewZeroPose(), sunOrbitFrame, NewColor(WithName("orange")))
		if err != nil {
			t.Fatal(err)
		}

		createBody(t, snapshot, "mercury", sunOrbitFrame, 4000, 10, 350, NewColor(WithName("dimgray")))
		createBody(t, snapshot, "venus", sunOrbitFrame, 6000, 50, 700, NewColor(WithName("wheat")))

		earthOrbit := createBody(t, snapshot, "earth", sunOrbitFrame, 8000, 95, 750, NewColor(WithName("dodgerblue")))
		createBody(t, snapshot, "moon", earthOrbit, 1400, 135, 200, NewColor(WithName("silver")))

		marsOrbit := createBody(t, snapshot, "mars", sunOrbitFrame, 10000, 175, 500, NewColor(WithName("orangered")))
		createBody(t, snapshot, "phobos", marsOrbit, 900, 45, 75, NewColor(WithName("dimgray")))
		createBody(t, snapshot, "deimos", marsOrbit, 1200, 225, 60, NewColor(WithName("darkgray")))

		jupiterOrbit := createBody(t, snapshot, "jupiter", sunOrbitFrame, 14000, 250, 1500, NewColor(WithName("tan")))
		createBody(t, snapshot, "io", jupiterOrbit, 2100, 0, 200, NewColor(WithName("orange")))
		createBody(t, snapshot, "europa", jupiterOrbit, 2400, 90, 175, NewColor(WithName("azure")))
		createBody(t, snapshot, "ganymede", jupiterOrbit, 2700, 180, 250, NewColor(WithName("slategray")))
		createBody(t, snapshot, "callisto", jupiterOrbit, 3000, 270, 225, NewColor(WithName("darkslategray")))

		saturnOrbit := createBody(t, snapshot, "saturn", sunOrbitFrame, 18000, 315, 1300, NewColor(WithName("palegoldenrod")))
		createRings(t, snapshot, saturnOrbit, 1600, NewColor(WithName("palegoldenrod")).SetAlpha(uint8(128)))
		createBody(t, snapshot, "rhea", saturnOrbit, 2100, 110, 125, NewColor(WithName("gainsboro")))
		createBody(t, snapshot, "enceladus", saturnOrbit, 1850, 200, 100, NewColor(WithName("snow")))
		createBody(t, snapshot, "mimas", saturnOrbit, 1700, 290, 90, NewColor(WithName("silver")))

		uranusOrbit := createBody(t, snapshot, "uranus", sunOrbitFrame, 22000, 25, 900, NewColor(WithName("paleturquoise")))
		createRings(t, snapshot, uranusOrbit, 1100, NewColor(WithName("paleturquoise")).SetAlpha(uint8(128)))
		createBody(t, snapshot, "titania", uranusOrbit, 1900, 0, 150, NewColor(WithName("lightslategray")))
		createBody(t, snapshot, "oberon", uranusOrbit, 2100, 90, 140, NewColor(WithName("gray")))
		createBody(t, snapshot, "umbriel", uranusOrbit, 1700, 180, 125, NewColor(WithName("dimgray")))
		createBody(t, snapshot, "ariel", uranusOrbit, 1550, 270, 130, NewColor(WithName("darkgray")))

		neptuneOrbit := createBody(t, snapshot, "neptune", sunOrbitFrame, 26000, 110, 850, NewColor(WithName("royalblue")))
		createRings(t, snapshot, neptuneOrbit, 950, NewColor(WithName("royalblue")).SetAlpha(uint8(128)))
		createBody(t, snapshot, "triton", neptuneOrbit, 1800, 200, 200, NewColor(WithName("lavender")))

		plutoOrbit := createBody(t, snapshot, "pluto", sunOrbitFrame, 30000, 195, 225, NewColor(WithName("tan")))
		createBody(t, snapshot, "charon", plutoOrbit, 750, 90, 125, NewColor(WithName("gray")))

		createBody(t, snapshot, "ceres", sunOrbitFrame, 11500, 140, 175, NewColor(WithName("rosybrown")))

		writeSnapshot(t, snapshot, "visualization_snapshot_sphere.json")
	})

	// generates a snapshot of a city simulation with plots, buildings, and citizens
	t.Run("snapshot capsule", func(t *testing.T) {
		snapshot := NewSnapshot(
			WithSceneCamera(
				NewSceneCamera(
					r3.Vector{X: 15000, Y: -15000, Z: 12000},
					r3.Vector{X: 0, Y: 0, Z: 2000},
				),
			),
		)

		roadColor := NewColor(WithName("darkgray"))
		grassColor := NewColor(WithName("green"))
		concreteColor := NewColor(WithName("lightgray"))
		buildingColors := []Color{
			NewColor(WithName("beige")),
			NewColor(WithName("lightblue")),
			NewColor(WithName("lavender")),
			NewColor(WithName("lightyellow")),
		}
		citizenColor := NewColor(WithName("purple"))

		plotSize := 3000.0     // Each plot is 3m x 3m (scaled up)
		plotThickness := 200.0 // Thick enough to cover axes helper gizmo
		gridSize := 8          // 8x8 grid

		// Create frame system
		fs := referenceframe.NewEmptyFrameSystem("world")
		rootFrame, _ := referenceframe.NewStaticFrame("root", spatialmath.NewZeroPose())
		fs.AddFrame(rootFrame, fs.World())

		// Create color map
		frameColors := map[string]Color{
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
				var plotColor Color
				isRoad := (i == gridSize/2 || j == gridSize/2)  // Cross roads through center
				isConcrete := !isRoad && (i%2 == 0 && j%2 == 0) // Some plots are concrete

				if isRoad {
					plotColor = roadColor
				} else if isConcrete {
					plotColor = concreteColor
				} else {
					plotColor = grassColor
				}

				// Per RDK's FrameSystemGeometries: geometry pose defines position relative to parent
				plotGeomPose := spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: plotThickness / 2.0})
				plot, _ := spatialmath.NewBox(
					plotGeomPose,
					r3.Vector{X: plotSize, Y: plotSize, Z: plotThickness},
					plotName,
				)
				plotFrame, _ := referenceframe.NewStaticFrameWithGeometry(plotName, spatialmath.NewZeroPose(), plot)
				fs.AddFrame(plotFrame, rootFrame)
				frameColors[plotName] = plotColor

				// Add buildings on some non-road plots
				if !isRoad && rand.Float64() < 0.4 { // 40% chance of building
					buildingHeight := 2000.0 + rand.Float64()*6000.0 // Random height 2-8m
					buildingWidth := 2000.0 + rand.Float64()*800.0   // Random width 2-2.8m
					buildingDepth := 2000.0 + rand.Float64()*800.0   // Random depth 2-2.8m
					buildingColor := buildingColors[rand.Intn(len(buildingColors))]
					buildingName := plotName + "_building"

					// Building geometry position relative to root (since plot frame is at root)
					// Building sits on top of the plot
					buildingGeomPose := spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: plotThickness + buildingHeight/2.0})
					building, _ := spatialmath.NewBox(
						buildingGeomPose,
						r3.Vector{X: buildingWidth, Y: buildingDepth, Z: buildingHeight},
						buildingName,
					)
					buildingFrame, _ := referenceframe.NewStaticFrameWithGeometry(buildingName, spatialmath.NewZeroPose(), building)
					fs.AddFrame(buildingFrame, rootFrame)
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
			cx := (rand.Float64()*2.0 - 1.0) * cityBounds
			cy := (rand.Float64()*2.0 - 1.0) * cityBounds
			cz := plotThickness + citizenHeight/2.0 // Standing on top of ground plots

			rotation := rand.Float64() * 360.0
			personName := fmt.Sprintf("person_%d", i)

			// Per RDK's FrameSystemGeometries: geometry pose defines position relative to parent
			personGeomPose := spatialmath.NewPose(
				r3.Vector{X: cx, Y: cy, Z: cz},
				&spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: rotation},
			)
			citizen, _ := spatialmath.NewCapsule(
				personGeomPose,
				50.0,          // Radius (body width) - 100mm diameter
				citizenHeight, // Height (person height) - small but visible
				personName,
			)
			personFrame, _ := referenceframe.NewStaticFrameWithGeometry(personName, spatialmath.NewZeroPose(), citizen)
			fs.AddFrame(personFrame, peopleFrame)
			frameColors[personName] = citizenColor
		}

		// Draw the frame system
		inputs := referenceframe.FrameSystemInputs{}
		err := snapshot.DrawFrameSystemGeometries(fs, inputs, frameColors)
		if err != nil {
			t.Fatal(err)
		}

		writeSnapshot(t, snapshot, "visualization_snapshot_capsule.json")
	})

	// generates a snapshot showcasing arrow drawings
	t.Run("snapshot arrows", func(t *testing.T) {

		snapshot := NewSnapshot(
			WithSceneCamera(
				NewSceneCamera(
					r3.Vector{X: 2000, Y: 2000, Z: 1500},
					r3.Vector{X: 0, Y: 0, Z: 0},
					WithAnimated(false),
				),
			),
		)

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
		err = snapshot.DrawGeometry(box, boxPose, "world", NewColor(WithName("red")))
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
			{r3.Vector{X: 0, Y: 0, Z: -1}, r3.Vector{X: 0, Y: 0, Z: boxHalfSize}}, // Top
			{r3.Vector{X: 0, Y: 0, Z: 1}, r3.Vector{X: 0, Y: 0, Z: -boxHalfSize}}, // Bottom
			{r3.Vector{X: 0, Y: -1, Z: 0}, r3.Vector{X: 0, Y: boxHalfSize, Z: 0}}, // Front (+Y)
			{r3.Vector{X: 0, Y: 1, Z: 0}, r3.Vector{X: 0, Y: -boxHalfSize, Z: 0}}, // Back (-Y)
			{r3.Vector{X: -1, Y: 0, Z: 0}, r3.Vector{X: boxHalfSize, Y: 0, Z: 0}}, // Right (+X)
			{r3.Vector{X: 1, Y: 0, Z: 0}, r3.Vector{X: -boxHalfSize, Y: 0, Z: 0}}, // Left (-X)
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

		err = snapshot.DrawArrows(
			"box-surface-arrows",
			"world",
			spatialmath.NewZeroPose(),
			boxArrowPoses,
			WithSingleArrowColor(NewColor(WithName("red"))),
		)
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
		err = snapshot.DrawGeometry(sphere, spherePose, "world", NewColor(WithName("green")))
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

		err = snapshot.DrawArrows(
			"sphere-surface-arrows",
			"world",
			spatialmath.NewZeroPose(),
			sphereArrowPoses,
			WithSingleArrowColor(NewColor(WithName("green"))),
		)
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
		err = snapshot.DrawGeometry(capsule, capsulePose, "world", NewColor(WithName("blue")))
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

		err = snapshot.DrawArrows(
			"capsule-surface-arrows",
			"world",
			spatialmath.NewZeroPose(),
			capsuleArrowPoses,
			WithSingleArrowColor(NewColor(WithName("blue"))),
		)
		if err != nil {
			t.Fatal(err)
		}

		writeSnapshot(t, snapshot, "visualization_snapshot_arrows.json")
	})

	// generates a snapshot showcasing lines navigating around obstacles
	t.Run("snapshot lines", func(t *testing.T) {
		snapshot := NewSnapshot(
			WithSceneCamera(
				NewSceneCamera(
					r3.Vector{X: 8000, Y: 8000, Z: 6000},
					r3.Vector{X: 0, Y: 0, Z: 1000},
				),
			),
		)

		obstacleColors := []Color{
			NewColor(WithName("red")),
			NewColor(WithName("green")),
			NewColor(WithName("blue")),
			NewColor(WithName("yellow")),
			NewColor(WithName("magenta")),
			NewColor(WithName("cyan")),
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

				err = snapshot.DrawGeometry(box, spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: z}), "world", color)
				if err != nil {
					t.Fatal(err)
				}
			} else {
				sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), size/2.0, fmt.Sprintf("obstacle-sphere-%d", i))
				if err != nil {
					t.Fatal(err)
				}
				err = snapshot.DrawGeometry(sphere, spatialmath.NewPoseFromPoint(r3.Vector{X: x, Y: y, Z: z}), "world", color)
				if err != nil {
					t.Fatal(err)
				}
			}
		}

		lineColors := []Color{
			NewColor(WithName("red")),
			NewColor(WithName("green")),
			NewColor(WithName("orange")),
			NewColor(WithName("magenta")),
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
		err := snapshot.DrawLine(
			"smooth-path",
			"world",
			spatialmath.NewZeroPose(),
			path1,
		)
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
		err = snapshot.DrawLine(
			"zigzag-path",
			"world",
			spatialmath.NewZeroPose(),
			path2,
			WithLineWidth(20.0),
			WithPointSize(10.0),
			WithLineColors(lineColors[0], nil),
		)
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
		err = snapshot.DrawLine(
			"spiral-path",
			"world",
			spatialmath.NewZeroPose(),
			path3,
			WithLineWidth(12.0),
			WithPointSize(10.0),
			WithLineColors(lineColors[1], nil),
		)
		if err != nil {
			t.Fatal(err)
		}

		// Path 4: Straight diagonal path with very few points
		var path4 []r3.Vector
		path4 = append(path4, r3.Vector{X: -3500, Y: -3500, Z: 300})
		path4 = append(path4, r3.Vector{X: -1000, Y: 0, Z: 800})
		path4 = append(path4, r3.Vector{X: 1000, Y: 1500, Z: 1200})
		path4 = append(path4, r3.Vector{X: 3500, Y: 3500, Z: 500})
		err = snapshot.DrawLine(
			"straight-path",
			"world",
			spatialmath.NewZeroPose(),
			path4,
			WithLineWidth(25.0),
			WithPointSize(10.0),
			WithLineColors(lineColors[2], nil),
		)
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
		err = snapshot.DrawLine(
			"helix-path",
			"world",
			spatialmath.NewZeroPose(),
			path5,
			WithLineWidth(18.0),
			WithPointSize(10.0),
			WithLineColors(lineColors[3], nil),
		)
		if err != nil {
			t.Fatal(err)
		}

		writeSnapshot(t, snapshot, "visualization_snapshot_line.json")
	})

	// generates a snapshot showcasing points shapes
	t.Run("snapshot points", func(t *testing.T) {
		snapshot := NewSnapshot(
			WithSceneCamera(
				NewSceneCamera(
					r3.Vector{X: 8000, Y: 8000, Z: 6000},
					r3.Vector{X: 0, Y: 0, Z: 1000},
				),
			),
		)

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

		err := snapshot.DrawPoints(
			"grid-points",
			"world",
			spatialmath.NewZeroPose(),
			gridPoints,
			WithSinglePointColor(NewColor(WithName("red"))),
			WithPointsSize(pointSize),
		)
		if err != nil {
			t.Fatal(err)
		}

		// 2. Per-point colored points in a sphere (1200mm radius, ~100mm average spacing)
		var spherePoints []r3.Vector
		var sphereColors []Color
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
			sphereColors = append(sphereColors, NewColor(WithHSV(float32(hue), 1.0, 1.0)))
		}

		err = snapshot.DrawPoints(
			"sphere-points",
			"world",
			spatialmath.NewZeroPose(),
			spherePoints,
			WithPerPointColors(sphereColors...),
			WithPointsSize(pointSize),
		)
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

		err = snapshot.DrawPoints(
			"wave-points",
			"world",
			spatialmath.NewZeroPose(),
			wavePoints,
			WithSinglePointColor(NewColor(WithName("blue"))),
			WithPointsSize(pointSize),
		)
		if err != nil {
			t.Fatal(err)
		}

		writeSnapshot(t, snapshot, "visualization_snapshot_points.json")
	})

	// generates a snapshot showcasing model shapes with fun models
	t.Run("snapshot model", func(t *testing.T) {
		snapshot := NewSnapshot(
			WithSceneCamera(
				NewSceneCamera(
					r3.Vector{X: 3000, Y: 3000, Z: 2000},
					r3.Vector{X: 0, Y: 0, Z: 300},
				),
			),
		)

		createPose := func(x, y, z float64) spatialmath.Pose {
			orientation := &spatialmath.OrientationVectorDegrees{
				OX: 1, OY: 0, OZ: 0, Theta: 90,
			}
			return spatialmath.NewPose(r3.Vector{X: x, Y: y, Z: z}, orientation)
		}

		// 1. Duck - Classic rubber duck from URL
		duckURL := "http://localhost:5173/models/Duck.glb"
		duckSize := uint64(120072)
		duckAsset, err := NewURLModelAsset("model/gltf-binary", duckURL, WithModelAssetSizeBytes(duckSize))
		if err != nil {
			t.Fatal(err)
		}
		err = snapshot.DrawModel(
			"duck",
			"world",
			createPose(-2000, -2000, 0),
			WithModelAssets(duckAsset),
		)
		if err != nil {
			t.Fatal(err)
		}

		// 2. Avocado - Fresh avocado from URL
		avocadoURL := "http://localhost:5173/models/Avocado.glb"
		avocadoSize := uint64(8110256)
		avocadoAsset, err := NewURLModelAsset("model/gltf-binary", avocadoURL, WithModelAssetSizeBytes(avocadoSize))
		if err != nil {
			t.Fatal(err)
		}
		err = snapshot.DrawModel(
			"avocado",
			"world",
			createPose(0, -2000, 0),
			WithModelAssets(avocadoAsset),
			WithModelScale(r3.Vector{X: 20.0, Y: 20.0, Z: 20.0}),
		)
		if err != nil {
			t.Fatal(err)
		}

		// 3. Lantern - Medieval lantern from URL
		lanternURL := "http://localhost:5173/models/Lantern.glb"
		lanternSize := uint64(9564180)
		lanternAsset, err := NewURLModelAsset("model/gltf-binary", lanternURL, WithModelAssetSizeBytes(lanternSize))
		if err != nil {
			t.Fatal(err)
		}
		err = snapshot.DrawModel(
			"lantern",
			"world",
			createPose(2000, -2000, 0),
			WithModelAssets(lanternAsset),
			WithModelScale(r3.Vector{X: 0.04, Y: 0.04, Z: 0.04}),
		)
		if err != nil {
			t.Fatal(err)
		}

		// 4. Animated Box - An animated box scene from GLB data
		boxData, err := os.ReadFile(filepath.Join(".", fixturesDir, "BoxAnimated.glb"))
		if err != nil {
			t.Fatal(err)
		}
		boxAnimationName := "animation_0"
		boxAsset, err := NewBinaryModelAsset("model/gltf-binary", boxData, WithModelAssetSizeBytes(uint64(len(boxData))))
		if err != nil {
			t.Fatal(err)
		}
		err = snapshot.DrawModel(
			"box",
			"world",
			createPose(-2000, 2000, 600),
			WithModelAssets(boxAsset),
			WithModelAnimationName(boxAnimationName),
		)
		if err != nil {
			t.Fatal(err)
		}

		// 5. Milk Truck - Cesium's iconic milk truck from GLB data
		milkTruckData, err := os.ReadFile(filepath.Join(".", fixturesDir, "CesiumMilkTruck.glb"))
		if err != nil {
			t.Fatal(err)
		}
		milkTruckAsset, err := NewBinaryModelAsset("model/gltf-binary", milkTruckData, WithModelAssetSizeBytes(uint64(len(milkTruckData))))
		if err != nil {
			t.Fatal(err)
		}
		err = snapshot.DrawModel(
			"milktruck",
			"world",
			createPose(0, 2000, 0),
			WithModelAssets(milkTruckAsset),
			WithModelScale(r3.Vector{X: 0.4, Y: 0.4, Z: 0.4}),
		)
		if err != nil {
			t.Fatal(err)
		}

		// 6. Fox - Animated fox character from GLB data
		foxData, err := os.ReadFile(filepath.Join(".", fixturesDir, "Fox.glb"))
		if err != nil {
			t.Fatal(err)
		}
		foxAsset, err := NewBinaryModelAsset("model/gltf-binary", foxData, WithModelAssetSizeBytes(uint64(len(foxData))))
		if err != nil {
			t.Fatal(err)
		}
		err = snapshot.DrawModel(
			"fox",
			"world",
			createPose(2000, 2000, 0),
			WithModelAssets(foxAsset),
			WithModelScale(r3.Vector{X: 0.02, Y: 0.02, Z: 0.02}),
		)
		if err != nil {
			t.Fatal(err)
		}

		writeSnapshot(t, snapshot, "visualization_snapshot_model.json")
	})
}
