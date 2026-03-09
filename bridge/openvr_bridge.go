// SteamVR → WebSocket bridge (Go version).
//
// Reads Vive Wand controller poses and button states from SteamVR/OpenVR
// and broadcasts them to connected WebSocket clients at ~90 Hz.
//
// Build requirements:
//
//	make bridge-deps   # downloads the OpenVR SDK into bridge/openvr-sdk/
//	make bridge-build  # compiles the binary
//
// Usage:
//
//	make bridge [BRIDGE_PORT=9090] [BRIDGE_HZ=90]

package main

/*
#cgo CFLAGS: -I${SRCDIR}/openvr-sdk/headers
#cgo LDFLAGS: -L${SRCDIR}/openvr-sdk/lib/linux64 -lopenvr_api
#include "openvr_capi.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// openvr_capi.h wraps the global entry points in '#if 0', so they won't be
// declared for us. The symbols are exported from libopenvr_api.so, so we
// declare them directly here and let the linker resolve them.
extern intptr_t VR_InitInternal(EVRInitError *peError, EVRApplicationType eType);
extern void     VR_ShutdownInternal(void);
extern intptr_t VR_GetGenericInterface(const char *pchInterfaceVersion, EVRInitError *peError);

static struct VR_IVRSystem_FnTable *gVRSystem = NULL;

// bridge_init initialises OpenVR with the given application type and caches
// the IVRSystem function-table pointer.
// Returns 0 on success or a non-zero EVRInitError value on failure.
static int bridge_init(int appType) {
    // IVRSystem_Version is a static const char*, not a macro, so we build the
    // FnTable interface name at runtime with snprintf rather than at compile
    // time via string-literal concatenation.
    char fnTable[64];
    snprintf(fnTable, sizeof(fnTable), "FnTable:%s", IVRSystem_Version);

    EVRInitError err = EVRInitError_VRInitError_None;
    VR_InitInternal(&err, (EVRApplicationType)appType);
    if (err != EVRInitError_VRInitError_None)
        return (int)err;

    gVRSystem = (struct VR_IVRSystem_FnTable *)
                    VR_GetGenericInterface(fnTable, &err);
    if (err != EVRInitError_VRInitError_None || gVRSystem == NULL) {
        VR_ShutdownInternal();
        return (int)(err ? err : 1);
    }
    return 0;
}

static void bridge_shutdown(void) {
    gVRSystem = NULL;
    VR_ShutdownInternal();
}

static unsigned int bridge_get_device_class(unsigned int idx) {
    if (!gVRSystem) return 0;
    return (unsigned int)gVRSystem->GetTrackedDeviceClass(idx);
}

static unsigned int bridge_get_controller_role(unsigned int idx) {
    if (!gVRSystem) return 0;
    return (unsigned int)gVRSystem->GetControllerRoleForTrackedDeviceIndex(idx);
}

// BridgeControllerData is a plain-C struct that carries the controller data
// we need back to Go, avoiding any complex vtable/pointer games on the Go side.
typedef struct {
    int      stateValid; // 1 if GetControllerStateWithPose succeeded (buttons/axes are usable)
    int      poseValid;  // 1 if pose is tracked (mat contains valid position/rotation)
    float    mat[12]; // row-major: mat[r*4+c] = mDeviceToAbsoluteTracking.m[r][c]
    uint64_t pressed;
    float    axis0x, axis0y; // trackpad x/y (Axis 0)
    float    axis1x;         // trigger value (Axis 1)
} BridgeControllerData;

// bridge_haptic_pulse fires a single haptic pulse on the controller's trackpad
// axis. durationUs is clamped by the hardware to ~3999 µs per pulse; callers
// wanting longer feedback should call this repeatedly.
static void bridge_haptic_pulse(unsigned int idx, unsigned short durationUs) {
    if (!gVRSystem) return;
    gVRSystem->TriggerHapticPulse((TrackedDeviceIndex_t)idx, 0, durationUs);
}

static BridgeControllerData bridge_get_controller(unsigned int idx) {
    BridgeControllerData out;
    memset(&out, 0, sizeof(out));
    if (!gVRSystem) return out;

    VRControllerState_t state;
    TrackedDevicePose_t    pose;
    memset(&state, 0, sizeof(state));
    memset(&pose,  0, sizeof(pose));

    bool ok = gVRSystem->GetControllerStateWithPose(
        ETrackingUniverseOrigin_TrackingUniverseStanding,
        (TrackedDeviceIndex_t)idx,
        &state, sizeof(state),
        &pose
    );
    if (!ok)
        return out; // controller not present at all

    // Button/axis state is always valid when the call succeeds.
    out.stateValid = 1;
    out.pressed    = state.ulButtonPressed;
    out.axis0x     = state.rAxis[0].x;
    out.axis0y     = state.rAxis[0].y;
    out.axis1x     = state.rAxis[1].x;

    // Pose (position/rotation) is only valid when actively tracked.
    if (pose.bPoseIsValid) {
        out.poseValid = 1;
        for (int r = 0; r < 3; r++)
            for (int c = 0; c < 4; c++)
                out.mat[r*4+c] = pose.mDeviceToAbsoluteTracking.m[r][c];
    }

    return out;
}
*/
import "C"

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"nhooyr.io/websocket"
)

