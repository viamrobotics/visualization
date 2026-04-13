# motion-tools

## 1.18.0

### Minor Changes

- a2d2976: add interaction layer trait
- bf53014: Add metadata to configure showing axes helper
- cec6888: Add `Opacities` trait, update `Metadata` with `color_format` and `opacities`
- a31c3bd: feat: refactor selection tool to use context instead of callbacks
- bf53014: Add invisible metadata to allow spawning hidden entities

### Patch Changes

- 9856850: Rework metadata parsing to match API and simplify new field additions

## 1.17.0

### Minor Changes

- e45aa3a: Add screen space trait
- e45aa3a: Update lines to accept line colors and dot colors
- e45aa3a: Add `useDrawService` hook

### Patch Changes

- e45aa3a: Fix issue with multiple meshes being rendered on entity add
- e45aa3a: Add draw utility functions to spawn entities from draw APIs
- cf5cd27: Run vitest in browser mode
- e45aa3a: Fix GLTFs drawn by client not being destroyed
- e9fcc6e: Add details snippet

## 1.16.0

### Minor Changes

- 12a2df3: feat: add ellipse selection type

### Patch Changes

- 8746e20: fix: force to navigate mode

## 1.15.8

### Patch Changes

- 3d93947: feat: expose zoom orthographic camera property
- a15a7aa: Improve persistence for refresh rates and enable pointcloud polling by default
- f2ae642: fix: make 3d models more resiliant
- e76e34f: feat: expose pcd onComplete callback

## 1.15.7

### Patch Changes

- 89258c9: sec: replace expr-eval with filtrex
- 89258c9: fix(deps): replace expr-eval with filtrex

## 1.15.6

### Patch Changes

- 59bb7f0: Enable log filtering by level
- 292abe1: [APP-15769] Viz tab: toggling tree item visibility does not propagate to children, and axes are not hidden
- e11e47d: Upgrade svelte to 5.55
- ef24ccf: Dedupe results of useFramelessComponents

## 1.15.5

### Patch Changes

- af76937: Fix edit mode issues and entity disposal

## 1.15.4

### Patch Changes

- 89c0802: Improve keyboard controls when zoomed in
- f353903: Fix "Cannot read properties of undefined" error
- 01d106f: Send release version to sentry

## 1.15.3

### Patch Changes

- b151176: Fix issue with multiple meshes being rendered on entity add
- 05d2934: Update useQuery hook to match Koota source
- f9e2f84: Bump Threlte

## 1.15.2

### Patch Changes

- 0467cea: Improve floating panel behavior in embedded environments

## 1.15.1

### Patch Changes

- 736a412: Move "add frame" to dashboard
- 9c47a4d: Fix: selection bounding box for models

## 1.15.0

### Minor Changes

- 99bcc28: add settings tab for weblabs

### Patch Changes

- fae30f6: force light mode
- ccc7a20: Use `<FloatingPanel>` for Treeview
- 2f357b2: Add automated import sorting

## 1.14.0

### Minor Changes

- 40bf132: Simplify `Transform` metadata, fix line color handling

### Patch Changes

- eff4330: Add draw points API
- a61c3e1: Add set camera API
- eb259e0: Add draw poses as arrows API
- a83ed6e: Add remove all, remove drawings, and remove transforms APIs
- 2c4a40c: Add draw robot and draw world state APIs
- 4a1c85f: Add draw nurbs API
- 8202bd4: Add draw geometry and draw geometries APIs
- 1a6df8f: Add replay API
- 8475f5d: Sort world tree nodes
- 41b4995: [APP-15201] Fix: entity disposing when connected to a machine
- 9f1e1bd: Add draw line API
- 3be3f7c: Update `createBufferGeometry` to handle RGBA and RGB
- 8bda28b: Add draw GLTF API

## 1.13.1

### Patch Changes

