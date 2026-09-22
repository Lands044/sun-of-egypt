// Game-specific devmenu field groups, concatenated with CORE_FIELDS (texts/CTA/
// sound) in index.js. See src/js/config/devmenu.js in the core kit for the field
// shape ({ path, label, type, min/max/step, hint }).
export const GAME_FIELDS = [
	['Игра', [
		{ path: 'game.rate', label: 'Ставка', type: 'number', min: 0, step: 1 },
		{ path: 'game.multiplier', label: 'Множитель', type: 'text' },
		{ path: 'game.outcomes', label: 'Исходы (win/lose)', type: 'list',
			hint: 'по одному на попытку, по порядку — пусто = победа с первого раза' },
		{ path: 'game.revealTime', label: 'Время показа (мс)', type: 'number', min: 100, step: 50 }
	]]
]

// Pattern for a config value that is an ARRAY OF OBJECTS rather than a flat
// list (e.g. scripted rounds with several fields each — payout amount, result
// grid, timing...). `game.outcomes` above is simple enough for a single `list`
// field, but once each entry needs more than one editable value, generate one
// field group per array index instead: derive the count from DEFAULT_CONFIG so
// the panel always matches however many entries the game actually has, and
// only expose the sub-fields that are safe to free-type (skip anything tied to
// a fixed layout/grid — that stays config.json-only, edited by hand).
//
// Not wired into GAME_FIELDS above (this placeholder's `outcomes` doesn't need
// it) — copy this helper once your `game` block gains a scripted-rounds array
// with per-round objects, à la:
//   game: { rounds: [{ type: 'loss', payout: 0 }, { type: 'win', payout: 50 }] }
//
// import { DEFAULT_CONFIG } from '@js/config/game.defaults.js'
//
// const roundFields = () => DEFAULT_CONFIG.game.rounds.map((round, i) => [
// 	{ path: `game.rounds.${i}.type`, label: `Раунд #${i + 1}: тип`, type: 'text' },
// 	{ path: `game.rounds.${i}.payout`, label: `Раунд #${i + 1}: виплата`, type: 'number', min: 0, step: 1 }
// ]).flat()
//
// export const GAME_FIELDS = [ ...above groups..., ['Раунди', roundFields()] ]