// ---------------------------------------------------------------------------
// OpenVR constants
// ---------------------------------------------------------------------------

const (
	vrApplicationBackground = 4  // EVRApplicationType_VRApplication_Background
	maxTrackedDevices       = 64 // k_unMaxTrackedDeviceCount
	deviceClassController   = 2  // ETrackedDeviceClass_Controller
	controllerRoleLeft      = 1  // ETrackedControllerRole_LeftHand
	controllerRoleRight     = 2  // ETrackedControllerRole_RightHand

	buttonMenu     uint64 = 1 << 1
	buttonGrip     uint64 = 1 << 2
	buttonTrackpad uint64 = 1 << 32
	buttonTrigger  uint64 = 1 << 33
)

// ---------------------------------------------------------------------------
// JSON types
// ---------------------------------------------------------------------------

// ControllerState mirrors the dict produced by the Python bridge.
type ControllerState struct {
	Connected       bool       `json:"connected"`
	Pos             [3]float64 `json:"pos"`
	Rot             [4]float64 `json:"rot"` // [qx, qy, qz, qw]
	Trigger         float64    `json:"trigger"`
	TriggerPressed  bool       `json:"triggerPressed"`
	Grip            bool       `json:"grip"`
	Trackpad        [2]float64 `json:"trackpad"`
	TrackpadPressed bool       `json:"trackpadPressed"`
	Menu            bool       `json:"menu"`
}

var nullController = ControllerState{
	Connected: false,
	Pos:       [3]float64{0, 0, 0},
	Rot:       [4]float64{0, 0, 0, 1},
}

type frameControllers struct {
	Left  ControllerState `json:"left"`
	Right ControllerState `json:"right"`
}

type frame struct {
	TS          float64          `json:"ts"`
	Controllers frameControllers `json:"controllers"`
}

// ---------------------------------------------------------------------------
// OpenVR helpers
// ---------------------------------------------------------------------------

// mat34ToQuat converts an OpenVR row-major 3×4 matrix (stored flat, row-major)
// to (position [x,y,z], quaternion [qx,qy,qz,qw]) using Shepperd's method.
// This is a direct port of the Python mat34_to_pos_quat function.
func mat34ToQuat(m [12]float32) ([3]float64, [4]float64) {
	// m[r*4+c] == matrix row r, column c
	pos := [3]float64{float64(m[3]), float64(m[7]), float64(m[11])}

	trace := float64(m[0] + m[5] + m[10])

	var qx, qy, qz, qw float64
	switch {
	case trace > 0:
		s := 0.5 / math.Sqrt(trace+1.0)
		qw = 0.25 / s
		qx = float64(m[9]-m[6]) * s
		qy = float64(m[2]-m[8]) * s
		qz = float64(m[4]-m[1]) * s
	case m[0] > m[5] && m[0] > m[10]:
		s := 2.0 * math.Sqrt(1.0+float64(m[0]-m[5]-m[10]))
		qw = float64(m[9]-m[6]) / s
		qx = 0.25 * s
		qy = float64(m[4]+m[1]) / s
		qz = float64(m[2]+m[8]) / s
	case m[5] > m[10]:
		s := 2.0 * math.Sqrt(1.0+float64(m[5]-m[0]-m[10]))
		qw = float64(m[2]-m[8]) / s
		qx = float64(m[4]+m[1]) / s
		qy = 0.25 * s
		qz = float64(m[9]+m[6]) / s
	default:
		s := 2.0 * math.Sqrt(1.0+float64(m[10]-m[0]-m[5]))
		qw = float64(m[4]-m[1]) / s
		qx = float64(m[2]+m[8]) / s
		qy = float64(m[9]+m[6]) / s
		qz = 0.25 * s
	}

	return pos, [4]float64{qx, qy, qz, qw}
}

