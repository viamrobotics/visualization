// Package main is the obstacle-store example module that backs the
// docs/guides/worldstatestore guide. It registers two models in one binary:
//
//   - viam-viz:obstacles:sensor — emits a deterministic, time-driven set of
//     obstacles so the store has something to react to.
//   - viam-viz:obstacles:store  — the WorldStateStoreService implementation
//     from the guide, polling the sensor and streaming deltas.
package main

import (
	"context"

	"go.viam.com/rdk/components/sensor"
	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/module"
	"go.viam.com/rdk/resource"
	"go.viam.com/rdk/services/worldstatestore"
)

func init() {
	resource.RegisterComponent(sensor.API, SensorModel, resource.Registration[sensor.Sensor, resource.NoNativeConfig]{
		Constructor: newObstacleSensor,
	})
	resource.RegisterService(worldstatestore.API, StoreModel, resource.Registration[worldstatestore.Service, resource.NoNativeConfig]{
		Constructor: newObstacleStore,
	})
}

func main() {
	ctx := context.Background()
	logger := logging.NewDebugLogger("obstacle-store")

	mod, err := module.NewModuleFromArgs(ctx)
	if err != nil {
		logger.Fatal(err)
	}
	if err := mod.AddModelFromRegistry(ctx, sensor.API, SensorModel); err != nil {
		logger.Fatal(err)
	}
	if err := mod.AddModelFromRegistry(ctx, worldstatestore.API, StoreModel); err != nil {
		logger.Fatal(err)
	}
	if err := mod.Start(ctx); err != nil {
		logger.Fatal(err)
	}
	defer mod.Close(ctx)
	<-ctx.Done()
}
