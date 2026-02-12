package server

import "testing"

// TestMain ensures the DrawService server is running for tests
func startTestServer(t *testing.T) {
	// Start the server
	_ = Start(3030, false)
	t.Cleanup(stopTestServer)
}

func stopTestServer() {
	Stop()
}
