<script lang="ts">
	import type { Struct } from '@viamrobotics/sdk'

	import { provideToast } from '@viamrobotics/prime-core'
	import { untrack } from 'svelte'

	import { provideWorld } from '#lib/ecs/index.js'
	import { provideFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import {
		type PartConfigContext,
		providePartConfig,
		usePartConfig,
	} from '#lib/hooks/usePartConfig.svelte.js'

	interface Props {
		current: Struct
		setLocalPartConfig: (config: Struct) => void
		onready: (partConfig: PartConfigContext) => void
	}

	const props: Props = $props()

	provideToast()
	provideWorld()
	provideFragmentInfo(
		() => 'part-id',
		() => undefined,
		() => undefined
	)
	providePartConfig(
		() => 'part-id',
		() => ({ current: props.current, isDirty: false, setLocalPartConfig: props.setLocalPartConfig })
	)

	const partConfig = usePartConfig()
	untrack(() => props.onready(partConfig))
</script>
