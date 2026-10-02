package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"connectrpc.com/connect"
	"github.com/viamrobotics/visualization/client/server"
	"github.com/viamrobotics/visualization/motionplan"
	"github.com/viamrobotics/visualization/motionplan/v1/motionplanv1connect"
)

func main() {
	port := flag.Int("port", server.DefaultPort, "port for the Connect-RPC API server")
	staticPort := flag.Int("static-port", 5173, "port for the static file server (production mode only)")
	production := flag.Bool("production", false, "serve static files on -static-port from -build-dir")
	tmpDir := flag.String("tmp-dir", "", "directory for chunked-entity buffers (default \".tmp\" beside go.mod)")
	flag.Parse()

	motionPlanPath, motionPlanHandler := motionplanv1connect.NewMotionPlanServiceHandler(
		motionplan.NewMotionPlanService(),
		connect.WithCompressMinBytes(1024),
	)

	if err := server.Start(server.DrawServerConfig{
		Port:          *port,
		Production:    *production,
		StaticPort:    *staticPort,
		TempDir:       *tmpDir,
		ExtraHandlers: map[string]http.Handler{motionPlanPath: motionPlanHandler},
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
