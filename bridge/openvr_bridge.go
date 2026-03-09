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
static struct VR_IVRInput_FnTable  *gVRInput  = NULL;

// Action set and per-action handles.
// Indices 0-4 are left-hand actions, 5-9 are right-hand, in order:
//   base+0 trigger (vector1), base+1 grip (boolean), base+2 menu (boolean),
//   base+3 trackpad (vector2), base+4 trackpad press (boolean)
static VRActionSetHandle_t gActionSet = 0;
static VRActionHandle_t    gAct[10]   = {0,0,0,0,0,0,0,0,0,0};

// bridge_init initialises OpenVR and loads the IVRInput action manifest.
// manifestPath must be the absolute path to actions.json.
// Returns 0 on success or a non-zero EVRInitError on failure.
static int bridge_init(const char *manifestPath) {
    char fnTable[64];
    snprintf(fnTable, sizeof(fnTable), "FnTable:%s", IVRSystem_Version);

    EVRInitError err = EVRInitError_VRInitError_None;
    VR_InitInternal(&err, EVRApplicationType_VRApplication_Background);
    if (err != EVRInitError_VRInitError_None)
        return (int)err;

    gVRSystem = (struct VR_IVRSystem_FnTable *)VR_GetGenericInterface(fnTable, &err);
    if (err != EVRInitError_VRInitError_None || gVRSystem == NULL) {
        VR_ShutdownInternal();
        return (int)(err ? err : 1);
    }

    // IVRInput — required for SteamVR Input 2.0 button/axis data.
    char inputFnTable[64];
    snprintf(inputFnTable, sizeof(inputFnTable), "FnTable:%s", IVRInput_Version);
    EVRInitError inputErr = EVRInitError_VRInitError_None;
    gVRInput = (struct VR_IVRInput_FnTable *)VR_GetGenericInterface(inputFnTable, &inputErr);
    if (gVRInput == NULL) {
        printf("[bridge-c] Warning: IVRInput unavailable (err=%d); buttons won't work\n", (int)inputErr);
        return 0;
    }

    EVRInputError mErr = gVRInput->SetActionManifestPath((char *)manifestPath);
    if (mErr != EVRInputError_VRInputError_None) {
        printf("[bridge-c] Warning: SetActionManifestPath(%s) failed (err=%d)\n", manifestPath, (int)mErr);
    } else {
        printf("[bridge-c] Action manifest loaded: %s\n", manifestPath);
    }

    gVRInput->GetActionSetHandle("/actions/bridge", &gActionSet);

    static const char *names[10] = {
        "/actions/bridge/in/left_trigger",
        "/actions/bridge/in/left_grip",
        "/actions/bridge/in/left_menu",
        "/actions/bridge/in/left_trackpad",
        "/actions/bridge/in/left_trackpad_press",
        "/actions/bridge/in/right_trigger",
        "/actions/bridge/in/right_grip",
        "/actions/bridge/in/right_menu",
        "/actions/bridge/in/right_trackpad",
        "/actions/bridge/in/right_trackpad_press",
    };
    for (int i = 0; i < 10; i++)
        gVRInput->GetActionHandle((char *)names[i], &gAct[i]);

    printf("[bridge-c] IVRInput ready (actionSet=0x%llx, IsUsingLegacyInput=%d)\n",
           (unsigned long long)gActionSet, (int)gVRInput->IsUsingLegacyInput());
    return 0;
}

static void bridge_shutdown(void) {
    gVRSystem  = NULL;
    gVRInput   = NULL;
    gActionSet = 0;
    VR_ShutdownInternal();
}

// bridge_update_input must be called once per frame before reading action data.
static void bridge_update_input(void) {
    if (!gVRInput || gActionSet == 0) return;
    VRActiveActionSet_t active;
    memset(&active, 0, sizeof(active));
    active.ulActionSet = gActionSet;
    gVRInput->UpdateActionState(&active, sizeof(VRActiveActionSet_t), 1);
}

static unsigned int bridge_get_device_class(unsigned int idx) {
    if (!gVRSystem) return 0;
    return (unsigned int)gVRSystem->GetTrackedDeviceClass(idx);
}

