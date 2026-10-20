# Judging a worker's evidence

Open this when a report looks green and you are deciding whether to believe it. `SKILL.md` §5 carries
the checks every review runs. This carries the failure shapes behind them, each one a case where an
accurate report carried no information.

## Why the tree check comes first

Seconds to run. Destruction is what reports are worst at surfacing, because a worker that deleted
something usually did it in service of a step that then succeeded, so its acceptance is green and its
summary is accurate as far as it goes. A typechange means a real file became a symlink, which is
almost never intended. A deletion outside `owns` is a defect regardless of what the report says about
it. If plan state is gone, stop the wave and recover before anything else.

## The evidence catalog

- **Acceptance evidence present and passing?** No evidence, no approval. An unrun acceptance is a
  `REVISE`, always. This is the one rule that keeps review from decaying into rubber-stamping. A brief
  with two commands needs two tails. A test tail alone, where you also asked for a typecheck, is an
  unrun acceptance.
- **Did the acceptance actually RUN, or did the build system skip it?** An incremental runner
  (wireit, turbo, nx, bazel) reports a cache hit as success. `Ran 0 scripts and skipped 26` is a
  claim that a previous run with these inputs passed, not evidence that anything ran now. That is
  usually fine and is the reason the cache exists. It is not fine as the sole evidence for a slice
  that changed a dozen files, and it is worthless when the worker populated the cache itself moments
  earlier. When a tail shows everything skipped on a large slice, verify one thing yourself directly.
- **Could the evidence have come out any other way?** An observed value is evidence only if a broken
  implementation would have produced a different one. One worker mirrored a route across the wrong
  axis and confirmed it by reading the Z column back, but the fixture sat at z ≈ 0, where negating
  changes nothing, so correct and broken produce the same output. The report was accurate and carried
  no information. Where the acceptance is a value read rather than a command's exit code, ask what
  the reading would have been if the code were wrong. If the worker did not say, send it back.
- **Did it satisfy the letter and worsen the artifact?** A worker optimizes for the acceptance you
  wrote. Ask what the change does to the shipped thing, not just to the check. One slice satisfied
  "the tarball must not carry these files" by excluding them in `files` while leaving a package
  `exports` entry pointing at them, which passes the check and publishes a package resolving to
  nothing.

## Revise rounds and what comes after the cap

Escalating the worker's model is the last resort, not the first. A third failed round says the brief
was wrong, so `RESLICE` it or take that one slice in-context yourself.

No `SendMessage` in your harness? Respawn with the original brief plus the defect list, and treat the
extra cost as another reason to keep the cap at 2.

## How much of the code to read

**Spot-read only what's load-bearing:** the seam implementation, a security-relevant branch, the one
hunk the brief called out. Read with `offset`/`limit`. A full diff read here forfeits the entire
point of the skill.
