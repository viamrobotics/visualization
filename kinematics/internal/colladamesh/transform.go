package colladamesh

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/golang/geo/r3"
)

// matrixSize is the row and column count of a COLLADA transform matrix.
const matrixSize = 4

// matrix is a row-major 4x4 transform for column vectors, as COLLADA's `<matrix>` is.
type matrix [matrixSize][matrixSize]float64

func identity() matrix {
	return matrix{{1, 0, 0, 0}, {0, 1, 0, 0}, {0, 0, 1, 0}, {0, 0, 0, 1}}
}

func (a matrix) times(b matrix) matrix {
	var product matrix
	for row := range product {
		for column := range product[row] {
			for k := range a[row] {
				product[row][column] += a[row][k] * b[k][column]
			}
		}
	}
	return product
}

func (a matrix) apply(point r3.Vector) r3.Vector {
	return r3.Vector{
		X: a[0][0]*point.X + a[0][1]*point.Y + a[0][2]*point.Z + a[0][3],
		Y: a[1][0]*point.X + a[1][1]*point.Y + a[1][2]*point.Z + a[1][3],
		Z: a[2][0]*point.X + a[2][1]*point.Y + a[2][2]*point.Z + a[2][3],
	}
}

// elementMatrix converts the text of one transform element of a node into its matrix.
func elementMatrix(element, text, nodeID string) (matrix, error) {
	var wantCount int
	switch element {
	case "matrix":
		wantCount = 16
	case "rotate":
		wantCount = 4
	default:
		wantCount = 3
	}
	fields := strings.Fields(text)
	if len(fields) != wantCount {
		return matrix{}, fmt.Errorf("colladamesh: <%s> of <node id=%q> has %d floats, need %d", element, nodeID, len(fields), wantCount)
	}
	values := make([]float64, len(fields))
	for i, field := range fields {
		value, err := strconv.ParseFloat(field, 64)
		if err != nil {
			return matrix{}, fmt.Errorf("colladamesh: <%s> of <node id=%q> has malformed float %q", element, nodeID, field)
		}
		values[i] = value
	}

	result := identity()
	switch element {
	case "matrix":
		for i, value := range values {
			result[i/matrixSize][i%matrixSize] = value
		}
	case "translate":
		result[0][3], result[1][3], result[2][3] = values[0], values[1], values[2]
	case "scale":
		result[0][0], result[1][1], result[2][2] = values[0], values[1], values[2]
	case "rotate":
		return rotation(values[:3], values[3], nodeID)
	}
	return result, nil
}

func rotation(axis []float64, degrees float64, nodeID string) (matrix, error) {
	length := math.Sqrt(axis[0]*axis[0] + axis[1]*axis[1] + axis[2]*axis[2])
	if length == 0 {
		return matrix{}, fmt.Errorf("colladamesh: <rotate> of <node id=%q> has a zero axis", nodeID)
	}
	x, y, z := axis[0]/length, axis[1]/length, axis[2]/length
	sin, cos := math.Sincos(degrees * math.Pi / 180)
	oneMinusCos := 1 - cos
	return matrix{
		{cos + x*x*oneMinusCos, x*y*oneMinusCos - z*sin, x*z*oneMinusCos + y*sin, 0},
		{y*x*oneMinusCos + z*sin, cos + y*y*oneMinusCos, y*z*oneMinusCos - x*sin, 0},
		{z*x*oneMinusCos - y*sin, z*y*oneMinusCos + x*sin, cos + z*z*oneMinusCos, 0},
		{0, 0, 0, 1},
	}, nil
}
