import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))

export interface E2EConfig {
	apiKeyId: string
	apiKey: string
	orgId: string
}

export const loadE2EConfig = (): E2EConfig => {
	const envPath = path.resolve(dirname, '../.env.e2e')

	if (!fs.existsSync(envPath)) {
		throw new Error(
			`E2E config not found at ${envPath}.\n` +
				`Run 'cd e2e && ./setup.sh' to set up your E2E environment.`
		)
	}

	const envContent = fs.readFileSync(envPath, 'utf8')
	const vars: Record<string, string> = {}

	for (const line of envContent.split('\n')) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) continue
		const eqIdx = trimmed.indexOf('=')
		if (eqIdx === -1) continue
		vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1)
	}

	const apiKeyId = vars['VIAM_E2E_API_KEY_ID']
	const apiKey = vars['VIAM_E2E_API_KEY']
	const orgId = vars['VIAM_E2E_ORG_ID']

	if (!apiKeyId || !apiKey || !orgId) {
		throw new Error(
			`Missing required fields in ${envPath}.\n` +
				`Expected: VIAM_E2E_API_KEY_ID, VIAM_E2E_API_KEY, VIAM_E2E_ORG_ID\n` +
				`Run 'cd e2e && ./setup.sh' to regenerate.`
		)
	}

	return { apiKeyId, apiKey, orgId }
}
