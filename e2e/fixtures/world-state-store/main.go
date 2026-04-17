package main

import (
	"context"

	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/module"
	"go.viam.com/rdk/resource"
	"go.viam.com/rdk/services/worldstatestore"
)

var Model = resource.NewModel("e2e", "test", "world-state-store")

func init() {
	resource.RegisterService(worldstatestore.API, Model, resource.Registration[worldstatestore.Service, resource.NoNativeConfig]{
		Constructor: newStore,
	})
}

func main() {
	ctx := context.Background()
	logger := logging.NewDebugLogger("e2e-world-state-store")

	mod, err := module.NewModuleFromArgs(ctx)
	if err != nil {
		logger.Fatal(err)
	}

	err = mod.AddModelFromRegistry(ctx, worldstatestore.API, Model)
	if err != nil {
		logger.Fatal(err)
	}

	err = mod.Start(ctx)
	if err != nil {
		logger.Fatal(err)
	}

	defer mod.Close(ctx)
	<-ctx.Done()
}
