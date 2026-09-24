/**
 * Variables that are string-replaced by vite.
 *
 * These should not be imported into `$lib`,
 * due to them not being replaced when shipped to NPM.
 */
export const backendIP = BACKEND_IP

/** Port of the Go Connect-RPC draw server. */
export const drawServicePort = DRAW_SERVICE_PORT
