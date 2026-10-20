# The fixer, mid-flight findings, and residue

Open this when a linter or formatter reports something while a wave is live, when you are setting up
a repo whose hooks run a fixer, or when you are deciding who cleans up what the barrier's fix pass
left behind.

## The standing rule a brief most often disarms

A brief that contradicts one of `task-worker.md`'s standing rules silently disarms it, and the only
thing standing between that and a corrupted wave is a worker with the judgment to refuse. The rule
most often contradicted is the fixer prohibition. `task-worker.md` says a worker does not run lint,
format, or fix commands, because a fixer rewrites files its siblings still have open. A verification
recipe written for in-context work says the opposite, and copying that recipe into a brief is the
easiest mistake in this skill. **The fixer runs once, at the barrier (§7), and never in a worker.**
`/tidy` is bound by the same rule for the same reason: it rewrites files, so its one run is the
barrier's, after the fixer and before verify.

## Why the fixer belongs at the barrier

**Formatting is orchestrator work, not worker work.** A fixer run by one worker rewrites files its
siblings still hold open, so the edits collide and N workers redo the same whole-repo pass N times.
One run at the wave barrier (§7) is cleaner and cheaper. If houserules' `lint-fix` module is installed,
confirm `fix.onSubagentStop` is not `true` in `.claude/houserules.config.json`. That setting fires the fixer
at every worker's exit, which is exactly the collision above.

**That setting covers only half of it.** `fix.onSubagentStop` governs a WORKER's exit. A `Stop` hook
fires at YOUR exit, and this pattern ends a turn every time you dispatch or review, with every
worker still holding files open. So the repo-wide fixer runs against a tree mid-edit anyway, from the
other direction.

Two consequences, and the second one matters more:

- Expect a fixer or linter to report problems in files a live slice is halfway through. A worker that
  has added an import and not yet written the call is not a defect.
- **A lint or format finding inside a `DISPATCHED` slice's owned path is not residue, and you do not
  act on it.** Check the slice table before touching anything a hook names. Fixing it means editing a
  running worker's file, which is precisely what every ownership rule here exists to prevent. Residue
  is only what survives the barrier, when every slice is `DONE` or `BLOCKED` and the tree is quiet.

## Routing the residue

**Residue** is what auto-fix couldn't fix, and it's yours by default. It's usually a handful of lines,
and a brief costs more than the edit. Delegate only when it's genuinely bulk work. The barrier's own
fix pass is the first over a consistent tree, since nothing was formatting mid-flight:

| Residue                                             | Do                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ≤ ~5 files, or any of it needs judgment             | fix in-context yourself                                                                      |
| Many files, **one** rule (a rename, an import swap) | `/sweep` (haiku shards, count-only reports)                                                  |
| Many files, several mechanical rules                | one cleanup `task-worker` owning exactly those paths, with the fix command as its acceptance |

Never send residue back to the slice workers. Their briefs are spent, and the residue crosses slice
boundaries by definition. That's why it survived to the barrier.