static unsigned int bridge_get_controller_role(unsigned int idx) {
    if (!gVRSystem) return 0;
    return (unsigned int)gVRSystem->GetControllerRoleForTrackedDeviceIndex(idx);
}

// BridgeControllerData carries per-controller data back to Go.
typedef struct {
    int      stateValid;
    int      poseValid;
    float    mat[12];        // row-major 3×4 tracking matrix
    uint64_t pressed;        // bitmask: bit1=menu, bit2=grip, bit32=trackpad
    float    axis0x, axis0y; // trackpad position
    float    axis1x;         // trigger value (0–1)
} BridgeControllerData;

static void bridge_haptic_pulse(unsigned int idx, unsigned short durationUs) {
    if (!gVRSystem) return;
    gVRSystem->TriggerHapticPulse((TrackedDeviceIndex_t)idx, 0, durationUs);
}

// bridge_get_controller reads pose via the legacy API (always works) and
// button/axis data via IVRInput. isLeft: 1=left hand, 0=right hand.
static BridgeControllerData bridge_get_controller(unsigned int idx, int isLeft) {
    BridgeControllerData out;
    memset(&out, 0, sizeof(out));
    if (!gVRSystem) return out;

    VRControllerState_t state;
    TrackedDevicePose_t pose;
    memset(&state, 0, sizeof(state));
    memset(&pose,  0, sizeof(pose));

    bool ok = gVRSystem->GetControllerStateWithPose(
        ETrackingUniverseOrigin_TrackingUniverseStanding,
        (TrackedDeviceIndex_t)idx,
        &state, sizeof(state),
        &pose
    );
    if (!ok) return out;

    out.stateValid = 1;
    if (pose.bPoseIsValid) {
        out.poseValid = 1;
        for (int r = 0; r < 3; r++)
            for (int c = 0; c < 4; c++)
                out.mat[r*4+c] = pose.mDeviceToAbsoluteTracking.m[r][c];
    }

    if (gVRInput && gActionSet != 0) {
        int base = isLeft ? 0 : 5;

        InputAnalogActionData_t trig;
        memset(&trig, 0, sizeof(trig));
        gVRInput->GetAnalogActionData(gAct[base+0], &trig, sizeof(trig), 0);
        out.axis1x = trig.x;

        InputDigitalActionData_t grip;
        memset(&grip, 0, sizeof(grip));
        gVRInput->GetDigitalActionData(gAct[base+1], &grip, sizeof(grip), 0);
        if (grip.bState) out.pressed |= (1ULL << 2);

        InputDigitalActionData_t menu;
        memset(&menu, 0, sizeof(menu));
        gVRInput->GetDigitalActionData(gAct[base+2], &menu, sizeof(menu), 0);
        if (menu.bState) out.pressed |= (1ULL << 1);

        InputAnalogActionData_t pad;
        memset(&pad, 0, sizeof(pad));
        gVRInput->GetAnalogActionData(gAct[base+3], &pad, sizeof(pad), 0);
        out.axis0x = pad.x;
        out.axis0y = pad.y;

        InputDigitalActionData_t padPress;
        memset(&padPress, 0, sizeof(padPress));
        gVRInput->GetDigitalActionData(gAct[base+4], &padPress, sizeof(padPress), 0);
        if (padPress.bState) out.pressed |= (1ULL << 32);
    } else {
        // Fallback to legacy (may be zero under SteamVR Input 2.0)
        out.pressed = state.ulButtonPressed;
        out.axis0x  = state.rAxis[0].x;
        out.axis0y  = state.rAxis[0].y;
        out.axis1x  = state.rAxis[1].x;
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
	"path/filepath"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"nhooyr.io/websocket"
)

// ---------------------------------------------------------------------------
// OpenVR constants
// ---------------------------------------------------------------------------

const (
	maxTrackedDevices     = 64 // k_unMaxTrackedDeviceCount
	deviceClassController = 2  // ETrackedDeviceClass_Controller
	controllerRoleLeft    = 1  // ETrackedControllerRole_LeftHand
	controllerRoleRight   = 2  // ETrackedControllerRole_RightHand

	buttonMenu     uint64 = 1 << 1
	buttonGrip     uint64 = 1 << 2
	buttonTrackpad uint64 = 1 << 32
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
// Returns nil if the device is not present.
func readController(idx uint32, isLeft bool) *ControllerState {
	leftFlag := C.int(0)
	if isLeft {
		leftFlag = 1
	}
	data := C.bridge_get_controller(C.uint(idx), leftFlag)
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
		TriggerPressed:  trigger > 0.8,
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
		// Vive Wands have mirrored local coordinate systems: the left controller's
		// local +X points world-left and local +Z also inverts (det = +1 preserved).
		// Negate qx and qz so identical physical gestures produce identical
		// quaternions from both controllers.
		if isLeft {
			rot[0] = -rot[0] // qx
			rot[2] = -rot[2] // qz
			rot[3] = -rot[3] // qz
		}
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
// Calibration — forward direction (Y-axis yaw offset)
// ---------------------------------------------------------------------------

var (
	calibMu  sync.RWMutex
	calibYaw float64
	calibSet bool
)

type calibData struct {
	Yaw float64 `json:"yaw"`
}

func loadCalib(dir string) {
	path := filepath.Join(dir, "calibration.json")
	b, err := os.ReadFile(path)
	if err != nil {
		fmt.Println("[bridge] No calibration file, forward = raw tracking frame")
		return
	}
	var cd calibData
	if err := json.Unmarshal(b, &cd); err != nil {
		fmt.Printf("[bridge] Bad calibration file: %v\n", err)
		return
	}
	calibMu.Lock()
	calibYaw = cd.Yaw
	calibSet = true
	calibMu.Unlock()
	fmt.Printf("[bridge] Calibration loaded: %.1f°\n", cd.Yaw*180/math.Pi)
}

func setCalib(yaw float64, dir string) {
	calibMu.Lock()
	calibYaw = yaw
	calibSet = true
	calibMu.Unlock()
	path := filepath.Join(dir, "calibration.json")
	b, _ := json.Marshal(calibData{Yaw: yaw})
	if err := os.WriteFile(path, b, 0644); err != nil {
		fmt.Printf("[bridge] Failed to save calibration: %v\n", err)
	} else {
		fmt.Printf("[bridge] ✓ Calibrated forward: %.1f° (saved)\n", yaw*180/math.Pi)
	}
}

// computeCalibYaw returns the Y-axis rotation that maps the controller's
// pointing direction (local -Z axis) to Room -X (expected robot forward).
// applyCalib rotates XZ as x'=x·cos-z·sin, z'=x·sin+z·cos (CCW by θ).
// To map (cfx,cfz) → (-1,0): θ = π - atan2(cfz, cfx).
func computeCalibYaw(rot [4]float64) (float64, bool) {
	cx, cy, cz, cw := rot[0], rot[1], rot[2], rot[3]
	// Controller -Z axis in world: -(R col2)
	cfx := -2 * (cx*cz + cy*cw)
	cfz := -(1 - 2*(cx*cx+cy*cy))
	mag := math.Sqrt(cfx*cfx + cfz*cfz)
	if mag < 1e-6 {
		return 0, false // pointing straight up/down
	}
	return math.Pi - math.Atan2(cfz/mag, cfx/mag), true
}

// applyCalib rotates a ControllerState's position and rotation by the stored
// calibration yaw (Y-axis rotation) to align raw tracking space to robot forward.
func applyCalib(cs ControllerState) ControllerState {
	if !cs.Connected {
		return cs
	}
	calibMu.RLock()
	yaw := calibYaw
	set := calibSet
	calibMu.RUnlock()
	if !set || yaw == 0 {
		return cs
	}
	qy := math.Sin(yaw / 2)
	qw := math.Cos(yaw / 2)
	cosY := 1 - 2*qy*qy // cos(yaw)
	sinY := 2 * qw * qy // sin(yaw)

	// Rotate position around Y axis
	x, z := cs.Pos[0], cs.Pos[2]
	cs.Pos = [3]float64{round5(x*cosY - z*sinY), cs.Pos[1], round5(x*sinY + z*cosY)}

	// Do NOT rotate the orientation quaternion by calibration yaw.
	// Calibration only corrects the position frame (operator's facing direction).
	// Left-multiplying CALIB * q does not cancel in the frontend sandwich
	// transform T * q * T⁻¹ used for relative rotation control — it would
	// introduce a spurious conjugation that inverts pitch and roll.
	return cs
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

// initBridge calls bridge_init with the action manifest path.
func initBridge(manifestPath string) int {
	cPath := C.CString(manifestPath)
	defer C.free(unsafe.Pointer(cPath))
	return int(C.bridge_init(cPath))
}

func pollLoop(ctx context.Context, h *hub, hz int, manifestPath string) {
	interval := time.Duration(float64(time.Second) / float64(hz))
	fmt.Printf("[bridge] Polling at %d Hz (interval %.1f ms)\n", hz,
		float64(interval)/float64(time.Millisecond))

	dir := filepath.Dir(manifestPath)
	loadCalib(dir)

	var leftIdx, rightIdx *uint32
	var wasLeftTrackpad, wasRightTrackpad bool
	var wasLeftGrip, wasRightGrip bool
	var wasLeftTrigger, wasRightTrigger bool
	lastScan := time.Time{}
	vrOK := initBridge(manifestPath) == 0
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
				if initBridge(manifestPath) == 0 {
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

		// Update IVRInput state once per frame before reading action data.
		C.bridge_update_input()

		resolve := func(idx *uint32, isLeft bool) ControllerState {
			if idx == nil {
				return nullController
			}
			cs := readController(*idx, isLeft)
			if cs == nil {
				return nullController
			}
			return *cs
		}

		leftRaw := resolve(leftIdx, true)
		rightRaw := resolve(rightIdx, false)

		// Trackpad rising edge: calibrate forward direction
		if leftRaw.Connected && leftRaw.TrackpadPressed && !wasLeftTrackpad {
			if yaw, ok := computeCalibYaw(leftRaw.Rot); ok {
				setCalib(yaw, dir)
			}
		}
		if rightRaw.Connected && rightRaw.TrackpadPressed && !wasRightTrackpad {
			if yaw, ok := computeCalibYaw(rightRaw.Rot); ok {
				setCalib(yaw, dir)
			}
		}
		wasLeftTrackpad = leftRaw.Connected && leftRaw.TrackpadPressed
		wasRightTrackpad = rightRaw.Connected && rightRaw.TrackpadPressed

		// Grip rising edge: log which hand pressed grip
		if leftRaw.Connected && leftRaw.Grip && !wasLeftGrip {
			fmt.Println("[bridge] LEFT grip pressed")
		}
		if rightRaw.Connected && rightRaw.Grip && !wasRightGrip {
			fmt.Println("[bridge] RIGHT grip pressed")
		}
		wasLeftGrip = leftRaw.Connected && leftRaw.Grip
		wasRightGrip = rightRaw.Connected && rightRaw.Grip

		// Trigger rising edge: log which hand pressed trigger
		if leftRaw.Connected && leftRaw.TriggerPressed && !wasLeftTrigger {
			fmt.Println("[bridge] LEFT trigger pressed")
		}
		if rightRaw.Connected && rightRaw.TriggerPressed && !wasRightTrigger {
			fmt.Println("[bridge] RIGHT trigger pressed")
		}
		wasLeftTrigger = leftRaw.Connected && leftRaw.TriggerPressed
		wasRightTrigger = rightRaw.Connected && rightRaw.TriggerPressed

		f := frame{
			TS: float64(time.Now().UnixMilli()) / 1000.0,
			Controllers: frameControllers{
				Left:  applyCalib(leftRaw),
				Right: applyCalib(rightRaw),
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

	// Resolve the action manifest path relative to the binary.
	exePath, err := os.Executable()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[bridge] Cannot determine executable path: %v\n", err)
		os.Exit(1)
	}
	manifestPath := filepath.Join(filepath.Dir(exePath), "actions.json")
	fmt.Printf("[bridge] Action manifest: %s\n", manifestPath)

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

	go pollLoop(ctx, h, *hz, manifestPath)

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	fmt.Println("\n[bridge] Stopped")

	cancel()
	_ = srv.Shutdown(context.Background())
}
