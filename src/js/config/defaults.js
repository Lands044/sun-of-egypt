// Built-in fallback config.
// Mirrors public/config.json — used when config.json is missing, unreachable
// or partially filled in. Every key here can be overridden by the runtime file.
//
// This is the CORE shape only: fields every landing needs regardless of game
// mechanics (texts, CTA, sound, dev tooling). Add a `game` block (and any other
// game-specific sections — `layout`, `sectors`, whatever your mechanic needs)
// in the game's own defaults, merged on top of this — see game-template for
// the pattern.
export const DEFAULT_CONFIG = {
	version: 1,

	cta: {
		url: "https://example.com/",
		target: "_self"
	},

	texts: {
		// Keep this generic — a run/spin/roll button, a win popup, a CTA. Add more
		// keys here (or in the game's own defaults) for anything mechanic-specific.
		actionButton: "PLAY",
		popupTitle: "Congratulations!",
		popupText: "Ready to continue playing?",
		ctaButton: "Continue",
		rotateNotice: "Please rotate your device to portrait mode"
	},

	sound: {
		enabled: true,
		volume: 1
	},

	assets: {
		logo: "logo",
		background: "background"
	},

	dev: {
		watch: true,
		watchInterval: 1500,
		menu: true
	}
}
