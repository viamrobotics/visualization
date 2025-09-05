# motion-tools

## 0.10.0

### Minor Changes

- 145e959: Allow updating geometries via draw commands

## 0.9.5

### Patch Changes

- bce6867: Add useWorldState hook
- 4e4cb54: Have consecutive calls to `DrawFrameSystem` attempt to keep the same geometry label -> color mapping.
- 179e693: Allow measuring against individual points in pointclouds

## 0.9.4

### Patch Changes

- 257395a: Add trailing url check
- 8c04b83: Machine page quality of life improvements
- afecbdf: Bump RDK dependency to v0.90.0

## 0.9.3

### Patch Changes

- 9026f1f: Expose camera controls to window
- f0f253b: Improve pointer miss logic
- f0f253b: Fix custom geometry editing

## 0.9.2

### Patch Changes

- 7fd6fc2: Improve client docs

## 0.9.1

### Patch Changes

- fb22274: Fix bounding boxes to not include children
- fb22274: Add ability to toggle labels

## 0.9.0

### Minor Changes

- dbcac64: Allow disabling pointcloud fetching for specific cameras

### Patch Changes

- a74de32: Fix trackball controls in object view
- dbcac64: Fix reactivity issues with refresh rates

## 0.8.0

### Minor Changes

- 9bd8ea2: Add DrawLine function
- 39abdc9: Add SetCameraPose function

## 0.7.0

### Minor Changes

- ff124ba: Add measure tool

### Patch Changes

- 8380f14: Replace DomPortal component with attachment

## 0.6.3

### Patch Changes

- f42bb52: Allow IPv6 posts in websocket server

## 0.6.2

### Patch Changes

- 78477b3: Add Render stats toggle
- 78477b3: Add reset camera button
- 78477b3: Fix orthographic point size
- 78477b3: Add pointcloud configuration settings

## 0.6.1

### Patch Changes

- d3aac67: Update to latest RDK
- 3a7a5cb: Add configurable grid settings

## 0.6.0

### Minor Changes

- fb87f90: Assign colors to different resources

## 0.5.6

### Patch Changes

- bbade6c: Fix: update detail position when moving created geometries"

## 0.5.5

### Patch Changes

- d54fb32: Improve pointcloud draw commands

## 0.5.4

### Patch Changes

- 5d75e8b: Allow binary mesh type, remove internal CameraControls component

## 0.5.3

### Patch Changes

- 4785f7e: Allow binary mesh type, remove internal CameraControls component

## 0.5.2

### Patch Changes

- 59bffbf: Add keyboard controls

## 0.5.1

### Patch Changes

- a2d439b: Fix geomety uuids resetting on refresh
- 776be74: Improve PCD worker parsing
- 4586a06: Show world position and orientation in details

## 0.5.0

### Minor Changes

- 8b3c5d7: Export pcd related functions

## 0.4.0

### Minor Changes

- fe32e95: Split library export to /lib

## 0.3.8

### Patch Changes

- df49e6a: Update CameraControls internal lib name for type safety

## 0.3.7

### Patch Changes

- f3b29e6: export Geometry

## 0.3.6

### Patch Changes

- fd96d61: Ensure unique uuids for unnamed geometries

## 0.3.5

### Patch Changes

- 51237f3: Render gripper geometries

## 0.3.4

### Patch Changes

- d43c1ab: Don't use tailwind computed classes

## 0.3.3

### Patch Changes

- 5fdb320: Use binding element for portal

## 0.3.2

### Patch Changes

- 4a97eb6: Portal into motion tools root

## 0.3.1

### Patch Changes

- 5a18876: Use absolute positioning for items

## 0.3.0

### Minor Changes

- 628630b: Add comprehensive peer dependencies

### Patch Changes

- f297a81: Only establish websocket connection locally
- 4fd9fc5: add logs

## 0.2.0

### Minor Changes

- 3a69548: Add comprehensive peer dependencies

## 0.1.0

### Minor Changes

- 163d3ac: Initial release
