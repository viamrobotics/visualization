---
title: Visualizer Guide
---

This guide covers the tools and features available in the Motion Tools visualizer UI.

## Connecting to a Machine

Click the connection status button in the toolbar to open the **Connection configurations** panel. Each config requires:

| Field             | Description                                                           |
| ----------------- | --------------------------------------------------------------------- |
| Host              | The machine's cloud address (e.g., `my-robot-main.abc123.viam.cloud`) |
| Part ID           | The part identifier for the machine                                   |
| API Key ID        | Your API key identifier                                               |
| API Key Value     | Your API key secret                                                   |
| Signaling Address | WebRTC signaling server (typically `https://app.viam.com:443`)        |

You can manage multiple configurations and toggle between them using the **Active** switch on each config. The connection status indicator shows the current state: **connecting**, **live** (green), or **offline** (red).

**Adding configs:**

- Click **Add config** to create a new entry manually
- **Paste** a JSON config anywhere in the window to auto-import it:

```json
{
	"host": "my-robot-main.abc123.viam.cloud",
	"partId": "myPartID",
	"apiKeyId": "myApiKeyId",
	"apiKeyValue": "myApiKeyValue",
	"signalingAddress": "https://app.viam.com:443"
}
```

**Environment variable configs:**

Configs can also be pre-loaded from a `.env.local` file using the `VITE_CONFIGS` variable (see [Quick Start](../#connect-to-a-machine)). Environment-injected configs appear in the panel but cannot be deleted.

All user-added configs are persisted to IndexedDB and available across browser sessions.

## World Tree

The **World** panel on the left side of the screen shows the entity hierarchy as a tree. Every named entity in the scene (frames, geometries, drawings) appears here, organized by parent-child relationships.

- **Select** a tree node to select the corresponding entity in the 3D scene and open its detail panel
- **Show/hide** entities using the eye icon toggle on each node. Hidden entities are dimmed in the tree and invisible in the scene
- The tree **auto-expands** to reveal the currently selected entity
- Entities with no parent (or parent `"world"`) appear as root nodes
- Nodes are sorted alphabetically

## Object Details

When you select an entity (by clicking in the scene or the world tree), a **Details** panel appears showing:

- **World position** (mm) and **world orientation** (degrees)
- **Local position** and **local orientation** relative to the parent frame
- **Parent frame** name
- **Geometry** type and dimensions (box, sphere, or capsule)
- **Points count** for point-type entities

Actions available:

- **Zoom to object** -- center the camera on the selected entity
- **Enter/Exit object view** -- lock the camera focus on the entity
- **Copy to clipboard** -- copy all detail data as JSON
- **Remove from scene** -- remove the entity (if removable)

### Relationships

The details panel also shows linked entities. You can add relationships between entities that have points or arrows traits using the **Add Relationship** button, which creates hover-linked connections with index mapping.

## Camera Controls

### Camera Modes

The visualizer supports two camera projection modes:

- **Perspective** -- standard 3D perspective projection with depth foreshortening
- **Orthographic** -- flat/schematic view without perspective distortion

Switch between modes using the camera mode buttons in the toolbar, or press **`C`** to toggle.

### Camera Reset

Click the camera reset button (camera icon) to return to the default camera position.

### Orientation Gizmo

A 3D orientation gizmo in the bottom-right corner shows the current camera orientation. Click its axes to snap the camera to a specific view direction.

### Keyboard Controls

| Key             | Action                                                       |
| --------------- | ------------------------------------------------------------ |
| `W` / `S`       | Move forward / backward                                      |
| `A` / `D`       | Truck left / right                                           |
| `R` / `F`       | Dolly in / out (perspective) or zoom in / out (orthographic) |
| Arrow keys      | Rotate and tilt the camera                                   |
| `C`             | Toggle perspective / orthographic mode                       |
| `1` / `2` / `3` | Switch to translate / rotate / scale transform mode          |
| `H`             | Toggle hide/show on the selected entity                      |
| `X`             | Toggle VR / AR mode (requires WebXR-capable browser)         |
| `Escape`        | Exit focused object view                                     |

### Programmatic Camera Control

You can also control the camera from the browser console by accessing the `cameraControls` object. See the [camera-controls API](https://github.com/yomotsu/camera-controls?tab=readme-ov-file#properties) for available methods and properties.

## Settings

Open the settings panel via the cog icon in the toolbar. Settings are organized into tabs and persisted across sessions.

### Connection Tab

Configure polling rates for live data from connected machines:

| Setting         | Options                                                            |
| --------------- | ------------------------------------------------------------------ |
| **Poses**       | Do not fetch, Manual, Live (60fps/30fps), or interval (0.5s - 10s) |
| **Pointclouds** | Do not fetch, Manual, or interval (0.5s - 10s)                     |
| **Vision**      | Do not fetch, Manual, or interval (0.5s - 10s)                     |

In **Manual** mode, a refresh button appears to trigger a one-time fetch. When actively polling, a pause button is shown.

### Scene Tab

| Setting                       | Description                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| **Arm Models**                | Toggle between Colliders, 3D Model, or both                                              |
| **Single item hover details** | Show position/orientation tooltip when hovering sub-entities                             |
| **Object labels**             | Show name labels on entities in the scene                                                |
| **Grid**                      | Toggle grid visibility, configure cell size (m), section size (m), and fade distance (m) |
| **Lines**                     | Configure default line thickness and dot size                                            |

### Pointclouds Tab

| Setting                 | Description                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| **Default point size**  | Size of point cloud points                                                 |
| **Default point color** | Color picker for point cloud rendering                                     |
| **Enabled cameras**     | Per-camera toggles to control which camera streams contribute point clouds |

### Vision Tab

Per-vision-service toggles to enable or disable individual vision service overlays.

### Widgets Tab

| Setting            | Description                                               |
| ------------------ | --------------------------------------------------------- |
| **Arm positions**  | Toggle the arm joint positions widget                     |
| **Camera widgets** | Per-camera toggles to open floating camera stream windows |

Camera stream widgets are draggable, resizable floating windows showing live video feeds with FPS counter and resolution picker.

### Stats Tab

| Setting            | Description                                       |
| ------------------ | ------------------------------------------------- |
| **Query devtools** | Toggle Query devtools for debugging data fetching |
| **Render stats**   | Toggle Three.js render statistics overlay         |

### Weblabs Tab

Feature flag toggles for experimental features. Each experiment can be independently enabled or disabled. Experiment state is stored in browser cookies.

### VR / AR Tab

This tab appears only in browsers that support [WebXR](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API). It configures VR/AR controller mapping for immersive sessions.

| Setting                 | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| **Enable VR / AR mode** | Master toggle for WebXR immersive mode                       |
| **Left Controller**     | Arm, gripper, scale factor (0.1 -- 3.0), and rotation toggle |
| **Right Controller**    | Arm, gripper, scale factor (0.1 -- 3.0), and rotation toggle |

Each controller can be mapped to a connected arm and gripper component. The scale factor controls movement sensitivity, and rotation can be independently toggled per hand.

## Measurement Tool

Activate the measurement tool by clicking the ruler icon in the toolbar.

1. **Click** on any surface to place the first measurement point (shows x/y/z coordinates in meters)
2. A preview line follows your cursor to the next potential point
3. **Click** again to place the second point -- a line appears between the two points with the **distance in meters** displayed at the midpoint
4. **Click** a third time to clear the measurement and start over

### Axis Constraints

Click the filter icon next to the ruler button to configure axis constraints. Disabling an axis (x, y, or z) locks the second measurement point to match the first point's coordinate on that axis, allowing measurements along specific planes.

The measurement resets when you change the selected entity or toggle the tool off.

## Frame Editing

When connected to a machine with edit permissions, you can modify frame configurations directly in the visualizer.

### Adding Frames

Click the axis-arrow icon in the toolbar to open the **Add Frames** panel. Select a frameless component from the dropdown and click **Add frame** to create a new frame for it.

### Editing Frame Properties

When viewing a frame entity's details (with edit permissions), all fields become editable:

- **Local position** (x, y, z in mm)
- **Local orientation** (x, y, z, theta in degrees)
- **Parent frame** (dropdown of available frames)
- **Geometry type** (None, Box, Sphere, or Capsule) with editable dimensions

### Saving Changes

When you have unsaved changes, a yellow banner appears at the bottom: "Live updates paused -- You are currently viewing a snapshot while editing." Use the **Save** button (or `Cmd/Ctrl+S`) to apply changes, or **Discard** to revert.

## Logs

Open the logs panel via the article icon in the toolbar. The panel shows application log messages with:

- **Filter chips** for error (red), warn (yellow), and info (blue) levels -- click to toggle each
- **Timestamp** and **message** for each log entry
- **Repeat count** badge when the same message occurs multiple times

The toolbar button shows badge indicators for active warning and error counts.

## File Drop

Drag and drop files directly onto the visualizer to load them:

| Format                          | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `visualization_snapshot*.json`  | Snapshot in JSON format                     |
| `visualization_snapshot*.pb`    | Snapshot in binary protobuf format          |
| `visualization_snapshot*.pb.gz` | Snapshot in gzip-compressed protobuf format |
| `.pcd`                          | Point cloud data files                      |
| `.ply`                          | PLY mesh/point cloud files                  |

Snapshot files are identified by the `visualization_snapshot` filename prefix and can use `.json`, `.pb`, or `.pb.gz` extensions. A toast notification confirms successful loading.
