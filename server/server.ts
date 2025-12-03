import { serve, spawn, type Subprocess } from 'bun'
import { getLocalIP } from './ip'
import { UuidTool } from 'uuid-tool'

const localIP = getLocalIP()
const connections = new Set<Bun.ServerWebSocket<unknown>>()

let viteProcess: Subprocess | undefined
let server: ReturnType<typeof serve> | undefined
let shuttingDown = false

const shutdown = async (code = 0) => {
	if (shuttingDown) return

	shuttingDown = true

	try {
		server?.stop?.()
	} catch (error) {
		console.error(error)
	}

	// Ask Vite to quit nicely; then hard-kill if it lingers
	try {
		viteProcess?.kill('SIGTERM')
	} catch (error) {
		console.error(error)
	}

	await new Promise((r) => setTimeout(r, 800))

	try {
		viteProcess?.kill('SIGKILL')
	} catch (error) {
		console.error(error)
	}

	// Exit this process
	process.exit(code)
}

const launchVite = (port: number) => {
	// Keep the handle so we can control it
	viteProcess = spawn({
		cmd: ['bun', 'run', 'vite'],
		env: {
			...process.env,
			BUN_SERVER_PORT: port.toString(),
		},
		stdout: 'inherit',
		stderr: 'inherit',
	})

	// If Vite exits on its own, bring down the Bun server too
	viteProcess.exited.then((code) => {
		console.warn(`Vite exited with code ${code ?? 'null'}. Shutting down Bun server.`)
		shutdown(typeof code === 'number' ? code : 1)
	})
}

function sendToClients(data: string | Bun.BufferSource) {
	if (connections.size === 0) {
		console.log('No connected web clients to send data.')
		return { code: 408, message: 'No connected web clients to send data.' }
	}

	for (const ws of connections) {
		ws.send(data)
	}

	return
}

const pendingResponses = new Map<string, (value: Response | PromiseLike<Response>) => void>()

async function handlePost(req: Request, pathname: string): Promise<Response> {
	const uuid = UuidTool.newUuid()

	try {
		switch (pathname) {
			case '/geometry':
			case '/geometries':
			case '/frames':
			case '/camera':
			case '/nurbs': {
				const json = await req.json()
				json.requestID = uuid
				const error = sendToClients(JSON.stringify(json))

				if (error) {
					return jsonResponse(error)
				}

				break
			}

			case '/points':
			case '/poses':
			case '/line':
			case '/pcd': {
				const buffer = await req.arrayBuffer()
				const original = new Uint8Array(buffer)
				const payload = new Uint8Array(16 + original.byteLength)

				payload.set(UuidTool.toBytes(uuid), 0)
				payload.set(original, 16)

				const error = sendToClients(payload)

				if (error) {
					return jsonResponse(error)
				}

				break
			}

			case '/gltf': {
				const buffer = await req.arrayBuffer()
				const original = new Uint8Array(buffer)
				const payload = new Uint8Array(20 + original.byteLength)

				payload.set(UuidTool.toBytes(uuid), 0)
				new DataView(payload.buffer).setFloat32(16, 4, true)
				payload.set(original, 20)

				const error = sendToClients(payload)

				if (error) {
					return jsonResponse(error)
				}

				break
			}

			case '/remove-all': {
				const error = sendToClients(JSON.stringify({ requestID: uuid, removeAll: true }))

				if (error) {
					return jsonResponse(error)
				}

				break
			}

			case '/remove': {
				const json = await req.json()
				const error = sendToClients(JSON.stringify({ requestID: uuid, remove: true, names: json }))

				if (error) {
					return jsonResponse(error)
				}

				break
			}

			default:
				return new Response('Not Found', { status: 404 })
		}

		return new Promise((resolve) => pendingResponses.set(uuid, resolve))
	} catch (err) {
		console.error('Error handling POST:', err)
		return new Response('Server Error', { status: 500 })
	}
}

const jsonResponse = (response: { code: number; message: string }) => {
	return new Response(response.message, {
		status: response.code,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	})
}

let port = 3000

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']
for (const sig of signals) {
	process.on(sig, () => shutdown(0))
}

process.on('uncaughtException', (err) => {
	console.error('Uncaught exception:', err)
	shutdown(1)
})

process.on('unhandledRejection', (reason) => {
	console.error('Unhandled rejection:', reason)
	shutdown(1)
})

// As a last resort (e.g., normal exit), try to kill vite
process.on('exit', () => viteProcess?.kill('SIGTERM'))

// Roughly 1 GiB
const oneGigabyte = 1024 * 1024 * 1024

while (true) {
	try {
		server = serve({
			port,
			hostname: '::',
			maxRequestBodySize: oneGigabyte,
			fetch(req, srv) {
				const { pathname } = new URL(req.url)

				if (pathname === '/ws') {
					if (srv.upgrade(req)) return
					return new Response('Upgrade Failed', { status: 400 })
				}

				if (req.method === 'OPTIONS') {
					return new Response(null, {
						status: 204,
						headers: {
							'Access-Control-Allow-Origin': '*',
							'Access-Control-Allow-Methods': 'POST, OPTIONS',
							'Access-Control-Allow-Headers': 'Content-Type',
						},
					})
				}

				if (req.method === 'POST') {
					return handlePost(req, pathname)
				}

				return new Response('Not Found', { status: 404 })
			},
			websocket: {
				open(ws) {
					console.log('WebSocket client connected.')
					connections.add(ws)
				},
				message(_ws, message) {
					if (typeof message === 'string') {
						try {
							const json = JSON.parse(message)
							const resolve = pendingResponses.get(json.requestID)

							if (resolve) {
								delete json.requestID
								resolve(jsonResponse(json))
								pendingResponses.delete(json.requestID)
							}
						} catch (error) {
							jsonResponse({ code: 400, message: JSON.stringify(error) })
						}
					}

					console.log(`Received: ${message}`)
				},
				close(ws) {
					console.log('WebSocket client closed.')
					connections.delete(ws)
				},
			},
		})

		console.log(`HTTP Server running at http://${localIP}:${port}`)
		console.log(`WebSocket endpoint at ws://${localIP}:${port}/ws`)

		launchVite(port)
		break
	} catch (err) {
		const error = err as Error
		if ('code' in error && typeof error.code === 'string' && error.code === 'EADDRINUSE') {
			console.warn(`Port ${port} in use, trying ${port + 1}...`)
			port += 1
		} else {
			console.error('Failed to start server:', error)
			// if we failed after starting vite, make sure to clean up
			shutdown(1)
			break
		}
	}
}
