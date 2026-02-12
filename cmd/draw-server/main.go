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
	port := flag.Int("port", 3030, "Server port")
	production := flag.Bool("production", false, "Run in production mode (serve static files)")
	flag.Parse()

	// Start the server
	if err := server.Start(*port, *production); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}

	// Wait for interrupt signal to gracefully shutdown the server
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan
	log.Println("Shutting down server...")

	if err := server.Stop(); err != nil {
		log.Printf("Error during shutdown: %v", err)
		os.Exit(1)
	}

	log.Println("Server shutdown complete")
}
