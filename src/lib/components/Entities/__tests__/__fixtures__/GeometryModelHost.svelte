<script lang="ts">
	import type { Entity } from 'koota'

	import { provideSettings } from '#lib/hooks/useSettings.svelte.js'

	import GeometryModel from '../../GeometryModel.svelte'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	provideSettings({ persist: false })
</script>

<GeometryModel {entity} />
