// SteamVR → Viam robot bridge (Go, E2E).
//
// Reads Vive Wand controller poses and button states from SteamVR/OpenVR
// and sends arm/gripper commands directly to a Viam robot at ~90 Hz.
// No frontend or WebSocket required.
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
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/components/arm"
	"go.viam.com/rdk/components/gripper"
	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/robot/client"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/utils/rpc"
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
// Quaternion math (x, y, z, w layout)
// ---------------------------------------------------------------------------

type quat [4]float64 // x, y, z, w

func qMul(a, b quat) quat {
	return quat{
		a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
		a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
		a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
		a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2],
	}
}

func qConj(q quat) quat { return quat{-q[0], -q[1], -q[2], q[3]} }

func qNorm(q quat) quat {
	mag := math.Sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3])
	if mag < 1e-10 {
		return quat{0, 0, 0, 1}
	}
	return quat{q[0] / mag, q[1] / mag, q[2] / mag, q[3] / mag}
}

func qFromAxisAngle(ax, ay, az, angle float64) quat {
	s := math.Sin(angle / 2)
	return quat{ax * s, ay * s, az * s, math.Cos(angle / 2)}
}

// qRotateVec rotates (vx,vy,vz) by q: v' = q * (v,0) * q^-1
func qRotateVec(q quat, vx, vy, vz float64) (float64, float64, float64) {
	r := qMul(qMul(q, quat{vx, vy, vz, 0}), qConj(q))
	return r[0], r[1], r[2]
}

// transformToRobotFrame: T * q * T^-1
func transformToRobotFrame(q, T quat) quat {
	return qNorm(qMul(qMul(T, q), qConj(T)))
}

// steamVRTransform is the SteamVR standing universe → Viam robot frame quaternion.
// Equivalent to rotZ(-90°) * rotX(90°) (same as the WebXR transform in the TS code).
// Combined with calibration yaw (applied on the right), this maps:
//   User forward → Robot +X, Up(+Y) → Robot +Z, User left → Robot +Y.
// Without calibration (user facing SteamVR -Z):
//   -Z → +X, +Y → +Z, +X → +Y.
var steamVRTransform = func() quat {
	rotX := qFromAxisAngle(1, 0, 0, math.Pi/2)
	rotZ := qFromAxisAngle(0, 0, 1, -math.Pi/2)
	return qNorm(qMul(rotZ, rotX))
}()


// quatToOVDeg converts a unit quaternion to a Viam orientation vector (theta in degrees).
// Port of OrientationVector.setFromQuaternion from OrientationVector.ts.
func quatToOVDeg(q quat) (ox, oy, oz, thetaDeg float64) {
	const eps = 0.0001
	conj := qConj(q)
	xAxis := quat{-1, 0, 0, 0}
	zAxis := quat{0, 0, 1, 0}
	newX := qMul(qMul(q, xAxis), conj)
	newZ := qMul(qMul(q, zAxis), conj)

	var th float64
	nzx, nzy, nzz := newZ[0], newZ[1], newZ[2]
	nxx, nxy, nxz := newX[0], newX[1], newX[2]

	if 1-math.Abs(nzz) > eps {
		// normal1 = newZimag × newXimag
		n1x := nzy*nxz - nzz*nxy
		n1y := nzz*nxx - nzx*nxz
		n1z := nzx*nxy - nzy*nxx
		// normal2 = newZimag × (0,0,1)
		n2x := nzy
		n2y := -nzx
		n2z := 0.0
		mag1 := math.Sqrt(n1x*n1x + n1y*n1y + n1z*n1z)
		mag2 := math.Sqrt(n2x*n2x + n2y*n2y + n2z*n2z)
		if mag1 > 1e-10 && mag2 > 1e-10 {
			cosTheta := math.Max(-1, math.Min(1, (n1x*n2x+n1y*n2y+n1z*n2z)/(mag1*mag2)))
			theta := math.Acos(cosTheta)
			if theta > eps {
				magNZ := math.Sqrt(nzx*nzx + nzy*nzy + nzz*nzz)
				if magNZ > 1e-10 {
					rotQ := qFromAxisAngle(nzx/magNZ, nzy/magNZ, nzz/magNZ, -theta)
					testZ := qMul(qMul(rotQ, zAxis), qConj(rotQ))
					n3x := nzy*testZ[2] - nzz*testZ[1]
					n3y := nzz*testZ[0] - nzx*testZ[2]
					n3z := nzx*testZ[1] - nzy*testZ[0]
					mag3 := math.Sqrt(n3x*n3x + n3y*n3y + n3z*n3z)
					if mag3 > 1e-10 {
						cosTest := (n1x*n3x + n1y*n3y + n1z*n3z) / (mag1 * mag3)
						if 1-cosTest < eps*eps {
							th = -theta
						} else {
							th = theta
						}
					}
				}
			}
		}
	} else if nzz < 0 {
		th = -math.Atan2(nxy, nxx)
	} else {
		th = -math.Atan2(nxy, -nxx)
	}

	mag := math.Sqrt(nzx*nzx + nzy*nzy + nzz*nzz)
	if mag < 1e-10 {
		mag = 1
	}
	return nzx / mag, nzy / mag, nzz / mag, th * 180 / math.Pi
}

