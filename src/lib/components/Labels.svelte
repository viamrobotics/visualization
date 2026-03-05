<script module>
	class Store {
		current = $state<HTMLElement[]>([])
		add(element: HTMLElement) {
			this.current.push(element)
		}
		remove(element: HTMLElement) {
			this.current.splice(this.current.indexOf(element))
		}
	}

	export const labels = new Store()
</script>

<script lang="ts">
	import { useTask } from '@threlte/core'
	import * as d3 from 'd3-force'

	type Node = {
		id: string

		// Anchor (dot center) in viewport px
		ax: number
		ay: number

		// Dot radius in viewport px
		dotR: number

		// Label text CENTER in viewport px (mutated by solver)
		x: number
		y: number

		// Text size in viewport px
		w: number
		h: number

		// Per-node constraints in viewport px
		minRadius: number
		maxRadius: number

		// Estimated CSS scale of this <HTML> island (screenPx / localPx)
		scale: number

		// DOM refs
		labelEl: HTMLElement
		textEl: HTMLElement
		dotEl: HTMLElement
		lineEl: SVGLineElement
	}

	export function createLabelLayout(opts?: {
		// Spacing / clarity
		labelPadding?: number // label-label spacing (viewport px)
		dotPadding?: number // dot clearance (viewport px)

		// “Stay close”
		maxRadius?: number // max distance from own dot (viewport px)

		// Radial “fan out” to reduce link crossings
		radialStrength?: number // 0..0.08 recommended

		// Solver
		ticksPerFrame?: number // 8–20
		anchorStrength?: number // 0.6–1.2

		// Safety
		maxStepPx?: number // clamp per tick movement (viewport px)
	}) {
		const labelPadding = opts?.labelPadding ?? 6
		const dotPadding = opts?.dotPadding ?? 6

		const baseMaxRadius = opts?.maxRadius ?? 140

		const radialStrength = opts?.radialStrength ?? 0.02

		const ticksPerFrame = opts?.ticksPerFrame ?? 14
		const anchorStrength = opts?.anchorStrength ?? 0.9

		const maxStepPx = opts?.maxStepPx ?? 40

		const nodesByLabel = new WeakMap<HTMLElement, Node>()
		let nodes: Node[] = []

		// ---------- DOM helpers ----------
		function req(labelEl: HTMLElement, sel: string): HTMLElement {
			const el = labelEl.querySelector(sel)
			if (!el) throw new Error(`Label missing ${sel}`)
			return el as HTMLElement
		}

		function dotCenterViewport(dotEl: HTMLElement) {
			const r = dotEl.getBoundingClientRect()
			return {
				x: r.left + r.width / 2,
				y: r.top + r.height / 2,
				radius: r.width / 2,
				width: r.width,
			}
		}

		function measureTextViewport(textEl: HTMLElement) {
			const r = textEl.getBoundingClientRect()
			return { w: r.width, h: r.height }
		}

		function getCssPxSize(el: HTMLElement) {
			const cs = getComputedStyle(el)
			// assumes pixels; Tailwind h-3 w-3 becomes "12px"
			const w = parseFloat(cs.width) || 0
			const h = parseFloat(cs.height) || 0
			return { w, h }
		}

		function estimateScale(labelEl: HTMLElement, dotEl: HTMLElement) {
			// Use dot: rendered width (viewport px) / CSS width (local px) = scale
			const dv = dotEl.getBoundingClientRect()
			const css = getCssPxSize(dotEl)
			const base = css.w || 12 // fallback for w-3
			const s = dv.width / base
			// guard against NaN/0
			return Number.isFinite(s) && s > 1e-4 ? s : 1
		}

		// Convert a screen-space delta (viewport px) into label-local px, compensating for scale
		function toLocalPx(n: Node, dxViewport: number, dyViewport: number) {
			const inv = 1 / n.scale
			return { dx: dxViewport * inv, dy: dyViewport * inv }
		}

		// ---------- Node lifecycle ----------
		function ensureNode(labelEl: HTMLElement): Node {
			const existing = nodesByLabel.get(labelEl)
			if (existing) return existing

			const textEl = req(labelEl, '.text')
			const dotEl = req(labelEl, '.dot')
			const lineEl = labelEl.querySelector('.link line') as SVGLineElement | null
			if (!lineEl) throw new Error('Label missing .link line')

			textEl.style.willChange = 'transform'

			const s = estimateScale(labelEl, dotEl)

			const aV = dotCenterViewport(dotEl)
			const m = measureTextViewport(textEl)

			const halfDiag = Math.hypot(m.w / 2, m.h / 2)
			const minRadius = halfDiag + aV.radius + dotPadding

			const node: Node = {
				id: crypto.randomUUID(),
				ax: aV.x,
				ay: aV.y,
				dotR: aV.radius,
				x: aV.x + minRadius, // start offset a bit so we don't sit on the dot
				y: aV.y,
				w: m.w,
				h: m.h,
				minRadius,
				maxRadius: baseMaxRadius,
				scale: s,
				labelEl,
				textEl,
				dotEl,
				lineEl,
			}

			nodesByLabel.set(labelEl, node)
			return node
		}

		// ---------- Forces (deterministic; no inertia) ----------

		function forceAnchor(strength: number) {
			let ns: Node[] = []
			function force() {
				for (const n of ns) {
					const dx = n.ax - n.x
					const dy = n.ay - n.y
					n.x += dx * strength * 0.12
					n.y += dy * strength * 0.12
				}
			}
			;(force as any).initialize = (newNodes: Node[]) => (ns = newNodes)
			return force as d3.Force<Node, any>
		}

		// Push labels away from cluster center (computed from anchors)
		function forceRadial(strength: number) {
			let ns: Node[] = []
			function force() {
				if (strength === 0 || ns.length === 0) return
				let sx = 0,
					sy = 0
				for (const n of ns) {
					sx += n.ax
					sy += n.ay
				}
				const cx = sx / ns.length
				const cy = sy / ns.length
				for (const n of ns) {
					const dx = n.x - cx
					const dy = n.y - cy
					n.x += dx * strength
					n.y += dy * strength
				}
			}
			;(force as any).initialize = (newNodes: Node[]) => (ns = newNodes)
			return force as d3.Force<Node, any>
		}

		// Keep label center within [minRadius, maxRadius] of its own dot
		function forceClampAnnulus() {
			let ns: Node[] = []
			function force() {
				for (const n of ns) {
					const dx = n.x - n.ax
					const dy = n.y - n.ay
					const d2 = dx * dx + dy * dy

					if (d2 < 1e-8) {
						n.x = n.ax + n.minRadius
						n.y = n.ay
						continue
					}

					const d = Math.sqrt(d2)
					if (d < n.minRadius) {
						const k = n.minRadius / d
						n.x = n.ax + dx * k
						n.y = n.ay + dy * k
					} else if (d > n.maxRadius) {
						const k = n.maxRadius / d
						n.x = n.ax + dx * k
						n.y = n.ay + dy * k
					}
				}
			}
			;(force as any).initialize = (newNodes: Node[]) => (ns = newNodes)
			return force as d3.Force<Node, any>
		}

		// Exact rect-rect collision between labels (viewport px)
		function forceLabelCollide(pad: number) {
			let ns: Node[] = []
			function force() {
				for (let i = 0; i < ns.length; i++) {
					const a = ns[i]
					for (let j = i + 1; j < ns.length; j++) {
						const b = ns[j]

						const dx = b.x - a.x
						const dy = b.y - a.y

						const ax = a.w / 2 + pad
						const ay = a.h / 2 + pad
						const bx = b.w / 2 + pad
						const by = b.h / 2 + pad

						const ox = ax + bx - Math.abs(dx)
						if (ox <= 0) continue

						const oy = ay + by - Math.abs(dy)
						if (oy <= 0) continue

						if (ox < oy) {
							const sx = dx < 0 ? -1 : 1
							const push = ox * 0.5 * sx
							a.x -= push
							b.x += push
						} else {
							const sy = dy < 0 ? -1 : 1
							const push = oy * 0.5 * sy
							a.y -= push
							b.y += push
						}
					}
				}
			}
			;(force as any).initialize = (newNodes: Node[]) => (ns = newNodes)
			return force as d3.Force<Node, any>
		}

		// Prevent any label rect from covering any dot (dots are circular obstacles)
		function forceAvoidDots(pad: number) {
			let ns: Node[] = []
			function force() {
				for (let i = 0; i < ns.length; i++) {
					const a = ns[i]
					const halfW = a.w / 2
					const halfH = a.h / 2

					for (let j = 0; j < ns.length; j++) {
						const d = ns[j]

						const dotX = d.ax
						const dotY = d.ay
						const r = d.dotR + pad

						const dx = dotX - a.x
						const dy = dotY - a.y

						const ox = halfW + r - Math.abs(dx)
						if (ox <= 0) continue

						const oy = halfH + r - Math.abs(dy)
						if (oy <= 0) continue

						// push out along minimal axis
						if (ox < oy) {
							const sx = dx < 0 ? -1 : 1
							a.x -= ox * sx
						} else {
							const sy = dy < 0 ? -1 : 1
							a.y -= oy * sy
						}
					}
				}
			}
			;(force as any).initialize = (newNodes: Node[]) => (ns = newNodes)
			return force as d3.Force<Node, any>
		}

		// Clamp movement per tick (viewport px) to avoid “explosions” in dense scenes
		function forceClampStep(stepPx: number) {
			let ns: Node[] = []
			const prev = new Map<string, { x: number; y: number }>()

			function force() {
				for (const n of ns) {
					const p = prev.get(n.id)
					if (!p) {
						prev.set(n.id, { x: n.x, y: n.y })
						continue
					}
					const dx = n.x - p.x
					const dy = n.y - p.y
					const d = Math.hypot(dx, dy)
					if (d > stepPx && d > 1e-6) {
						const k = stepPx / d
						n.x = p.x + dx * k
						n.y = p.y + dy * k
					}
					p.x = n.x
					p.y = n.y
				}
			}

			;(force as any).initialize = (newNodes: Node[]) => {
				ns = newNodes
				prev.clear()
				for (const n of ns) prev.set(n.id, { x: n.x, y: n.y })
			}

			return force as d3.Force<Node, any>
		}

		const sim = d3
			.forceSimulation<Node>([])
			// We’re using “position nudges”, not velocity integration
			.alphaDecay(0.0)
			.velocityDecay(1.0)
			.force('anchor', forceAnchor(anchorStrength))
			.force('radial', forceRadial(radialStrength))
			.force('labels', forceLabelCollide(labelPadding))
			.force('dots', forceAvoidDots(dotPadding))
			.force('annulus', forceClampAnnulus())
			.force('step', forceClampStep(maxStepPx))
			.stop()

		// ---------- Writeback (scale-aware) ----------
		function writeBack(n: Node) {
			const dxV = n.x - n.ax // viewport px offset
			const dyV = n.y - n.ay

			// Convert viewport offset into local px for this HTML island
			const dLocal = toLocalPx(n, dxV, dyV)

			// Text size in local px
			const wLocal = n.w / n.scale
			const hLocal = n.h / n.scale

			// Your label origin is at the dot (because label is 0x0 and dot is -1/2 translated),
			// so dot local center is ~ (0,0). We use that.
			const tx = dLocal.dx - wLocal / 2
			const ty = dLocal.dy - hLocal / 2

			n.textEl.style.transform = `translate(${tx}px, ${ty}px)`

			// Link is in the same local coordinate space
			n.lineEl.setAttribute('x1', '0')
			n.lineEl.setAttribute('y1', '0')
			n.lineEl.setAttribute('x2', `${dLocal.dx}`)
			n.lineEl.setAttribute('y2', `${dLocal.dy}`)
		}

		/**
		 * Call once per frame, after Drei <HTML> has positioned the DOM.
		 * Pass array of `.label` elements.
		 */
		function step(labelElements: HTMLElement[]) {
			nodes = labelElements.map(ensureNode)

			// Update anchors + sizes + scale each frame
			for (const n of nodes) {
				n.scale = estimateScale(n.labelEl, n.dotEl)

				const aV = dotCenterViewport(n.dotEl)
				n.ax = aV.x
				n.ay = aV.y
				n.dotR = aV.radius

				const m = measureTextViewport(n.textEl)
				n.w = m.w
				n.h = m.h

				const halfDiag = Math.hypot(n.w / 2, n.h / 2)
				n.minRadius = halfDiag + n.dotR + dotPadding
				n.maxRadius = baseMaxRadius

				// If camera jumps far, reset near anchor to avoid huge drags
				const dx = n.x - n.ax
				const dy = n.y - n.ay
				if (dx * dx + dy * dy > n.maxRadius * n.maxRadius * 9) {
					n.x = n.ax + n.minRadius
					n.y = n.ay
				}
			}

			sim.nodes(nodes)

			for (let i = 0; i < ticksPerFrame; i++) sim.tick()

			for (const n of nodes) writeBack(n)
		}

		return { step, simulation: sim }
	}

	const { step } = createLabelLayout({
		labelPadding: 6,
		dotPadding: 6,
		ticksPerFrame: 14,
		anchorStrength: 0.9,
		radialStrength: 0.02,
		maxRadius: 140,
		maxStepPx: 40,
	})

	useTask(() => {
		step(labels.current)
	})
</script>
