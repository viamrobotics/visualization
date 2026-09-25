# visualization

## 2.7.0

### Minor Changes

- c592002: Require three 0.181 or newer as a peer dependency
- 7dd5b19: Details panel splits into Details and Appearance tabs.

### Patch Changes

- c592002: Draw every batchable transparent surface through one BatchedMesh so primitives and parsed meshes sort against each other by depth

## 2.6.1

### Patch Changes

- 923367b: Toon and wireframe render modes draw colors without tone mapping.
- 3509c21: Opacity edits apply to every object type and survive a scene sync.
- 923367b: Realistic shading is now the render mode for every user, lit by an off-axis key light.

## 2.6.0

### Minor Changes

- 3118e9c: Add obstacles to the scene from a new plus menu in the World panel header.

### Patch Changes

- 6f6f115: Bump `@viamrobotics/test-widgets` to 0.15.0
- daf1bbf: Apply every `fragment_mods` entry sharing a fragment id, so a part that imports one fragment twice no longer loses the second import's overrides.
- daf1bbf: Allow editing a fragment component's frame unless a fragment variable actually supplies one of its fields, rather than whenever the fragment declares any variable.
- daf1bbf: Resolve fragment-provided frames the way the server does, so build mode draws them instead of filing their components under "Frameless components".
- daf1bbf: Write a frame edit on a fragment component as only the fields that changed, so a field the fragment binds to a variable keeps its binding.

## 2.5.1

### Patch Changes

- fd6d243: Adding a frame in build mode no longer reports the scene's poses as stale.
- 97bacc6: Hold indexed point clouds at full detail under the point budget. Draw range addresses the index when a geometry has one, and three-mesh-bvh reorders that index spatially for picking, so decimating it drew a contiguous chunk of the cloud instead of the uniform sample `shuffled` describes — whole regions of a scan vanished while the camera moved and returned when it settled. Only clouds that opt into selection picking are indexed, so this was invisible until a scene both exceeded the budget and enabled the selection tool.

## 2.5.0

### Minor Changes

- 9c2b451: Open the visualizer from viz.mode and viz.select query parameters, with a useDeepLinkParam hook for plugins to claim their own

## 2.4.0

### Minor Changes

- b1bbc99: Add a button to the logs panel header that clears all logs.

### Patch Changes

- 2bc71e8: Fix spurious pose and frame errors when switching machines quickly.
- 8837ea8: Load world state store transforms directly instead of through per-transform queries.
- 5586bc1: Redraw frames after a machine reconnects instead of leaving the scene empty until reload.
- 5586bc1: Retry arm kinematics and model fetches so a dropped request does not leave an arm undrawn.
- 0ce3365: Offer interpolated preview playback, filling in frames between planned waypoints
- b1bbc99: Switching parts clears the logs panel instead of keeping the previous machine's lines.

## 2.3.1

### Patch Changes

- 8f64dc4: Fetch each arm's 3D models from its own component, so an arm appearing or disappearing no longer rebuilds every other arm's model query.
- 8f64dc4: Render each vision service's pointcloud objects from its own component, so one service that is slow, unhealthy, or being rebuilt no longer blocks every other service's objects from rendering.
- 8f64dc4: Render each camera's pointcloud from its own component, so one camera that is slow, unhealthy, or being rebuilt no longer blocks every other camera's pointcloud from rendering.
- 59c8592: Source the pointcloud, pointcloud object, and arm model resource lists from machine status, so a resource going unhealthy no longer drops out of the list and remounts everything derived from it.
- 59c8592: Source every resource list from machine status, so a resource going unhealthy no longer drops out of the list and remounts everything derived from it.

## 2.3.0

### Minor Changes

- e50042d: Add world tree filter
- 5e80ef4: Update camera smoothing to match common cad apps
- 9aff0ee: Replace the Focus plugin with Isolate, add an F focus hotkey, and move dolly to Q and E
- 3f36a76: Mark world tree rows and folders that are logging warnings or errors

### Patch Changes

