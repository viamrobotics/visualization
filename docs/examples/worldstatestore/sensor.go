package main

import (
	"context"
	"fmt"
	"math"
	"time"

	"go.viam.com/rdk/components/sensor"
	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/resource"
)

var SensorModel = resource.NewModel("viam-viz", "obstacles", "sensor")

const obstacleSlots = 8

type obstacleSensor struct {
	resource.Named
	resource.TriviallyReconfigurable
	resource.TriviallyCloseable

	logger logging.Logger
	epoch  time.Time
}

func newObstacleSensor(
	_ context.Context,
	_ resource.Dependencies,
	conf resource.Config,
	logger logging.Logger,
) (sensor.Sensor, error) {
	return &obstacleSensor{
		Named:  conf.ResourceName().AsNamed(),
		logger: logger,
		epoch:  time.Now(),
	}, nil
}

const (
	visibilityFreq      = 0.1
	visibilityThreshold = -0.3
	growthFreq          = 0.6
	baseSize            = 80.0
	growthRange         = 60.0
)

func (s *obstacleSensor) Readings(_ context.Context, _ map[string]any) (map[string]any, error) {
	t := time.Since(s.epoch).Seconds()
	tNext := t + pollInterval.Seconds()

	obstacles := make([]any, 0, obstacleSlots)
	for i := range obstacleSlots {
		phase := float64(i) * 0.7
		if math.Sin(t*visibilityFreq+phase) <= visibilityThreshold {
			continue
		}

		breath := 0.5 + 0.5*math.Sin(t*growthFreq+phase)
		size := baseSize + growthRange*breath
		endingSoon := math.Sin(tNext*visibilityFreq+phase) <= visibilityThreshold

		obstacles = append(obstacles, map[string]any{
			"id":          obstacleID(i),
			"x":           800 * math.Sin(t*0.3+phase),
			"y":           800 * math.Cos(t*0.4+phase),
			"z":           200 + 150*math.Sin(t*0.2+2*phase),
			"sx":          size,
			"sy":          size,
			"sz":          size,
			"ending_soon": endingSoon,
		})
	}

	return map[string]any{"obstacles": obstacles}, nil
}

func obstacleID(i int) string {
	return fmt.Sprintf("obs-%d", i)
}
