#!/usr/bin/env node
/**
 * Stop hook. Runs `eslint --fix` once on the files Claude edited this turn, then re-runs
 * prettier on them, since an autofix can leave formatting prettier would change.
 *
 * The edited set comes from the turn's Edit/Write/MultiEdit calls in the transcript, not
 * from `git status`, so the user's own uncommitted work is never touched. A turn with no
 * edits spawns nothing.
 *
 * ESLint runs at Stop rather than per edit for two reasons. Autofix can change code, and a
 * multi-edit change passes through intermediate states (an import added one edit before
 * its first use) that an autofix would rewrite. And `projectService` type-aware linting
 * pays a TypeScript program setup on every invocation.
 *
 * Exits 2 with the remaining problems on stderr so Claude fixes them. Every other path,
 * including a crash in this script, exits 0.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit'])
const LINTABLE = /\.(?:ts|tsx|js|jsx|mjs|cjs|svelte)$/
// Under the 120s hook timeout in settings.json, so a hung eslint is killed here first.
const SPAWN_TIMEOUT_MS = 110_000
const REPORTED_LINES = 60

/** Whether a transcript entry is a prompt the user typed, as opposed to a tool result. */
function isUserPrompt(entry) {
	if (entry.type !== 'user') return false
	const content = entry.message?.content
	if (typeof content === 'string') return true
	return Array.isArray(content) && content.some((block) => block.type !== 'tool_result')
}

/** Repo-relative paths written by edit tools since the user's last prompt. */
function filesEditedThisTurn(transcriptPath) {
	const lines = readFileSync(transcriptPath, 'utf8').trim().split('\n')
	const files = new Set()

	for (let i = lines.length - 1; i >= 0; i--) {
		let entry
		try {
			entry = JSON.parse(lines[i])
		} catch {
			continue
		}
		if (isUserPrompt(entry)) break
		if (entry.type !== 'assistant') continue

		for (const block of entry.message?.content ?? []) {
			if (block.type !== 'tool_use' || !EDIT_TOOLS.has(block.name)) continue
			const filePath = block.input?.file_path
			if (!filePath) continue
			const abs = path.resolve(root, filePath)
			const rel = path.relative(root, abs)
			if (!rel.startsWith('..') && existsSync(abs)) files.add(rel)
		}
	}

	return [...files]
}

function run(bin, args) {
	return spawnSync(path.join(root, 'node_modules/.bin', bin), args, {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		timeout: SPAWN_TIMEOUT_MS,
		killSignal: 'SIGKILL',
	})
}

try {
	const input = JSON.parse(readFileSync(0, 'utf8'))
	// A Stop hook that blocked once is re-entered with this flag. Exiting avoids a loop.
	if (input.stop_hook_active || !input.transcript_path) process.exit(0)

	const edited = filesEditedThisTurn(input.transcript_path)
	const lintable = edited.filter((file) => LINTABLE.test(file))
	if (lintable.length === 0) process.exit(0)

	const lint = run('eslint', ['--fix', '--no-warn-ignored', ...lintable])
	run('prettier', ['--write', '--ignore-unknown', ...lintable])

	if (lint.status !== 0) {
		process.stderr.write('ESLint left problems in files edited this turn. Fix them:\n\n')
		process.stderr.write(
			`${lint.stdout}${lint.stderr}`.trim().split('\n').slice(-REPORTED_LINES).join('\n')
		)
		process.stderr.write('\n')
		process.exit(2)
	}
} catch {
	// A Stop hook that crashes would fire on every turn. Fail open.
}

process.exit(0)
