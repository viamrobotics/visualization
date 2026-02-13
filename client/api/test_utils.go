package api

import (
	"testing"

	"github.com/viam-labs/motion-tools/client/server"
)

// TestMain ensures the DrawService server is running for tests
func startTestServer(t *testing.T) {
	// Start the server
	_ = server.Start(3030, false)
	t.Cleanup(stopTestServer)
}

func stopTestServer() {
	server.Stop()
}
