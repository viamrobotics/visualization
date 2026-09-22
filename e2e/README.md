# End-to-End Testing Guide

This guide explains how to run and manage the Playwright end-to-end tests for the Viam Visualization application.

## Projects

The suite is split into Playwright projects so that a run only pays for what it needs.

| Project          | Specs                                                      | Needs a Viam machine |
| ---------------- | ---------------------------------------------------------- | -------------------- |
| `drawing`        | `deep-link`, `draw-client`, `file-drop`, `snapshot`        | no                   |
| `matrix`         | everything under `e2e/matrix/`                             | no                   |
| `robot`          | `arm`, `edit-frame`, `obstacle-store`, `world-state-store` | yes                  |
| `robot-setup`    | `robot.setup.ts`                                           | provisions it        |
| `robot-teardown` | `robot.teardown.ts`                                        | deletes it           |

`robot` declares `robot-setup` as a dependency, so selecting it provisions an ephemeral
machine first and deletes it afterwards. The `drawing` project has no such dependency, which
is why it starts in seconds.

`drawing` runs `fullyParallel`. Each worker owns a draw server on port `4100 + parallelIndex`
with its own chunk buffer directory, and the page it drives carries a `?drawPort=` query so
the app subscribes to that worker's server rather than a shared one. Scene invocations get the
same port through `-port`. Nothing is shared, so the specs cannot see each other's entities.
`robot` stays serial: its four specs push conflicting configs at one machine.

## Putting entities on screen

Specs that need a scene rendered call the `drawScene` fixture, which runs `.bin/draw-scenes`,
a Go binary that calls `client/api` the way a user would. That is the realism argument for
having it: the e2e drives the public API through a script, not through a test harness.

```bash
# every scene name
.bin/draw-scenes -list

# draw one against a running visualizer
.bin/draw-scenes -port 3030 hierarchy/draw
```

It replaced `go test -run` invocations, which cost about 1.9s each in package loading and
linking against about 10ms to exec the binary. Two of the old `-run` patterns also matched more
subtests than they named, because Go matches each element of the pattern unanchored, so a
scene drew more than the spec asserted.

The binary refuses to run when nothing is listening on `-port`. `server.Start` would otherwise
stand up its own server inside the process, draw into it, and lose the scene on exit.

`matrix` shares the drawing project's per-worker draw server but opens **one page per
worker** instead of one per test, because a cell is two RPCs and a poll. A fresh page per cell
would spend the suite loading the app. Cells stay isolated by clearing the scene in
`beforeEach` and asserting on an entity each cell names itself.

## The entity matrix

`e2e/matrix/` crosses every entity type with every behavior it supports, twice: once applied at
spawn, once applied through an update. The table of types and cases is shared with the unit
spec at `src/lib/__tests__/__fixtures__/entityMatrix.ts`, so the two suites cannot drift on
what they cover.

The two suites answer different questions. `draw-parity.spec.ts` runs in Vitest and proves the
spawn and update code paths in `draw.ts` agree with each other. It cannot prove either one is
right, because it hands protos straight to `draw.ts`. The e2e cells assert the absolute end
state after a real round trip through the Go service and `StreamEntityChanges`, so a field the
service drops still fails here even though both paths agree.

| File                        | What it covers                                              |
| --------------------------- | ----------------------------------------------------------- |
| `entity-matrix.test.ts`     | one cell per type and trait, at spawn and on update         |
| `entity-appearance.test.ts` | every type reaches the canvas, plus the `AddEntities` batch |
| `field-mask.test.ts`        | partial updates, and the two masks the service rejects      |

Cells assert ECS trait state read out of the page, which is where the wire ends. Where a
renderer mounts an `Object3D` the cell also asserts its effective visibility and world
position. For the instanced types, which have no per-entity object, a visibility cell compares
the settled canvas against an empty-scene frame captured by the same worker on the same run,
so nothing depends on a committed baseline.

Setup hands the machine over through `e2e/.bin/machine.json` rather than environment
variables, because Playwright runs each project in its own worker process. viam-server runs
detached with its output in `e2e/.bin/viam-server.log`, and teardown kills it by the pid
recorded in that file.

## Prerequisites

The `drawing` project needs only Go and a working dev server. Everything below is for the
`robot` project:

- **Go** (to build the `world-state-store` test module).
- **The Viam CLI** installed and authenticated:

  ```bash
  # macOS
  brew install viam
  # or see https://docs.viam.com/dev/tools/cli/ for other platforms

  viam login
  ```

- **Access to a `Viam Viz E2E` organization.** If your account doesn't already belong to one, create it at [app.viam.com](https://app.viam.com/) with the exact name `Viam Viz E2E`; the setup script will detect it on the next run.

## Running E2E Tests

```bash
# the drawing and matrix suites: no cloud machine, no setup.sh
pnpm e2e

# the same suites in the Playwright UI
pnpm e2e:ui

# the matrix alone
pnpm e2e:matrix

# the robot suite: installs viam-server, then provisions a machine
pnpm e2e:robot

# everything
pnpm e2e:all
```

Each of those runs `pnpm go-build` first, which builds both `.bin/draw-server` and
`.bin/draw-scenes`. The fixtures exec the prebuilt binaries rather than compiling per test.

### Running specific tests

Narrow by project first, then by file or title. A project selection is what keeps a one-test
run from provisioning a machine it does not need.

```bash
# one project
npx playwright test --project=drawing

# one file
npx playwright test --project=robot e2e/world-state-store.test.ts

# one test by title
npx playwright test --project=robot --grep "basic edit frame"

# a family of tests
npx playwright test --project=drawing --grep "point cloud"

# one row of the matrix, or one behavior across every type
npx playwright test --project=matrix --grep "box "
npx playwright test --project=matrix --grep visibility

# the inverse: everything except the slow chunked point cloud test
npx playwright test --project=drawing --grep-invert chunked
```

