// Package server provides an embeddable Connect-RPC draw server.
//
// It exposes a singleton lifecycle (Start / Stop / GetClient) so that
// client/api functions can draw to a local visualizer without the caller
// having to manage server internals.
//
// Typical usage:
//
//	if err := server.Start(3030); err != nil {
//	    log.Fatal(err)
//	}
//	defer server.Stop()
//
//	// client/api functions call server.GetClient() internally.
package server

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"connectrpc.com/connect"
	"github.com/rs/cors"
	"github.com/viam-labs/motion-tools/draw"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

// ErrNotRunning is returned by Stop and GetClient when the server has not been started.
var ErrNotRunning = errors.New("draw server is not running")

type serverConfig struct {
	production bool
	staticPort int
	buildDir   string
}

// ServerOption configures the draw server.
type ServerOption func(*serverConfig)

// WithProduction enables the static file server, serving files from buildDir.
func WithProduction(buildDir string) ServerOption {
	return func(c *serverConfig) {
		c.production = true
		c.buildDir = buildDir
	}
}

// WithStaticPort sets the port for the static file server (default 5173).
// Only relevant when WithProduction is also provided.
func WithStaticPort(port int) ServerOption {
	return func(c *serverConfig) {
		c.staticPort = port
	}
}

func defaultConfig() serverConfig {
	return serverConfig{
		staticPort: 5173,
		buildDir:   "build",
	}
}

var (
	mu         sync.Mutex
	running    bool
	rpcSrv     *http.Server
	staticSrv  *http.Server
	drawClient drawv1connect.DrawServiceClient
	drawSvc    *draw.DrawService
	address    string
)

// Start starts the Connect-RPC draw server on port. It is idempotent: calling
// Start when the server is already running returns nil immediately.
//
// In production mode (WithProduction option), a separate static file server is
// started on the static port (default 5173) to serve the built frontend assets.
func Start(port int, opts ...ServerOption) error {
	mu.Lock()
	defer mu.Unlock()

	if running {
		return nil
	}

	cfg := defaultConfig()
	for _, o := range opts {
		o(&cfg)
	}

	svc := draw.NewDrawService()
	drawSvc = svc
	rpcAddr := fmt.Sprintf(":%d", port)
	address = fmt.Sprintf("localhost:%d", port)

	rpcListener, err := net.Listen("tcp", rpcAddr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", rpcAddr, err)
	}

	rpcSrv = &http.Server{
		Addr:    rpcAddr,
		Handler: newRPCHandler(svc),
	}

	go func() {
		if err := rpcSrv.Serve(rpcListener); !errors.Is(err, http.ErrServerClosed) {
			log.Printf("draw server rpc error: %v", err)
		}
	}()

	if cfg.production {
		staticAddr := fmt.Sprintf(":%d", cfg.staticPort)
		staticListener, err := net.Listen("tcp", staticAddr)
		if err != nil {
			// RPC server is already started; clean it up before returning.
			_ = rpcSrv.Shutdown(context.Background())
			rpcSrv = nil
			return fmt.Errorf("failed to listen on %s: %w", staticAddr, err)
		}

		staticSrv = &http.Server{
			Addr:    staticAddr,
			Handler: staticFileHandler(cfg.buildDir),
		}

		go func() {
			if err := staticSrv.Serve(staticListener); !errors.Is(err, http.ErrServerClosed) {
				log.Printf("draw server static error: %v", err)
			}
		}()

		log.Printf("draw server static files on http://localhost:%d (serving %q)", cfg.staticPort, cfg.buildDir)
	}

	// Give the listeners a moment to be ready before clients connect.
	time.Sleep(10 * time.Millisecond)

	// Use the Connect protocol over HTTP/1.1 (chunked streaming).  The h2c
	// wrapper on the server still accepts HTTP/1.1 requests, so there is no
	// need for a special transport on the Go side.
	drawClient = drawv1connect.NewDrawServiceClient(
		http.DefaultClient,
		fmt.Sprintf("http://%s", address),
	)

	running = true

	log.Printf("draw server Connect-RPC on http://%s", address)

	return nil
}

// Stop gracefully shuts down the server and resets the singleton. It is safe
// to call Stop and then Start again.
func Stop() error {
	mu.Lock()
	defer mu.Unlock()

	if !running {
		return ErrNotRunning
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := rpcSrv.Shutdown(ctx); err != nil {
			log.Printf("draw server rpc shutdown error: %v", err)
		}
	}()

	if staticSrv != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := staticSrv.Shutdown(ctx); err != nil {
				log.Printf("draw server static shutdown error: %v", err)
			}
		}()
	}

	wg.Wait()

	rpcSrv = nil
	staticSrv = nil
	drawClient = nil
	drawSvc = nil
	address = ""
	running = false

	return nil
}

// GetClient returns the singleton Connect-RPC DrawService client.
// Returns nil if the server has not been started.
func GetClient() drawv1connect.DrawServiceClient {
	mu.Lock()
	defer mu.Unlock()
	return drawClient
}

// GetService returns the underlying DrawService of the running server.
// Returns nil if the server has not been started.
// Primarily intended for testing.
func GetService() *draw.DrawService {
	mu.Lock()
	defer mu.Unlock()
	return drawSvc
}

// GetAddress returns the host:port address of the running RPC server, or an
// empty string if the server is not running.
func GetAddress() string {
	mu.Lock()
	defer mu.Unlock()
	return address
}

func newRPCHandler(svc drawv1connect.DrawServiceHandler) http.Handler {
	mux := http.NewServeMux()

	rpcPath, rpcHandler := drawv1connect.NewDrawServiceHandler(
		svc,
		connect.WithCompressMinBytes(1024),
	)
	mux.Handle(rpcPath, rpcHandler)

	return cors.New(cors.Options{
		AllowedOrigins:      []string{"*"},
		AllowedMethods:      []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:      []string{"*"},
		AllowPrivateNetwork: true,
	}).Handler(h2c.NewHandler(mux, &http2.Server{}))
}

func staticFileHandler(buildDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(buildDir, filepath.Clean("/"+r.URL.Path))

		info, err := os.Stat(path)
		if err == nil && info.IsDir() {
			path = filepath.Join(path, "index.html")
			info, err = os.Stat(path)
		}

		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				http.ServeFile(w, r, filepath.Join(buildDir, "index.html"))
				return
			}
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if info.IsDir() {
			http.ServeFile(w, r, filepath.Join(path, "index.html"))
			return
		}

		http.ServeFile(w, r, path)
	})
}
