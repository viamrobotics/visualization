package api

import (
	"path/filepath"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"
)

const gltfFixture = "../data/flamingo.glb"

func TestDrawGLTFSendsTheFileInline(t *testing.T) {
	fake := startFake(t)

	_, err := DrawGLTF(DrawGLTFOptions{Name: "model", FilePath: gltfFixture})
	test.That(t, err, test.ShouldBeNil)

	model := fake.onlyAddedDrawing(t).GetPhysicalObject().GetModel()
	test.That(t, model, test.ShouldNotBeNil)
	test.That(t, model.GetAssets(), test.ShouldNotBeEmpty)
	test.That(t, model.GetAssets()[0].GetData(), test.ShouldNotBeEmpty)
	test.That(t, model.GetAssets()[0].GetMimeType(), test.ShouldEqual, "model/gltf-binary")
}

// A zero Scale means "unspecified" and falls back to the draw default rather
// than scaling everything to nothing.
func TestDrawGLTFScale(t *testing.T) {
	for _, tc := range []struct {
		name    string
		scale   r3.Vector
		wantErr string
	}{
		{name: "zero uses the default"},
		{name: "a uniform scale", scale: r3.Vector{X: 2, Y: 2, Z: 2}},
		{name: "a non-uniform scale", scale: r3.Vector{X: 1, Y: 2, Z: 3}},
		{
			// NewModel rejects a partly-zero scale rather than treating the zero
			// axis as 1.
			name:    "a partly-zero scale is rejected",
			scale:   r3.Vector{X: 1, Y: 0, Z: 1},
			wantErr: "scale cannot be zero",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawGLTF(DrawGLTFOptions{
				Name:     "model",
				FilePath: gltfFixture,
				Scale:    tc.scale,
			})

			if tc.wantErr != "" {
				test.That(t, err, test.ShouldNotBeNil)
				test.That(t, err.Error(), test.ShouldContainSubstring, tc.wantErr)
				test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
				return
			}
			test.That(t, err, test.ShouldBeNil)
			test.That(t, fake.addEntityCount(), test.ShouldEqual, 1)
		})
	}
}

func TestDrawGLTFRejections(t *testing.T) {
	t.Run("a non-ascii name is rejected before the file is read", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawGLTF(DrawGLTFOptions{Name: "café", FilePath: gltfFixture})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "not ascii")
	})

	t.Run("no visualizer is reported before the file is read", func(t *testing.T) {
		requireNoServer(t)

		_, err := DrawGLTF(DrawGLTFOptions{Name: "ok", FilePath: "does-not-exist.glb"})

		// The client check precedes the read, so a missing file is not what the
		// caller hears about here.
		test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
	})

	t.Run("a missing file is reported as a read failure", func(t *testing.T) {
		fake := startFake(t)

		_, err := DrawGLTF(DrawGLTFOptions{
			Name:     "missing",
			FilePath: filepath.Join(t.TempDir(), "absent.glb"),
		})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "failed to read GLTF file")
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
	})

	t.Run("an empty file is rejected by the asset constructor", func(t *testing.T) {
		fake := startFake(t)
		empty := filepath.Join(t.TempDir(), "empty.glb")
		test.That(t, writeFile(empty, nil), test.ShouldBeNil)

		_, err := DrawGLTF(DrawGLTFOptions{Name: "empty", FilePath: empty})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "failed to create model asset")
		test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
	})

	t.Run("an RPC failure is wrapped", func(t *testing.T) {
		fake := startFake(t)
		fake.errs["AddEntity"] = errRPCBoom

		_, err := DrawGLTF(DrawGLTFOptions{Name: "rpc", FilePath: gltfFixture})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntity RPC failed")
	})
}
