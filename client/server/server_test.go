package server_test

import (
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/viam-labs/motion-tools/client/server"
)

func TestGetClient_NilBeforeStart(t *testing.T) {
	_ = server.Stop() // ensure clean state

	// GetClient lazily attaches to a server on DefaultPort when Start was
	// never called. Skip this assertion if something is already listening
	// there (e.g. `make up` is running locally).
	addr := fmt.Sprintf("localhost:%d", server.DefaultPort)
	if conn, err := net.DialTimeout("tcp", addr, 100*time.Millisecond); err == nil {
		_ = conn.Close()
		t.Skipf("default port %d is in use; GetClient would lazily attach", server.DefaultPort)
	}

	if got := server.GetClient(); got != nil {
		t.Error("expected GetClient() to return nil when no server is listening on DefaultPort and Start() was not called")
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

	// GetClient lazily attaches to a server on DefaultPort. Skip the
	// post-Stop nil assertion if something happens to be listening there.
	addr := fmt.Sprintf("localhost:%d", server.DefaultPort)
	if conn, err := net.DialTimeout("tcp", addr, 100*time.Millisecond); err == nil {
		_ = conn.Close()
		return
	}

	if got := server.GetClient(); got != nil {
		t.Error("expected nil client after Stop() with no server on DefaultPort")
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
