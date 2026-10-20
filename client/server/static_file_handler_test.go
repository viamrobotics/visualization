package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"go.viam.com/test"
)

func TestStaticFileHandler(t *testing.T) {
	buildDir := t.TempDir()
	files := map[string]string{
		"index.html":               "root",
		"snapshot.html":            "snapshot",
		"snapshot/reconcile.html":  "reconcile",
		"docs/index.html":          "docs",
		"_app/immutable/entry.js":  "entry",
		"models/arm/arm-model.glb": "model",
	}
	for name, body := range files {
		path := filepath.Join(buildDir, name)
		test.That(t, os.MkdirAll(filepath.Dir(path), 0o755), test.ShouldBeNil)
		test.That(t, os.WriteFile(path, []byte(body), 0o600), test.ShouldBeNil)
	}

	srv := httptest.NewServer(staticFileHandler(buildDir))
	t.Cleanup(srv.Close)

	tests := []struct {
		name     string
		path     string
		expected string
	}{
		{"serves the root page", "/", "root"},
		{"serves an asset by exact path", "/_app/immutable/entry.js", "entry"},
		{"serves a prerendered route from its .html file", "/snapshot", "snapshot"},
		{"serves a nested prerendered route from its .html file", "/snapshot/reconcile", "reconcile"},
		{"serves a directory's index.html", "/docs", "docs"},
		{"falls back to the root page for an unknown route", "/does/not/exist", "root"},
		{"falls back to the root page below a file", "/models/arm/arm-model.glb/x", "root"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := http.Get(srv.URL + tc.path)
			test.That(t, err, test.ShouldBeNil)
			body, err := io.ReadAll(resp.Body)
			test.That(t, err, test.ShouldBeNil)
			test.That(t, resp.Body.Close(), test.ShouldBeNil)
			test.That(t, resp.StatusCode, test.ShouldEqual, http.StatusOK)
			test.That(t, string(body), test.ShouldEqual, tc.expected)
		})
	}
}
