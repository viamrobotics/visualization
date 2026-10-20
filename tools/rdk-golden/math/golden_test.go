package rdkmath

// goldenQuaternion names the components of a quat.Number, whose own fields are Real/Imag/Jmag/Kmag.
// Three.js orders a quaternion (x, y, z, w) and RDK writes the scalar first, so spelling each one
// out is for consistency.
type goldenQuaternion struct {
	W float64 `json:"w"`
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

func quatOf(w, x, y, z float64) *goldenQuaternion {
	return &goldenQuaternion{W: w, X: x, Y: y, Z: z}
}
