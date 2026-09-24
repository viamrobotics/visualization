package api

import (
	"encoding/binary"
	"math"
	"os"
	"testing"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
	"go.viam.com/test"
)

// decodeFloats unpacks the little-endian float32 arrays the draw protos carry
// for positions, so a test can assert on numbers instead of bytes.
func decodeFloats(t *testing.T, packed []byte) []float32 {
	t.Helper()
	test.That(t, len(packed)%4, test.ShouldEqual, 0)

	out := make([]float32, len(packed)/4)
	for i := range out {
		out[i] = math.Float32frombits(binary.LittleEndian.Uint32(packed[i*4:]))
	}
	return out
}

// boolPtr is for the *bool fields on Attrs and Metadata.
func boolPtr(v bool) *bool {
	return &v
}

// strPtr is for the optional string fields on the relationship protos.
func strPtr(v string) *string {
	return &v
}

// writeFile is os.WriteFile with the mode fixed, for building file fixtures.
func writeFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0o600)
}

// nameOf and parentOf name the two fields that are easy to confuse: a Drawing's
// reference_frame carries its name, and the parent frame it hangs off lives on
// pose_in_observer_frame.
func nameOf(drawing *drawv1.Drawing) string {
	return drawing.GetReferenceFrame()
}

func parentOf(drawing *drawv1.Drawing) string {
	return drawing.GetPoseInObserverFrame().GetReferenceFrame()
}

// axesHelperOf and invisibleOf read presence rather than value. The generated
// getters return a bool with a zero default, which cannot distinguish "sent
// false" from "not sent", and that distinction is the point of these tests.
func axesHelperOf(drawing *drawv1.Drawing) *bool {
	if metadata := drawing.GetMetadata(); metadata != nil {
		return metadata.ShowAxesHelper
	}
	return nil
}

func invisibleOf(drawing *drawv1.Drawing) *bool {
	if metadata := drawing.GetMetadata(); metadata != nil {
		return metadata.Invisible
	}
	return nil
}