- cd6489e: Add a Preview move action that asks the motion service to plan without executing
- 3f36a76: Report pose errors that were dropped at live refresh rates and during frame moves
- 7f7ac1f: Fix frame axes helpers leaving a dot behind after they are hidden or removed
- 3f36a76: Stop requesting frames and poses before the machine connects
- 2c1c148: Fix an arrows entity becoming unremovable when its colors buffer is longer than its pose buffer
- e92cc15: Draw a previewed plan as ghost frames the collision panel reports on
- 2f56955: Reject a malformed joint axis instead of drawing a meaningless rotation
- ca38d7e: Scrub a previewed plan and execute it without planning again
- 2450fb7: Keep the scene drawn when a machine disconnects instead of wiping it. World state entities, arm 3D models, pointclouds, and pointcloud objects now survive a drop and a redial, and a point cloud interrupted mid-stream resumes its remaining chunks on reconnect rather than staying half-written. Requires @viamrobotics/svelte-sdk 1.3.0, which keys queries on the addressed part and resource so a torn-down client no longer empties their data.

## 2.2.0

### Minor Changes

- 7ff2d47: Add wireframe and realistic shading modes to the scene settings panel

### Patch Changes

- 9b9175f: Adding a frame to a frameless component now creates a frame with no geometry

## 2.1.0

### Minor Changes

- cdb140a: Add folder actions

### Patch Changes

- f50b758: Render cylinder geometries as an instanced primitive, alongside boxes, capsules and spheres

## 2.0.0

### Major Changes

- bccc909: Remove the deprecated `client/client` v1 API and its WebSocket transport, rename `traits.DrawServiceAPI` to `traits.DrawAPI`, replace the `<DrawService />` `websocketPort` prop with a `port` that actually selects the draw server, drop the bundled LLM scene builder backend in favor of the prompt and schemas now exported from `@viamrobotics/visualization/scene-builder`, and retire the Bun dev server now that the Go draw server serves static files
- 3d89eb8: Move build mode into the opt-in `BuildFrames` plugin, which now also owns the transform-mode and custom-geometry hotkeys, and hide the mode toggle when monitor is the only reachable mode
- 5a38260: Add `useDetailsSection` so plugins contribute per-entity content to the details cards, and remove the `DetailsPortal` export along with the unused details portal targets, which never had a working landing zone
- 3fd52f8: Move the file drop target into the opt-in `FileDrop` plugin, and export `OverlayPortal` for plugin chrome that no toolbar or panel portal fits
- 9ab2c22: Keep build mode live instead of freezing a machine snapshot while editing
- 4420a06: Move the frame POV panels into the opt-in `FramePov` plugin
- 365fa3c: Move monitor mode into the opt-in `Monitor` plugin: every mode is now plugin-contributed with mount order as priority, the mode is `none` when no mode plugins are mounted, and each mode plugin owns its own details cards
- d7a92cb: Rename the package from `@viamrobotics/motion-tools` to `@viamrobotics/visualization` and the Go module from `github.com/viam-labs/motion-tools` to `github.com/viamrobotics/visualization`
- f6d7f66: Move the settings popover into the opt-in `Settings` plugin, and make `@zag-js/tabs` an optional peer dependency
- adeb956: Move the world tree panel into the opt-in `WorldTree` plugin, and make `@zag-js/tree-view` and `svelte-virtuallists` optional peer dependencies

### Minor Changes

- 48a6a01: Add frameless components to the world tree
- b58b4fd: Share trajectory playback between the plan replayer and the move panel

  `MotionPlanReplayerContext.setStep` now pauses playback when called, rather than only applying the step, since a caller scrubbing by hand almost always means "take over from here."

- ce0f501: Publish immersive session state as `useEnvironment().current.isImmersive` so only the XR plugin needs `@threlte/xr`, and make the plugin-only peers `@threlte/xr`, `@threlte/rapier`, and `@dimforge/rapier3d-compat` optional

### Patch Changes

- 85d16c8: Reconstruct RDK's flattened frame system from a robot's frame system config, placing a part's configured geometry on its origin frame even when the part also carries a kinematic model
- 6928474: Create points BVH in a web worker
- 9454975: Render cylinders by lowering to mesh; bump rdk to open-cylinder release
- 0cc741a: Fix incorrect raycasting with individual points and turn on hover details by default
- 0d248c2: Replace the three-perf render stats overlay with a more expressive custom pane
- 583feac: Include self in ghost frames
- 8ea9eab: Don't reset queries on disconnect

## 1.45.1

### Patch Changes

- e08b88f: Show details panel for non-movable objects in move mode

## 1.45.0

### Minor Changes

