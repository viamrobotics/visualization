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

`.claude/rules/` loads by each file's `paths:` frontmatter. Repo-owned: `koota-ecs`, `threlte-scene`, `svelte-lifecycle`, `frontend-aesthetics`, `math`, `go`, `testing-go`, `testing-frontend`, `viam-context`. The rest are houserules-managed: edit their `paths:`, never their bodies.

<!-- houserules:claude-md start -->

### houserules sections

Maintained by `npx houserules update`. Text outside the markers is yours and never touched.
Fuller templates live in `.claude/templates/`.

### Skill triggers

- After a meaningful change to a package: record a changeset with `/changeset`, **before
  the commit**.
- Too big to hold in one plan: scaffold with `/plan-project`, then execute each phase with
  `/orchestrate`.
- Building UI, an artifact, or a deck? Take colors, type, and spacing from
  `.claude/design/tokens.json`, never a palette of your own.

### Conventions

- **The user always handles `git commit` / `push` / PR-create.** Describe what is ready and stop.
- **Edit from the file's current bytes.** Re-read before editing when your view of it is
  second-hand (a snapshot, a lint error, another tool's output) or the user may have it open.
- **Do not rewrite what is not yours to change.** When the user presents a file as their own
  finished work, or has it open mid-edit, surface the problem and let them decide.
- **Watch for the missing `[houserules]` SessionStart banner.** Without it, the session started
  below the repo root and the installed hooks, including the Bash guard, are not active. Tell
  the user to relaunch Claude Code from the repo root.

### Cost & verification discipline

- Implement stage-sized work (a handful of files) in-context, with no implementation subagents.
  Reserve subagents for parallel or unbounded work (wide sweeps, migrations).
- Exception, a planned phase under `/orchestrate`: dispatch as that skill says. Never pull a
  worker’s diff into the main context.
- Verify with static gates (tests, typecheck, lint) plus a short falsifiable acceptance checklist
  for the user. No browser/screenshot verification unless explicitly asked.
- Run them in order, scoped to the packages you changed: format first, then lint with autofix,
  then typecheck and test, so only real problems are left.
- **"Done" means every check passed, not that the edits were made.** Report a check that failed
  or never ran, with its output. The recorded evasions, and what each one means:
  - "The edits are in, so it is done": done is the checks passing, with output you read.
  - "I know this fact from memory": state it only after running the command that could falsify it.
  - "It passed earlier": a stale or cached pass is not this change's pass. Re-run on current bytes.
  - "The subagent reported success": the tree is the evidence, not the report.
- When the user is blocked on each turn, a cheap reversible action is itself the check. Run it
  and let its result falsify, with at most one cheaper check first.
- Derive empirical constants by parsing the artifact itself, not screenshot-and-iterate loops.
- A subagent runs a command expected to outlast the default Bash timeout with
  `run_in_background: true`, ends its turn without reporting, and reports when the completion
  notification re-invokes it, reading the output file it names. A foreground call blocks the
  subagent until Claude Code moves it to the background anyway, so starting it there saves the
  blocked minutes and lets the subagent end its turn.
- On AskUserQuestion timeout, stop and re-ask later. Never carry tentative selections forward.
- Read the repo's own docs + targeted greps before fanning out Explore/Plan agents.

### Tool-use efficiency

- `grep -n` to locate, then `Read` with `offset`/`limit`. Grep output is location data, not
  content: never judge text against a grep listing of it.
- Pipe long command output through `grep`, and batch related greps into one call.

<!-- houserules:claude-md end -->