- f656483: Add colors and line width to nurbs
- 2b8da5f: Add DrawnFrames to draw API
- d171cf0: Add DrawnFrames type and use that in the draw frames API
- d888c1d: Standardize colorables in draw API
- a75ce2c: Add DrawableOption to public draw API
- d171cf0: Add draw frame system and draw frames APIs
- 6e34aa0: Add draw client API helpers
- ec39781: Fix: reduce over-eager state evaluation of frame updates
- c02782f: export name and render order props form PCD
- 6e34aa0: Add ChromaticColorChooser and AchromaticColorChooser to the draw API
- af2a313: Add server for new draw service and to host static assets in production mode
- 8796d64: Add DrawService

## 1.13.0

### Minor Changes

- 3ef8369: Feat: logs panel

### Patch Changes

- 31e25d8: Fix: Update selected bounding boxes so that they move as objects move
- aa7aad8: Remove disk persistence for visibility
- bb97ee2: Fix: use machine connection only for frame data unless editing frames

## 1.12.3

### Patch Changes

- 0fba953: fix machine config reactivity for e2e tests
- 373155b: Add connection status in dashboard
- 86d5aa2: Fix: Depth test sorting
- 6918e3c: [APP-15201] (1/2) Clean up usePartConfig
- 535c559: Add HDR environment map for more realistic arm rendering

## 1.12.2

### Patch Changes

- 3cddd9e: Create inline versions of workers to work outside of project boundaries
- 4dbb986: fix: force orthographic cam mode when enter lasso tool

## 1.12.1

### Patch Changes

- f9c41ec: Fix: Lasso object layout

## 1.12.0

### Minor Changes

- 247d5c3: Add `<LassoTool>` plugin

### Patch Changes

- 0fac3d8: Fix: Render lasso lines on top of other objects
- 71e14fa: Fix transparency flickering

## 1.11.1

### Patch Changes

- 3f609ff: Reposition joint limits widgets above camera feeds, centered, and remove tilt
- a5135ea: Fix: detached mesh reference when performing bvh cleanup
- 828c53f: Standardize draw APIs
- 8f79b03: Use `three-mesh-bvh` directly

## 1.11.0

### Minor Changes

- 076823c: add hybrid poses raycasting
- f071d0b: Add DrawService protos
- b9c0aa6: Add point cloud API to draw, add ability to downscale geometries (just point clouds for now)
- 20d5e57: Add new color helper functions
- 3222384: Add experimental VR controller support for arm teleoperation

### Patch Changes

- 75025f8: Update draw frame system API to be consistent with other draw APIs
- b9c0aa6: Update draw geometry API to be consistent with other draw APIs
- 305f09b: Update NewTransform to accept arbitrary IDs (used to generate UUIDs)
- b710cee: Update NewDrawing to accept arbitrary IDs (used to generate UUIDs)
- 24b3b62: Logs performance improvements
- 098fbe1: Move widgets section from left pane drawer to settings overlay
- a801570: fix sub-entity hover when entity in framesystem
- 0a39009: Truncate long camera names in widgets panel to prevent horizontal scrolling
- 82a5161: Improve Pointcloud Object performance

## 1.10.0

### Minor Changes

- 2e43ecd: Feature: settings panel
- 3022029: enable hoverlinking for pcds and poses

### Patch Changes

- 15fb951: Fix: preserve last pointcloud fetch when entering edit mode
- 7cf4e8b: Show millimeter level precision in measuring tool

## 1.9.1

### Patch Changes

- 03bb508: Fix: do not show axes on geos from useGeomtries resources
- 006bd88: Fix: use cloned instance of 3d model when displaying multiple arms of the same type
- fde7471: Fix: pointcloud memory leak with high refresh rates
- f946fbc: Fix: z-index sorting for overlay items

## 1.9.0

### Minor Changes

- 1f3de95: Feature: measurement tool axis snapping
- 2606cf8: bump koota version to 0.6.5

## 1.8.0

### Minor Changes

- 93da1b7: enable sub entity hover info for poses and pcds

## 1.7.0

### Minor Changes

- 7e842e0: Added the Camera widget, including a resolution selector and a styled FPS counter with freeze detection. Improved layout stability by locking the aspect ratio to the video source.

## 1.6.0

### Minor Changes

- 2086308: general availability for 3d model arms

## 1.5.0

### Minor Changes

- 8c31e73: enable pcds from world store services

### Patch Changes

