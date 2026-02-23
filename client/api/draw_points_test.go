package api

import (
	"math"
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/test"
)

// generateTorusKnotPoints generates points along a torus knot for testing.
func generateTorusKnotPoints() []r3.Vector {
	R := 2000.0
	r := 500.0
	rTube := 300.0
	p := 2
	q := 3
	nPath := 500
	nRing := 50

	points := make([]r3.Vector, 0, nPath*nRing)

	maxT := 2 * math.Pi * float64(q)

	for i := range nPath {
		t0 := maxT * float64(i) / float64(nPath)
		t1 := maxT * float64(i+1) / float64(nPath)

		cx := (R + r*math.Cos(float64(q)*t0)) * math.Cos(float64(p)*t0)
		cy := (R + r*math.Cos(float64(q)*t0)) * math.Sin(float64(p)*t0)
		cz := r * math.Sin(float64(q)*t0)

		nx := (R + r*math.Cos(float64(q)*t1)) * math.Cos(float64(p)*t1)
		ny := (R + r*math.Cos(float64(q)*t1)) * math.Sin(float64(p)*t1)
		nz := r * math.Sin(float64(q)*t1)

		tx := nx - cx
		ty := ny - cy
		tz := nz - cz

		ux, uy, uz := 0.0, 0.0, 1.0

		nx1 := ty*uz - tz*uy
		ny1 := tz*ux - tx*uz
		nz1 := tx*uy - ty*ux

		nLen := math.Sqrt(nx1*nx1 + ny1*ny1 + nz1*nz1)
		if nLen == 0 {
			nx1, ny1, nz1 = 0, 1, 0
			nLen = 1
		}
		nx1 /= nLen
		ny1 /= nLen
		nz1 /= nLen

		bx := ty*nz1 - tz*ny1
		by := tz*nx1 - tx*nz1
		bz := tx*ny1 - ty*nx1

		bLen := math.Sqrt(bx*bx + by*by + bz*bz)
		bx /= bLen
		by /= bLen
		bz /= bLen

		for j := range nRing {
			theta := 2 * math.Pi * float64(j) / float64(nRing)
			cosT := math.Cos(theta)
			sinT := math.Sin(theta)

			ox := cosT*nx1*rTube + sinT*bx*rTube
			oy := cosT*ny1*rTube + sinT*by*rTube
			oz := cosT*nz1*rTube + sinT*bz*rTube

			points = append(points, r3.Vector{
				X: cx + ox,
				Y: cy + oy,
				Z: cz + oz,
			})
		}
	}

	return points
}

// runDrawPointsTest generates torus knot points and draws them with the given colors.
func runDrawPointsTest(t *testing.T, name string, colors *[]draw.Color) {
	t.Helper()

	points := generateTorusKnotPoints()

	options := DrawPointsOptions{Name: name, Positions: points}
	if colors != nil {
		options.Colors = *colors
	}
	uuid, err := DrawPoints(options)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuid, test.ShouldNotBeNil)
}

func TestDrawPoints(t *testing.T) {
	startTestServer(t)

	t.Run("DrawPoints", func(t *testing.T) {
		runDrawPointsTest(t, "myPoints", nil)
	})

	t.Run("DrawPointsWithSingleColor", func(t *testing.T) {
		runDrawPointsTest(t, "myPointsSingleColor", &[]draw.Color{draw.ColorFromName("yellow")})
	})

	t.Run("DrawPointsWithColorPalette", func(t *testing.T) {
		runDrawPointsTest(t, "myPointsPalette", &[]draw.Color{
			draw.ColorFromName("yellow"),
			draw.ColorFromName("red"),
			draw.ColorFromName("blue"),
		})
	})

	t.Run("DrawPointsWithPerPointColors", func(t *testing.T) {
		points := generateTorusKnotPoints()
		cc := NewColorfulColorChooser()
		colors := cc.Get(len(points))

		runDrawPointsTest(t, "myPointsPerPoint", &colors)
	})

	t.Run("DrawPointsWithPointSize", func(t *testing.T) {
		points := generateTorusKnotPoints()

		uuid, err := DrawPoints(DrawPointsOptions{
			Name:      "myPointsWithSize",
			Positions: points,
			PointSize: 50,
			Colors:    []draw.Color{draw.ColorFromName("green")},
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})
}
