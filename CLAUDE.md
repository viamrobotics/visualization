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
| Testing         | Vitest + Playwright (TS); `go.viam.com/test` (Go)             |

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

## Generated code — never hand-edit

- Any files included in `.gitignore` should not be edited
- Edit `.proto` files in `protos/`, then run `pnpm proto`.

## Code organization

Organize code by feature with **one focused unit per file**. File names should describe what the code does. Avoid generic bucket files (`utils`, `helpers`, `constants`).

## Topic-specific rules

Detailed guidance lives in `.claude/rules/`. Path-scoped rules load when Claude reads matching files; rules without `paths` load every session. Kit-managed rules (svelte, three, typescript, testing, code-comments, prose-voice, design, …) are installed and documented by houserules — see the houserules block below. The repo-owned rules:

| Rule                     | Loads when                                         |
| ------------------------ | -------------------------------------------------- |
| `koota-ecs.md`           | editing `.svelte`, `.svelte.ts`, or `src/lib/ecs/` |
| `threlte-scene.md`       | editing `.svelte`, `.svelte.ts`                    |
| `svelte-lifecycle.md`    | editing `.svelte`                                  |
| `frontend-aesthetics.md` | editing `.svelte` or `.css`                        |
| `math.md`                | editing files under `src/lib/math/`                |
| `go.md`                  | editing `.go`                                      |
| `testing-go.md`          | editing Go test files (`*_test.go`)                |
| `testing-frontend.md`    | editing frontend test files (`src/**/*.spec.ts`)   |
| `viam-context.md`        | every session (no path scope)                      |

<!-- houserules:claude-md start -->

### houserules sections

This block is maintained by `npx houserules update`. Content outside the markers is yours
and never touched. Templates for a fuller CLAUDE.md skeleton and for guardrail rules live
in `.claude/templates/`.

### Skill triggers

- After a meaningful change to a package: record a changeset with `/changeset`, **before
  the commit**.
- Too big to hold in one plan: scaffold with `/plan-project`, then execute each phase with
  `/orchestrate`.

### Conventions

- **The user always handles `git commit` / `push` / PR-create.** Describe what is ready and stop.
  (Enforced by `.claude/scripts/guard-bash.mjs`.)
- **Edit from the file's current bytes.** Re-read before editing when your view of it is
  second-hand (an earlier snapshot, a build or lint error, another tool's output) or the user may
  have it open. A tool's report and the file on disk can disagree within seconds.
- **Do not rewrite what is not yours to change.** When the user presents a file as their own
  finished work, or has it open mid-edit, surface the problem and let them decide.

### Cost & verification discipline

- Stage-sized work (≤ a handful of files): implement directly in-context, with no implementation
  subagents. Reserve subagents for genuinely parallel or unbounded work (wide sweeps, migrations).
- Exception, a planned phase under `/orchestrate`: dispatch one scoped `task-worker` per slice
  and review the returned reports. Never pull a worker’s diff into the main context.
- Verify with static gates (tests, typecheck, lint) plus a short falsifiable acceptance checklist
  for the user. No browser/screenshot verification unless explicitly asked.
- Run those gates in order: format first, since it rewrites in place and settles the mechanical
  noise, then lint with autofix so only real problems are left, then typecheck and test. Scope
  each command to the packages you changed. This order is for work you do yourself.
  When subagents are editing in parallel, the fixer runs once after they report, never inside
  one of them, since it rewrites files their siblings still have open.
- **"Done" means every check passed, not that the edits were made.** Report a check that failed
  or never ran, with its output. Never claim success over one you did not see pass.
  The recorded evasions, and what each one actually means:
  | Excuse | Reality |
  | --- | --- |
  | "The edits are in, so it is done" | Done is the checks passing, with output you read. |
  | "I know this fact from memory" | State it only after running the command that could falsify it. |
  | "It passed earlier" | A stale or cached pass is not this change's pass. Re-run on current bytes. |
  | "The subagent reported success" | The tree is the evidence. Check it before believing the report. |
- Derive empirical constants by parsing the artifact itself, not screenshot-and-iterate loops.
- On AskUserQuestion timeout, stop and re-ask later. Never carry tentative selections forward.
- Read the repo's own docs + targeted greps before fanning out Explore/Plan agents.

### Tool-use efficiency

- `grep -n` to locate, then `Read` with `offset`/`limit`. Never read big files whole.
- Never `git stash` to baseline-check. Use `git diff --name-only` / `git show HEAD:<path>`.
- Pipe long command output through `grep`, and batch related greps into one call.

<!-- houserules:claude-md end -->
