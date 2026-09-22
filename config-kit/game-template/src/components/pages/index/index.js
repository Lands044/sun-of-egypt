import { loadConfig, watchConfig } from '@js/config/config.js'
import { registerGameConfig } from '@js/config/normalize.js'
import { DEFAULT_CONFIG } from '@js/config/game.defaults.js'
import { soundUrl } from '@js/config/assets.js'
import { renderLanding } from './render.js'
import { GAME_FIELDS } from './devmenu.fields.js'

// Wire the game's own normalizeConfig() hook in before loadConfig() runs.
registerGameConfig()

// PLACEHOLDER GAME — "click to reveal a win or a loss".
//
// This class exists to show the pattern (config in, DOM out, teardown-safe timers
// and listeners, mount/destroy for live config reloads) — replace the actual game
// logic with your mechanic and keep the surrounding lifecycle.
class Game {
	constructor(config) {
		this.config = config

		this.actor = document.getElementById('actor')
		this.spinButton = document.getElementById('go-btn')
		this.cashButton = document.getElementById('cash-btn')
		this.popup = document.getElementById('popup')
		this.controls = document.getElementById('game-controls')
		this.balance = document.getElementById('balance')
		this.multiplierElement = document.getElementById('multiplier-element')

		this.clickSound = this.createSound('click')
		this.revealSound = this.createSound('reveal')
		this.winSound = this.createSound('win')
		this.loseSound = this.createSound('lose')

		this.rate = config.game.rate
		this.multiplier = config.game.multiplier
		this.outcomes = config.game.outcomes
		this.attempt = 1

		// Tracked so a config-driven re-render can cancel work that is still queued.
		this.timers = new Set()
		this.listeners = []
	}

	createSound(key) {
		const audio = new Audio(soundUrl(this.config.assets.sounds[key], DEFAULT_CONFIG.assets.sounds[key]))
		audio.volume = this.config.sound.volume
		return audio
	}

	delay(callback, time) {
		const id = setTimeout(() => {
			this.timers.delete(id)
			callback()
		}, time)
		this.timers.add(id)
		return id
	}

	on(target, event, handler) {
		target.addEventListener(event, handler)
		this.listeners.push([target, event, handler])
	}

	initGame() {
		this.on(this.spinButton, 'click', () => this.play())
		this.on(this.cashButton, 'click', () => this.handleCashOut())
	}

	destroy() {
		this.timers.forEach(id => clearTimeout(id))
		this.timers.clear()
		this.listeners.forEach(([target, event, handler]) => target.removeEventListener(event, handler))
		this.listeners = []
	}

	getOutcome() {
		// Runs out -> always win, same rationale as chicken-road's `crashes` list.
		return this.outcomes[this.attempt - 1] !== false
	}

	play() {
		this.playSound(this.clickSound)
		this.disableControls(this.config.game.revealTime)

		const willWin = this.getOutcome()

		this.delay(() => {
			this.playSound(this.revealSound)
			if (willWin) this.handleWin()
			else this.handleFail()
		}, this.config.game.revealTime)
	}

	handleWin() {
		this.updateBalance(true)
		this.showModal()
		this.playSound(this.winSound)
		this.disableControls(this.config.game.winLockTime)
	}

	handleCashOut() {
		this.showModal()
		this.disableControls(this.config.game.winLockTime)
	}

	handleFail() {
		this.actor.classList.add('is--lose')
		this.playSound(this.loseSound)

		this.delay(() => {
			this.resetGame()
		}, this.config.game.failResetTime)
	}

	resetGame() {
		this.attempt += 1
		this.actor.classList.remove('is--lose')
		this.updateBalance(false)
	}

	updateBalance(won) {
		this.balance.textContent = won ? (this.rate * Number(this.multiplier)).toFixed(2) : '0'
	}

	showModal() {
		document.body.classList.add('is--modal-open')
		this.popup.classList.add('show')
	}

	playSound(audio) {
		if (!this.config.sound.enabled) return
		audio.currentTime = 0
		audio.play().catch(err => console.error('Audio playback error: ', err))
	}

	disableControls(time) {
		this.spinButton.setAttribute('disabled', '')
		if (time) {
			this.delay(() => this.spinButton.removeAttribute('disabled'), time)
		}
	}
}

function setupRedirectHandler(config) {
	const button = document.getElementById('win-cta')
	if (!button) return

	const handler = (e) => {
		e.preventDefault()
		e.stopPropagation()
		if (config.cta.target === '_blank') {
			window.open(config.cta.url, '_blank', 'noopener')
		} else {
			window.location.href = config.cta.url
		}
	}

	button.addEventListener('click', handler)
	return () => button.removeEventListener('click', handler)
}

// Keep the landing in one fixed form: no zooming, no scrolling. See docs/config.md
// ("One fixed form") for why — carried over unchanged from chicken-road.
document.addEventListener('touchstart', (e) => {
	if (e.touches.length > 1) e.preventDefault()
}, { passive: false })

document.addEventListener('gesturestart', (e) => {
	e.preventDefault()
}, { passive: false })

let lastTouchEnd = 0
document.addEventListener('touchend', (e) => {
	const now = Date.now()
	if (now - lastTouchEnd < 300) e.preventDefault()
	lastTouchEnd = now
}, { passive: false })

document.addEventListener('wheel', (e) => {
	if (e.ctrlKey || e.metaKey) e.preventDefault()
}, { passive: false })

document.addEventListener('scroll', () => {
	if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
}, { passive: true })

let game = null
let disposeRedirect = null

// Renders the landing for a given config. Called once on load, and again on every
// config change so an edit takes effect without a rebuild or a page reload.
function mount(config) {
	game?.destroy()
	disposeRedirect?.()

	document.body.classList.remove('is--modal-open')
	document.getElementById('popup')?.classList.remove('show')

	renderLanding(config)
	game = new Game(config)
	game.initGame()
	disposeRedirect = setupRedirectHandler(config)

	return game
}

let devMenu = null

document.addEventListener('DOMContentLoaded', async () => {
	const config = await loadConfig()
	mount(config)

	// Editing public/config.json re-renders the landing in place — no build step,
	// no page reload.
	watchConfig(config, next => {
		mount(next)
		devMenu?.sync(next)
	})

	// Config editor panel — ships in production too (config.dev.menu controls it).
	// In dev it writes straight to public/config.json; in a built preview/
	// production it falls back to this browser's localStorage instead (see
	// docs/config.md, "The config menu" — production mode). Set this back to
	// `import.meta.env.DEV && config.dev.menu` to make it dev-only again.
	if (config.dev.menu) {
		const { initDevMenu, CORE_FIELDS } = await import('@js/config/devmenu.js')
		devMenu = await initDevMenu(config, next => mount(next), {
			fields: [...GAME_FIELDS, ...CORE_FIELDS],
			title: 'НАСТРОЙКИ'
		})
	}
})
