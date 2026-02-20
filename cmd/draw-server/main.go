package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/viam-labs/motion-tools/client/server"
)

func main() {
	port := flag.Int("port", 3030, "port for the Connect-RPC API server")
	staticPort := flag.Int("static-port", 5173, "port for the static file server (production mode only)")
	production := flag.Bool("production", false, "serve static files on -static-port from -build-dir")
	buildDir := flag.String("build-dir", "build", "path to the built frontend assets directory")
	flag.Parse()

	var opts []server.ServerOption
	if *production {
		opts = append(opts, server.WithProduction(*buildDir), server.WithStaticPort(*staticPort))
	}

	if err := server.Start(*port, opts...); err != nil {
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