- 7801e62: Add `useHotkey` so features and plugins contribute keyboard shortcuts declaratively
- 7cfcc26: Add `useEnvironmentMode` so a persisted mode resolves back to monitor when the plugin contributing it is not mounted

### Patch Changes

- f8e10a0: Keep a plan's snapshots with the plan when another one is removed
- cee7c2b: Cut pointcloud draw range when moving camera to avoid frame stutters
- 7729bee: Fix `Visualizer` imports pulling `@viamrobotics/test-widgets` through the plugins barrel
- 59813bb: Read mesh data delivered as a number array, the shape a component's kinematics arrives in over protobuf-JSON, alongside the base64 shape plan dumps use

## 1.44.0

### Minor Changes

- f5bc780: Add folders to treeview

### Patch Changes

- 88dd8c4: Drive plan joints by RDK's schema order, not their declaration order
- 0780313: Infer an untyped geometry's shape from whichever dimensions it sets, the way RDK's `ParseConfig` dispatches on them

## 1.43.1

### Patch Changes

- c61ce9b: Keep the Viam tweakpane theme applied when a second visualizer mounts, instead of falling back to Tweakpane's dark defaults
- f7cd229: Do not show stale pose indicator if not connected to a robot
- 7f76463: Show last pointcloud objects snapshot in build mode

## 1.43.0

### Minor Changes

- 1df9610: Derive frames and geometries from frame system kinematics instead of polling `getGeometries`
- f4cad4d: Render STL collision meshes alongside PLY, and rotate unoriented link geometry into its own frame

### Patch Changes

- d6e1289: Migrate workspace panels to popovers
- 55b7a17: Move the shared plan kinematics into `$lib/motion`
- c6fe538: Read a plan model's output frame from where RDK writes it
- 2880ef6: Memory leak fix with ply files
- 9be560c: Drive mimic joints from the joint they mimic when replaying a plan, and keep the joints declared after one on their own columns

## 1.42.0

### Minor Changes

- d6cefbc: Warn in the world tree header when live poses stop updating
- 1d175f0: Improve toggle mode UX

### Patch Changes

- 4011ee5: Enable horizontal scrolling in treeview
- d6cefbc: Replace prime tooltips with a portalled zag-js tooltip that respects host app stacking
- f522222: Read every orientation and geometry encoding RDK accepts in a machine config
- 50aedd2: Fix stale pose warning appearing late, not at all, or after poses recover
- b8d6222: Give dropdown panels a bordered surface and an arrow pointing at their trigger
- 938719c: Stability fixes
- aed21ae: Share spatialmath JSON decoding between the frame system and motion plan readers

## 1.41.1

### Patch Changes

- b22115a: Better error states in build mode
- 8549b91: POV widget improvements
- 5faf86d: Ensure build mode takes most recent pose snapshot when starting up
- 4a46eb1: Build mode fixes

## 1.41.0

### Minor Changes

- 8d92e23: Add dedicated move mode
- 2756206: Add batch and partial-update draw APIs: `AddEntities`, `UpdateTransform`, and `UpdateEntity`
- 2756206: Stop dropping draw service entity changes under load
- 00ee712: Add collision warnings to the `MoveFrame` plugin

### Patch Changes

- 86dcace: Support prismatic joint FK
- 83796b8: Improved selection state for no-geometry frames
- 96879b4: Render world state obstacles
- 96879b4: Local Motion Plan Replayer quick hits
- e1c977d: Support axis-angles and warn on skipped frames/orients
- 6207580: Improved parent options during frame editing reparenting

## 1.40.0

### Minor Changes

- f6b9142: Move frame plugin UX improvements

### Patch Changes

- 1c61c5c: Add tests for the new `Pose` class
- d2c58fe: Use Three.js-like api for pose math

## 1.39.0

### Minor Changes

- 51ea2d8: Add frame edit undo / redo

### Patch Changes

- 79c4bfc: make upload motion plan callback usable via server RDK path
- ff3e614: Restrict motion plan replayer to monitor mode

## 1.38.0

### Minor Changes

- d34e066: Add control widgets for all resource types through a new ControlWidgets plugin, including a Move control for the built-in motion service
- 9f08bcf: Add `MoveFrame` plugin to easily move entities with a motion service
- c33ca6b: Select in-headset AR cameras from the XR settings panel instead of the control widgets plugin

