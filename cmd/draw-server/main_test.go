package main_test

import (
	"testing"

	"github.com/viam-labs/motion-tools/client/server"
)

func TestDrawServer_Smoke(t *testing.T) {
	if err := server.Start(server.DrawServerConfig{Port: 19200}); err != nil {
		t.Fatalf("server.Start: %v", err)
	}
	t.Cleanup(func() { _ = server.Stop() })

	if client := server.GetClient(); client == nil {
		t.Fatal("expected non-nil client after Start()")
	}
}
