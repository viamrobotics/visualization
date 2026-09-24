package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/viamrobotics/visualization/client/server"
)

func main() {
	port := flag.Int("port", server.DefaultPort, "port for the Connect-RPC API server")
	staticPort := flag.Int("static-port", 5173, "port for the static file server (production mode only)")
	production := flag.Bool("production", false, "serve static files on -static-port from -build-dir")
	tmpDir := flag.String("tmp-dir", "", "directory for chunked-entity buffers (default \".tmp\" beside go.mod)")
	flag.Parse()

	if err := server.Start(server.DrawServerConfig{
		Port:       *port,
		Production: *production,
		StaticPort: *staticPort,
		TempDir:    *tmpDir,
	}); err != nil {
		log.Fatal(err)
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("shutting down draw server...")
	if err := server.Stop(); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
