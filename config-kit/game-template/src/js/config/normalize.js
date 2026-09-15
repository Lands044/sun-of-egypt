import { setGameNormalizer, toNumber, clampInt } from '@js/config/config.js'
import { DEFAULT_CONFIG } from './game.defaults.js'

// Game-specific validation, registered with the core config module. Import this
// module once (from index.js, before loadConfig() runs) and it wires itself in —
// see registerGameConfig() below.
function normalizeGameConfig(config) {
	config.game.rate = toNumber(config.game.rate, DEFAULT_CONFIG.game.rate)
	config.game.revealTime = clampInt(config.game.revealTime, DEFAULT_CONFIG.game.revealTime, 100, 5000)
	config.game.failResetTime = clampInt(config.game.failResetTime, DEFAULT_CONFIG.game.failResetTime, 200, 20000)
	config.game.winLockTime = clampInt(config.game.winLockTime, DEFAULT_CONFIG.game.winLockTime, 0, 120000)

	const multiplier = toNumber(config.game.multiplier, toNumber(DEFAULT_CONFIG.game.multiplier, 1))
	config.game.multiplier = multiplier > 0 ? String(multiplier) : DEFAULT_CONFIG.game.multiplier

	config.game.outcomes = (Array.isArray(config.game.outcomes) ? config.game.outcomes : [])
		.map(item => item === true || item === 'true' || item === 'win')

	return config
}

export function registerGameConfig() {
	setGameNormalizer(normalizeGameConfig)
}
