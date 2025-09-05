package client

import (
	"testing"

	"github.com/viam-labs/motion-tools/client/shapes"

	"math"
	"time"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawGeometries(t *testing.T) {
	t.Run("draw geometries", func(t *testing.T) {
		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 1001, Y: 1, Z: 1},
				&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 101, Y: 100, Z: 200},
			"myBox2",
		)
		test.That(t, err, test.ShouldBeNil)

		sphere, err := spatialmath.NewSphere(
			spatialmath.NewPose(
				r3.Vector{X: 1, Y: 1000, Z: 0},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			100,
			"mySphere2",
		)
		test.That(t, err, test.ShouldBeNil)

		capsule, err := spatialmath.NewCapsule(
			spatialmath.NewPose(
				r3.Vector{X: -1002, Y: 3, Z: 0},
				&spatialmath.OrientationVectorDegrees{Theta: 90, OX: 1, OY: 0, OZ: 1},
			),
			102,
			300,
			"myCapsule2",
		)
		test.That(t, err, test.ShouldBeNil)

		mesh, err := spatialmath.NewMeshFromPLYFile("../data/lod_500.ply")
		pose := spatialmath.NewPose(
			r3.Vector{X: -343.34, Y: -139.51, Z: 537.44},
			&spatialmath.OrientationVectorDegrees{Theta: 90, OX: -0.9943171068536344, OY: -0.0046240014351797976, OZ: -0.10635840177882347},
		)
		meshInWrld := mesh.Transform(pose).(*spatialmath.Mesh)
		test.That(t, err, test.ShouldBeNil)

		sphere2, err := spatialmath.NewSphere(
			spatialmath.NewPose(
				r3.Vector{X: 1, Y: 1, Z: 2000},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			500,
			"mySphere3",
		)
		test.That(t, err, test.ShouldBeNil)

		geometries := []spatialmath.Geometry{box, sphere, capsule, meshInWrld, sphere2}
		geometriesInFrame := referenceframe.NewGeometriesInFrame("myBox", geometries)

		colors := []string{"#EF9A9A", "#EF5350", "#F44336", "fern", "hotpink"}

		test.That(t, DrawGeometries(geometriesInFrame, colors), test.ShouldBeNil)
	})
}

func TestDrawUpdatingGeometries(t *testing.T) {
	t.Run("draw animating boxes", func(t *testing.T) {

		for i := 0; i < 100; i++ {
			box1, err1 := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i)/16.) * 1000, Y: math.Cos(float64(i)/16.) * 1000, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"myBox1",
			)

			box2, err2 := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i+120)/16.) * 1000, Y: math.Cos(float64(i+120)/16.) * 1000, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"myBox2",
			)

			box3, err3 := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i+240)/16.) * 1000, Y: math.Cos(float64(i+240)/16.) * 1000, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"myBox3",
			)

			test.That(t, err1, test.ShouldBeNil)
			test.That(t, err2, test.ShouldBeNil)
			test.That(t, err3, test.ShouldBeNil)

			geometries := []spatialmath.Geometry{box1, box2, box3}
			geometriesInFrame := referenceframe.NewGeometriesInFrame("world", geometries)
			colors := []string{"#EF9A9A", "#EF5350", "#F44336"}

			test.That(t, DrawGeometries(geometriesInFrame, colors), test.ShouldBeNil)
			time.Sleep(16 * time.Millisecond)
		}
	})
}

