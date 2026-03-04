/// <reference types="vite/client" />
/// <reference types="vite-plugin-glsl/ext" />

// Vite define replacements (set at build time via vite.config.ts)
declare const BACKEND_IP: string
declare const WS_PORT: string

declare module '*.hdr'
