/**
 * Tauri command that returns the port of the bundled draw server, or null when
 * the shell did not spawn one (debug builds, or the sidecar failed to start).
 * The Rust side registers it under the same name in `src-tauri/src/draw_server.rs`.
 */
export const DRAW_SERVICE_PORT_COMMAND = 'draw_service_port'

/** Payload of {@link DRAW_SERVICE_PORT_COMMAND}. */
export type DrawServicePortPayload = number | null
