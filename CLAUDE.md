# Viam Visualization

3D visualization and debugging interface for Viam robotics. Renders spatial data (frames, geometries, point clouds, drawings) using Svelte 5, Threlte/Three.js, and Koota ECS on the frontend, backed by a Connect-RPC Go service.

## Tech stack

| Layer           | Technology                                                    |
| --------------- | ------------------------------------------------------------- |
| Frontend        | Svelte 5 (runes), Threlte/Three.js, Koota ECS, Rapier physics |
| Styling         | TailwindCSS 4                                                 |
| RPC             | Connect-RPC (not standard gRPC)                               |
| Proto tooling   | Buf (`buf.yaml`, `buf.gen.*.yaml`)                            |
| Package manager | pnpm                                                          |
| Dev server      | Go (`cmd/draw-server`), Vite for HMR                          |
| Go              | 1.25                                                          |
| Testing         | Vitest + Playwright (TS), `go.viam.com/test` (Go)             |

## Commands

```
make up            # build if needed, start the draw server (5173 app, 3030 RPC)
pnpm proto         # vendor, lint, format, regenerate all protobuf
pnpm check         # svelte-check + go vet
pnpm lint          # prettier + eslint + golangci-lint
pnpm lint:client   # golangci-lint for client/
pnpm test          # vitest unit tests
pnpm test:draw     # Go tests for draw/
pnpm test:client   # Go tests for client/
pnpm e2e           # Playwright drawing suite
pnpm e2e:robot     # Playwright robot suite (provisions a cloud machine)
```

## Never hand-edit generated code

- Any files included in `.gitignore` should not be edited
- Edit `.proto` files in `protos/`, then run `pnpm proto`.

## Code organization

Organize code by feature with **one focused unit per file**. File names should describe what the code does. Avoid generic bucket files (`utils`, `helpers`, `constants`).

## Topic-specific rules

`.claude/rules/` loads by each file's `paths:` frontmatter. Repo-owned: `koota-ecs`, `threlte-scene`, `svelte-lifecycle`, `frontend-aesthetics`, `math`, `go`, `testing-go`, `testing-frontend`, `viam-context`. The rest are houserules-managed and gitignored: set their `paths:` under `rules` in `.claude/houserules.config.json`, never edit the files.

<!-- houserules:claude-md start -->

@.claude/houserules.md

<!-- houserules:claude-md end -->
