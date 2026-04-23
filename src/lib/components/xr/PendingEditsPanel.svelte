<script lang="ts">
	import { T } from '@threlte/core'
	import { Text } from 'threlte-uikit'
	import { Button, ButtonLabel, Panel } from 'threlte-uikit/horizon'

	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	import HUD from './HUD.svelte'
	import HUDBillboard from './HUDBillboard.svelte'

	const partConfig = usePartConfig()
</script>

{#if partConfig.isDirty}
	<HUD>
		<HUDBillboard position={[0, -0.55, -0.8]}>
			<T.Group scale={0.1}>
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
							<ButtonLabel>
								<Text
									text="Discard"
									fontSize={14}
									color="#ffffff"
								/>
							</ButtonLabel>
						</Button>
						<Button
							variant="primary"
							size="sm"
							onclick={() => partConfig.save()}
						>
							<ButtonLabel>
								<Text
									text="Save"
									fontSize={14}
									color="#ffffff"
								/>
							</ButtonLabel>
						</Button>
					</Panel>
				</Panel>
			</T.Group>
		</HUDBillboard>
	</HUD>
{/if}
