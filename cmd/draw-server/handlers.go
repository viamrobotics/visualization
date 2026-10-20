package main

import (
	"maps"
	"net/http"

	"connectrpc.com/connect"

	"github.com/viamrobotics/visualization/kinematics"
	"github.com/viamrobotics/visualization/kinematics/v1/kinematicsv1connect"
)

// allHandlers returns every service this build mounts beside the draw service, keyed by mount path.
func allHandlers() map[string]http.Handler {
	handlers := baseHandlers()
	maps.Copy(handlers, extraHandlers())
	return handlers
}

// baseHandlers returns the services linked into every build, nomotionplan included.
func baseHandlers() map[string]http.Handler {
	path, handler := kinematicsv1connect.NewKinematicsServiceHandler(
		kinematics.NewKinematicsService(),
		connect.WithCompressMinBytes(1024),
	)
	return map[string]http.Handler{path: handler}
}
