package client

import (
	"testing"

	"math"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawPoints(t *testing.T) {
	t.Run("DrawPoints", func(t *testing.T) {

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
	})
}
