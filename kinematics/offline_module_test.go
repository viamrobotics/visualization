package kinematics

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"testing"
)

var moduleLinePattern = regexp.MustCompile(`(?m)^module .*$`)

// runGoInOfflineModule turns dir into a Go module named modulePath, reusing the repo root go.mod
// requirements and go.sum, then runs `go <args...>` in dir with no network. It skips under
// testing.Short and fails the test with the combined output on error.
func runGoInOfflineModule(t *testing.T, dir, modulePath string, args ...string) {
	t.Helper()
	if testing.Short() {
		t.Skip("offline module build skipped in short mode")
	}
	goMod, err := os.ReadFile(filepath.Join("..", "go.mod"))
	if err != nil {
		t.Fatalf("read repo go.mod: %v", err)
	}
	goSum, err := os.ReadFile(filepath.Join("..", "go.sum"))
	if err != nil {
		t.Fatalf("read repo go.sum: %v", err)
	}
	goMod = moduleLinePattern.ReplaceAllLiteral(goMod, []byte("module "+modulePath))
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), goMod, 0o644); err != nil {
		t.Fatalf("write go.mod: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "go.sum"), goSum, 0o644); err != nil {
		t.Fatalf("write go.sum: %v", err)
	}
	cmd := exec.Command("go", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GOFLAGS=-mod=mod", "GOPROXY=off", "GOWORK=off")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("go %v in %s failed: %v\n%s", args, dir, err, out)
	}
}
