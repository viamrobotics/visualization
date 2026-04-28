# motion-tools

3D visualization and debugging interface for Viam robotics. Renders spatial data (frames, geometries, point clouds, drawings) using Svelte 5, Threlte/Three.js, and Koota ECS on the frontend, backed by a Connect-RPC Go service.

## Tech stack

| Layer           | Technology                                                    |
| --------------- | ------------------------------------------------------------- |
| Frontend        | Svelte 5 (runes), Threlte/Three.js, Koota ECS, Rapier physics |
| Styling         | TailwindCSS 4                                                 |
| RPC             | Connect-RPC (not standard gRPC)                               |
| Proto tooling   | Buf (`buf.yaml`, `buf.gen.*.yaml`)                            |
| Package manager | pnpm                                                          |
| Dev server      | Bun (`server/server.ts`)                                      |
| Go              | 1.25                                                          |
| Testing         | Vitest + Playwright (TS); `go.viam.com/test` (Go)             |

## Commands

```
make up            # build if needed, start server (ports 5173 + 3000)
make proto         # vendor, lint, format, regenerate all protobuf
pnpm check         # svelte-check + go vet
pnpm lint          # prettier + eslint + golangci-lint
pnpm lint:client   # golangci-lint for client/
pnpm test          # vitest unit tests
pnpm test:draw     # Go tests for draw/
pnpm test:client   # Go tests for client/
pnpm test:e2e      # Playwright E2E
```

## Generated code — never hand-edit

- Any files included in `.gitignore` should not be edited
- Edit `.proto` files in `protos/`, then run `make proto`.

## Code organization

Organize code by feature with **one focused unit per file**. File names should describe what the code does. Avoid generic bucket files (`utils`, `helpers`, `constants`).

## Topic-specific rules

Detailed guidance lives in `.claude/rules/`. Path-scoped rules load when Claude reads matching files; rules without `paths` load every session.

| Rule                  | Loads when                                          |
| --------------------- | --------------------------------------------------- |
| `svelte.md`           | editing `.svelte`, `.svelte.ts`, `.svelte.js`       |
| `three.md`            | editing files under `src/lib/three/`                |
| `go.md`               | editing `.go`                                       |
| `protobuf.md`         | editing `.proto`                                    |
| `testing-go.md`       | editing Go test files (`*_test.go`)                 |
| `testing-frontend.md` | editing frontend test files (`src/**/*.spec.ts`)    |
| `e2e-testing.md`      | editing files under `e2e/`                          |
| `pr-description.md`   | editing files under `.changeset/`                   |
| `changesets.md`       | editing files under `.changeset/` or `CHANGELOG.md` |
