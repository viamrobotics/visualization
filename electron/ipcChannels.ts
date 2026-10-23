/** IPC channel the renderer invokes for the current launch config. */
export const LAUNCH_CONFIG_CHANNEL = 'launch-config:get'

/** IPC channel the main process sends a replaced launch config on. */
export const LAUNCH_CONFIG_CHANGED_CHANNEL = 'launch-config:changed'

/** IPC channel the renderer invokes for the bundled draw server's port. */
export const DRAW_SERVICE_PORT_CHANNEL = 'draw-service:port'
