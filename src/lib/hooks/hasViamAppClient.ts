import { useViamClient } from '@viamrobotics/svelte-sdk'

/**
 * Whether a `ViamAppProvider` is mounted above the caller. Call it during component
 * init. A context cannot appear later, so one read holds for the caller's lifetime.
 */
export const hasViamAppClient = (): boolean => useViamClient() !== undefined
