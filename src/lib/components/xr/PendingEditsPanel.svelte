<script lang="ts">
	import { T } from '@threlte/core'
	import { Headset } from '@threlte/xr'
	import { Text } from 'threlte-uikit'
	import { Button, ButtonLabel, Panel } from 'threlte-uikit/horizon'

	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	const partConfig = usePartConfig()
</script>

{#if partConfig.isDirty}
	<Headset>
		<T.Group
			position={[0, 0, -0.6]}
			scale={0.1}
		>
			<Panel
				flexDirection="column"
				padding={16}
				gap={12}
				backgroundColor="#111"
				borderRadius={16}
				minWidth={420}
			>
				<Text
					text="Pending frame edits"
					fontSize={18}
					color="#ffffff"
				/>
				<Panel
					flexDirection="row"
					gap={8}
				>
					<Button
						variant="tertiary"
						size="sm"
						onclick={() => partConfig.discardChanges()}
					>
						<ButtonLabel>Discard</ButtonLabel>
					</Button>
					<Button
						variant="primary"
						size="sm"
						onclick={() => partConfig.save()}
					>
						<ButtonLabel>Save</ButtonLabel>
					</Button>
				</Panel>
			</Panel>
		</T.Group>
	</Headset>
{/if}
