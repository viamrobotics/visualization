package draw

import "github.com/golang/geo/r3"

type Units string

const mmToM = 0.001

var (
	UnitsMM Units = "mm"
	UnitsM  Units = "m"
)

func float64ToMeters(value float64) float64 {
	return value * mmToM
}

func float32ToMeters(value float32) float32 {
	return value * mmToM
}

func vectorToMeters(vector r3.Vector) r3.Vector {
	return r3.Vector{X: float64ToMeters(vector.X), Y: float64ToMeters(vector.Y), Z: float64ToMeters(vector.Z)}
}
