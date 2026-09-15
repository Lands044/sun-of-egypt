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
