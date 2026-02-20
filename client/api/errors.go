package api

import (
	"errors"
)

// ErrVisualizerNotRunning is returned when the visualizer is not running.
var ErrVisualizerNotRunning = errors.New("visualizer is not running; start it with `make up`")