func TestDrawGeometry(t *testing.T) {
	t.Run("draw box", func(t *testing.T) {
		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 1001, Y: 1, Z: 1},
				&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 101, Y: 100, Z: 200},
			"myBox",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(box, "purple"), test.ShouldBeNil)
	})

	t.Run("draw sphere", func(t *testing.T) {
		box, err := spatialmath.NewSphere(
			spatialmath.NewPose(
				r3.Vector{X: 1, Y: 1000, Z: 0},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			100,
			"mySphere",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(box, "red"), test.ShouldBeNil)
	})

	t.Run("draw capsule", func(t *testing.T) {
		capsule, err := spatialmath.NewCapsule(
			spatialmath.NewPose(
				r3.Vector{X: -1002, Y: 3, Z: 0},
				&spatialmath.OrientationVectorDegrees{Theta: 90, OX: 1, OY: 0, OZ: 1},
			),
			102,
			300,
			"myCapsule",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(capsule, "orange"), test.ShouldBeNil)
	})

	t.Run("draw mesh", func(t *testing.T) {
		mesh, err := spatialmath.NewMeshFromPLYFile("../data/lod_500.ply")
		pose := spatialmath.NewPose(
			r3.Vector{X: -343.34, Y: -139.51, Z: 537.44},
			&spatialmath.OrientationVectorDegrees{Theta: 90, OX: -0.9943171068536344, OY: -0.0046240014351797976, OZ: -0.10635840177882347},
		)
		meshInWrld := mesh.Transform(pose).(*spatialmath.Mesh)

		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(meshInWrld, "blue"), test.ShouldBeNil)
	})
}

func TestDrawUpdatingGeometry(t *testing.T) {
	t.Run("draw animating box", func(t *testing.T) {

		for i := 0; i < 100; i++ {
			box, err := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i)/16.) * 1000, Y: 1, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"myBox",
			)

			test.That(t, err, test.ShouldBeNil)
			test.That(t, DrawGeometry(box, "purple"), test.ShouldBeNil)
			time.Sleep(16 * time.Millisecond)
		}
	})
}

func TestDrawGLTF(t *testing.T) {
	test.That(t, DrawGLTF("../data/flamingo.glb"), test.ShouldBeNil)
	// test.That(t, DrawGLTF("../data/coffeemat.glb"), test.ShouldBeNil)
}

func TestDrawLines(t *testing.T) {
	nTurns := 5.0    // Number of spiral turns
	radius := 1000.0 // Radius of spiral
	height := 4000.0 // Total height of spiral
	nPath := 50      // Number of points along spiral

	points := make([]spatialmath.Pose, 0, nPath)

	maxT := 2 * math.Pi * nTurns

	for i := 0; i < nPath; i++ {
		t := maxT * float64(i) / float64(nPath)

		x := radius * math.Cos(t)
		y := radius * math.Sin(t)
		z := height * float64(i) / float64(nPath) // Linear vertical rise

		points = append(points, spatialmath.NewPoseFromPoint(r3.Vector{
			X: x,
			Y: y,
			Z: z,
		}))
	}

	lineColor := [3]uint8{255, 0, 0}
	dotColor := [3]uint8{0, 255, 0}
	test.That(t, DrawLine("upwardSpiral", points, &lineColor, &dotColor), test.ShouldBeNil)
}

func TestDrawPoints(t *testing.T) {
	R := 2000.0
	r := 500.0
	rTube := 300.0
	p := 2
	q := 3
	nPath := 500
	nRing := 50

	points := make([]spatialmath.Pose, 0, nPath*nRing)
	colors := make([][3]uint8, 0, nPath*nRing)

	maxT := 2 * math.Pi * float64(q)

	for i := range nPath {
		t0 := maxT * float64(i) / float64(nPath)
		t1 := maxT * float64(i+1) / float64(nPath)

		// Center point at t0
		cx := (R + r*math.Cos(float64(q)*t0)) * math.Cos(float64(p)*t0)
		cy := (R + r*math.Cos(float64(q)*t0)) * math.Sin(float64(p)*t0)
		cz := r * math.Sin(float64(q)*t0)

		// Next point (for tangent)
		nx := (R + r*math.Cos(float64(q)*t1)) * math.Cos(float64(p)*t1)
		ny := (R + r*math.Cos(float64(q)*t1)) * math.Sin(float64(p)*t1)
		nz := r * math.Sin(float64(q)*t1)

		// Tangent = next - center
		tx := nx - cx
		ty := ny - cy
		tz := nz - cz

		// Up vector
		ux, uy, uz := 0.0, 0.0, 1.0

		// Cross(tangent, up) → normal
		nx1 := ty*uz - tz*uy
		ny1 := tz*ux - tx*uz
		nz1 := tx*uy - ty*ux

		// Normalize normal
		nLen := math.Sqrt(nx1*nx1 + ny1*ny1 + nz1*nz1)
		if nLen == 0 {
			nx1, ny1, nz1 = 0, 1, 0 // fallback if cross was zero
			nLen = 1
		}
		nx1 /= nLen
		ny1 /= nLen
		nz1 /= nLen

		// Cross(tangent, normal) → binormal
		bx := ty*nz1 - tz*ny1
		by := tz*nx1 - tx*nz1
		bz := tx*ny1 - ty*nx1

		// Normalize binormal
		bLen := math.Sqrt(bx*bx + by*by + bz*bz)
		bx /= bLen
		by /= bLen
		bz /= bLen

		// Create ring
		for j := range nRing {
			theta := 2 * math.Pi * float64(j) / float64(nRing)
			cosT := math.Cos(theta)
			sinT := math.Sin(theta)

			// Offset = cosT * normal + sinT * binormal
			ox := cosT*nx1*rTube + sinT*bx*rTube
			oy := cosT*ny1*rTube + sinT*by*rTube
			oz := cosT*nz1*rTube + sinT*bz*rTube

			points = append(points, spatialmath.NewPoseFromPoint(r3.Vector{
				X: cx + ox,
				Y: cy + oy,
				Z: cz + oz,
			}))

			if j > nRing/2 {
				continue
			}

			colors = append(colors, [3]uint8{
				uint8((cosT + 1) * 127.5),
				uint8((sinT + 1) * 127.5),
				uint8(255 * float64(i) / float64(nPath)),
			})
		}
	}

	defaultColor := [3]uint8{255, 0, 0}
	test.That(t, DrawPoints("myPoints", points, colors, &defaultColor), test.ShouldBeNil)
}

