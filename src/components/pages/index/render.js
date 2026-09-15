import { imageUrl } from '@js/config/assets.js'

const setText = (selector, value) => {
	const element = document.querySelector(selector)
	if (element && typeof value === 'string') element.textContent = value
}

const setHtml = (selector, value) => {
	const element = document.querySelector(selector)
	if (element && typeof value === 'string') element.innerHTML = value
}

const setImage = (selector, value, fallbackKey) => {
	const element = document.querySelector(selector)
	if (element) element.src = imageUrl(value, fallbackKey)
}

const setBackground = (selector, value, fallbackKey) => {
	const element = document.querySelector(selector)
	if (element) element.style.backgroundImage = `url('${imageUrl(value, fallbackKey)}')`
}

/**
 * Applies the parts of the config that are static DOM (art, labels, popup, CTA,
 * jackpots, lines badge). Anything tied to game state (balance, bet, spin
 * results) is read directly from `config` by the SlotMachine class in index.js,
 * since it drives its own re-renders on spin/bet-change.
 *
 * Safe to call repeatedly — this is the function the dev watcher re-runs on every
 * config.json edit.
 */
export function renderLanding(config) {
	const { texts, cta, assets, game } = config

	setImage('.game__logo img', assets.logo, 'logo')
	setBackground('.page', assets.background, 'background')

	setHtml('.game__button-spin-label', texts.spinButtonLabel)
	setText('.popup__title', texts.popupTitle)
	setText('.popup__text', texts.popupText)
	setText('.cta-button', texts.ctaButton)

	const ctaButton = document.querySelector('.cta-button')
	if (ctaButton) {
		ctaButton.href = cta.url
		ctaButton.target = cta.target
	}

	setText('.jackpots__item--grand .jackpots__value', game.jackpots.grand.toFixed(2))
	setText('.jackpots__item--major .jackpots__value', game.jackpots.major.toFixed(2))
	setText('.jackpots__item--mini .jackpots__value', game.jackpots.mini.toFixed(2))

	setText('.lines-badge__num', String(game.linesCount))
	const linesItem = document.querySelector('.lines__item')
	if (linesItem) linesItem.dataset.value = String(game.linesCount)
}
