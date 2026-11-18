//go:build nomotionplan

package main

import "net/http"

// extraHandlers returns no services, so the cgo nlopt solver behind MotionPlanService is not linked.
func extraHandlers() map[string]http.Handler {
	return map[string]http.Handler{}
}