// ---------------------------------------------------------------------------
// Controller state
// ---------------------------------------------------------------------------

type ControllerState struct {
	Connected       bool
	Pos             [3]float64 // x, y, z (meters)
	Rot             quat       // x, y, z, w
	Trigger         float64
	TriggerPressed  bool
	Grip            bool
	Trackpad        [2]float64
	TrackpadPressed bool
	Menu            bool
}

var nullController = ControllerState{Rot: quat{0, 0, 0, 1}}

// mat34ToQuat converts an OpenVR row-major 3×4 matrix to (position, quaternion).
func mat34ToQuat(m [12]float32) ([3]float64, quat) {
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
	return pos, quat{qx, qy, qz, qw}
}

func readController(idx uint32, isLeft bool) *ControllerState {
	leftFlag := C.int(0)
	if isLeft {
		leftFlag = 1
	}
	data := C.bridge_get_controller(C.uint(idx), leftFlag)
	if data.stateValid == 0 {
		return nil
	}
	pressed := uint64(data.pressed)
	trigger := float64(data.axis1x)
	cs := &ControllerState{
		Connected:       data.poseValid != 0,
		Trigger:         trigger,
		TriggerPressed:  trigger > 0.8,
		Grip:            pressed&buttonGrip != 0,
		Trackpad:        [2]float64{float64(data.axis0x), -float64(data.axis0y)},
		TrackpadPressed: pressed&buttonTrackpad != 0,
		Menu:            pressed&buttonMenu != 0,
	}
	if data.poseValid != 0 {
		var flat [12]float32
		for i := 0; i < 12; i++ {
			flat[i] = float32(data.mat[i])
		}
		pos, rot := mat34ToQuat(flat)
		cs.Pos = pos
		cs.Rot = rot
	}
	return cs
}

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

func hapticPulse(idx uint32, intensity, durationMs float64) {
	us := intensity * durationMs * 1000
	if us < 1 {
		us = 1
	}
	if us > 65535 {
		us = 65535
	}
	C.bridge_haptic_pulse(C.uint(idx), C.ushort(us))
}

// ---------------------------------------------------------------------------
// Calibration
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

func saveCalib(yaw float64, dir string) {
	calibMu.Lock()
	calibYaw = yaw
	calibSet = true
	calibMu.Unlock()
	path := filepath.Join(dir, "calibration.json")
	b, _ := json.Marshal(calibData{Yaw: yaw})
	if err := os.WriteFile(path, b, 0644); err != nil {
		fmt.Printf("[bridge] Failed to save calibration: %v\n", err)
	} else {
		fmt.Printf("[bridge] Calibrated forward: %.1f° (saved)\n", yaw*180/math.Pi)
	}
}

func computeCalibYaw(rot quat) (float64, bool) {
	// Extract controller's -Z axis (forward direction) projected onto XZ plane.
	cx, cy, cz, cw := rot[0], rot[1], rot[2], rot[3]
	cfx := -2 * (cx*cz + cy*cw)
	cfz := -(1 - 2*(cx*cx+cy*cy))
	mag := math.Sqrt(cfx*cfx + cfz*cfz)
	if mag < 1e-6 {
		return 0, false
	}
	// Yaw = angle from SteamVR -Z to the user's forward, around +Y axis.
	// steamVRTransform without yaw maps -Z → Robot +X.  With yawQ applied,
	// the user's forward (cfx, cfz) gets rotated to align with -Z first.
	return math.Atan2(cfx/mag, -cfz/mag), true
}

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
	cosY := math.Cos(yaw)
	sinY := math.Sin(yaw)
	x, z := cs.Pos[0], cs.Pos[2]
	cs.Pos = [3]float64{x*cosY - z*sinY, cs.Pos[1], x*sinY + z*cosY}
	// Rotation is NOT modified here — calibration yaw only affects position.
	// The rotation offset is computed as a delta (curRot * inv(ctrlRef)) which
	// is independent of any global yaw, so applying yaw here would conjugate
	// the delta and change its axis incorrectly.
	return cs
}

