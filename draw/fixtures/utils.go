package draw

import (
	"encoding/base64"
	"math"
)

func Float32SliceToBytes(arr []float32) []byte {
	b := make([]byte, 4*len(arr))
	for i, v := range arr {
		bits := math.Float32bits(v)
		b[4*i+0] = byte(bits)
		b[4*i+1] = byte(bits >> 8)
		b[4*i+2] = byte(bits >> 16)
		b[4*i+3] = byte(bits >> 24)
	}
	return b
}

func Uint8SliceToBytes(arr []uint8) []byte {
	return arr
}

func Byte64EncodedToString(encoded string) string {
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return ""
	}
	return string(decoded)
}
