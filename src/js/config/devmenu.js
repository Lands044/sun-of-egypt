import { mergeConfig, normalizeConfig, saveConfig, saveLocalConfig, loadLocalConfig, clearLocalConfig, CONFIG_URL } from './config.js'

// Config editor panel, game-agnostic. Whether it ships in a production build is
// the game's own call (see index.js: `config.dev.menu` gates it — the game
// decides whether that stays true in the built config.json, or set it to
// `import.meta.env.DEV && config.dev.menu` to keep it dev-only again).
//
// Two save modes, picked automatically by whether a dev server is behind the
// page:
// - dev (import.meta.env.DEV): every edit is written straight back to
//   public/config.json through the dev-only /__config endpoint, so a refresh
//   picks up exactly what you last had, on every device that loads the page.
// - production (a static build, no write endpoint behind it): every edit is
//   written to this browser's localStorage instead. It survives a refresh on
//   this device only — public/config.json on the server never changes, and
//   nobody else sees the edit. "Download" exports the edited config.json to
//   deploy it for real.
//
// FIELDS is generic (texts/CTA/sound). A game adds its own groups — see
// game-template/src/components/pages/index/devmenu.fields.js — and passes the
// combined list in through initDevMenu(config, onApply, { fields }).

const CSS = `
.devmenu {
	position: fixed;
	top: 12px;
	right: 12px;
	z-index: 99999;
	width: 320px;
	max-height: calc(100vh - 24px);
	display: flex;
	flex-direction: column;
	font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
	color: #e8e8ea;
	background: rgba(24, 24, 28, 0.94);
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 10px;
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
	backdrop-filter: blur(8px);
}
.devmenu__head {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 12px;
	cursor: pointer;
	user-select: none;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.devmenu__title { flex: 1; font-weight: 700; letter-spacing: 0.04em; }
.devmenu__badge {
	font-size: 10px;
	padding: 2px 6px;
	border-radius: 99px;
	background: #3a6df0;
	color: #fff;
}
.devmenu__body { overflow-y: auto; padding: 4px 12px 12px; }
.devmenu.is--collapsed .devmenu__body,
.devmenu.is--collapsed .devmenu__foot { display: none; }
.devmenu__group { margin-top: 12px; }
.devmenu__group > legend,
.devmenu__legend {
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: #8f8f9c;
	margin-bottom: 6px;
}
.devmenu__row {
	display: grid;
	grid-template-columns: 1fr 150px;
	align-items: center;
	gap: 8px;
	margin-bottom: 6px;
}
.devmenu__row label { color: #c9c9d4; overflow-wrap: anywhere; }
.devmenu__row input[type="text"],
.devmenu__row input[type="number"] {
	width: 100%;
	padding: 5px 7px;
	font: inherit;
	color: #fff;
	background: rgba(255, 255, 255, 0.07);
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 5px;
}
.devmenu__row input:focus { outline: 1px solid #3a6df0; }
.devmenu__row input[type="checkbox"] { justify-self: start; width: 16px; height: 16px; }
.devmenu__row input[type="range"] { width: 100%; }
.devmenu__hint { color: #74748a; font-size: 10px; margin: 8px 0 0; }
.devmenu__fieldhint { color: #74748a; font-size: 10px; margin: -2px 0 8px; line-height: 1.3; }
.devmenu__status { font-size: 10px; margin: 4px 0 0; color: #8f8f9c; }
.devmenu__status[data-tone="ok"] { color: #56c271; }
.devmenu__status[data-tone="error"] { color: #f0736a; }
.devmenu__foot {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	padding: 10px 12px;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.devmenu__foot button {
	flex: 1 1 auto;
	padding: 6px 8px;
	font: inherit;
	color: #e8e8ea;
	background: rgba(255, 255, 255, 0.09);
	border: 1px solid rgba(255, 255, 255, 0.16);
	border-radius: 5px;
	cursor: pointer;
}
.devmenu__foot button:hover { background: rgba(255, 255, 255, 0.16); }
.devmenu__foot button.is--primary { background: #3a6df0; border-color: #3a6df0; color: #fff; }
`