// ---------------------------------------------------------------------------
// Teleop hand — controls one arm + optional gripper
// ---------------------------------------------------------------------------

type pose struct {
	x, y, z              float64
	ox, oy, oz, thetaDeg float64
}

type teleopHand struct {
	name        string
	armName     string
	gripperName string
	arm         arm.Arm
	gripper     gripper.Gripper // nil if no gripper
	deviceIdx   *uint32
	scale       float64
	rotEnabled  bool
	absoluteRot bool

	// button edge state
	wasGrip    bool
	wasTrigger bool
	wasMenu    bool

	// control state
	isControlling  bool
	isSending      bool
	errorTimeout   time.Time
	lastCmdTime    time.Time
	poseStack      []pose
	gripStopTimer  *time.Timer

	// reference capture (on grip press)
	ctrlRefPos       [3]float64
	ctrlRefRotRobot  quat
	calibTransform   quat // steamVRTransform * calibYaw, captured at grip press
	robotRefPos      [3]float64
	robotRefQuat     quat
	ctrlToArmOffset  quat
}

const (
	cmdInterval      = 11 * time.Millisecond
	errorCooldown    = 1 * time.Second
	errorHapticIntvl = 200 * time.Millisecond
)

func newTeleopHand(name, armName, gripperName string, scale float64, rotEnabled bool) *teleopHand {
	return &teleopHand{
		name:             name,
		armName:          armName,
		gripperName:      gripperName,
		scale:            scale,
		rotEnabled:       rotEnabled,
		ctrlToArmOffset: quat{0, 0, 0, 1},
	}
}

func (h *teleopHand) connect(ctx context.Context, robot *client.RobotClient) error {
	a, err := arm.FromRobot(robot, h.armName)
	if err != nil {
		return fmt.Errorf("arm %q: %w", h.armName, err)
	}
	h.arm = a
	if h.gripperName != "" {
		g, err := gripper.FromRobot(robot, h.gripperName)
		if err != nil {
			fmt.Printf("[%s] gripper %q not available: %v\n", h.name, h.gripperName, err)
		} else {
			h.gripper = g
		}
	}
	return nil
}

func (h *teleopHand) tick(ctx context.Context, cs ControllerState) {
	// --- Gripper (trigger) ---
	if h.gripper != nil {
		if cs.TriggerPressed && !h.wasTrigger {
			if h.gripStopTimer != nil {
				h.gripStopTimer.Stop()
				h.gripStopTimer = nil
			}
			go func() {
				if _, err := h.gripper.Grab(ctx, nil); err != nil {
					fmt.Printf("[%s] gripper grab: %v\n", h.name, err)
				}
			}()
		} else if !cs.TriggerPressed && h.wasTrigger {
			if h.gripStopTimer != nil {
				h.gripStopTimer.Stop()
			}
			go func() {
				if err := h.gripper.Open(ctx, nil); err != nil {
					fmt.Printf("[%s] gripper open: %v\n", h.name, err)
					return
				}
			}()
			h.gripStopTimer = time.AfterFunc(1*time.Second, func() {
				if err := h.gripper.Stop(ctx, nil); err != nil {
					fmt.Printf("[%s] gripper stop: %v\n", h.name, err)
				}
			})
		}
		h.wasTrigger = cs.TriggerPressed
	}

	// Arm requires connected pose.
	if !cs.Connected {
		return
	}

	// --- Grip: start/stop arm control ---
	if cs.Grip && !h.wasGrip {
		h.startControl(ctx, cs)
	} else if !cs.Grip && h.wasGrip && h.isControlling {
		h.isControlling = false
		h.sendHaptic(0.3, 80)
		// Debug: log arm pose and controller orientation on release.
		go func() {
			if p, err := h.arm.EndPosition(ctx, nil); err == nil {
				pt := p.Point()
				ov := p.Orientation().OrientationVectorDegrees()
				fmt.Printf("[%s] arm pose: pos=(%.1f, %.1f, %.1f) ov=(%.3f, %.3f, %.3f, θ=%.1f°)\n",
					h.name, pt.X, pt.Y, pt.Z, ov.OX, ov.OY, ov.OZ, ov.Theta)
			}
			curRotRobot := transformToRobotFrame(cs.Rot, h.calibTransform)
			cox, coy, coz, ctheta := quatToOVDeg(curRotRobot)
			fmt.Printf("[%s] controller rot (robot frame): ov=(%.3f, %.3f, %.3f, θ=%.1f°)\n",
				h.name, cox, coy, coz, ctheta)
		}()
	}
	h.wasGrip = cs.Grip

	// --- Menu: return to saved pose ---
	if cs.Menu && !h.wasMenu && len(h.poseStack) > 0 {
		go h.returnToPose(ctx)
	}
	h.wasMenu = cs.Menu

	// --- Control frame ---
	if h.isControlling {
		if !h.isSending {
			h.controlFrame(ctx, cs)
		}
	}
}