func round5(v float64) float64 { return math.Round(v*1e5) / 1e5 }
func round3(v float64) float64 { return math.Round(v*1e3) / 1e3 }

// readController reads pose and button state for a single tracked device.
// Returns nil if the device pose is not valid.
func readController(idx uint32) *ControllerState {
	data := C.bridge_get_controller(C.uint(idx))
	if data.stateValid == 0 {
		return nil // controller not present
	}

	pressed := uint64(data.pressed)

	// Negate Y: OpenVR trackpad +y=up, but WebXR axes[3] is +y=down.
	trackpadX := float64(data.axis0x)
	trackpadY := -float64(data.axis0y)
	trigger := float64(data.axis1x)

	cs := &ControllerState{
		Connected:       data.poseValid != 0,
		Trigger:         round3(trigger),
		TriggerPressed:  pressed&buttonTrigger != 0,
		Grip:            pressed&buttonGrip != 0,
		Trackpad:        [2]float64{round3(trackpadX), round3(trackpadY)},
		TrackpadPressed: pressed&buttonTrackpad != 0,
		Menu:            pressed&buttonMenu != 0,
	}

	if data.poseValid != 0 {
		var flat [12]float32
		for i := 0; i < 12; i++ {
			flat[i] = float32(data.mat[i])
		}
		pos, rot := mat34ToQuat(flat)
		cs.Pos = [3]float64{round5(pos[0]), round5(pos[1]), round5(pos[2])}
		cs.Rot = [4]float64{round5(rot[0]), round5(rot[1]), round5(rot[2]), round5(rot[3])}
	}

	return cs
}

// findControllers scans all tracked-device slots and returns the device indices
// of the left and right hand controllers (either may be nil if not found).
func findControllers() (left, right *uint32) {
	for i := uint32(0); i < maxTrackedDevices; i++ {
		cls := uint32(C.bridge_get_device_class(C.uint(i)))
		if cls != deviceClassController {
			continue
		}
		role := uint32(C.bridge_get_controller_role(C.uint(i)))
		idx := i
		switch role {
		case controllerRoleLeft:
			left = &idx
		case controllerRoleRight:
			right = &idx
		}
	}
	return
}

// hapticReq is the inbound message shape for haptic feedback requests.
// Example: {"haptic":{"hand":"left","intensity":0.5,"duration":100}}
//
// intensity: 0.0–1.0 (scales the pulse duration since TriggerHapticPulse has
//
//	no amplitude parameter)
//
// duration: milliseconds
type hapticReq struct {
	Haptic *struct {
		Hand      string  `json:"hand"`      // "left" or "right"
		Intensity float64 `json:"intensity"` // 0.0–1.0
		Duration  float64 `json:"duration"`  // ms
	} `json:"haptic"`
}

// ---------------------------------------------------------------------------
// WebSocket hub
// ---------------------------------------------------------------------------

type hub struct {
	mu       sync.RWMutex
	clients  map[*websocket.Conn]struct{}
	leftIdx  *uint32 // current left controller device index (nil = not found)
	rightIdx *uint32 // current right controller device index
}

func newHub() *hub { return &hub{clients: make(map[*websocket.Conn]struct{})} }

// setControllerIndices is called by pollLoop whenever it rescans devices.
func (h *hub) setControllerIndices(left, right *uint32) {
	h.mu.Lock()
	h.leftIdx = left
	h.rightIdx = right
	h.mu.Unlock()
}

// triggerHaptic fires a haptic pulse on the named controller.
// intensity (0–1) scales the microsecond duration since TriggerHapticPulse
// has no amplitude control. Max hardware pulse is ~3999 µs per call.
func (h *hub) triggerHaptic(hand string, intensity, durationMs float64) {
	h.mu.RLock()
	var idx *uint32
	if hand == "left" {
		idx = h.leftIdx
	} else {
		idx = h.rightIdx
	}
	h.mu.RUnlock()

	if idx == nil {
		return
	}
	us := intensity * durationMs * 1000
	if us < 1 {
		us = 1
	}
	if us > 65535 {
		us = 65535
	}
	C.bridge_haptic_pulse(C.uint(*idx), C.ushort(us))
}

func (h *hub) add(c *websocket.Conn) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *hub) remove(c *websocket.Conn) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

