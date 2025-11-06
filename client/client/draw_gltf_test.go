package client

import (
	"testing"

	"go.viam.com/test"
)

func TestDrawGLTF(t *testing.T) {
	t.Run("DrawGLTF", func(t *testing.T) {
		test.That(t, DrawGLTF("../data/flamingo.glb"), test.ShouldBeNil)
	})

	// Draco compression not yet supported
	t.Run("DrawGLTF draco compression", func(t *testing.T) {
		// test.That(t, DrawGLTF("../data/coffeemat.glb"), test.ShouldBeNil)
	})

}