- b8208f7: Fix `drawGLTF` to skip header bytes
- 19f1fee: Clicking the icon on the Drawer buttons now opens or closes the section, just like the rest of the button.
- b8208f7: Update E2E snapshots
- b8208f7: Fix world tree not be reactive to frame changes
- 3855183: Restore downscaling when drawing pointclouds with DrawGeometries

## 1.4.0

### Minor Changes

- 7d54e64: Fix drawing pointclouds with over 16 million points

### Patch Changes

- 5b83236: update localpose from frames when not editing

## 1.3.5

### Patch Changes

- 486557a: Use localhost instead of detecting device local ip
- 8393486: Focus view fixes
- 00c60ca: Add "remove from scene" button for non-polling objects
- e508a60: Add vite-plugin-glsl
- 38809b1: Do not render line outline on 3d model in model only mode

## 1.3.4

### Patch Changes

- 4bb4a20: Add click to zoom to object
- 7cac829: Fix vision service toggling, allow empty pointclouds from GetObjectPointclouds
- 835468e: Fix hiding arrows, add hotkey for hiding

## 1.3.3

### Patch Changes

- 19a26cf: enable poses color palleting
- 7d66c9d: add gripper as origin_frame using component for pose

## 1.3.2

### Patch Changes

- cfd73bf: Improve arrow performance / avoid max entity limits when rendering many arrows

## 1.3.1

### Patch Changes

- cfd02f1: Update snapshot drag-and-drop prefix
- fab1052: remove bun from pnpm install use brew

## 1.3.0

### Minor Changes

- 971ae0d: Add support for viewing pointcloud objects

### Patch Changes

- 1309814: Reduce arrow geometry resolution
- 1309814: Increase websocket max packet size to 1gb

## 1.2.3

### Patch Changes

- 4145bf2: Fix: memory leak in pointcloud rendering, reuse pointcloud attribute buffers

## 1.2.2

### Patch Changes

- 0eccaab: remove relative app.css ref and put global styles in app.css

## 1.2.1

### Patch Changes

- 115eaab: fix: improve tree node virtualization; fix effect loop in exported Snapshot component
- 2515d55: add peer deps

## 1.2.0

### Minor Changes

- d089816: Add Snapshot component

## 1.1.6

### Patch Changes

- ae47b1c: Fix: clear up entities when executing remove draw calls
- ae47b1c: Fix: correct reparenting when editing frames

## 1.1.5

### Patch Changes

- 5b23b66: Clean up machine picker UI
- 61e71d6: Fix: vite string replacement causing undefined values to be shipped to NPM package

## 1.1.4

### Patch Changes

- 8dd0334: Use getPose from Robot client instead of deprecated motion service method
- 8d2a621: Fix: ensure all dependencies are listed in package.json for embedded environments

## 1.1.3

### Patch Changes

- 44886c4: Fix: correct pointcloud parenting to camera

## 1.1.2

### Patch Changes

- 6297e12: fix parented motion service components rendering

## 1.1.1

### Patch Changes

- eaee2e6: Bump go dependencies

## 1.1.0

### Minor Changes

- 9c99afe: Include draw/v1 API

## 1.0.3

### Patch Changes

- 4a1d233: Fix: bvh unmount cleanup error
- c42053a: Fix: scroll to selected treeview item when 3d object clicked

## 1.0.2

### Patch Changes

- cd6ae37: Reduce points threshold for raycasting

## 1.0.1

### Patch Changes

- eb911ff: Replace `useDraggable` hook with library
- 5e6964d: Add RemoveAllSpatialObjects() test

## 1.0.0

### Major Changes

- 2205701: Use an ECS for state management

### Minor Changes

- a6be822: Add go draw API
- f584b66: use draw api for go client

### Patch Changes

- 58f32c5: Make the tree container resizable
- 785d2ee: Remove edit frame weblab
- 37ca6bb: Add draw API protos
- 633db17: Add snapshot API

## 0.19.2

### Patch Changes

- 44b0f31: Do not send a list of null geometries to draw if a pointcloud is drawn with DrawGeometries
- bdf21ce: Refactor useFrames to produce `WorldObject`s at the end of the pipeline

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
