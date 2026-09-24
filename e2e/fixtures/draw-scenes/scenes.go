package main

import "path/filepath"

// sceneEnv is what a scene needs from the command line: where its fixture
// files live, and which recording the replay pair shares.
type sceneEnv struct {
	dataDir    string
	replayPath string
}

// data resolves a fixture file inside the configured data directory.
func (e sceneEnv) data(name string) string {
	return filepath.Join(e.dataDir, name)
}

// A scene draws something and returns. Everything it drew stays on the server
// after the process exits, which is the point: the browser is watching.
type scene func(env sceneEnv) error

// scenes maps the names the e2e passes on the command line to the functions
// that draw them. Names are namespaced by what they exercise, so `--grep` in
// the spec and `-list` here read the same way.
var scenes = map[string]scene{
	"lifecycle/add":        lifecycleAdd,
	"lifecycle/update":     lifecycleUpdate,
	"lifecycle/remove-all": lifecycleRemoveAll,

	"hierarchy/draw":    hierarchyDraw,
	"frames/draw":       framesDraw,
	"frame-system/draw": frameSystemDraw,
	"geometries/draw":   geometriesDraw,
	"world-state/draw":  worldStateDraw,

	"point-cloud/files":            pointCloudFiles,
	"point-cloud/single-color":     pointCloudSingleColor,
	"point-cloud/opacity":          pointCloudOpacity,
	"point-cloud/palette":          pointCloudPalette,
	"point-cloud/per-point-colors": pointCloudPerPointColors,
	"point-cloud/downscaled":       pointCloudDownscaled,
	"point-cloud/updating":         pointCloudUpdating,
	"point-cloud/chunked":          pointCloudChunked,
	"point-cloud/chunked-small":    pointCloudChunkedSmall,

	"camera/top-down": cameraTopDown,
	"camera/reset":    cameraReset,

	"replay/record":   replayRecord,
	"replay/playback": replayPlayback,

	"redraw-loop/with-clear":    redrawLoopWithClear,
	"redraw-loop/without-clear": redrawLoopWithoutClear,

	"relationships/setup":  relationshipsSetup,
	"relationships/create": relationshipsCreate,
	"relationships/delete": relationshipsDelete,
}
