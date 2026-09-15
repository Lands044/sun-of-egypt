// Built-in art and audio, bundled by Vite. The runtime config refers to these by
// key ("logo", "coin-1"), or bypasses the registry entirely with a URL
// ("/img/my-art.png") pointing at a file dropped into the public folder.
//
// Game-agnostic: it just globs whatever is under src/assets/img and
// src/assets/sound, so a new game only needs to drop files in those folders and
// reference them by filename (without extension) from config.json.
const images = import.meta.glob('../../assets/img/*.{webp,png,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' })
const sounds = import.meta.glob('../../assets/sound/*.{mp3,ogg,wav}', { eager: true, query: '?url', import: 'default' })

const byName = (modules) => Object.fromEntries(
	Object.entries(modules).map(([path, url]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), url])
)

export const IMAGES = byName(images)
export const SOUNDS = byName(sounds)

const isUrl = (value) => /^(https?:)?\/\/|^[./]/.test(value)

function resolve(registry, value, fallbackKey) {
	if (typeof value === 'string' && value !== '') {
		if (isUrl(value)) return value
		if (registry[value]) return registry[value]
		console.warn(`[assets] unknown key "${value}", falling back to "${fallbackKey}"`)
	}
	return registry[fallbackKey] || ''
}

export const imageUrl = (value, fallbackKey) => resolve(IMAGES, value, fallbackKey)
export const soundUrl = (value, fallbackKey) => resolve(SOUNDS, value, fallbackKey)
