package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/viam-labs/motion-tools/draw"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

var (
	// Package-level variables for managing the server and client
	mu            sync.Mutex
	serverRunning bool
	httpServer    *http.Server
	drawClient    drawv1connect.DrawServiceClient
	address       = "localhost:3030" // Default address
	readyChan     chan struct{}
)

// SetAddress configures the server address (host:port)
// Must be called before Start()
func SetAddress(addr string) {
	mu.Lock()
	defer mu.Unlock()
	if serverRunning {
		log.Printf("Warning: cannot change address while server is running")
		return
	}
	address = addr
}

// GetAddress returns the current server address
func GetAddress() string {
	mu.Lock()
	defer mu.Unlock()
	return address
}

// Start starts the server with the DrawService
// If production is true, also serves static files from the /build directory
// Returns nil if the server is already running (idempotent)
func Start(port int, production bool) error {
	mu.Lock()
	defer mu.Unlock()

	if serverRunning {
		// Server already running - this is OK for tests
		return nil
	}

	// Update address with the specified port
	address = fmt.Sprintf("localhost:%d", port)

	// Create the DrawService implementation
	service := draw.NewService()

	// Create the Connect handler
	path, handler := drawv1connect.NewDrawServiceHandler(service)

	mux := http.NewServeMux()

	// Mount the DrawService
	mux.Handle(path, corsMiddleware(handler))

	// In production mode, serve static files from /build
	if production {
		buildDir, err := getBuildDir()
		if err != nil {
			return fmt.Errorf("failed to locate build directory: %w", err)
		}

		log.Printf("Serving static files from: %s", buildDir)
		fileServer := http.FileServer(http.Dir(buildDir))
		mux.Handle("/", corsMiddleware(staticFileHandler(buildDir, fileServer)))
	}

	// Create HTTP server with h2c (HTTP/2 cleartext) support for Connect
	httpServer = &http.Server{
		Addr:              address,
		Handler:           h2c.NewHandler(mux, &http2.Server{}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Initialize the package-level Connect client
	drawClient = drawv1connect.NewDrawServiceClient(
		http.DefaultClient,
		fmt.Sprintf("http://%s", address),
	)

	serverRunning = true

	// Create a channel to signal when the server is ready
	readyChan = make(chan struct{})

	// Start server in a goroutine
	go func() {
		// Signal that the goroutine has started
		close(readyChan)

		log.Printf("DrawService server listening on %s", address)
		if production {
			log.Printf("Static files available at http://%s", address)
		}
		log.Printf("Connect-RPC endpoint: http://%s%s", address, path)

		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Server error: %v", err)
			mu.Lock()
			serverRunning = false
			mu.Unlock()
		}
	}()

	// Wait for the goroutine to start
	<-readyChan

	// Give the server a moment to bind to the port
	time.Sleep(100 * time.Millisecond)

	return nil
}

// Stop gracefully shuts down the server
func Stop() error {
	mu.Lock()
	defer mu.Unlock()

	if !serverRunning {
		return fmt.Errorf("server is not running")
	}

	if httpServer == nil {
		serverRunning = false
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("server shutdown failed: %w", err)
	}

	serverRunning = false
	httpServer = nil
	drawClient = nil
	readyChan = nil

	log.Println("Server stopped")
	return nil
}

// GetClient returns the package-level DrawService client
// Returns nil if the server is not running
func GetClient() drawv1connect.DrawServiceClient {
	mu.Lock()
	defer mu.Unlock()
	return drawClient
}

// corsMiddleware adds CORS headers to support browser requests from different origins
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow requests from any origin (adjust for production if needed)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms")
		w.Header().Set("Access-Control-Expose-Headers", "Connect-Protocol-Version, Connect-Timeout-Ms")

		// Handle preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// staticFileHandler serves static files and falls back to index.html for SPA routing
func staticFileHandler(buildDir string, fileServer http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if the requested file exists
		path := filepath.Join(buildDir, r.URL.Path)
		info, err := os.Stat(path)

		// If file exists and is not a directory, serve it
		if err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		// If it's a directory, try serving index.html from it
		if err == nil && info.IsDir() {
			indexPath := filepath.Join(path, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				http.ServeFile(w, r, indexPath)
				return
			}
		}

		// For SPA routing: if file not found, serve the root index.html
		indexPath := filepath.Join(buildDir, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			http.ServeFile(w, r, indexPath)
			return
		}

		// If index.html doesn't exist, return 404
		http.NotFound(w, r)
	})
}

// getBuildDir locates the build directory relative to the current executable
func getBuildDir() (string, error) {
	// Try to find build directory relative to current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	buildDir := filepath.Join(cwd, "build")
	if _, err := os.Stat(buildDir); err == nil {
		return buildDir, nil
	}

	// Try relative to executable location
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}

	buildDir = filepath.Join(filepath.Dir(exe), "build")
	if _, err := os.Stat(buildDir); err == nil {
		return buildDir, nil
	}

	return "", fmt.Errorf("build directory not found")
}
