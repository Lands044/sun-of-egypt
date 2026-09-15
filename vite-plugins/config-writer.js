import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Dev-only endpoint that writes public/config.json.
 *
 * The config editor is a tool for authoring that file, so an edit has to land in
 * the file itself — that is what makes it survive a refresh and what you end up
 * shipping. Anything else (localStorage, a memory-only patch) would drift from
 * the source of truth the landing reads.
 *
 * Serve-only: it never exists in a build, and the built site has no such route.
 * Game-agnostic — works unchanged for any landing built on this kit.
 */
export default function configWriter({ publicDir, fileName = 'config.json' } = {}) {
	const target = path.join(publicDir, fileName)

	return {
		name: 'landing-config-writer',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/__config', async (req, res) => {
				if (req.method !== 'POST') {
					res.statusCode = 405
					return res.end('POST only')
				}

				try {
					const chunks = []
					for await (const chunk of req) {
						chunks.push(chunk)
						// The config is a few KB; anything larger is not a config.
						if (chunks.reduce((n, c) => n + c.length, 0) > 512 * 1024) {
							throw new Error('payload too large')
						}
					}

					// Parse before writing so a malformed body can never truncate the
					// file, and write via a temp file so a crash mid-write cannot
					// leave config.json half-written.
					const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
					const body = `${JSON.stringify(parsed, null, '\t')}\n`
					const temp = `${target}.tmp`
					await fs.writeFile(temp, body, 'utf8')
					await fs.rename(temp, target)

					res.setHeader('Content-Type', 'application/json')
					res.end(JSON.stringify({ ok: true, bytes: Buffer.byteLength(body) }))
				} catch (error) {
					res.statusCode = 400
					res.setHeader('Content-Type', 'application/json')
					res.end(JSON.stringify({ ok: false, error: error.message }))
				}
			})
		}
	}
}
