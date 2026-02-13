import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Camera from '../Camera.svelte'
import { StreamClient } from '@viamrobotics/sdk'
import { useSettings } from '$lib/hooks/useSettings.svelte'

// Mock Viam SDK components
vi.mock('@viamrobotics/svelte-sdk', () => ({
	// We use a simple div to represent the stream
	CameraStream: vi.fn().mockImplementation(() => ({
		$$render: () => '<div data-testid="camera-stream"></div>',
	})),
	useRobotClient: vi.fn(() => ({ current: {} })),
	useConnectionStatus: vi.fn(() => ({ current: 'CONNECTED' })),
}))

vi.mock('@viamrobotics/sdk', () => ({
	StreamClient: vi.fn().mockImplementation(() => ({
		getOptions: vi.fn().mockResolvedValue([{ width: 640, height: 480 }]),
		setOptions: vi.fn().mockResolvedValue(undefined),
	})),
	MachineConnectionEvent: {
		DISCONNECTED: 'DISCONNECTED',
		DIALING: 'DIALING',
		CONNECTING: 'CONNECTING',
		CONNECTED: 'CONNECTED',
		DISCONNECTING: 'DISCONNECTING',
	},
}))

vi.mock('$lib/hooks/useSettings.svelte', () => ({
	useSettings: vi.fn(),
}))

vi.mock('$lib/hooks/usePartID.svelte', () => ({
	usePartID: vi.fn(() => ({
		current: 'test-part-id',
	})),
}))

vi.mock('$lib/hooks/useEnvironment.svelte', () => ({
	useEnvironment: vi.fn(() => ({
		current: {
			viewerMode: 'monitor',
		},
	})),
}))

describe('Camera widget', () => {
	const mockSettings = {
		current: {
			openCameraWidgets: { 'test-part-id': ['test-camera'] },
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(useSettings).mockReturnValue(mockSettings as any)
	})

	it('renders camera name', () => {
		render(Camera, { name: 'test-camera' })
		expect(screen.getByText('test-camera')).toBeInTheDocument()
	})

	it('renders resolutions in dropdown', async () => {
		render(Camera, { name: 'test-camera' })

		await waitFor(() => {
			expect(screen.getByRole('combobox')).toBeInTheDocument()
		})

		const select = screen.getByRole('combobox')
		expect(select).toHaveTextContent('640x480')
	})

	it('removes itself from settings when close button is clicked', async () => {
		render(Camera, { name: 'test-camera' })

		const closeButton = screen.getByRole('button', { name: /close/i })
		await fireEvent.click(closeButton)

		expect(mockSettings.current.openCameraWidgets['test-part-id']).not.toContain('test-camera')
	})

	it('calls setOptions when a resolution is selected', async () => {
		const mockSetOptions = vi.fn().mockResolvedValue(undefined)
		vi.mocked(StreamClient).mockImplementation(
			() =>
				({
					getOptions: vi.fn().mockResolvedValue([{ width: 640, height: 480 }]),
					setOptions: mockSetOptions,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
				}) as any
		)

		render(Camera, { name: 'test-camera' })

		await waitFor(() => {
			expect(screen.getByRole('combobox')).toBeInTheDocument()
		})

		const select = screen.getByRole('combobox') as HTMLSelectElement
		await fireEvent.change(select, { target: { value: '640x480' } })

		expect(mockSetOptions).toHaveBeenCalledWith('test-camera', 640, 480)
	})
})
