import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'

/**
 * Reduces a Playwright JSON report to a stable fingerprint of what failed, so a
 * workflow can tell a new failure from one it has already reported.
 *
 * Usage: node .github/scripts/e2e-failure-fingerprint.js <report.json>
 *
 * Writes `fingerprint`, `summary`, and `count` to $GITHUB_OUTPUT when it is set,
 * and the summary to stdout either way. A missing or unparseable report is
 * fingerprinted as `unknown`, which never matches a stored key, so a run that
 * died before writing a report still reports.
 */

/**
 * Which baselines a screenshot assertion compared. Attachments arrive as
 * `<baseline>-expected.png` / `-actual.png` / `-diff.png` triples, and the
 * shared stem is the baseline's own name.
 */
const SNAPSHOT_ROLE = /-(expected|actual|diff|previous)(\.[a-z0-9]+)?$/i

const snapshotNames = (result) => {
	const names = (result.attachments ?? [])
		.map((attachment) => attachment.name ?? '')
		.filter((name) => SNAPSHOT_ROLE.test(name))
		.map((name) => name.replace(SNAPSHOT_ROLE, ''))

	return [...new Set(names)].toSorted()
}

/**
 * Every failed spec in the report, as `project > file > title` plus any
 * baselines it compared.
 *
 * Pixel counts are deliberately excluded. They drift by a few pixels between
 * runs on the same commit, so including them would make every run a new
 * fingerprint and defeat the whole point.
 */
const collectFailures = (report) => {
	const failures = []

	const walk = (suite, file) => {
		const suiteFile = suite.file ?? file

		for (const spec of suite.specs ?? []) {
			if (spec.ok) continue

			for (const test of spec.tests ?? []) {
				const last = test.results?.at(-1)
				if (!last || last.status === 'passed' || last.status === 'skipped') continue

				const snapshots = snapshotNames(last)
				failures.push(
					[
						test.projectName || 'unknown-project',
						suiteFile || 'unknown-file',
						spec.title,
						...snapshots,
					].join(' > ')
				)
			}
		}

		for (const child of suite.suites ?? []) {
			walk(child, suiteFile)
		}
	}

	for (const suite of report.suites ?? []) {
		walk(suite, suite.file)
	}

	return [...new Set(failures)].toSorted()
}

const reportPath = process.argv[2]

let failures
try {
	failures = collectFailures(JSON.parse(readFileSync(reportPath, 'utf8')))
} catch (error) {
	console.error(`Could not read ${reportPath}: ${error.message}`)
	failures = undefined
}

const fingerprint =
	failures === undefined
		? 'unknown'
		: failures.length === 0
			? 'none'
			: createHash('sha256').update(failures.join('\n')).digest('hex').slice(0, 16)

const summary =
	failures === undefined
		? 'No report was written, so the failing set is unknown.'
		: failures.length === 0
			? 'No failures.'
			: failures.map((failure) => `• ${failure}`).join('\n')

console.log(summary)

if (process.env.GITHUB_OUTPUT) {
	appendFileSync(
		process.env.GITHUB_OUTPUT,
		`fingerprint=${fingerprint}\nsummary<<E2E_SUMMARY_EOF\n${summary}\nE2E_SUMMARY_EOF\n`
	)
}