func TestDrawPointCloud(t *testing.T) {
	pc1, err := pointcloud.NewFromFile("../data/octagon.pcd", pointcloud.BasicType)
	test.That(t, err, test.ShouldBeNil)

	pc2, err := pointcloud.NewFromFile("../data/Zaghetto.pcd", pointcloud.BasicType)
	test.That(t, err, test.ShouldBeNil)

	pc3, err := pointcloud.NewFromFile("../data/simple.pcd", pointcloud.BasicType)
	test.That(t, err, test.ShouldBeNil)

	pc4, err := pointcloud.NewFromFile("../data/boat.pcd", pointcloud.BasicType)
	test.That(t, err, test.ShouldBeNil)

	test.That(t, DrawPointCloud("octagon", pc1, &[3]uint8{0, 255, 0}), test.ShouldBeNil)
	test.That(t, DrawPointCloud("Zaghetto", pc2, nil), test.ShouldBeNil)
	test.That(t, DrawPointCloud("simple", pc3, nil), test.ShouldBeNil)
	test.That(t, DrawPointCloud("boat", pc4, nil), test.ShouldBeNil)
}

func TestDrawPoses(t *testing.T) {
	const (
		numPoints = 5000
		radius    = 1000.0
	)

	// Define the center of the sphere
	centerX := 1500.0
	centerY := 1500.0
	centerZ := -300.0

	var poses []spatialmath.Pose
	var colors []string
	pallet := []string{"#6200EA", "#EF5350", "#0091EA", "#E53935", "#D32F2F", "blue"}

	for i := range numPoints {
		phi := math.Acos(1 - 2*float64(i)/float64(numPoints))
		theta := math.Pi * (1 + math.Sqrt(5)) * float64(i)

		x := radius * math.Sin(phi) * math.Cos(theta)
		y := radius * math.Sin(phi) * math.Sin(theta)
		z := radius * math.Cos(phi)

		// Apply offset to shift the sphere center
		x += centerX
		y += centerY
		z += centerZ

		// Orientation: point back toward the center
		dx := centerX - x
		dy := centerY - y
		dz := centerZ - z

		length := math.Sqrt(dx*dx + dy*dy + dz*dz)

		pose := spatialmath.NewPose(
			r3.Vector{X: x, Y: y, Z: z},
			&spatialmath.OrientationVectorDegrees{
				OX:    dx / length,
				OY:    dy / length,
				OZ:    dz / length,
				Theta: 0,
			},
		)

		poses = append(poses, pose)
		colors = append(colors, pallet[i%len(pallet)])
	}

	test.That(t, DrawPoses(poses, colors, true), test.ShouldBeNil)

	box, err := spatialmath.NewSphere(
		spatialmath.NewPose(
			r3.Vector{X: centerX, Y: centerY, Z: centerZ},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		radius,
		"mySpherePose",
	)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, DrawGeometry(box, "turquoise"), test.ShouldBeNil)
}

