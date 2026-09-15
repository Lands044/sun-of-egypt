import { imageUrl } from '@js/config/assets.js'

// textContent rather than innerText: these are plain labels, and innerText is
// rendering-dependent (it reads back empty inside a hidden element).
const setText = (selector, value) => {
	const element = document.querySelector(selector)
	if (element && typeof value === 'string') element.textContent = value
}

const setImage = (selector, value, fallbackKey) => {
	const element = document.querySelector(selector)
	if (element) element.src = imageUrl(value, fallbackKey)
}

/**
 * Applies the config to the page: repoints art and rewrites every configurable
 * label. Safe to call repeatedly — this is the function the dev watcher re-runs
 * on every config.json edit and the one place that turns config into DOM.
 *
 * This is the file to rewrite for your actual mechanic — reels, a wheel, cards,
 * whatever. Keep the shape: read from `config`, write to the DOM, nothing else.
 */
export function renderLanding(config) {
	const { game, assets, texts, cta } = config

	setImage('.logo img', assets.logo, 'logo')
	setImage('.actor__default', assets.actor, 'actor')
	setImage('.actor__lose', assets.actorLose, 'actor-lose')

	setText('#action-btn-text', texts.actionButton)
	setText('#multiplier-value', game.multiplier)
	setText('#balance', String(game.rate))
	setText('.popup__title', texts.popupTitle)
	setText('.popup__text', texts.popupText)
	setText('#win-cta', texts.ctaButton)
	setText('.rotate-overlay__content p', texts.rotateNotice)

	const ctaButton = document.getElementById('win-cta')
	if (ctaButton) {
		ctaButton.href = cta.url
		ctaButton.target = cta.target
	}
}