func (h *teleopHand) startControl(ctx context.Context, cs ControllerState) {
	go func() {
		currentPose, err := h.arm.EndPosition(ctx, nil)
		if err != nil {
			fmt.Printf("[%s] startControl: EndPosition: %v\n", h.name, err)
			return
		}
		pt := currentPose.Point()
		ori := currentPose.Orientation()
		ovd := ori.OrientationVectorDegrees()

		h.robotRefPos = [3]float64{pt.X, pt.Y, pt.Z}

		// Reconstruct robot arm quaternion from orientation vector degrees.
		ovRad := spatialmath.NewOrientationVector()
		ovRad.OX = ovd.OX
		ovRad.OY = ovd.OY
		ovRad.OZ = ovd.OZ
		ovRad.Theta = ovd.Theta * math.Pi / 180
		rq := ovRad.Quaternion()
		h.robotRefQuat = qNorm(quat{rq.Imag, rq.Jmag, rq.Kmag, rq.Real})

		h.poseStack = append(h.poseStack, pose{
			x: pt.X, y: pt.Y, z: pt.Z,
			ox: ovd.OX, oy: ovd.OY, oz: ovd.OZ, thetaDeg: ovd.Theta,
		})

		h.ctrlRefPos = cs.Pos

		// Build calibrated rotation transform: steamVRTransform * yawQ.
		// This maps SteamVR axes to robot axes accounting for the user's
		// facing direction.  Used only for rotation (position uses applyCalib).
		calibMu.RLock()
		yaw := calibYaw
		calibMu.RUnlock()
		h.calibTransform = steamVRTransform
		if yaw != 0 {
			yawQ := qFromAxisAngle(0, 1, 0, yaw)
			h.calibTransform = qNorm(qMul(steamVRTransform, yawQ))
		}

		// Matches TS: controllerRefRotRobot = transformToRobotFrame(grip.quaternion, qTransform)
		h.ctrlRefRotRobot = transformToRobotFrame(cs.Rot, h.calibTransform)

		// Matches TS: offset = inverse(controllerRefRotRobot) * robotRefQuat
		h.ctrlToArmOffset = qNorm(qMul(qConj(h.ctrlRefRotRobot), h.robotRefQuat))

		h.errorTimeout = time.Time{}
		h.isControlling = true
		h.sendHaptic(0.5, 100)
		fmt.Printf("[%s] control started at (%.1f, %.1f, %.1f)\n", h.name, pt.X, pt.Y, pt.Z)
	}()
}

