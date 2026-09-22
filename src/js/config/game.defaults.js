import { DEFAULT_CONFIG as CORE_DEFAULTS } from '@js/config/defaults.js'

// Game-specific defaults for the slot machine, merged on top of the core shape
// (texts/cta/sound/dev). Structural values tied to the CSS grid (columns/rows per
// breakpoint, icon count) stay hardcoded in index.js — only values that don't
// affect layout are config-driven.
export const DEFAULT_CONFIG = {
	...CORE_DEFAULTS,

	game: {
		balance: 1000.00,
		bet: 1.20,
		betStep: 0.60,
		minBet: 0.60,
		maxBet: 48.00,

		jackpots: {
			grand: 1000.00,
			major: 150.00,
			mini: 30.00
		},

		linesCount: 25,

		spinDuration: 3000,
		turboSpinDuration: 900,

		bigWinDuration: 2000,
		smallWinDuration: 1500,
		ctaDelay: 1500,

		// Scripted spin outcomes, in order. Each entry's `result` is a per-column
		// array of icon numbers (1-12) — the length of `result` must match the
		// game's column/row grid (5x4 desktop, 3x3 mobile), so the icon layout
		// itself is not config-driven, only which numbers/amounts appear.
		spins: {
			desktop: [
				{
					type: 'loss',
					winAmount: 0,
					winLine: null,
					result: [
						[2, 4, 1],
						[3, 5, 2],
						[1, 7, 4],
						[6, 2, 5],
						[4, 1, 3]
					]
				},
				{
					type: 'smallwin',
					winAmount: 50,
					winLine: [1, 1, 1, 1],
					result: [
						[1, 3, 4],
						[7, 3, 8],
						[4, 3, 1],
						[2, 3, 4],
						[5, 6, 7]
					]
				},
				{
					type: 'bigwin',
					winAmount: 150,
					winLine: [1, 1, 2, 2, 2],
					result: [
						[2, 8, 4],
						[5, 8, 2],
						[3, 4, 8],
						[1, 4, 8],
						[5, 3, 8]
					]
				}
			],
			mobile: [
				{
					type: 'loss',
					winAmount: 0,
					winLine: null,
					result: [
						[4, 1, 7],
						[5, 2, 8],
						[7, 4, 3]
					]
				},
				{
					type: 'smallwin',
					winAmount: 50,
					winLine: [1, 1, 1],
					result: [
						[2, 3, 5],
						[7, 3, 2],
						[4, 3, 8]
					]
				},
				{
					type: 'bigwin',
					winAmount: 150,
					winLine: [2, 1, 1],
					result: [
						[1, 5, 8],
						[3, 8, 2],
						[2, 8, 4]
					]
				}
			]
		}
	},

	// actionButton/rotateNotice from CORE_DEFAULTS.texts are dropped — this game
	// has no single action button (spinButtonLabel covers it) and no rotate-to-
	// portrait overlay, so neither field is read anywhere (see docs/config.md,
	// "No dead or hidden fields").
	texts: (({ actionButton, rotateNotice, ...rest }) => ({
		...rest,
		popupTitle: "Congratulations!",
		popupText: "Ready to continue playing?",
		ctaButton: "Download Now",
		spinButtonLabel: "Hold for<br>Turbo Spin"
	}))(CORE_DEFAULTS.texts),

	assets: {
		...CORE_DEFAULTS.assets,
		logo: "logo",
		background: "bg",
		sounds: {
			spin: "spin",
			win: "win",
			select: "select"
		}
	}
}
