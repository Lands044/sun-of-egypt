import { DEFAULT_CONFIG } from '@js/config/game.defaults.js'

// Game-specific devmenu field groups, concatenated with CORE_FIELDS (texts/CTA/
// sound) in index.js. See src/js/config/devmenu.js in the core kit for the field
// shape ({ path, label, type, min/max/step, hint }).
//
// Only type/winAmount are editable here — result/winLine are per-column icon
// grids tied to the fixed desktop/mobile layouts (CSS-dependent), so they stay
// config.json-only. Field count is derived from DEFAULT_CONFIG.game.spins so the
// panel always matches the number of scripted spins.
const spinFields = (breakpoint, label) => DEFAULT_CONFIG.game.spins[breakpoint].map((spin, i) => [
	{ path: `game.spins.${breakpoint}.${i}.type`, label: `${label} #${i + 1}: тип`, type: 'text',
		hint: i === 0 ? 'loss / smallwin / bigwin' : undefined },
	{ path: `game.spins.${breakpoint}.${i}.winAmount`, label: `${label} #${i + 1}: сума виграшу`, type: 'number', min: 0, step: 1 }
]).flat()

export const GAME_FIELDS = [
	['Ставки', [
		{ path: 'game.balance', label: 'Баланс', type: 'number', min: 0, step: 1 },
		{ path: 'game.bet', label: 'Ставка', type: 'number', min: 0, step: 0.1 },
		{ path: 'game.betStep', label: 'Крок ставки', type: 'number', min: 0.1, step: 0.1 },
		{ path: 'game.minBet', label: 'Мін. ставка', type: 'number', min: 0, step: 0.1 },
		{ path: 'game.maxBet', label: 'Макс. ставка', type: 'number', min: 0, step: 0.1 }
	]],
	['Джекпоти', [
		{ path: 'game.jackpots.grand', label: 'Grand', type: 'number', min: 0, step: 1 },
		{ path: 'game.jackpots.major', label: 'Major', type: 'number', min: 0, step: 1 },
		{ path: 'game.jackpots.mini', label: 'Mini', type: 'number', min: 0, step: 1 }
	]],
	['Лінії', [
		{ path: 'game.linesCount', label: 'Кількість ліній', type: 'number', min: 1, step: 1 }
	]],
	['Тривалості (мс)', [
		{ path: 'game.spinDuration', label: 'Спін (звичайний)', type: 'number', min: 200, step: 100 },
		{ path: 'game.turboSpinDuration', label: 'Спін (турбо)', type: 'number', min: 100, step: 100 },
		{ path: 'game.bigWinDuration', label: 'Показ великого виграшу', type: 'number', min: 200, step: 100 },
		{ path: 'game.smallWinDuration', label: 'Показ малого виграшу', type: 'number', min: 200, step: 100 },
		{ path: 'game.ctaDelay', label: 'Затримка перед CTA', type: 'number', min: 0, step: 100 }
	]],
	['Спіни — Desktop', spinFields('desktop', 'Спін')],
	['Спіни — Mobile', spinFields('mobile', 'Спін')]
]