### Patch Changes

- 8afe4a4: Add do command widgets to ControlWidgets plugin

## 1.37.1

### Patch Changes

- 8627748: Fix updating arrows
- b476aaa: Fix motion plan replayer provider surface for app
- 7dce2eb: Remove skeletonlabs dependency and uses badges for logs chips

## 1.37.0

### Minor Changes

- f563895: Toggle independent arm position widgets with per-arm switches
- 04f4e2e: Motion plan replayer + docs
- 2c86fdd: Dedicated edit mode

### Patch Changes

- 339cb67: Refactor frame editing for plugin extraction
- 76b5ae0: Migrate camera and arm position widgets to use FloatingPanel
- f563895: Add individual switches for arm widgets, similar to cameras
- fec460a: Fix tweakpane styling race condition
- 27b41ec: Add the motion plan JSON parser (`parsePlan`) for the Motion Plan Replayer: validates and normalizes plan JSON into a `ParsedPlan` (frames, parents, trajectory, goals).
- 2da1274: Add frame-descriptor derivation for the Motion Plan Replayer: converts a `ParsedPlan` into static and jointed `FrameDescriptor`s (geometry, orientation conversion, joint-index mapping, end-effector reparenting).
- 0f42c63: Add per-step snapshot generation (`parsedPlanToSnapshots`) and the `PartOfPlan` ECS relation for the Motion Plan Replayer, turning frame descriptors into renderable snapshots grouped under a plan entity.
- 7292c08: Add the Motion Plan Replayer plugin shell: a dashboard-mounted floating panel that uploads plan JSON files, parses them into snapshots, and lists them with ready/error/no-trajectory status. Exposes an `extraSource` snippet receiving `addPlan` so an embedding app can inject its own plan source (e.g. a DB picker) without escaping the plugin's context.
- ddfa766: Render Motion Plan Replayer plans in 3D and add the timeline scrubber. Selecting a plan spawns its snapshot entities under a plan entity, and a bottom scrubber (play/pause, step, seek) resolves each slider position to the corresponding snapshot via `reconcileSnapshotEntities`. Plan entities are tinted and torn down as a group through the `PartOfPlan` relation.
- a388301: Add persistent per-frame display config to the Motion Plan Replayer. Per-frame color, opacity, visibility, and axes edits made via the scene Details panel and tree now persist across scrubbing instead of being reset each step. Also fixes the Details panel "show axes helper" toggle, which previously had no effect because the batched axes renderer never reacted to the trait being added or removed at runtime.
- 3f4bd3b: Render mesh geometry in the Motion Plan Replayer.

## 1.36.2

### Patch Changes

- 191c8ec: Snapping and local transform improvements
- 6b481e4: Fix transform controls & fragment editing

## 1.36.1

### Patch Changes

- b55128d: `Pose.svelte` and `Entities.svelte` refactor
- c1529d2: Fix parent field in details occasionally rendering blank
- 21ea83d: Fix sorting for instanced rendering

## 1.36.0

### Minor Changes

- 0620ce8: Add Fullscreen plugin that expands the visualizer to cover the viewport

## 1.35.1

### Patch Changes

- 95cbf22: Start deprecation of legacy go client.
- 1cf2975: Tighten geom typing (for LLM scene builder)

## 1.35.0

### Minor Changes

- ed62728: Port Snapshot to V2 API signature

### Patch Changes

- dab5ca3: Fix pointcloud object positions
- 0a844cd: Fix plugin declaration types
- 644753d: Allow mesh vertex colors
- ec08d01: Improve plugins infrastructure
- 56bf4bc: Debounce tree updates
- 951fc2a: UI/UX LLM scene builder improvements
- 5294217: Batch sphere rendering into instanced draw calls

## 1.34.10

### Patch Changes

- 7c7b3c4: add geometry editing for llm scene builder

## 1.34.9

### Patch Changes

- b49538a: Add color control to details panel
- 2fc9bbe: Batch capsule rendering into instanced draw calls

## 1.34.8

### Patch Changes

- 9923932: Show triangle count for BufferGeometries
- db5d3a3: Batch all AxesHelpers into a single draw call

## 1.34.7

### Patch Changes

- 57da47d: fix: make fragment frame parse optional for standalone
- ee5edd6: Upgrade to Vite 8 and Vitest 4
- 800ba17: Security patches

