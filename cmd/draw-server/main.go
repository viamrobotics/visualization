package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/viamrobotics/visualization/client/server"
)

// listeningPrefix starts the first stdout line. Supervisors parse the port that follows the URL.
const listeningPrefix = "draw-server: listening on "

func main() {
	port := flag.Int("port", server.DefaultPort, "port for the Connect-RPC API server (0 picks a free port)")
	staticPort := flag.Int("static-port", 5173, "port for the static file server (production mode only)")
	production := flag.Bool("production", false, "serve static files on -static-port from -build-dir")
	tmpDir := flag.String("tmp-dir", "", "directory for chunked-entity buffers (default \".tmp\" beside go.mod)")
	exitOnStdinClose := flag.Bool("exit-on-stdin-close", false, "shut down when stdin reaches EOF, for use as a sidecar whose parent may die without signalling")
	flag.Parse()

	if err := server.Start(server.DrawServerConfig{
		Port:          *port,
		Production:    *production,
		StaticPort:    *staticPort,
		TempDir:       *tmpDir,
		ExtraHandlers: extraHandlers(),
	}); err != nil {
		log.Fatal(err)
	}

	_, boundPort, err := net.SplitHostPort(server.GetAddress())
	if err != nil {
		log.Fatal(err)
	}
	if _, err := strconv.Atoi(boundPort); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%shttp://127.0.0.1:%s\n", listeningPrefix, boundPort)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	if *exitOnStdinClose {
		go func() {
			_, _ = io.Copy(io.Discard, os.Stdin)
			sigCh <- syscall.SIGTERM
		}()
	}
	<-sigCh

	log.Println("shutting down draw server...")
	if err := server.Stop(); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