func (h *hub) count() int {
	h.mu.RLock()
	n := len(h.clients)
	h.mu.RUnlock()
	return n
}

func (h *hub) broadcast(ctx context.Context, msg []byte) {
	h.mu.RLock()
	conns := make([]*websocket.Conn, 0, len(h.clients))
	for c := range h.clients {
		conns = append(conns, c)
	}
	h.mu.RUnlock()

	for _, c := range conns {
		_ = c.Write(ctx, websocket.MessageText, msg)
	}
}

// handler upgrades an HTTP request to a WebSocket connection, adds it to the
// hub, and reads incoming messages until the client disconnects.
// Clients may send haptic requests:
//
//	{"haptic":{"hand":"left","intensity":0.5,"duration":100}}
func (h *hub) handler(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // allow any Origin
	})
	if err != nil {
		return
	}
	h.add(conn)
	fmt.Printf("[bridge] Client connected (%d total)\n", h.count())

	ctx := r.Context()
	for {
		_, msg, err := conn.Read(ctx)
		if err != nil {
			break
		}
		var req hapticReq
		if json.Unmarshal(msg, &req) == nil && req.Haptic != nil {
			h.triggerHaptic(req.Haptic.Hand, req.Haptic.Intensity, req.Haptic.Duration)
		}
	}

	h.remove(conn)
	_ = conn.Close(websocket.StatusNormalClosure, "")
	fmt.Printf("[bridge] Client disconnected (%d total)\n", h.count())
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

func pollLoop(ctx context.Context, h *hub, hz int) {
	interval := time.Duration(float64(time.Second) / float64(hz))
	fmt.Printf("[bridge] Polling at %d Hz (interval %.1f ms)\n", hz,
		float64(interval)/float64(time.Millisecond))

	var leftIdx, rightIdx *uint32
	lastScan := time.Time{}
	vrOK := int(C.bridge_init(C.int(vrApplicationBackground))) == 0
	if vrOK {
		fmt.Println("[bridge] OpenVR initialized")
	} else {
		fmt.Fprintln(os.Stderr, "[bridge] OpenVR not available, will retry...")
	}

	for {
		start := time.Now()

		// Re-scan for controllers (and retry OpenVR init) every 2 s.
		if time.Since(lastScan) > 2*time.Second {
			if !vrOK {
				if rc := int(C.bridge_init(C.int(vrApplicationBackground))); rc == 0 {
					vrOK = true
					fmt.Println("[bridge] OpenVR initialized")
				}
			}
			leftIdx, rightIdx = findControllers()
			h.setControllerIndices(leftIdx, rightIdx)
			lastScan = time.Now()
			if leftIdx != nil || rightIdx != nil {
				l, r := -1, -1
				if leftIdx != nil {
					l = int(*leftIdx)
				}
				if rightIdx != nil {
					r = int(*rightIdx)
				}
				fmt.Printf("[bridge] Controllers: left=%d, right=%d\n", l, r)
			}
		}

		resolve := func(idx *uint32) ControllerState {
			if idx == nil {
				return nullController
			}
			if cs := readController(*idx); cs != nil {
				return *cs
			}
			return nullController
		}

		f := frame{
			TS: float64(time.Now().UnixMilli()) / 1000.0,
			Controllers: frameControllers{
				Left:  resolve(leftIdx),
				Right: resolve(rightIdx),
			},
		}

		if msg, err := json.Marshal(f); err == nil {
			h.broadcast(ctx, msg)
		}

		elapsed := time.Since(start)
		if sleep := interval - elapsed; sleep > 0 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(sleep):
			}
		} else {
			select {
			case <-ctx.Done():
				return
			default:
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

func main() {
	port := flag.Int("port", 9090, "WebSocket port (default: 9090)")
	hz := flag.Int("hz", 90, "Polling rate in Hz (default: 90)")
	flag.Parse()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	h := newHub()
	mux := http.NewServeMux()
	mux.HandleFunc("/", h.handler)

	srv := &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%d", *port),
		Handler: mux,
	}

	fmt.Printf("[bridge] WebSocket server listening on ws://0.0.0.0:%d\n", *port)
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "[bridge] server error: %v\n", err)
		}
	}()

	defer func() {
		C.bridge_shutdown()
		fmt.Println("[bridge] OpenVR shut down")
	}()

	go pollLoop(ctx, h, *hz)

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	fmt.Println("\n[bridge] Stopped")

	cancel()
	_ = srv.Shutdown(context.Background())
}
