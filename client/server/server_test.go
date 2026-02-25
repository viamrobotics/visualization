package server_test

import (
	"net/http"
	"testing"

	"github.com/viam-labs/motion-tools/client/server"
)

func TestGetClient_NilBeforeStart(t *testing.T) {
	_ = server.Stop() // ensure clean state
	if got := server.GetClient(); got != nil {
		t.Error("expected GetClient() to return nil before Start()")
	}
}

func TestGetClient_LifecycleNonNilThenNil(t *testing.T) {
	if err := server.Start(server.DrawServerConfig{Port: 19101}); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if got := server.GetClient(); got == nil {
		t.Error("expected non-nil client after Start()")
	}
	if err := server.Stop(); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	if got := server.GetClient(); got != nil {
		t.Error("expected nil client after Stop()")
	}
}

func TestStart_Idempotent(t *testing.T) {
	if err := server.Start(server.DrawServerConfig{Port: 19102}); err != nil {
		t.Fatalf("first Start: %v", err)
	}
	t.Cleanup(func() { _ = server.Stop() })

	if err := server.Start(server.DrawServerConfig{Port: 19102}); err != nil {
		t.Errorf("second Start should be a no-op but returned: %v", err)
	}
}

func TestProductionMode_StaticServerOnSeparatePort(t *testing.T) {
	if err := server.Start(server.DrawServerConfig{
		Port:       19110,
		Production: true,
		StaticPort: 19111,
	}); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(func() { _ = server.Stop() })

	resp, err := http.Get("http://localhost:19111/")
	if err != nil {
		t.Fatalf("static port not reachable: %v", err)
	}
	resp.Body.Close()
}
