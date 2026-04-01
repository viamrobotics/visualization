# Embedding Guide

Motion Tools is published as an npm package that you can embed in your own Svelte application. The package provides the core visualizer component, a snapshot renderer, and plugins for point cloud selection and display.

## Installation

```bash
pnpm add @viamrobotics/motion-tools
```

## `<MotionTools>`

The top-level wrapper component that provides the 3D scene, ECS world, settings, and all UI overlays (world tree, dashboard, details panel, etc.).

```svelte
<script>
	import { MotionTools } from '@viamrobotics/motion-tools'
</script>

<MotionTools />
```

### Props

| Prop                   | Type                   | Default | Description                                           |
| ---------------------- | ---------------------- | ------- | ----------------------------------------------------- |
| `partID`               | `string`               | `''`    | Identifier for the robot part to connect to           |
| `enableKeybindings`    | `boolean`              | `true`  | Enable keyboard shortcuts (WASD, camera toggle, etc.) |
| `cameraPose`           | `CameraPose`           | --      | Initial camera position and look-at target            |
| `drawConnectionConfig` | `DrawConnectionConfig` | --      | Backend connection for the live draw server           |
| `children`             | `Snippet`              | --      | Content rendered inside the 3D scene                  |
| `dashboard`            | `Snippet`              | --      | Custom toolbar content                                |
| `details`              | `Snippet<[{ entity: Entity }]>` | --  | Custom content injected into the entity details panel |

#### `CameraPose`

```typescript
interface CameraPose {
	position: [number, number, number]
	lookAt: [number, number, number]
}
```

#### `DrawConnectionConfig`

```typescript
interface DrawConnectionConfig {
	backendIP: string
	websocketPort: string
}
```

### Snippets

Use Svelte 5 snippets to inject content into the scene, toolbar, or details panel:

```svelte
<MotionTools>
	{#snippet children()}
		<!-- Content rendered in the 3D scene -->
	{/snippet}

	{#snippet dashboard()}
		<!-- Custom buttons added to the toolbar -->
	{/snippet}

	{#snippet details({ entity })}
		<!-- Custom content appended to the entity details panel -->
	{/snippet}
</MotionTools>
```

## `<Snapshot>`

Renders a protobuf `Snapshot` by spawning its transforms and drawings as entities in the scene. Must be a child of `<MotionTools>`.

```svelte
<script>
	import { MotionTools } from '@viamrobotics/motion-tools'
	import { Snapshot, SnapshotProto } from '@viamrobotics/motion-tools/lib'
</script>

<MotionTools>
	<Snapshot snapshot={mySnapshot} />
</MotionTools>
```

### Props

| Prop       | Type            | Description                                |
| ---------- | --------------- | ------------------------------------------ |
| `snapshot` | `SnapshotProto` | The protobuf Snapshot to render (required) |

The `SnapshotProto` class is re-exported from `@viamrobotics/motion-tools/lib` for convenience. You can use it to deserialize snapshot data:

```typescript
import { SnapshotProto } from '@viamrobotics/motion-tools/lib'

const snapshot = SnapshotProto.fromBinary(binaryData)
```

### Behavior

- Spawns all transforms and drawings from the snapshot as ECS entities
- Applies scene metadata (grid settings, labels, render options) if present
- Sets the camera position and look-at from `sceneCamera` metadata if present
- Automatically cleans up spawned entities when the component unmounts or the snapshot changes

## Plugins

Motion Tools uses a component composition pattern for plugins. Plugins are Svelte components that you render as children of `<MotionTools>` to add functionality. Interaction modes are coordinated through a shared settings context -- when one tool activates, others deactivate.

### `<SelectionTool>`

A point cloud selection plugin that lets users select points using a freeform lasso polygon or an ellipse.

```svelte
<script>
	import { MotionTools, SelectionTool } from '@viamrobotics/motion-tools'

	function handleSelection(pcd: Blob) {
		// pcd is a binary PCD blob of the selected points
	}
</script>

<MotionTools>
	<SelectionTool onSelection={handleSelection} />
</MotionTools>
```

#### Props

| Prop          | Type                  | Default | Description                                                   |
| ------------- | --------------------- | ------- | ------------------------------------------------------------- |
| `enabled`     | `boolean`             | `false` | Auto-enable selection mode on mount                           |
| `onSelection` | `(pcd: Blob) => void` | --      | Callback with selected points as a binary PCD blob (required) |

#### User Workflow

1. Click the selection button in the toolbar to activate selection mode (automatically switches to orthographic camera)
2. Use the settings popover next to the selection button to choose between **Lasso** (freeform polygon) and **Ellipse** selection types
3. Hold **Shift** and click-drag to draw the selection region
4. On release, points inside the region are highlighted
5. Click **Commit selection** in the floating panel to trigger the `onSelection` callback with the selected points as a PCD blob

### `<PCD>`

Renders point cloud data as an entity in the scene.

```svelte
<script>
	import { MotionTools, PCD } from '@viamrobotics/motion-tools'
</script>

<MotionTools>
	<PCD
		data={myPcdData}
		name="my-pointcloud"
	/>
</MotionTools>
```

#### Props

| Prop          | Type         | Default           | Description                       |
| ------------- | ------------ | ----------------- | --------------------------------- |
| `data`        | `Uint8Array` | --                | Binary PCD data (required)        |
| `name`        | `string`     | `'Random points'` | Display name in the world tree    |
| `renderOrder` | `number`     | --                | Rendering order for draw priority |
| `oncreate`    | `(positions: Float32Array, colors: Uint8Array \| null) => void` | -- | Callback fired after PCD is parsed and the entity is spawned |

## Package Exports

The npm package provides two entry points:

### `@viamrobotics/motion-tools`

The main entry point for the visualizer and plugins.

```typescript
import { MotionTools, SelectionTool, PCD } from '@viamrobotics/motion-tools'
import { relations, traits, provideWorld, useWorld, useQuery, useTrait } from '@viamrobotics/motion-tools'
```

| Export          | Description                                            |
| --------------- | ------------------------------------------------------ |
| `MotionTools`   | Main visualizer component                              |
| `SelectionTool` | Point cloud selection plugin (lasso + ellipse)         |
| `PCD`           | Point cloud renderer component                         |
| `relations`     | ECS relation definitions (e.g. `ChildOf`)              |
| `traits`        | ECS trait definitions for all entity properties         |
| `provideWorld`  | Create and provide an ECS world via Svelte context      |
| `useWorld`      | Access the ECS world from Svelte context                |
| `useQuery`      | Reactive hook to query entities by traits               |
| `useTrait`      | Reactive hook to read a trait value from an entity      |

### `@viamrobotics/motion-tools/lib`

Utility components, classes, and the Snapshot proto type.

```typescript
import {
	Snapshot,
	SnapshotProto,
	AxesHelper,
	parsePcdInWorker,
} from '@viamrobotics/motion-tools/lib'
```

| Export              | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `Snapshot`          | Snapshot renderer component (requires `<MotionTools>` parent)      |
| `SnapshotProto`     | Protobuf `Snapshot` class for creating/deserializing snapshots     |
| `AxesHelper`        | Pure component for rendering coordinate axes (no context required) |
| `BatchedArrow`      | Three.js batched arrow mesh class                                  |
| `CapsuleGeometry`   | Three.js capsule geometry class                                    |
| `OrientationVector` | Three.js orientation vector class                                  |
| `parsePcdInWorker`  | Worker-based PCD file parser                                       |
