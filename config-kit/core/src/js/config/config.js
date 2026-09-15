import { DEFAULT_CONFIG } from './defaults.js'

// Resolved relative to <base>, so the landing keeps working when it is deployed
// into a subfolder or embedded in the PWA shell.
export const CONFIG_URL = new URL('config.json', document.baseURI).href

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

// Deep merge where objects merge key-by-key and arrays are replaced wholesale —
// a config that lists 4 entries means 4, not "the first 4 of the defaults".
export function mergeConfig(base, patch) {
	if (!isPlainObject(patch)) return structuredClone(base)

	const out = structuredClone(base)
	for (const [key, value] of Object.entries(patch)) {
		if (key.startsWith('$')) continue
		if (isPlainObject(value) && isPlainObject(out[key])) {
			out[key] = mergeConfig(out[key], value)
		} else if (value !== undefined) {
			out[key] = structuredClone(value)
		}
	}
	return out
}

export const toNumber = (value, fallback) => {
	const n = Number(value)
	return Number.isFinite(n) ? n : fallback
}

export const clampInt = (value, fallback, min, max) => {
	const n = Math.round(toNumber(value, fallback))
	return Math.min(max, Math.max(min, n))
}

/**
 * Game-specific validation/clamping hook. Assign your own function here (from
 * the game's own module, at import time) to run after the generic merge — e.g.
 * clamp step counts, fit multiplier lists to a step count, resolve a computed
 * max from layout geometry. Left as an identity function so the core kit has
 * no game-shaped assumptions baked in.
 *
 * Example, in the game's own config module:
 *   import { setGameNormalizer } from '@js/config/config.js'
 *   setGameNormalizer((config) => { ...mutate and return config... })
 */
let normalizeGameConfig = (config) => config
export const setGameNormalizer = (fn) => { normalizeGameConfig = fn }

export function normalizeConfig(input) {
	const config = mergeConfig(DEFAULT_CONFIG, input)

	config.sound.volume = Math.min(1, Math.max(0, toNumber(config.sound.volume, 1)))
	config.sound.enabled = config.sound.enabled !== false

	return normalizeGameConfig(config)
}

async function fetchConfig(url) {
	// cache: 'no-store' so an edited config.json is picked up on the next load
	// instead of being served from the HTTP cache.
	const response = await fetch(url, { cache: 'no-store' })
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
	return response.json()
}

/**
 * Resolves the config for this page load.
 *
 * Priority: window.<INJECT_GLOBAL> (injected by a PWA host)
 *        -> ?config=<url> (per-link override)
 *        -> public/config.json
 *        -> built-in defaults
 */
export async function loadConfig({ injectGlobal = 'LANDING_CONFIG' } = {}) {
	const injected = window[injectGlobal]
	if (isPlainObject(injected)) return normalizeConfig(injected)

	const override = new URLSearchParams(window.location.search).get('config')
	const url = override ? new URL(override, document.baseURI).href : CONFIG_URL

	try {
		return normalizeConfig(await fetchConfig(url))
	} catch (error) {
		console.warn(`[config] falling back to defaults, could not load ${url}:`, error.message)
		return normalizeConfig({})
	}
}

// The last content the watcher knows about. Kept at module scope so a save made
// from inside the page can move the baseline forward: without that, the watcher
// would see its own write as an external change and remount the landing again.
let watchBaseline = null

/**
 * Writes the config back to public/config.json through the dev-only endpoint, so
 * an edit survives a refresh instead of living only in memory.
 *
 * Returns { ok, error }. Fails cleanly when there is no dev server behind the
 * page (a built preview), where the file is not writable anyway.
 */
export async function saveConfig(raw) {
	const body = JSON.stringify(raw)

	try {
		const response = await fetch(new URL('__config', document.baseURI).href, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body
		})
		const result = await response.json().catch(() => ({}))
		if (!response.ok || !result.ok) throw new Error(result.error || `${response.status} ${response.statusText}`)

		// The file now holds exactly what we sent, so treat that as seen.
		watchBaseline = body
		return { ok: true }
	} catch (error) {
		return { ok: false, error: error.message }
	}
}

/**
 * Polls config.json and calls back with the new config whenever the file changes,
 * so editing it re-renders the landing with no build step and no page reload.
 * Returns a stop function.
 */
export function watchConfig(config, onChange, { injectGlobal = 'LANDING_CONFIG' } = {}) {
	if (!config.dev.watch || window[injectGlobal]) return () => {}

	let stopped = false

	const tick = async () => {
		try {
			const raw = await fetchConfig(CONFIG_URL)
			const serialized = JSON.stringify(raw)
			if (watchBaseline !== null && serialized !== watchBaseline) onChange(normalizeConfig(raw))
			watchBaseline = serialized
		} catch {
			// A transient read error (file mid-write, dev server restarting) is not
			// worth reporting — the next tick will pick the config back up.
		}
	}

	tick()
	const timer = setInterval(() => {
		if (!stopped) tick()
	}, config.dev.watchInterval)

	return () => {
		stopped = true
		clearInterval(timer)
	}
}
