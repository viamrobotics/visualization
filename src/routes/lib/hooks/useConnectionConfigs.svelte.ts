import { get, set } from 'idb-keyval'
import { PersistedState } from 'runed'
import { getContext, setContext } from 'svelte'
import { envConfigs } from '../configs'
import { isEqual } from 'lodash-es'

interface ConnectionConfig {
	host: string
	partId: string
	apiKeyId: string
	apiKeyValue: string
	signalingAddress: string
}

const key = Symbol('connection-config-context')
const activeConfig = new PersistedState<number>('active-connection-config', 0)

interface Context {
	current: ConnectionConfig[]
	add: () => void
	remove: (index: number) => void
	isEnvConfig: (config: ConnectionConfig) => boolean
}

export const provideConnectionConfigs = () => {
	let connectionConfigs: ConnectionConfig[] = $state([])

	get('connection-configs').then((response) => {
		if (Array.isArray(response)) {
			connectionConfigs = response
		}
	})

	$effect(() => {
		set('connection-configs', $state.snapshot(connectionConfigs))
	})

	const merged = $derived([...envConfigs, ...connectionConfigs])

	const add = () => {
		connectionConfigs.push({
			host: '',
			partId: '',
			apiKeyId: '',
			apiKeyValue: '',
			signalingAddress: '',
		})
	}

	const remove = (index: number) => {
		connectionConfigs.splice(index - envConfigs.length, 1)
	}

	const isEnvConfig = (config: ConnectionConfig) => {
		return envConfigs.some((value) => isEqual(config, value))
	}

	setContext<Context>(key, {
		get current() {
			return merged
		},
		add,
		remove,
		isEnvConfig,
	})
}

export const useConnectionConfigs = () => {
	return getContext<Context>(key)
}

export const useActiveConnectionConfig = () => {
	const connectionConfigs = useConnectionConfigs()

	return {
		get current() {
			if (activeConfig.current === -1) {
				return undefined
			}
			return connectionConfigs.current.at(activeConfig.current)
		},
		set(index: number | undefined) {
			activeConfig.current = index ?? -1
		},
	}
}