func (h *teleopHand) controlFrame(ctx context.Context, cs ControllerState) {
	now := time.Now()
	if now.Sub(h.lastCmdTime) < cmdInterval {
		return
	}
	if !h.errorTimeout.IsZero() && now.Before(h.errorTimeout) {
		return
	}

	// Position: delta in SteamVR space → rotate by calibTransform → robot frame.
	// Matches TS: deltaRobot = deltaXR.applyQuaternion(qTransform)
	dx := cs.Pos[0] - h.ctrlRefPos[0]
	dy := cs.Pos[1] - h.ctrlRefPos[1]
	dz := cs.Pos[2] - h.ctrlRefPos[2]
	rx, ry, rz := qRotateVec(h.calibTransform, dx, dy, dz)
	scaleMM := h.scale * 1000
	tx := h.robotRefPos[0] + rx*scaleMM
	ty := h.robotRefPos[1] + ry*scaleMM
	tz := h.robotRefPos[2] + rz*scaleMM

	// Rotation: T * q * T^-1, then apply offset
	var tox, toy, toz, thetaDeg float64
	if h.rotEnabled {
		curRotRobot := transformToRobotFrame(cs.Rot, h.calibTransform)
		if h.absoluteRot {
			// Absolute: controller orientation + 180° X to correct gripper mounting.
			flipX := qFromAxisAngle(1, 0, 0, math.Pi)
			tox, toy, toz, thetaDeg = quatToOVDeg(qNorm(qMul(curRotRobot, flipX)))
		} else {
			// Relative: apply offset from reference capture.
			targetRot := qNorm(qMul(curRotRobot, h.ctrlToArmOffset))
			tox, toy, toz, thetaDeg = quatToOVDeg(targetRot)
		}
	} else {
		// Keep arm at reference orientation
		tox, toy, toz, thetaDeg = quatToOVDeg(h.robotRefQuat)
	}

	if math.IsNaN(tx) || math.IsNaN(tox) || math.IsNaN(thetaDeg) {
		return
	}

	h.lastCmdTime = now
	h.isSending = true

	go func() {
		defer func() { h.isSending = false }()

		p := spatialmath.NewPose(
			r3.Vector{X: tx, Y: ty, Z: tz},
			&spatialmath.OrientationVectorDegrees{OX: tox, OY: toy, OZ: toz, Theta: thetaDeg},
		)
		if err := h.arm.MoveToPosition(ctx, p, nil); err != nil {
			fmt.Printf("[%s] MoveToPosition: %v\n", h.name, err)
			h.errorTimeout = time.Now().Add(errorCooldown)
			h.sendHaptic(0.8, 200)
		}
	}()
}

func (h *teleopHand) returnToPose(ctx context.Context) {
	if len(h.poseStack) == 0 {
		return
	}
	saved := h.poseStack[len(h.poseStack)-1]
	h.poseStack = h.poseStack[:len(h.poseStack)-1]
	h.isControlling = false

	p := spatialmath.NewPose(
		r3.Vector{X: saved.x, Y: saved.y, Z: saved.z},
		&spatialmath.OrientationVectorDegrees{OX: saved.ox, OY: saved.oy, OZ: saved.oz, Theta: saved.thetaDeg},
	)
	if err := h.arm.MoveToPosition(ctx, p, nil); err != nil {
		fmt.Printf("[%s] returnToPose: %v\n", h.name, err)
	}
}

func (h *teleopHand) sendHaptic(intensity, durationMs float64) {
	if h.deviceIdx != nil {
		hapticPulse(*h.deviceIdx, intensity, durationMs)
	}
}

