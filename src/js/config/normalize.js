import { setGameNormalizer, toNumber, clampInt } from '@js/config/config.js'
import { DEFAULT_CONFIG } from './game.defaults.js'

// Validates a single scripted spin entry, falling back to the matching default
// entry (by index) when a field is missing or malformed — a partial config.json
// edit (e.g. only tweaking winAmount) should not corrupt the result grid.
function normalizeSpin(spin, fallback) {
	if (typeof spin !== 'object' || spin === null) return fallback

	const type = ['loss', 'smallwin', 'bigwin'].includes(spin.type) ? spin.type : fallback.type
	const winAmount = toNumber(spin.winAmount, fallback.winAmount)
	const winLine = Array.isArray(spin.winLine) ? spin.winLine : fallback.winLine
	const result = Array.isArray(spin.result) && spin.result.length === fallback.result.length
		? spin.result
		: fallback.result

	return { type, winAmount, winLine, result }
}

function normalizeSpinList(list, fallbackList) {
	if (!Array.isArray(list) || list.length === 0) return fallbackList
	return list.map((spin, i) => normalizeSpin(spin, fallbackList[i % fallbackList.length]))
}

function normalizeGameConfig(config) {
	const game = config.game
	const defaults = DEFAULT_CONFIG.game

	game.balance = toNumber(game.balance, defaults.balance)
	game.bet = toNumber(game.bet, defaults.bet)
	game.betStep = toNumber(game.betStep, defaults.betStep)
	game.minBet = toNumber(game.minBet, defaults.minBet)
	game.maxBet = toNumber(game.maxBet, defaults.maxBet)

	game.jackpots = {
		grand: toNumber(game.jackpots?.grand, defaults.jackpots.grand),
		major: toNumber(game.jackpots?.major, defaults.jackpots.major),
		mini: toNumber(game.jackpots?.mini, defaults.jackpots.mini)
	}

	game.linesCount = clampInt(game.linesCount, defaults.linesCount, 1, 100)

	game.spinDuration = clampInt(game.spinDuration, defaults.spinDuration, 200, 20000)
	game.turboSpinDuration = clampInt(game.turboSpinDuration, defaults.turboSpinDuration, 100, 20000)

	game.bigWinDuration = clampInt(game.bigWinDuration, defaults.bigWinDuration, 200, 20000)
	game.smallWinDuration = clampInt(game.smallWinDuration, defaults.smallWinDuration, 200, 20000)
	game.ctaDelay = clampInt(game.ctaDelay, defaults.ctaDelay, 0, 20000)

	game.spins = {
		desktop: normalizeSpinList(game.spins?.desktop, defaults.spins.desktop),
		mobile: normalizeSpinList(game.spins?.mobile, defaults.spins.mobile)
	}

	return config
}

export function registerGameConfig() {
	setGameNormalizer(normalizeGameConfig)
}
