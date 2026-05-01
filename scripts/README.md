# scripts/

Build and code generation scripts that run as part of the development workflow or publish pipeline.

---

## `post-process-workers.js`

**Run automatically as part of `pnpm run prepack`** (`svelte-package && node scripts/post-process-workers.js && publint`).

### What it does

After `svelte-package` copies `src/lib` into `dist/`, this script rewrites web worker references so the published package works correctly in consumer projects.

It scans `dist/` for files containing `new Worker(new URL(..., import.meta.url))`, bundles each referenced worker file into a self-contained IIFE using esbuild (inlining all dependencies like Three.js PCDLoader), replaces the `new Worker(new URL(...))` call with a Blob URL equivalent, and deletes the now-unnecessary worker `.js` files from `dist/`.

### Why we need it

This is a workaround for a [known open Vite bug](https://github.com/vitejs/vite/issues/21422). When a library uses `new Worker(new URL('./worker.js', import.meta.url))`, a consumer project's Vite dep optimizer moves the library to `.vite/deps/` but the worker file doesn't follow -- causing a runtime error.

`svelte-package` copies `.ts` files as-is (transpiled to JS), so there is no point in the library packaging pipeline where Vite's bundler runs and can resolve worker imports. The fix is to post-process `dist/` and inline the worker code so that consumers load it from a Blob URL with no file path dependency.

In dev mode within this project, Vite handles `new Worker(new URL(...))` natively with full HMR support -- no post-processing is needed.

---

## `model-pipeline.js`

**Run manually via `pnpm run model-pipeline:run`** when new 3D models need to be added to the project.

### What it does

Converts `.glb` and `.gltf` 3D model files into typed Threlte/Svelte components using [`@threlte/gltf`](https://threlte.xyz/docs/reference/gltf/getting-started).

Place model files in `static/models/`, then run the script. It:

1. Finds all `.glb`/`.gltf` files in `static/models/` (skipping already-transformed files)
2. Runs `@threlte/gltf` on each file to generate a typed Svelte component
3. Moves the generated `.svelte` files to `src/lib/components/models/`
4. Cleans up the intermediate files from `static/models/`

Configuration at the top of the file controls output options (TypeScript types, Draco compression, mesh simplification, etc.). By default `overwrite: false` -- existing components are not replaced.

### Why we need it

Hand-writing Three.js scene graphs for complex GLTF models is tedious and error-prone. `@threlte/gltf` generates Svelte components that exactly mirror the scene hierarchy of a model, including typed props for materials and geometry. This script automates the full pipeline from raw model file to usable Svelte component.
