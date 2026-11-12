import type { LaunchConfigPayload } from './launchConfig'

/** The API the Electron preload exposes on `window.viamDesktop`. Absent in the browser build. */
export interface DesktopBridge {
	/**
	 * The bundled draw server's port, once it has started. `null` when the shell did not start one
	 * (an unpackaged run without `VIAM_VISUALIZER_SIDECAR`) or it failed to start or has exited.
	 */
	drawServicePort(): Promise<number | null>
	/** The current launch file result, or `null` when the app started without one. */
	launchConfig(): Promise<LaunchConfigPayload | null>
	/**
	 * Calls `listener` whenever a relaunch or an opened file replaces the launch config.
	 *
	 * @returns A function that stops the calls.
	 */
	onLaunchConfigChanged(listener: (payload: LaunchConfigPayload) => void): () => void
}

declare global {
	interface Window {
		viamDesktop?: DesktopBridge
	}
}

/** The desktop bridge, or `undefined` outside the Electron shell. */
export const getDesktopBridge = (): DesktopBridge | undefined => window.viamDesktop