func TestDrawNurbs(t *testing.T) {
	nurbs := shapes.GenerateNURBS(20, 3)

	test.That(t, DrawNurbs(nurbs, "#40E0D0", "nurbs-1"), test.ShouldBeNil)
}

func TestDrawFrameSystem(t *testing.T) {
	fs := referenceframe.NewEmptyFrameSystem("test")
	dims := r3.Vector{X: 100, Y: 100, Z: 100}

	// add a static frame with a box
	name0 := "frame0"
	box0, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, name0)
	test.That(t, err, test.ShouldBeNil)
	frame0, err := referenceframe.NewStaticFrameWithGeometry(name0, spatialmath.NewZeroPose(), box0)
	test.That(t, err, test.ShouldBeNil)
	fs.AddFrame(frame0, fs.World())

	// add an arm model to the fs
	armName := "arm1"
	model, err := referenceframe.ParseModelJSONFile("../data/ur5e.json", armName)
	test.That(t, err, test.ShouldBeNil)
	fs.AddFrame(model, fs.World())

	// add a static frame as a child of the model
	name2 := "frame1"
	box2, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, name2)
	test.That(t, err, test.ShouldBeNil)
	blockFrame, err := referenceframe.NewStaticFrameWithGeometry(name2, spatialmath.NewZeroPose(), box2)
	test.That(t, err, test.ShouldBeNil)
	fs.AddFrame(blockFrame, model)

	// draw the frame system
	inputs := referenceframe.NewZeroInputs(fs)
	test.That(t, DrawFrameSystem(fs, inputs), test.ShouldBeNil)
	inputs[armName] = referenceframe.FloatsToInputs([]float64{1, 1, 1, 1, 1, 1})
	test.That(t, DrawFrameSystem(fs, inputs), test.ShouldBeNil)
}

func TestDrawWorldState(t *testing.T) {
	dims := r3.Vector{X: 100, Y: 100, Z: 100}

	// make a super simple frame system
	fs := referenceframe.NewEmptyFrameSystem("test")
	frameName := "frame0"
	frame0, err := referenceframe.NewStaticFrame(frameName, spatialmath.NewPoseFromPoint(r3.Vector{Z: 300}))
	test.That(t, err, test.ShouldBeNil)
	fs.AddFrame(frame0, fs.World())

	// make some boxes
	box0, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, "box0")
	test.That(t, err, test.ShouldBeNil)
	box1, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(r3.Vector{X: 300}), dims, "box1")
	test.That(t, err, test.ShouldBeNil)
	box2, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(r3.Vector{Z: 300}), dims, "box2")
	test.That(t, err, test.ShouldBeNil)

	// make the worldstate and draw it
	ws, err := referenceframe.NewWorldState([]*referenceframe.GeometriesInFrame{
		referenceframe.NewGeometriesInFrame(frameName, []spatialmath.Geometry{box0, box1}),
		referenceframe.NewGeometriesInFrame(referenceframe.World, []spatialmath.Geometry{box2}),
	}, nil)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, DrawWorldState(ws, fs, referenceframe.NewZeroInputs(fs)), test.ShouldBeNil)
}

func TestRemoveSpatialObjects(t *testing.T) {
	t.Run("draw box", func(t *testing.T) {
		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 2000, Y: 2000, Z: 100},
				&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 101, Y: 100, Z: 200},
			"box2delete",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(box, "black"), test.ShouldBeNil)

		time.Sleep(1 * time.Second)

		toDelete := []string{"box2delete"}
		test.That(t, RemoveSpatialObjects(toDelete), test.ShouldBeNil)
	})
}

func TestSetCameraPose(t *testing.T) {
	t.Run("set camera pose", func(t *testing.T) {
		position := r3.Vector{X: 10000., Y: 20000., Z: 10000.}
		lookAt := r3.Vector{X: 100., Y: 500., Z: 800.}
		test.That(t, SetCameraPose(position, lookAt, true), test.ShouldBeNil)
	})
}
