#!/usr/bin/env python3
"""
SteamVR → WebSocket bridge.

Reads Vive Wand controller poses and button states from SteamVR/OpenVR
and broadcasts them to connected WebSocket clients at ~90 Hz.

Usage:
    python openvr_bridge.py [--port 9090] [--hz 90]
"""

import argparse
import asyncio
import json
import math
import time

import openvr
import websockets

# ---------------------------------------------------------------------------
# OpenVR helpers
# ---------------------------------------------------------------------------

# Vive Wand button bit masks (from openvr.h k_EButton_*)
BUTTON_MENU = 1 << 1        # k_EButton_ApplicationMenu
BUTTON_GRIP = 1 << 2        # k_EButton_Grip
BUTTON_TRACKPAD = 1 << 32   # k_EButton_SteamVR_Touchpad
BUTTON_TRIGGER = 1 << 33    # k_EButton_SteamVR_Trigger


def mat34_to_pos_quat(mat):
    """Convert an OpenVR HmdMatrix34_t to (position, quaternion).

    Returns ([x, y, z], [qx, qy, qz, qw]).
    """
    m = mat.m
    pos = [m[0][3], m[1][3], m[2][3]]

    # Rotation matrix → quaternion (Shepperd's method)
    trace = m[0][0] + m[1][1] + m[2][2]
    if trace > 0:
        s = 0.5 / math.sqrt(trace + 1.0)
        w = 0.25 / s
        x = (m[2][1] - m[1][2]) * s
        y = (m[0][2] - m[2][0]) * s
        z = (m[1][0] - m[0][1]) * s
    elif m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = 2.0 * math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2])
        w = (m[2][1] - m[1][2]) / s
        x = 0.25 * s
        y = (m[0][1] + m[1][0]) / s
        z = (m[0][2] + m[2][0]) / s
    elif m[1][1] > m[2][2]:
        s = 2.0 * math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2])
        w = (m[0][2] - m[2][0]) / s
        x = (m[0][1] + m[1][0]) / s
        y = 0.25 * s
        z = (m[1][2] + m[2][1]) / s
    else:
        s = 2.0 * math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1])
        w = (m[1][0] - m[0][1]) / s
        x = (m[0][2] + m[2][0]) / s
        y = (m[1][2] + m[2][1]) / s
        z = 0.25 * s

    return pos, [x, y, z, w]


def read_controller(vr_system, device_index):
    """Read pose and buttons for a single tracked device."""
    # Get controller state + pose in one call (standing universe)
    success, state, pose = vr_system.getControllerStateWithPose(
        openvr.TrackingUniverseStanding, device_index
    )
    if not success or not pose.bPoseIsValid:
        return None

    pos, rot = mat34_to_pos_quat(pose.mDeviceToAbsoluteTracking)

    pressed = state.ulButtonPressed

    # Axis 0 = trackpad (x, y), Axis 1 = trigger (x = value)
    trackpad_x = state.rAxis[0].x
    trackpad_y = state.rAxis[0].y
    trigger_val = state.rAxis[1].x

    return {
        "connected": True,
        "pos": [round(v, 5) for v in pos],
        "rot": [round(v, 5) for v in rot],
        "trigger": round(trigger_val, 3),
        "triggerPressed": bool(pressed & BUTTON_TRIGGER),
        "grip": bool(pressed & BUTTON_GRIP),
        "trackpad": [round(trackpad_x, 3), round(trackpad_y, 3)],
        "trackpadPressed": bool(pressed & BUTTON_TRACKPAD),
        "menu": bool(pressed & BUTTON_MENU),
    }


NULL_CONTROLLER = {
    "connected": False,
    "pos": [0, 0, 0],
    "rot": [0, 0, 0, 1],
    "trigger": 0.0,
    "triggerPressed": False,
    "grip": False,
    "trackpad": [0.0, 0.0],
    "trackpadPressed": False,
    "menu": False,
}


def find_controllers(vr_system):
    """Find left and right controller device indices.

    Returns (left_index, right_index) — either may be None.
    """
    left = None
    right = None

    for i in range(openvr.k_unMaxTrackedDeviceCount):
        cls = vr_system.getTrackedDeviceClass(i)
        if cls != openvr.TrackedDeviceClass_Controller:
            continue

        role = vr_system.getControllerRoleForTrackedDeviceIndex(i)
        if role == openvr.TrackedControllerRole_LeftHand:
            left = i
        elif role == openvr.TrackedControllerRole_RightHand:
            right = i

    return left, right


# ---------------------------------------------------------------------------
# WebSocket server
# ---------------------------------------------------------------------------

clients: set = set()


async def handler(websocket):
    clients.add(websocket)
    print(f"[bridge] Client connected ({len(clients)} total)")
    try:
        async for _msg in websocket:
            pass  # We don't expect messages from clients, but drain the queue
    finally:
        clients.discard(websocket)
        print(f"[bridge] Client disconnected ({len(clients)} total)")


async def broadcast(message: str):
    if not clients:
        return
    websockets.broadcast(clients, message)


async def poll_loop(vr_system, hz: int):
    """Main polling loop — reads controllers and broadcasts at the target rate."""
    interval = 1.0 / hz
    left_idx, right_idx = None, None
    last_scan = 0.0

    print(f"[bridge] Polling at {hz} Hz (interval {interval*1000:.1f} ms)")

    while True:
        loop_start = time.perf_counter()

        # Re-scan for controllers every 2 seconds (handles reconnects)
        if loop_start - last_scan > 2.0:
            left_idx, right_idx = find_controllers(vr_system)
            last_scan = loop_start
            if left_idx is not None or right_idx is not None:
                print(f"[bridge] Controllers: left={left_idx}, right={right_idx}")

        left = read_controller(vr_system, left_idx) if left_idx is not None else None
        right = read_controller(vr_system, right_idx) if right_idx is not None else None

        msg = json.dumps({
            "ts": round(time.time(), 3),
            "controllers": {
                "left": left or NULL_CONTROLLER,
                "right": right or NULL_CONTROLLER,
            },
        })

        await broadcast(msg)

        # Sleep for remainder of interval
        elapsed = time.perf_counter() - loop_start
        sleep_time = interval - elapsed
        if sleep_time > 0:
            await asyncio.sleep(sleep_time)


async def main(port: int, hz: int):
    print("[bridge] Initializing OpenVR...")
    vr_system = openvr.init(openvr.VRApplication_Background)
    print("[bridge] OpenVR initialized")

    try:
        async with websockets.serve(handler, "0.0.0.0", port):
            print(f"[bridge] WebSocket server listening on ws://0.0.0.0:{port}")
            await poll_loop(vr_system, hz)
    finally:
        openvr.shutdown()
        print("[bridge] OpenVR shut down")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SteamVR → WebSocket bridge")
    parser.add_argument("--port", type=int, default=9090, help="WebSocket port (default: 9090)")
    parser.add_argument("--hz", type=int, default=90, help="Polling rate in Hz (default: 90)")
    args = parser.parse_args()

    try:
        asyncio.run(main(args.port, args.hz))
    except KeyboardInterrupt:
        print("\n[bridge] Stopped")
