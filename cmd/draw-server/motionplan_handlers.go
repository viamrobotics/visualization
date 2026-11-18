//go:build !nomotionplan

package main

import (
	"net/http"

	"connectrpc.com/connect"
	"github.com/viamrobotics/visualization/motionplan"
	"github.com/viamrobotics/visualization/motionplan/v1/motionplanv1connect"
)

// extraHandlers returns the services linked only into the full binary, keyed by mount path.
func extraHandlers() map[string]http.Handler {
	path, handler := motionplanv1connect.NewMotionPlanServiceHandler(
		motionplan.NewMotionPlanService(),
		connect.WithCompressMinBytes(1024),
	)
	return map[string]http.Handler{path: handler}
}