func (h *teleopHand) toggleRotMode() {
	h.absoluteRot = !h.absoluteRot
	mode := "relative"
	if h.absoluteRot {
		mode = "absolute"
	}
	fmt.Printf("[%s] rotation mode: %s\n", h.name, mode)
	h.sendHaptic(0.3, 80)
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

func initBridge(manifestPath string) int {
	cPath := C.CString(manifestPath)
	defer C.free(unsafe.Pointer(cPath))
	return int(C.bridge_init(cPath))
}

func pollLoop(ctx context.Context, hz int, manifestPath string, left, right *teleopHand) {
	interval := time.Duration(float64(time.Second) / float64(hz))
	fmt.Printf("[bridge] Polling at %d Hz (%.1f ms)\n", hz, float64(interval)/float64(time.Millisecond))

	dir := filepath.Dir(manifestPath)
	loadCalib(dir)

	var leftIdx, rightIdx *uint32
	var wasLeftTrackpad, wasRightTrackpad bool
	lastScan := time.Time{}
	vrOK := initBridge(manifestPath) == 0
	if vrOK {
		fmt.Println("[bridge] OpenVR initialized")
	} else {
		fmt.Fprintln(os.Stderr, "[bridge] OpenVR not available, will retry...")
	}

	for {
		start := time.Now()

		if time.Since(lastScan) > 2*time.Second {
			if !vrOK && initBridge(manifestPath) == 0 {
				vrOK = true
				fmt.Println("[bridge] OpenVR initialized")
			}
			leftIdx, rightIdx = findControllers()
			if left != nil {
				left.deviceIdx = leftIdx
			}
			if right != nil {
				right.deviceIdx = rightIdx
			}
			lastScan = time.Now()
		}

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

		// Trackpad rising edge: dispatch by region.
		for _, tr := range []struct {
			raw  ControllerState
			was  *bool
		}{
			{leftRaw, &wasLeftTrackpad},
			{rightRaw, &wasRightTrackpad},
		} {
			pressed := tr.raw.Connected && tr.raw.TrackpadPressed
			if pressed && !*tr.was {
				y := tr.raw.Trackpad[1]
				if y < -0.3 {
					// Up: calibrate forward direction.
					if yaw, ok := computeCalibYaw(tr.raw.Rot); ok {
						saveCalib(yaw, dir)
					}
				} else if y > 0.3 {
					// Down: toggle rotation control mode.
					if left != nil {
						left.toggleRotMode()
					}
					if right != nil {
						right.toggleRotMode()
					}
				}
			}
			*tr.was = pressed
		}

		// Pass raw (uncalibrated) controller state to teleop hands.
		// The teleop hand uses calibTransform for both position and rotation,
		// matching the TS/WebXR approach where qTransform handles everything.
		if left != nil && left.arm != nil {
			left.tick(ctx, leftRaw)
		}
		if right != nil && right.arm != nil {
			right.tick(ctx, rightRaw)
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
	hz := flag.Int("hz", 90, "Polling rate in Hz")
	address := flag.String("address", "project-cart-1-main.kssbd6djf3.viam.cloud", "Viam machine address")
	keyID := flag.String("key-id", "", "Viam API key ID")
	key := flag.String("key", "", "Viam API key")
	// Left controller → right-arm/gripper; right controller → left-arm/gripper.
	leftArm := flag.String("left-arm", "right-arm", "Arm controlled by the left controller")
	rightArm := flag.String("right-arm", "left-arm", "Arm controlled by the right controller")
	leftGripper := flag.String("left-gripper", "right-gripper", "Gripper controlled by the left controller (empty to disable)")
	rightGripper := flag.String("right-gripper", "left-gripper", "Gripper controlled by the right controller (empty to disable)")
	scale := flag.Float64("scale", 1.0, "Position scale factor (0.1–3.0)")
	rotEnabled := flag.Bool("rotation", true, "Enable orientation tracking")
	flag.Parse()

	exePath, err := os.Executable()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[bridge] Cannot determine executable path: %v\n", err)
		os.Exit(1)
	}
	manifestPath := filepath.Join(filepath.Dir(exePath), "actions.json")
	fmt.Printf("[bridge] Action manifest: %s\n", manifestPath)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to Viam robot.
	logger := logging.NewLogger("bridge")
	fmt.Printf("[bridge] Connecting to %s ...\n", *address)

	dialOpts := []rpc.DialOption{}
	if *keyID != "" && *key != "" {
		dialOpts = append(dialOpts, rpc.WithEntityCredentials(*keyID, rpc.Credentials{
			Type:    rpc.CredentialsTypeAPIKey,
			Payload: *key,
		}))
	}

	robot, err := client.New(ctx, *address, logger, client.WithDialOptions(dialOpts...))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[bridge] Failed to connect to robot: %v\n", err)
		os.Exit(1)
	}
	defer robot.Close(ctx)
	fmt.Println("[bridge] Connected to robot")

	left := newTeleopHand("left", *leftArm, *leftGripper, *scale, *rotEnabled)
	if err := left.connect(ctx, robot); err != nil {
		fmt.Fprintf(os.Stderr, "[bridge] Left hand: %v\n", err)
	}

	right := newTeleopHand("right", *rightArm, *rightGripper, *scale, *rotEnabled)
	if err := right.connect(ctx, robot); err != nil {
		fmt.Fprintf(os.Stderr, "[bridge] Right hand: %v\n", err)
	}

	defer func() {
		C.bridge_shutdown()
		fmt.Println("[bridge] OpenVR shut down")
	}()

	go pollLoop(ctx, *hz, manifestPath, left, right)

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	fmt.Println("\n[bridge] Stopped")
	cancel()
}
