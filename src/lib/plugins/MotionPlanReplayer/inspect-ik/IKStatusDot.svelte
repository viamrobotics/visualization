<script lang="ts">
	import { IK_STATUS_LABEL, type IKStatus } from './parse-ik-solutions'

	interface Props {
		status: IKStatus
		/** Set when no adjacent text already names the status, so the dot isn't the only cue. */
		labelled?: boolean
	}

	const { status, labelled = false }: Props = $props()
</script>

<span
	class={[
		'size-2 shrink-0 rounded-full',
		{
			'bg-success-dark': status === 'valid',
			'bg-warning-dark': status === 'path-invalid',
			'bg-danger-dark': status === 'invalid',
		},
	]}
	role={labelled ? 'img' : undefined}
	aria-label={labelled ? IK_STATUS_LABEL[status] : undefined}
	aria-hidden={labelled ? undefined : 'true'}
></span>
