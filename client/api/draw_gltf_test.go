package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"
)

func TestDrawGLTF(t *testing.T) {
	startTestServer(t)

	t.Run("DrawGLTF", func(t *testing.T) {
		showAxesHelper := false
		uuid, err := DrawGLTF(DrawGLTFOptions{
			Name:     "flamingo",
			FilePath: "../data/flamingo.glb",
			Scale:    r3.Vector{X: 1, Y: 1, Z: 1},
			Attrs:    &Attrs{ShowAxesHelper: &showAxesHelper},
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawGLTF errors on all-zero scale", func(t *testing.T) {
		_, err := DrawGLTF(DrawGLTFOptions{
			Name:     "flamingo",
			FilePath: "../data/flamingo.glb",
		})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "scale dimensions must be non-zero")
	})

	t.Run("DrawGLTF errors on any zero scale dimension", func(t *testing.T) {
		_, err := DrawGLTF(DrawGLTFOptions{
			Name:     "flamingo",
			FilePath: "../data/flamingo.glb",
			Scale:    r3.Vector{X: 1, Y: 0, Z: 1},
		})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "scale dimensions must be non-zero")
	})
}
