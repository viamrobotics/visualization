package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"

	"connectrpc.com/connect"
	"github.com/rs/cors"
	"github.com/viam-labs/motion-tools/draw"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	port := flag.Int("port", 3030, "port for the Connect-RPC API server")
	staticPort := flag.Int("static-port", 5173, "port for the static file server (production mode only)")
	production := flag.Bool("production", false, "serve static files on -static-port from -build-dir")
	buildDir := flag.String("build-dir", "build", "path to the built frontend assets directory")
	flag.Parse()

	svc := draw.NewDrawService()

	rpcAddr := fmt.Sprintf(":%d", *port)
	rpcListener, err := net.Listen("tcp", rpcAddr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", rpcAddr, err)
	}

	rpcSrv := &http.Server{
		Addr:    rpcAddr,
		Handler: newRPCHandler(svc),
	}

	var staticSrv *http.Server
	var staticListener net.Listener

	if *production {
		staticAddr := fmt.Sprintf(":%d", *staticPort)
		staticListener, err = net.Listen("tcp", staticAddr)
		if err != nil {
			log.Fatalf("failed to listen on %s: %v", staticAddr, err)
		}
		staticSrv = &http.Server{
			Addr:    staticAddr,
			Handler: staticFileHandler(*buildDir),
		}
	}

	// Graceful shutdown: wait for both servers to finish before exiting.
	idleConnsClosed := make(chan struct{})
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		log.Println("shutting down draw server...")

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := rpcSrv.Shutdown(context.Background()); err != nil {
				log.Printf("rpc server shutdown error: %v", err)
			}
		}()

		if staticSrv != nil {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if err := staticSrv.Shutdown(context.Background()); err != nil {
					log.Printf("static server shutdown error: %v", err)
				}
			}()
		}

		wg.Wait()
		close(idleConnsClosed)
	}()

	log.Printf("Connect-RPC server listening on http://localhost%s", rpcAddr)

	if staticSrv != nil {
		log.Printf("static file server listening on http://localhost:%d (serving %q)", *staticPort, *buildDir)
		go func() {
			if err := staticSrv.Serve(staticListener); !errors.Is(err, http.ErrServerClosed) {
				log.Fatalf("static server error: %v", err)
			}
		}()
	}

	if err := rpcSrv.Serve(rpcListener); !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("rpc server error: %v", err)
	}

	<-idleConnsClosed
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
				// SPA fallback: serve index.html for client-side routes.
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
