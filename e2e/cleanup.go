package main

import (
	"fmt"
	"os"

	"github.com/viam-labs/motion-tools/client/client"
)

func main() {
	if err := client.RemoveAllSpatialObjects(); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to remove all spatial objects: %v\n", err)
		os.Exit(1)
	}
}