// Generic groups every landing has regardless of mechanic. A game's own field
// list (see devmenu.fields.js in game-template) is concatenated with this one.
export const CORE_FIELDS = [
	['Тексти', [
		{ path: 'texts.actionButton', label: 'Кнопка дії', type: 'text' },
		{ path: 'texts.popupTitle', label: 'Заголовок вікна', type: 'text' },
		{ path: 'texts.popupText', label: 'Текст вікна', type: 'text' },
		{ path: 'texts.ctaButton', label: 'Кнопка CTA', type: 'text' },
		{ path: 'cta.url', label: 'Посилання CTA', type: 'text' }
	]],
	['Звук', [
		{ path: 'sound.enabled', label: 'Увімкнено', type: 'checkbox' },
		{ path: 'sound.volume', label: 'Гучність', type: 'range', min: 0, max: 1, step: 0.05 }
	]]
]

// Each field maps a config path to an input. `get` reads the value out of the
// config for display, `set` writes the raw input value back into a patch object.
const getPath = (object, path) => path.split('.').reduce((acc, key) => acc?.[key], object)

const setPath = (object, path, value) => {
	const keys = path.split('.')
	const last = keys.pop()
	const target = keys.reduce((acc, key) => (acc[key] ??= {}), object)
	target[last] = value
}

function readInput(field, input) {
	switch (field.type) {
		case 'checkbox': return input.checked
		case 'number':
		case 'range': {
			// undefined leaves the stored value alone (mergeConfig skips it). Without
			// this an empty field reads as 0, and since edits are saved immediately,
			// clearing a box to retype it would persist the clamped minimum.
			const value = Number(input.value)
			return input.value.trim() === '' || !Number.isFinite(value) ? undefined : value
		}
		case 'list': return input.value.split(',').map(item => item.trim()).filter(Boolean)
		default: return input.value
	}
}

const writeInput = (field, input, value) => {
	if (field.type === 'checkbox') input.checked = Boolean(value)
	else if (field.type === 'list') input.value = (value || []).join(', ')
	else input.value = value ?? ''
}

/**
 * @param initialConfig  the normalized config to seed the panel with
 * @param onApply        called with the new normalized config on every edit
 * @param fields         array of [legend, fieldDefs] groups. Defaults to
 *                       CORE_FIELDS alone; a game should pass
 *                       [...GAME_FIELDS, ...CORE_FIELDS].
 * @param title          panel title, e.g. the game's name
 */
