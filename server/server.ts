import { serve, spawn, type Subprocess } from 'bun'
import { getLocalIP } from './ip'

const localIP = getLocalIP()
const connections = new Set<Bun.ServerWebSocket<unknown>>()

const messages = {
	success: { message: 'Data received successfully', status: 200 },
	noClient: { message: 'No connected client', status: 404 },
}

let viteProcess: Subprocess | undefined
let server: ReturnType<typeof serve> | undefined
let shuttingDown = false

const shutdown = async (code = 0) => {
	if (shuttingDown) return

	shuttingDown = true

	try {
		server?.stop?.()
	} catch {}

	// Ask Vite to quit nicely; then hard-kill if it lingers
	try {
		viteProcess?.kill('SIGTERM')
	} catch {}

	await new Promise((r) => setTimeout(r, 800))

	try {
		viteProcess?.kill('SIGKILL')
	} catch {}

	// Exit this process
	process.exit(code)
}

const wireProcessLifeline = () => {
	// If our process is going down, take Vite with us
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
		console.log('No connected web clients to send data!')
		return false
	}

	for (const ws of connections) {
		ws.send(data)
	}

	return true
}

async function handlePost(req: Request, pathname: string): Promise<Response> {
	try {
		switch (pathname) {
			case '/geometry':
			case '/geometries':
			case '/camera':
			case '/nurbs': {
				const json = await req.json()
				const success = sendToClients(JSON.stringify(json))
				return jsonResponse(success)
			}
			case '/points':
			case '/poses':
			case '/line':
			case '/gltf':
			case '/pcd': {
				const buffer = await req.arrayBuffer()
				const success = sendToClients(buffer)
				return jsonResponse(success)
			}
			case '/remove-all': {
				const success = sendToClients(JSON.stringify({ removeAll: true }))
				return jsonResponse(success)
			}
			case '/remove': {
				const json = await req.json()
				const success = sendToClients(JSON.stringify({ remove: true, names: json }))
				return jsonResponse(success)
			}
			default:
				return new Response('Not Found', { status: 404 })
		}
	} catch (err) {
		console.error('Error handling POST:', err)
		return new Response('Server Error', { status: 500 })
	}
}

const jsonResponse = (success: boolean) =>
	new Response(JSON.stringify(success ? messages.success : messages.noClient), {
		status: success ? 200 : 408,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	})

let port = 3000
wireProcessLifeline()

while (true) {
	try {
		server = serve({
			port,
			hostname: '::',
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
	} catch (error: any) {
		if (error?.code === 'EADDRINUSE') {
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
