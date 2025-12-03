import { serve, spawn, type Subprocess, file } from 'bun'
import { getLocalIP } from './ip'
import { resolve, join } from 'node:path'
import { stat } from 'node:fs/promises'

const localIP = getLocalIP()
const connections = new Set<Bun.ServerWebSocket<unknown>>()
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production')
const buildDir = resolve(import.meta.dir, '../build')

const STATIC_PORT = parseInt(process.env.STATIC_PORT || '5173', 10)
const WS_PORT = parseInt(process.env.WS_PORT || '3000', 10)

const messages = {
	success: { message: 'Data received successfully', status: 200 },
	noClient: { message: 'No connected client', status: 404 },
}

let viteProcess: Subprocess | undefined
let apiServer: ReturnType<typeof serve> | undefined
let staticServer: ReturnType<typeof serve> | undefined
let shuttingDown = false

const shutdown = async (code = 0) => {
	if (shuttingDown) return

	shuttingDown = true

	try {
		apiServer?.stop?.()
		staticServer?.stop?.()
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

const launchVite = () => {
	// Keep the handle so we can control it
	viteProcess = spawn({
		cmd: ['bun', 'run', 'vite'],
		env: {
			...process.env,
			WS_PORT: WS_PORT.toString(),
			STATIC_PORT: STATIC_PORT.toString(),
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

const startStaticServer = () => {
	try {
		staticServer = serve({
			port: STATIC_PORT,
			hostname: '::',
			async fetch(req) {
				const { pathname } = new URL(req.url)

				if (req.method === 'GET') {
					const response = await serveStatic(pathname)
					if (response) return response
				}

				return new Response('Not Found', { status: 404 })
			},
		})

		console.log(`Static file server running at http://${localIP}:${STATIC_PORT}`)
	} catch (err) {
		console.error('Failed to start static file server:', err)
		shutdown(1)
	}
}

const serveStatic = async (pathname: string): Promise<Response | null> => {
	try {
		let filePath = join(buildDir, pathname)

		const fileStats = await stat(filePath).catch(() => null)
		if (fileStats?.isFile()) {
			return new Response(file(filePath))
		}

		if (fileStats?.isDirectory()) {
			filePath = join(filePath, 'index.html')
		} else {
			filePath = join(buildDir, 'index.html')
		}

		const indexStats = await stat(filePath).catch(() => null)
		if (indexStats?.isFile()) {
			return new Response(file(filePath))
		}

		return null
	} catch (err) {
		console.error('Error serving static file:', err)
		return null
	}
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
			case '/frames':
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

const jsonResponse = (success: boolean) => {
	return new Response(JSON.stringify(success ? messages.success : messages.noClient), {
		status: success ? 200 : 408,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	})
}

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

// Start the API/WebSocket server
try {
	apiServer = serve({
		port: WS_PORT,
		hostname: '::',
		maxRequestBodySize: oneGigabyte,
		async fetch(req, srv) {
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

	console.log(`API/WebSocket server running at http://${localIP}:${WS_PORT}`)
	console.log(`WebSocket endpoint: ws://${localIP}:${WS_PORT}/ws`)

	if (isProduction) {
		startStaticServer()
		console.log(
			`\n\t\x1b[32m\x1b[1mAccess the app at:\x1b[0m\x1b[32m http://${localIP}:${STATIC_PORT}\x1b[0m`
		)
	} else {
		launchVite()
	}
} catch (err) {
	console.error('Failed to start server:', err)
	shutdown(1)
}
