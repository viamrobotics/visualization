---
paths:
  # Scoped to src/ so Playwright e2e suites (e2e/*.test.ts) stay out of scope.
  - 'src/**/*.test.ts'
  - 'src/**/*.spec.ts'
---

# Testing — 3D and WebGL

Domain guidance for tests that cover Three.js scenes and other WebGL code. See `testing.md`
for the runner-agnostic rules this guide assumes, and `three.md` if this repo installed it for
how the Three.js layer itself should be authored. This guide is about testing that code, not
writing it.

## Rule — follow without deliberation

- **Assert the scene graph, not pixels.** A unit test cannot see what rendered. What it can see
  is `Object3D` structure: which children got added to which parent, `position`, `rotation`,
  `scale`, and `matrix` after an update. Read those off the objects directly rather than
  rendering a frame and inspecting the output.
- **Mount, unmount, then assert `renderer.info.memory` returns to baseline.** This is the
  highest-value check available here. Three.js does not free GPU memory on garbage collection,
  so a component that forgets a `.dispose()` call leaks geometries or textures on every mount
  and unmount cycle, and nothing about a passing render test reveals it. Capture the counts
  before mounting, mount and unmount, then assert the counts came back to what they were.
- **Assert the specific counts, not that they changed.** `renderer.info.memory.geometries` and
  `renderer.info.memory.textures` are exact integers. Read the baseline into a variable and
  compare against it, per the base rule's guidance on asserting a literal you can name.
- **A test that needs a real render still needs a real WebGL context.** `renderer.info.memory`
  reads Three.js's own bookkeeping and works under any `WebGLRenderer` the test can construct,
  but constructing one at all requires a `canvas.getContext('webgl2')` that returns a working
  context. `jsdom` and `happy-dom` do not provide one, and a plain `node` environment has no
  `canvas` at all. Run mount/unmount memory tests, and anything else that instantiates a real
  renderer, under a runner that launches an actual browser, such as Playwright or Puppeteer in
  browser mode, not the same unit-test environment the rest of the suite runs in.
- **Scene-graph assertions do not have this problem.** `Object3D`, its children, and its
  transforms are plain Three.js objects with no renderer involved, so TH-027-style tests run
  fine in `node` or `jsdom` alongside the rest of a unit suite. Reach for a real browser only
  for the tests that actually need a renderer.
- **Context loss is a process-killing bug in disguise if you force it carelessly.** Simulating
  `webglcontextlost` through a driver or extension can crash the browser process the test is
  running in rather than failing the assertion, which is exactly the shape `testing.md` says
  not to depend on. Pin the observable result your context-loss handler produces, such as a
  flag or a resubmitted draw call count, and drive that path through the handler directly
  instead of forcing a real context loss where you can avoid it.

## Examples

**Bad — asserting that the mesh is "there" instead of where it resolved:**

```ts
it('adds the arrow to the scene', () => {
  const scene = new Scene();
  const arrow = buildArrow();

  scene.add(arrow);

  expect(scene.children.length).toBeGreaterThan(0);
});
```

**Good — the parent and the resolved transform, named:**

```ts
it('parents the arrow to the scene at the given origin', () => {
  const scene = new Scene();
  const arrow = buildArrow({ origin: new Vector3(1, 2, 3) });

  scene.add(arrow);

  expect(scene.children).toContain(arrow);
  expect(arrow.position.toArray()).toEqual([1, 2, 3]);
});
```

**Bad — no assertion that disposal happened, only that mount and unmount ran without throwing:**

```ts
it('unmounts cleanly', () => {
  const { unmount } = mountViewer();

  unmount();
});
```

**Good — baseline captured, then pinned after the full cycle:**

```ts
it('releases every geometry and texture on unmount', () => {
  const renderer = new WebGLRenderer({ canvas });
  const baselineGeometries = renderer.info.memory.geometries;
  const baselineTextures = renderer.info.memory.textures;

  const { unmount } = mountViewer(renderer);
  unmount();

  expect(renderer.info.memory.geometries).toBe(baselineGeometries);
  expect(renderer.info.memory.textures).toBe(baselineTextures);
});
```

`mountViewer` here loads a model, so between mount and unmount both counts rise. The assertion
after unmount is what catches a `dispose()` call that got dropped in a refactor: the counts stay
elevated instead of returning to baseline, and the test fails at the exact place the leak was
introduced.
