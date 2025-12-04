# motion-tools

## 0.19.1

### Patch Changes

- 41b18bd: make 3d model map creation more resiliant
- 3fa205f: Add roundtrip comms for draw API

## 0.19.0

### Minor Changes

- 61f0b27: Upgrade to svelte-sdk v1

## 0.18.3

### Patch Changes

- a404d00: Add logs from drawing server

## 0.18.2

### Patch Changes

- 610ba57: Remove hooks from Geometry component

## 0.18.1

### Patch Changes

- 429b056: Add usePose to logs

## 0.18.0

### Minor Changes

- 4d33a82: Allow manual refetching pointclouds and poses

### Patch Changes

- 8b3cc87: fix: return fake default weblab if none provided

## 0.17.0

### Minor Changes

- 66ff043: enable 3d models for arms

## 0.16.4

### Patch Changes

- ff41f2e: Use correct key for updating world state arrows

## 0.16.3

### Patch Changes

- 77ca9cd: Bumps github.com/go-viper/mapstructure/v2 from 2.3.0 to 2.4.0.
- 1d24c82: Bumps vite from 7.1.4 to 7.1.11.

## 0.16.2

### Patch Changes

- d87bbb6: fix arrow poses WorldObject init

## 0.16.1

### Patch Changes

- c849ab6: Include position and orientation details in pose world objects
- c849ab6: Invalidate renderer immediately when poses are drawn

## 0.16.0

### Minor Changes

- 4cee07e: Allow setting initial camera pose when embedded

### Patch Changes

- 56fe484: Only render on-demand

## 0.15.4

### Patch Changes

- f6dcb64: Sanitize incomplete poses from draw commands

## 0.15.3

### Patch Changes

- 4b80422: Fix arbitrary geometry editing
- 60269ad: refactor useframes

## 0.15.2

### Patch Changes

- f275caa: revert useframe refactor

## 0.15.1

### Patch Changes

- bc666ef: Do not depend on resource names to fetch poses

## 0.15.0

### Minor Changes

- b1976c6: Add PLY file drag-n-drop

### Patch Changes

- 9b5f383: hide delete button in app
- 3539418: Fix world state parenting in tree, fix color parsing, fix arrow management for world state

## 0.14.12

### Patch Changes

- 66c4c7c: Allow automatic buffer resizing for drawing arrows
- b1659d8: put add frames behind weblab

## 0.14.11

### Patch Changes

- 9c6ae90: fix bug in converting quat to ov

## 0.14.10

### Patch Changes

- 1c4143d: put pose matrix computations behind weblab

## 0.14.9

### Patch Changes

- b2dd602: Fix: use orientation vector methods for matrix transforms

## 0.14.8

### Patch Changes

- b8127a1: Fix excessive $effect calls causing CPU overload

## 0.14.7

### Patch Changes

- ac38329: Assume orientation is orientation vector degrees when unspecified
- 33c1353: ignore blank updated fields when edit frame
- 35bf0cd: dont show edit frames ui to non-permissioned users

## 0.14.6

### Patch Changes

- f9416d4: fix weblab loading logic to properly parse url encoded val

## 0.14.5

### Patch Changes

- fd16f3b: properly parse buffer stored ascii ply files

## 0.14.4

### Patch Changes

- 3bb9b57: Add DrawFrame API

## 0.14.3

### Patch Changes

- 709d3c5: get fragment ids if in string or object with id field
- d44734e: Improve logs tab
- 3880247: update details copied from detail pane to match shown

## 0.14.2

### Patch Changes

- 98db073: fix bug with select on:input not firing

## 0.14.1

### Patch Changes

- 95bc6a9: Add missing frameless component provider
- f173bc4: refetch poses when re-enter monitor mode

## 0.14.0

### Minor Changes

- d2c23ec: enable create and delete frames in standalone version
- 5ec5351: Add `shape` metadata for supported shapes from draw API. Add support for arrows from world state store.

## 0.13.0

### Minor Changes

- a48fd20: allow editing fragment defined frames
- db8b413: add ability to edit frames (re-parent, update pose, edit geo)

### Patch Changes

- 2a30157: Use oriented bounding boxes for selection

## 0.12.0

### Minor Changes

- 00d0df6: create weblab infrastructure
- 65ebe16: Display more info on world object details pane (local pose, parent frame)
- 2a67113: Add widgets drawer and arm positions widget

### Patch Changes

- 07f9d64: Display only one tree entry for frames with geometries
- 76c17f4: Allow live refresh rates

## 0.11.8

### Patch Changes

- c9662b9: Better pointcloud support. DrawWorldState will draw pointclouds via DrawGeometries. Pointclouds are downscaled for performance.

## 0.11.7

### Patch Changes

- f42eb95: Call getPose from origin frames and add frame geometry offsets

## 0.11.6

### Patch Changes

- 4095760: Remove .ts extension from worker URL

## 0.11.5

### Patch Changes

- b2e27c8: Revert "Worker fixes"

## 0.11.4

### Patch Changes

- 02edb37: Update measurement tool rendering opacity to 0.5
- 1aa922d: APP-9598 - Update getPose method signature for breaking change
- 0034f6d: APP 9587 - Allow drag and drop PCD files
- ad0c509: Use Vite worker bundling
- dbaf99f: Add makefile for simplifying env setup

## 0.11.3

### Patch Changes

- 0190973: Resize server body size limits to 1GB

## 0.11.2

### Patch Changes

- 15fb3e7: Ensure pointcloud arrays are not shared when posting http

## 0.11.1

### Patch Changes

- 77856ac: Clear previous points with same label if redrawn

## 0.11.0

### Minor Changes

- e505b0b: Improved world state store handling

### Patch Changes

- c093e40: Add Record + Replay functionality.

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