## 1.34.6

### Patch Changes

- a61b755: fix: allow llm scene builder to resolve fragments
- 700db52: Instanced rendering of all boxes

## 1.34.5

### Patch Changes

- 07a0bf4: Add better touchscreen support for the select plugin

## 1.34.4

### Patch Changes

- 7dcb43b: Extract logs into a plugin

## 1.34.3

### Patch Changes

- 7ab8838: Quick frame builder UX hits
- affbcd5: Reorg frame builder deps

## 1.34.2

### Patch Changes

- 6f1c52e: useFrames condition to show LLM frame edit preview

## 1.34.1

### Patch Changes

- 664674b: Remove AISettings panel from settings tabs and delete AISettings.svelte component
- 797a8a7: Fix baseline matrix and EditedMatrix update conditions in useFrames

## 1.34.0

### Minor Changes

- 64db2c5: added llm scene builder

## 1.33.2

### Patch Changes

- 054deaf: Fix world state store service race conditions

## 1.33.1

### Patch Changes

- ac05fed: Default `Line` and `Mesh` opacity to `1`, fix `LineDots` instance ID tracking, enable BVH raycasting in `'gizmo'` interaction mode, fix stale matrix reads in `SelectedTransformControls`, and add `isOpen` / `close` to `Popover` snippets plus a `shapes` icon and `disableTooltip` prop on dashboard `Button`
- dc668f7: Feat: force directed graph labels
- a0cd017: Split the Details overlay into focused subcomponents under `details/` and expose a `details-extensions` portal target for plugin-supplied editors
- 0b7b924: Fix unbounded memory growth from the world state transform stream

## 1.33.0

### Minor Changes

- 617679e: Migrate WebXR features to a plugin

## 1.32.0

### Minor Changes

- bca0cd6: Add multiselect / multifocus

### Patch Changes

- 652e924: Add `writeMatrix` and `CustomDetails` ECS traits, and a `'gizmo'` interaction mode
- 4f1840b: Add plugin docs and make plugin dependencies optional
- 78579a2: Make <MeasureTool> a plugin
- cab2479: Stop keyboard events from propagating out of the Details panel so they don't rotate the 3D scene

## 1.31.0

### Minor Changes

- af2df29: create snapshot --> drawn pcd helper
- 33579d3: feat: have select plugin emit multiple entities per selection (one per source entity)

## 1.30.0

### Minor Changes

- a62cf24: feat: disallow edit components where fragment has variables; update props for Visualizer component
- 9e60e37: Move query dev tools to `<Debug />` plugin

### Patch Changes

- 03544e9: fix: bug resolving frame updates for non fragment frames
- c81c67c: fix: hide transform controls on invisible entities
- 1821030: Redesign dashboard button: inactive state now uses white background with visible icons, active state uses sky-blue background with white icons
- b0a929b: Remove `dpr` attribute from `<Canvas />`

## 1.29.1

### Patch Changes

- 66089d4: Fix invisibility cascading downwards in the pose graph

## 1.29.0

### Minor Changes

- 1042f65: Move Draw Service to `/plugins`

### Patch Changes

- 3be2ce1: Use prime tweakpane theme
- 0761452: Fix transforming with gizmo
- 86243ac: Dark mode fix

## 1.28.1

### Patch Changes

- 97d0242: Use GroundedSkybox for Skybox plugin

## 1.28.0

### Minor Changes

- a95a836: Add SkyBox plugin
- 6c64bde: Add frame POV panel

### Patch Changes

- bf80dcb: Dashboard cleanup
- 4d6af12: Fix circular relationships when frames and geometries have the same name

## 1.27.1

### Patch Changes

- a522e15: Fix parenting on `GetGeometries` entities

## 1.27.0

### Minor Changes

- 2fe4e97: Use MatrixWorld trait to transform all entities

### Patch Changes

- d7b764b: Fetch geometries from generic components
- 2fe4e97: Run BVH generation on demand

## 1.26.2

### Patch Changes

- 8f23f42: Fix: add fragment-defined component names to the parent options in the details panel
- 3f97069: Clamp geometry dimensions to 0 when editing
- cc409c0: fix: set 3d models current in outer loop
- 7e983d0: Use local and world Matrix traits as object transform source-of-truth
- dd4fd29: Update Treeview to use entity relations
- 8f23f42: Fix: Hold the staged frame pose in embedded mode while the framesystem reconfigures