export async function initDevMenu(initialConfig, onApply, { fields = CORE_FIELDS, title = 'НАЛАШТУВАННЯ' } = {}) {
	let config = initialConfig
	const inputs = new Map()
	// import.meta.env.DEV is replaced at build time, so this branch is resolved
	// once and for all when the game bundles the panel into a production build.
	const isDevServer = import.meta.env.DEV

	// The file as written, not the normalized config: saving this back preserves
	// the $comment documentation and any keys the panel does not manage. In
	// production this browser's own local edits (if any) take precedence — same
	// source loadConfig() itself reads from, so the panel and the page agree.
	let raw
	if (!isDevServer) {
		raw = loadLocalConfig()
	}
	if (!raw) {
		try {
			raw = await (await fetch(CONFIG_URL, { cache: 'no-store' })).json()
		} catch {
			raw = structuredClone(config)
		}
	}

	const style = document.createElement('style')
	style.textContent = CSS
	document.head.appendChild(style)

	const panel = document.createElement('div')
	panel.className = 'devmenu'
	// Collapsed state survives the reloads you get while tweaking the config.
	if (localStorage.getItem('devmenu:collapsed') === '1') panel.classList.add('is--collapsed')

	const head = document.createElement('div')
	head.className = 'devmenu__head'
	const badgeLabel = isDevServer ? 'dev' : 'prod'
	head.innerHTML = `<span class="devmenu__title">${title}</span><span class="devmenu__badge">${badgeLabel}</span><span>▾</span>`
	head.addEventListener('click', () => {
		panel.classList.toggle('is--collapsed')
		localStorage.setItem('devmenu:collapsed', panel.classList.contains('is--collapsed') ? '1' : '0')
	})

	const body = document.createElement('div')
	body.className = 'devmenu__body'

	let saveTimer = null
	let status = null

	const setStatus = (text, tone) => {
		if (!status) return
		status.textContent = text
		status.dataset.tone = tone || ''
	}

	// Debounced so dragging the volume slider writes once, not sixty times.
	const scheduleSave = () => {
		setStatus('збереження…')
		clearTimeout(saveTimer)
		saveTimer = setTimeout(async () => {
			// On a static build there is no server to write public/config.json —
			// fall back to this browser's own localStorage instead, so the edit at
			// least survives a refresh on this device. "Download" is how the change
			// gets onto the actual deployed file.
			const result = isDevServer ? await saveConfig(raw) : saveLocalConfig(raw)
			if (result.ok) {
				const label = isDevServer ? 'збережено' : 'збережено локально (лише цей браузер)'
				setStatus(`${label} ${new Date().toLocaleTimeString()}`, 'ok')
			} else {
				// No dev server behind the page and localStorage unavailable — the
				// panel still works, the change just cannot be persisted anywhere.
				setStatus(`не збережено: ${result.error}`, 'error')
			}
		}, 300)
	}

	const apply = () => {
		const patch = {}
		for (const [field, input] of inputs) setPath(patch, field.path, readInput(field, input))
		raw = mergeConfig(raw, patch)
		config = normalizeConfig(raw)
		// normalizeConfig may have padded, trimmed or clamped values, so mirror the
		// result back into the inputs.
		sync(config)
		onApply(config)
		scheduleSave()
	}

	for (const [legend, groupFields] of fields) {
		const group = document.createElement('div')
		group.className = 'devmenu__group'

		const title = document.createElement('div')
		title.className = 'devmenu__legend'
		title.textContent = legend
		group.appendChild(title)

		for (const field of groupFields) {
			const row = document.createElement('div')
			row.className = 'devmenu__row'

			const label = document.createElement('label')
			label.textContent = field.label

			const input = document.createElement('input')
			input.type = field.type === 'list' ? 'text' : field.type
			if (field.min !== undefined) input.min = field.min
			if (field.max !== undefined) input.max = field.max
			// A limit computed at normalize time rather than baked into the field def.
			if (field.maxPath) input.max = getPath(config, field.maxPath)
			if (field.step !== undefined) input.step = field.step
			writeInput(field, input, getPath(config, field.path))
			input.addEventListener('change', apply)

			label.htmlFor = input.id = `devmenu-${field.path.replace(/\./g, '-')}`
			inputs.set(field, input)
			row.append(label, input)
			group.appendChild(row)

			if (field.hint) {
				const note = document.createElement('p')
				note.className = 'devmenu__fieldhint'
				note.textContent = field.hint
				group.appendChild(note)
			}
		}

		body.appendChild(group)
	}

	const hint = document.createElement('p')
	hint.className = 'devmenu__hint'
	hint.textContent = isDevServer
		? 'Зміни одразу зберігаються в public/config.json.'
		: 'Зміни зберігаються лише в цьому браузері (localStorage). Щоб опублікувати їх на сайті — натисніть "Скачати" і замініть config.json на хостингу.'
	body.appendChild(hint)

	status = document.createElement('p')
	status.className = 'devmenu__status'
	status.textContent = 'очікування'
	body.appendChild(status)

	const foot = document.createElement('div')
	foot.className = 'devmenu__foot'

	const button = (text, primary, handler) => {
		const element = document.createElement('button')
		element.type = 'button'
		element.textContent = text
		if (primary) element.className = 'is--primary'
		element.addEventListener('click', handler)
		foot.appendChild(element)
		return element
	}

	// Everything applies on change already; this just replays the current state,
	// which is handy for re-running the intro after a win.
	button('Перезапуск', true, () => onApply(config))

	// Export the file as written, comments and all.
	const exportable = () => JSON.stringify(raw, null, '\t')

	button('Скачати', false, () => {
		const url = URL.createObjectURL(new Blob([exportable()], { type: 'application/json' }))
		const link = document.createElement('a')
		link.href = url
		link.download = 'config.json'
		link.click()
		URL.revokeObjectURL(url)
	})

	// Only meaningful in production: undoes this browser's local edits and goes
	// back to whatever public/config.json actually has on the server. In dev,
	// raw already IS public/config.json (every edit writes straight to it), so
	// there is nothing local to discard.
	if (!isDevServer) {
		button('Скинути локальні зміни', false, async () => {
			clearLocalConfig()
			try {
				raw = await (await fetch(CONFIG_URL, { cache: 'no-store' })).json()
			} catch {
				raw = structuredClone(config)
			}
			config = normalizeConfig(raw)
			sync(config)
			onApply(config)
			setStatus('локальні зміни скинуто', 'ok')
		})
	}

	panel.append(head, body, foot)
	document.body.appendChild(panel)

	function sync(next) {
		config = next
		for (const [field, input] of inputs) {
			if (field.maxPath) input.max = getPath(config, field.maxPath)
			writeInput(field, input, getPath(config, field.path))
		}
	}

	return { sync }
}
