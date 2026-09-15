import { mergeConfig, normalizeConfig, saveConfig, CONFIG_URL } from './config.js'

// Dev-only config editor, game-agnostic.
//
// This module is only ever reached from an `import.meta.env.DEV` branch, so it is
// dropped from production builds entirely — nothing here ships in dist/. Its CSS
// is injected as a string for the same reason: a .scss import would be pulled
// into the production stylesheet.
//
// Every edit is written straight back to public/config.json through a dev-only
// endpoint, so the file is always the current state and a refresh picks up
// exactly what you last had. "Download" is still there for grabbing a copy.
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
		{ path: 'texts.popupTitle', label: 'Заголовок окна', type: 'text' },
		{ path: 'texts.popupText', label: 'Текст окна', type: 'text' },
		{ path: 'texts.ctaButton', label: 'Кнопка CTA', type: 'text' },
		{ path: 'cta.url', label: 'Ссылка CTA', type: 'text' }
	]],
	['Звук', [
		{ path: 'sound.enabled', label: 'Включён', type: 'checkbox' },
		{ path: 'sound.volume', label: 'Громкость', type: 'range', min: 0, max: 1, step: 0.05 }
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
export async function initDevMenu(initialConfig, onApply, { fields = CORE_FIELDS, title = 'НАСТРОЙКИ' } = {}) {
	let config = initialConfig
	const inputs = new Map()

	// The file as written, not the normalized config: saving this back preserves
	// the $comment documentation and any keys the panel does not manage.
	let raw
	try {
		raw = await (await fetch(CONFIG_URL, { cache: 'no-store' })).json()
	} catch {
		raw = structuredClone(config)
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
	head.innerHTML = `<span class="devmenu__title">${title}</span><span class="devmenu__badge">dev</span><span>▾</span>`
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
		setStatus('сохранение…')
		clearTimeout(saveTimer)
		saveTimer = setTimeout(async () => {
			const result = await saveConfig(raw)
			if (result.ok) {
				setStatus(`сохранено ${new Date().toLocaleTimeString()}`, 'ok')
			} else {
				// No dev server behind the page (a built preview) — the panel still
				// works, the change just cannot be persisted from here.
				setStatus(`не сохранено: ${result.error}`, 'error')
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
	hint.textContent = 'Изменения сразу сохраняются в public/config.json.'
	body.appendChild(hint)

	status = document.createElement('p')
	status.className = 'devmenu__status'
	status.textContent = 'ожидание'
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

	button('Загрузить из файла', false, async () => {
		const response = await fetch(CONFIG_URL, { cache: 'no-store' })
		raw = await response.json()
		config = normalizeConfig(raw)
		sync(config)
		onApply(config)
		setStatus('загружено из файла', 'ok')
	})

	// Export the file as written, comments and all.
	const exportable = () => JSON.stringify(raw, null, '\t')

	button('Копировать', false, async (event) => {
		await navigator.clipboard.writeText(exportable())
		event.target.textContent = 'Скопировано'
		setTimeout(() => { event.target.textContent = 'Копировать' }, 1200)
	})

	button('Скачать', false, () => {
		const url = URL.createObjectURL(new Blob([exportable()], { type: 'application/json' }))
		const link = document.createElement('a')
		link.href = url
		link.download = 'config.json'
		link.click()
		URL.revokeObjectURL(url)
	})

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