`--grep` matches the file path as well as the title, so anchoring a title with `^` finds
nothing. Match on a distinctive substring instead.

Selecting `--project=robot` runs `robot-setup` and `robot-teardown` around it, even for a
single `--grep` match. Running the robot specs without a project selection fails with an
`Incomplete machine state` error, because nothing provisioned the machine.

## Understanding Test Results

### Screenshot Comparison

Playwright captures screenshots during test execution and compares them against baselines stored in `e2e/<test-name>.test.ts-snapshots/`. Failures produce:

- `actual.png` — the current screenshot
- `expected.png` — the baseline
- `diff.png` — a visual diff

These land in the `test-results/` folder.

NOTE: the robot specs share one ephemeral machine and push conflicting configs at it, which is why the `robot` project stays serial. If one fails, re-run just that one with `--grep` before investigating further.

## Updating Screenshots

Baselines are per platform. `-darwin` files come from a laptop and `-linux` files come from a
CI runner, and a run only reads the set matching where it runs. That is why the two are updated
in different places.

For `-darwin`, when you have intentionally changed the UI:

1. Run with the update flag:
   ```bash
   pnpm e2e -u
   # or, for the robot specs
   pnpm e2e:robot -u
   ```
2. Review the updated files in `e2e/**/*-snapshots/`.
3. Commit the new snapshots alongside your code changes.

> Only update screenshots when you've intentionally modified the UI. Random test failures should be investigated rather than blindly updating snapshots.

For `-linux`, run the **Update E2E Baselines** workflow from the Actions tab. It records on the
same runner image CI verifies against and opens a PR with the result. Do not record these
locally: an Apple Silicon machine produces arm64 pixels, CI renders on x86_64, and the two do
not match closely enough to share a baseline.

## CI

Three workflows, none of them on pull requests. Rendering the scene needs a GPU-backed browser,
and gating every PR on that costs more than it catches.

| Workflow                   | Trigger                              | What it runs                                                                                          |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `playwright.yml`           | after Deploy Docs on main, or manual | `drawing` and `matrix` against a local production build, plus a smoke test of the deployed playground |
| `e2e-robot.yml`            | nightly at 07:00 UTC, or manual      | `robot`, against a machine it provisions and deletes                                                  |
| `update-e2e-baselines.yml` | manual only                          | the same specs with `--update-snapshots`, then opens a PR                                             |

The post-deploy run builds the app and serves it through the bun server rather than testing the
gh-pages deploy, so a failure points at a commit instead of at a deploy. Baselines recorded
against `pnpm dev` still apply: the two were measured pixel for pixel identical across both
projects. `playground-smoke.test.ts` is what still covers the deploy, and it takes no
screenshots, because the deploy differs from a local build by `BASE_PATH` and Sentry and cannot
share baselines.

Nothing in CI passes `--update-snapshots` except the workflow whose entire job is to. A visual
regression fails the run and posts to Slack.

Slack only hears about a failure once. `.github/actions/notify-e2e-failure` hashes the set of
failing specs and the baselines they compared, then uses that hash as an `actions/cache` key: a
hit means this exact set was already reported, so the run stays quiet. A failure that appears or
disappears changes the hash and posts. Pixel counts are deliberately left out of the hash,
because they drift by a few pixels between runs on the same commit and would make every run look
new. A run that never wrote a report posts unconditionally, since that is a broken workflow
rather than a known-failing test.

The nightly robot job sweeps machines named `e2e-<user>-<millis>` older than two hours whether
it passed or failed, which cleans up after a run killed before its teardown project.

## Troubleshooting

- **`viam-server binary not found at .../e2e/.bin/viam-server`**
  Run `./e2e/setup.sh` to install it, or use `pnpm e2e:robot`, which runs it for you.
- **`Incomplete machine state at .../e2e/.bin/machine.json`**
  A robot spec ran without `robot-setup`. Add `--project=robot` to the command.
- **The machine never comes online**
  Read `e2e/.bin/viam-server.log`, which holds everything viam-server wrote.
- **`port 41xx is already in use`**
  A draw server from a killed run is still listening. The Go server attaches to an existing
  listener instead of failing, so the fixture refuses to start rather than silently sharing
  one. Find it with `lsof -nP -iTCP:4100 -sTCP:LISTEN` and kill it.
- **`draw-server binary not found`** or **`draw-scenes binary not found`**
  Run `pnpm go-build`.
- **`no draw server is listening on port N`**
  A scene was run by hand without a visualizer behind it. Start one with `make up`, or pass the
  `-port` of a running worker's server.
- **A draw server failed to start**
  Its log lives beside its chunk directory under the system temp dir, and the fixture's error
  message quotes it.
- **`E2E config not found at .../e2e/.env.e2e`**
  Same fix — run `cd e2e && ./setup.sh`. The script will create the API key and write the file.
- **`Organization "Viam Viz E2E" not found`**
  Your Viam CLI user doesn't have access to an org named exactly `Viam Viz E2E`. Create one at [app.viam.com](https://app.viam.com/) or ask to be added, then re-run setup.
- **Not authenticated with the Viam CLI**
  Run `viam login` and re-run `./e2e/setup.sh`.
- **Stuck/stale machines in the cloud**
  `robot-teardown` deletes the machine, and setup records it in `machine.json` before anything else can fail, so a run that dies partway through still gets cleaned up. A hard kill (SIGKILL, crash) can still leak one. Clean up orphaned `e2e-<username>-*` machines under the `e2e-tests` location in the `Viam Viz E2E` org.
