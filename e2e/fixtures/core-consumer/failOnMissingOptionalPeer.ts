import type { Plugin } from 'vite'

const OPTIONAL_PEER_STUB_PREFIX = '__vite-optional-peer-dep:'

/**
 * Fails the build when a module imports an optional peer the host did not install.
 *
 * Vite resolves such an import to a stub that throws only at runtime, so without this plugin a
 * scoped path that reaches test-widgets or prime-core still builds green.
 */
export const failOnMissingOptionalPeer = (): Plugin => ({
	name: 'fail-on-missing-optional-peer',
	enforce: 'pre',
	load(id) {
		if (!id.startsWith(OPTIONAL_PEER_STUB_PREFIX)) {
			return null
		}

		// The stub id is `__vite-optional-peer-dep:<import>:<importing package>`.
		const [, peerImport, importingPackage] = id.split(':')
		this.error(
			`${importingPackage} imports the optional peer ${peerImport}, which this host did not install`
		)
	},
})
