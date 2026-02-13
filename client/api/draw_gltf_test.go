package api

import (
	"testing"

	"go.viam.com/test"
)

func TestDrawGLTF(t *testing.T) {
	startTestServer(t)

	t.Run("DrawGLTF", func(t *testing.T) {
		uuid, err := DrawGLTF(DrawGLTFOptions{
			Name:     "flamingo",
			FilePath: "../data/flamingo.glb",
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})
}
