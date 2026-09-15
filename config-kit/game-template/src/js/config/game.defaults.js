import { DEFAULT_CONFIG as CORE_DEFAULTS } from '@js/config/defaults.js'

// Game-specific defaults, merged on top of the core shape (texts/cta/sound/dev).
// Replace `game` and `assets` below with whatever your mechanic actually needs —
// this is a minimal "click to win" placeholder: one action reveals a result that
// is either a win or a loss, picked from a scripted sequence.
//
// Named game.defaults.js (not defaults.js) deliberately: the core kit already
// installs its own src/js/config/defaults.js at that exact path, so this file
// needs a different name to sit next to it without colliding.
export const DEFAULT_CONFIG = {
	...CORE_DEFAULTS,

	game: {
		// The payout multiplier(s) available. This placeholder only uses one, on
		// win — replace with whatever progression your mechanic needs (steps,
		// reels, wheel segments...).
		multiplier: "2.00",
		rate: 20,
		// Scripted outcomes for successive attempts: true = win, false = lose.
		// Runs out -> next attempt always wins, same rationale as chicken-road's
		// `crashes` list (see docs/config.md in the core kit).
		outcomes: [false],
		revealTime: 700,
		failResetTime: 1500,
		winLockTime: 10000
	},

	assets: {
		...CORE_DEFAULTS.assets,
		actor: "actor",
		actorLose: "actor-lose",
		sounds: {
			click: "click",
			reveal: "reveal",
			win: "win",
			lose: "lose"
		}
	}
}
