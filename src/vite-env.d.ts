/// <reference types="vite/client" />

// Vite define replacements (set at build time via vite.config.ts)
declare const BACKEND_IP: string
declare const DRAW_SERVICE_PORT: string

declare module '*.hdr'