## 1.26.1

### Patch Changes

- 424b6f5: Clamp `renderer.devicePixelRatio` between 1 and 2

## 1.26.0

### Minor Changes

- cd5388e: Add an `autoSelectNewEntities` prop to `SelectionTool`. When enabled, each new entity added to the selection set (via lasso or ellipse) is set as the active `selectedEntity`, causing the Details panel to focus the latest selection. Defaults to `false` so existing consumers see no behavior change.

### Patch Changes

- 32a4ce4: Bump `@threlte/extras` to fix ghosting issue

## 1.25.6

### Patch Changes

- dc5c94f: Fix: clicking on frames in the Treeview causes reparenting due to Tweakpane behavior

## 1.25.5

### Patch Changes

- 142223f: Reduce logs memory and CPU consumption

## 1.25.4

### Patch Changes

- f8533f4: hotfix: check positions on line dot cleanup

## 1.25.3

### Patch Changes

- 8a420db: hotfix: Bail out line dot effect when positions is undefined

## 1.25.2

### Patch Changes

- 1e0d80c: Update snapshots with the same UUID, rerender snapshots with different UUIDs, add `SetUUID` to `Snapshot`

## 1.25.1

### Patch Changes

- fb8b7ca: Use Koota relations for parent / child interactions
- e4ca46e: Allow updating Snapshot entities
- 8c60f88: Screenshot only canvas for UI-unrelated e2e tests

## 1.25.0

### Minor Changes

- 7a31f2e: Add reconnection backoff and a manual reconnection button

### Patch Changes

- a3ead32: Improve `Mesh.svelte` performance by geometry pooling

## 1.24.0

### Minor Changes

- 20644de: add pcd color prop
- 76d38d0: Wire up the `ID` field on `DrawGeometriesInFrame`, `DrawFrames`, `DrawFrameSystem`, and `DrawWorldState`.

### Patch Changes

- 116682a: Security patches
- 76d38d0: Fix `NewColorChooser` pre-allocating zero-valued entries before appending named colors, which produced a doubled-length slice with transparent-black entries at the front.

## 1.23.2

### Patch Changes

- 645d74b: Fix unreadable text in the Details panel under dark mode by swapping
  `dark:text-black` for `dark:text-white` on the panel container so child
  text contrasts against dark surroundings rather than disappearing.

## 1.23.1

### Patch Changes

- 7e52e42: Capture save keyboard event before hitting input bindings

## 1.23.0

### Minor Changes

- 29903ad: Enable draw service API by default, add migration doc

### Patch Changes

- 29903ad: Fix frames not rendering for offline parts when the embedder skips dialing. The merge fallback now triggers whenever the connection is not actively `CONNECTED`, instead of only when explicitly `DISCONNECTED`, so config-derived frames render even when `connectionStatus` is `undefined` or `CONNECTING`.
- 29903ad: useInputMap for navigation controls
- 29903ad: Add opacity slider to `Details` panel

## 1.22.0

### Minor Changes

- 8ead73e: Add transform controls.

### Patch Changes

- b54ac3b: Fix file drop being triggered by dragging numbers

## 1.21.0

### Minor Changes

- 40cbf95: wire up RenderOrder and Material traits, add depthWrite support

### Patch Changes

- 40cbf95: Use koota relations for model sub-entities
- 40cbf95: Prevent selection, focus, and hover interactions on invisible entities

## 1.20.0

### Minor Changes

- 79e18f2: Add API to chunk large point clouds
- f5e0fef: Use tweakpane for frame-editing inputs

## 1.19.1

### Patch Changes

- bbe99fe: Fix world state point cloud rendering and updating

## 1.19.0

### Minor Changes

- 0ed1c07: Add chunking metadata and support in world state hook

### Patch Changes

- efbbaa8: Support bases in GetGeometries calls
- c2ca03d: Add frame lifecycle for pending saves
- 7c7d6e9: Fix unbounded logs
- deaf54d: Consolidate `Parent` trait handling.
- 7c7d6e9: Fix pcd memory leak
- 7c7d6e9: Fix inverted visibility on arrow head mesh

## 1.18.1

### Patch Changes

- 1f6e1fe: fix: use screen sapce for ellipse select

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
