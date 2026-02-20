package main_test

import (
	"testing"

	"github.com/viam-labs/motion-tools/client/server"
)

// TestDrawServer_Smoke confirms the binary's wiring: Start binds a port and
// GetClient returns a non-nil client, Stop cleans up.
func TestDrawServer_Smoke(t *testing.T) {
	const port = 19200

	if err := server.Start(port); err != nil {
		t.Fatalf("server.Start: %v", err)
	}
	t.Cleanup(func() { _ = server.Stop() })

	if client := server.GetClient(); client == nil {
		t.Fatal("expected non-nil client after Start()")
	}
}
