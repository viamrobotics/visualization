import { contextBridge } from 'electron'

// The renderer detects the desktop shell by this global. Later phases add the launch config and
// draw-server port to it.
contextBridge.exposeInMainWorld('viamDesktop', {})
