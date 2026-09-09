package rdkmath

import (
	sm "go.viam.com/rdk/spatialmath"
)

// Constructors for the spatialmath values the golden generators drive, so a case table reads as the
// list of inputs it is rather than as a wall of field names. Each mirrors the struct literal the RDK
// test the value came from uses.

func ov(theta, x, y, z float64) *sm.OrientationVector {
	return &sm.OrientationVector{Theta: theta, OX: x, OY: y, OZ: z}
}

func ovd(theta, x, y, z float64) *sm.OrientationVectorDegrees {
	return &sm.OrientationVectorDegrees{Theta: theta, OX: x, OY: y, OZ: z}
}

func euler(roll, pitch, yaw float64) *sm.EulerAngles {
	return &sm.EulerAngles{Roll: roll, Pitch: pitch, Yaw: yaw}
}

func r4aa(theta, x, y, z float64) *sm.R4AA {
	return &sm.R4AA{Theta: theta, RX: x, RY: y, RZ: z}
}

func quaternionOf(real, imag, jmag, kmag float64) *sm.Quaternion {
	return &sm.Quaternion{Real: real, Imag: imag, Jmag: jmag, Kmag: kmag}
}
