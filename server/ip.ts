import os from 'node:os'

/** Get the local IP (non-internal IPv4 address) */
export const getLocalIP = () => {
	const interfaces = os.networkInterfaces()

	for (const ifaceList of Object.values(interfaces)) {
		for (const iface of ifaceList ?? []) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address
			}
		}
	}

	return 'localhost'
}
