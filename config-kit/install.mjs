#!/usr/bin/env node
// Встановлює config-kit (core/ + game-template/) у цільовий проєкт, побудований
// на тій самій FLS/Vite-шаблонній базі (template.config.js + template_modules/).
//
// Використання:
//   node config-kit/install.mjs <шлях-до-проєкту> [--force]
//
// Що робить:
//   1. Копіює config-kit/core/**         -> <проєкт>/**   (каркас, завжди перезаписується)
//   2. Копіює config-kit/game-template/** -> <проєкт>/**   (стартова гра-заготовка;
//      файл пропускається, якщо вже існує в проєкті, якщо не передано --force)
//   3. Патчить <проєкт>/vite.config.js — роздача public/config.json, підключення
//      dev-only middleware для запису конфігу
//   4. Перевіряє, що в <проєкт>/template.config.js є потрібні аліаси
//      (@js, @styles, @img, @sound)
//   5. Генерує MIGRATION_PROMPT.md — готовий промпт для Claude Code, який
//      описує, як довести інтеграцію до кінця в цьому конкретному проєкті
//      (підключити наявну гру до конфігу, якщо вона вже була, або допомогти
//      з чистою заготовкою, якщо ні)
//
// Скрипт нічого не редагує сам через AI і нічого не комітить у git — він лише
// готує файли й інструкцію. Безпечно запускати повторно: кожен крок перевіряє
// власний маркер перед записом.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT_ROOT = path.dirname(fileURLToPath(import.meta.url))
const CORE_DIR = path.join(KIT_ROOT, 'core')
const TEMPLATE_DIR = path.join(KIT_ROOT, 'game-template')

const args = process.argv.slice(2)
const force = args.includes('--force')
const targetArg = args.find(a => !a.startsWith('--'))

if (!targetArg) {
	console.error('Використання: node config-kit/install.mjs <шлях-до-проєкту> [--force]')
	process.exit(1)
}

const TARGET = path.resolve(process.cwd(), targetArg)

if (!fs.existsSync(TARGET)) {
	console.error(`Проєкт не знайдено: ${TARGET}`)
	process.exit(1)
}
if (!fs.existsSync(path.join(TARGET, 'vite.config.js'))) {
	console.error(`У ${TARGET} немає vite.config.js — цей інсталятор розрахований на той самий FLS/Vite-шаблон, що й вихідний проєкт.`)
	process.exit(1)
}

const log = (msg) => console.log(msg)
const warn = (msg) => console.warn(`\x1b[33m! ${msg}\x1b[0m`)

// ---------------------------------------------------------------------------
// 1-2. Копіювання файлів
// ---------------------------------------------------------------------------

function copyTree(srcRoot, destRoot, { overwrite }) {
	const entries = fs.readdirSync(srcRoot, { withFileTypes: true })
	let copied = 0
	let skipped = 0
	const skippedFiles = []

	for (const entry of entries) {
		const src = path.join(srcRoot, entry.name)
		const dest = path.join(destRoot, entry.name)

		if (entry.isDirectory()) {
			fs.mkdirSync(dest, { recursive: true })
			const sub = copyTree(src, dest, { overwrite })
			copied += sub.copied
			skipped += sub.skipped
			skippedFiles.push(...sub.skippedFiles)
			continue
		}

		if (fs.existsSync(dest) && !overwrite) {
			warn(`вже існує, пропущено (додай --force, щоб перезаписати): ${path.relative(TARGET, dest)}`)
			skipped++
			skippedFiles.push(path.relative(TARGET, dest))
			continue
		}

		fs.mkdirSync(path.dirname(dest), { recursive: true })
		fs.copyFileSync(src, dest)
		copied++
	}

	return { copied, skipped, skippedFiles }
}

log(`\nКопіюю core kit (каркас — завжди перезаписується)...`)
const coreResult = copyTree(CORE_DIR, TARGET, { overwrite: true })
log(`  Записано файлів: ${coreResult.copied}.`)

log(`\nКопіюю game-template (стартова гра${force ? ', з примусовим перезаписом' : ' — наявні файли залишаються без змін'})...`)
const templateResult = copyTree(TEMPLATE_DIR, TARGET, { overwrite: force })
log(`  Записано файлів: ${templateResult.copied}, пропущено: ${templateResult.skipped}.`)

// ---------------------------------------------------------------------------
// 3. Патчинг vite.config.js
// ---------------------------------------------------------------------------

const viteConfigPath = path.join(TARGET, 'vite.config.js')
// Нормалізуємо перенос рядків перед патчингом — regex-и нижче розраховані на \n,
// а змішані CRLF/LF (типово для файлів цього шаблону) інакше можуть не зматчитись.
let viteConfig = fs.readFileSync(viteConfigPath, 'utf8').replace(/\r\n/g, '\n')
// Те, що саме крок (d) нижче записує у vite.config.js — маркер для перевірки при
// повторному запуску, узгоджений з самим патчем за побудовою.
const MARKER = 'configWriter({'

let viteConfigPatchedNow = false

if (viteConfig.includes(MARKER)) {
	log(`\nvite.config.js вже підключений (знайдено "${MARKER}") — залишаю без змін.`)
} else {
	log(`\nПатчу vite.config.js...`)
	let patched = viteConfig
	let ok = true

	// a) import
	const importAnchor = `import { ignoredDirs, ignoredFiles } from './template_modules/ignored.js'`
	if (patched.includes(importAnchor) && !patched.includes("vite-plugins/config-writer.js")) {
		patched = patched.replace(
			importAnchor,
			`${importAnchor}\n// Dev-only writer for public/config.json, used by the config editor panel.\nimport configWriter from './vite-plugins/config-writer.js'`
		)
	} else if (!patched.includes("vite-plugins/config-writer.js")) {
		ok = false
		warn(`Не знайдено місце для імпорту у vite.config.js — додай вручну:\n    import configWriter from './vite-plugins/config-writer.js'`)
	}

	// b) publicDir: false -> path.join(__dirname, "public")
	if (/publicDir:\s*false/.test(patched)) {
		patched = patched.replace(
			/publicDir:\s*false,?/,
			`// Served at the site root in dev and copied into dist/ on build.\n\t\t// Holds config.json, the runtime config the landing fetches on every load.\n\t\tpublicDir: path.join(__dirname, "public"),`
		)
	} else if (!/publicDir:\s*path\.join\(__dirname,\s*["']public["']\)/.test(patched)) {
		ok = false
		warn(`Не знайдено "publicDir: false" у vite.config.js — встанови вручну:\n    publicDir: path.join(__dirname, "public"),`)
	}

	// c) watch.ignored: додаємо виключення config.json. Захоплюємо тіло масиву аж
	// до (але без) відступу перед закриваючою `]`, щоб вставка не лишала зайвий
	// порожній рядок.
	const watchIgnoredAnchor = /(watch:\s*\{\s*ignored:\s*\[[\s\S]*?[,\[]\s*)(\n\s*)(\])/
	if (watchIgnoredAnchor.test(patched) && !patched.includes('public/config.json`,')) {
		patched = patched.replace(watchIgnoredAnchor, (match, head, closingIndent, close) => {
			// closingIndent — це "\n" + відступ, який уже мала закриваюча `]`;
			// перевикористовуємо його, щоб новий елемент вирівнявся так само.
			const itemIndent = closingIndent.replace('\n', '\n\t')
			const addition = [
				`${itemIndent}// config.json is picked up in place by the page's own config`,
				`${itemIndent}// watcher. Leaving it to Vite would full-reload the page on every`,
				`${itemIndent}// edit — including every keystroke in the config panel, which`,
				`${itemIndent}// writes the file as you type.`,
				`${itemIndent}\`**/public/config.json\`,`
			].join('')
			return `${head}${addition}${closingIndent}${close}`
		})
	} else if (!patched.includes('public/config.json`,')) {
		ok = false
		warn(`Не знайдено server.watch.ignored у vite.config.js — додай вручну:\n    \`**/public/config.json\`,`)
	}

	// d) plugins: [ ... ] -> підключаємо configWriter першим
	const pluginsAnchor = /plugins:\s*\[\n/
	if (pluginsAnchor.test(patched) && !patched.includes('configWriter({')) {
		patched = patched.replace(
			pluginsAnchor,
			`plugins: [\n\t\t\t// Запис config.json з панелі налаштувань (тільки dev)\n\t\t\tconfigWriter({ publicDir: path.join(__dirname, "public") }),\n`
		)
	} else if (!patched.includes('configWriter({')) {
		ok = false
		warn(`Не знайдено масив plugins у vite.config.js — додай вручну:\n    configWriter({ publicDir: path.join(__dirname, "public") }),`)
	}

	// e) custom-hmr: не робити full-reload на запис config.json
	const hmrAnchor = /handleHotUpdate\(\{\s*file,\s*server\s*\}\)\s*\{\n/
	if (hmrAnchor.test(patched) && !patched.includes("endsWith('public/config.json')")) {
		patched = patched.replace(
			hmrAnchor,
			`handleHotUpdate({ file, server }) {\n\t\t\t\t\t// See server.watch.ignored — the landing re-renders config.json\n\t\t\t\t\t// itself, so a reload here would fight the in-place update.\n\t\t\t\t\tif (file.replace(/\\\\/g, '/').endsWith('public/config.json')) return\n`
		)
	} else if (!patched.includes("endsWith('public/config.json')")) {
		warn(`Не знайдено handleHotUpdate у custom-hmr — це не критично (лише прибирає зайвий full-reload при збереженні), додай вручну за потреби:\n    if (file.replace(/\\\\/g, '/').endsWith('public/config.json')) return`)
	}

	fs.writeFileSync(viteConfigPath, patched, 'utf8')
	viteConfigPatchedNow = true
	log(ok ? `  vite.config.js пропатчено.` : `  vite.config.js пропатчено частково — див. попередження вище.`)
}

// ---------------------------------------------------------------------------
// 4. Перевірка аліасів у template.config.js
// ---------------------------------------------------------------------------

const templateConfigPath = path.join(TARGET, 'template.config.js')
let missingAliases = []
if (fs.existsSync(templateConfigPath)) {
	const templateConfigSrc = fs.readFileSync(templateConfigPath, 'utf8')
	const required = ["'@js'", "'@styles'", "'@img'", "'@sound'"]
	missingAliases = required.filter(key => !templateConfigSrc.includes(key))
	if (missingAliases.length) {
		warn(`У template.config.js бракує аліас(ів) ${missingAliases.join(', ')} у блоці \`aliases\`. Кіт імпортує через @js/config/*, @img/*, @sound/* — додай їх, наприклад:\n    '@js': 'src/js',\n    '@styles': 'src/styles',\n    '@img': 'src/assets/img',\n    '@sound': 'src/assets/sound',`)
	} else {
		log(`\ntemplate.config.js вже має всі потрібні аліаси.`)
	}
} else {
	warn(`У ${TARGET} не знайдено template.config.js — перевірку аліасів пропущено.`)
}

// ---------------------------------------------------------------------------
// 5. Генерація MIGRATION_PROMPT.md
// ---------------------------------------------------------------------------

const hasExistingGame = templateResult.skippedFiles.length > 0
const promptPath = path.join(TARGET, 'MIGRATION_PROMPT.md')

const existingGameSection = hasExistingGame ? `## У цьому проєкті вже була своя гра

Встановлення не перезаписало наступні файли, бо вони вже існували в проєкті —
ймовірно, там своя ігрова логіка:

${templateResult.skippedFiles.map(f => `- \`${f}\``).join('\n')}

Твоє завдання — **підключити цю наявну гру до config-kit, не переписуючи її
логіку з нуля.** Постав це в основу.

### Кроки

1. Прочитай наявні \`src/components/pages/index/index.html\`,
   \`src/components/pages/index/index.js\` (і \`index.scss\`, якщо там є розміри/
   анімації, завʼязані на конкретні значення) — розберись, яка там механіка:
   що є "кроком"/"раундом" гри, які параметри хардкоджені (тексти кнопок,
   множники/виплати, тривалості анімацій, шляхи до картинок/звуків, URL
   CTA-кнопки), де програш/виграш вирішується.

2. Прочитай \`config-kit/README.md\` та \`docs/config.md\` (вже скопійований у
   корінь проєкту цим інсталятором) — там описаний патерн: \`core/\` дає
   \`loadConfig\`/\`saveConfig\`/\`normalizeConfig\`/\`watchConfig\`/\`mergeConfig\`
   (\`src/js/config/config.js\`) і dev-панель (\`src/js/config/devmenu.js\`) без
   жодних припущень про механіку гри. Кожна гра додає власний \`game\`-блок
   через:
   - \`src/js/config/game.defaults.js\` — спред core-дефолтів (з
     \`src/js/config/defaults.js\`, той файл не чіпай) + власний \`game\`
     (і будь-які інші секції, які потрібні механіці — на кшталт \`layout\` чи
     \`sectors\` у chicken-road-example)
   - \`src/js/config/normalize.js\` — валідація/кламп своїх полів, реєструється
     через \`setGameNormalizer()\` з core \`config.js\`
   - \`public/config.json\` — реальні значення, що дзеркалять дефолти
   - \`render.js\` — застосовує конфіг до DOM (функція, яку dev-watcher
     перезапускає на кожен edit конфігу)
   - (опційно) \`devmenu.fields.js\` — поля для панелі редагування

   Подивись \`config-kit/game-template/\` як референс — це той самий патерн,
   застосований до мінімальної placeholder-гри.

3. **Не видаляй і не спрощуй існуючу ігрову логіку.** Постав конфіг ПІД неї:
   заміни хардкоджені значення (тексти, числа, шляхи до асетів, URL) на
   читання з обʼєкта \`config\`, який приходить з \`loadConfig()\`. Приклад
   мапінгу — подивись \`config-kit/game-template/src/components/pages/index/
   index.js\` та порівняй з тим, як chicken-road-example (сусідній git-проєкт,
   якщо він доступний) переніс свою гру з хардкоду на конфіг — той самий
   принцип: клас гри приймає \`config\` у конструктор, бере звідти
   \`rate\`/\`multipliers\`/\`stepTime\`/шляхи до звуків, і так далі.

4. У кінці \`src/components/pages/index/index.js\` додай виклик
   \`registerGameConfig()\` (з нового \`normalize.js\`) ПЕРЕД \`loadConfig()\`,
   підключи \`watchConfig()\` для live-релоаду в dev, і (за
   \`config.dev.menu\`) — \`initDevMenu\` з \`@js/config/devmenu.js\`, передавши
   власний \`GAME_FIELDS\` разом з \`CORE_FIELDS\`. За замовчуванням панель
   вантажиться і в production-білді — там вона пише зміни в localStorage
   браузера замість \`public/config.json\` (нема кому приймати запис на
   статичному хостингу), з кнопкою "Скачати" для експорту готового файлу.
   Якщо потрібен строго dev-only варіант (панель зникає з \`dist/\` повністю) —
   постав умову \`import.meta.env.DEV && config.dev.menu\`, як було раніше.

5. Онови \`public/config.json\` так, щоб він відображав реальні поточні
   значення гри (те, що зараз хардкоджено в коді) — щоб після інтеграції
   поведінка на екрані не змінилась, доки хтось не відредагує конфіг.

6. Перевір: \`npm run dev\`, відкрий сторінку, переконайся що гра виглядає й
   грається так само, як до змін. Зміни щось у панелі конфігу (текст кнопки
   або число) — переконайся, що сторінка оновлюється без релоаду.
   \`npm run build\` — переконайся, що \`dist/config.json\` існує. Якщо
   лишив панель dev-only (\`import.meta.env.DEV && config.dev.menu\`) —
   \`grep -r devmenu dist/\` має бути порожнім; якщо панель ships і в
   production (дефолт) — знаходження там очікуване, перевір натомість, що
   панель у зібраному \`dist/\` відкривається і пише в localStorage (бейдж
   "prod", а не "dev").

**Не роби:** не переписуй анімації/CSS-геометрію "про всяк випадок", не
рефактори те, що не звʼязано з винесенням значень у конфіг, не видаляй
робочий код, у якому не певен — постав питання замість вгадування.
` : `## У цьому проєкті ще немає власної гри

Файли \`game-template\` скопійовано повністю — тут поки що працює лише
placeholder ("клік → win/lose"). Твоє завдання — замінити цей placeholder на
реальну механіку гри.

### Кроки

1. Уточни в користувача (якщо це ще не описано десь у репозиторії), яка саме
   гра потрібна — жанр/механіка, що вважається кроком/раундом, які параметри
   мають бути редаговані через конфіг (тексти, виплати/множники, тривалості
   анімацій, арт, звук).

2. Прочитай \`docs/config.md\` (в корені проєкту) і
   \`config-kit/game-template/\` — це референсна реалізація патерну
   (\`game.defaults.js\` + \`normalize.js\` + \`render.js\` + \`devmenu.fields.js\` +
   \`config.json\`), яку треба розширити чи переписати під нову механіку,
   зберігаючи структуру: \`core/\` (\`src/js/config/defaults.js\` включно) не
   займаєш, вся механіка — у \`src/js/config/{game.defaults,normalize}.js\` та
   \`src/components/pages/index/{index.js,render.js,devmenu.fields.js}\`.

3. Реалізуй саму гру: DOM/CSS у \`index.html\`/\`index.scss\`, логіку в класі
   \`Game\` (\`index.js\`), відображення конфігу в DOM у \`render.js\`.

4. Онови \`public/config.json\` реальними значеннями нової гри.

5. Перевір: \`npm run dev\`, погратись, переконатись що панель конфігу вгорі
   праворуч редагує гру наживо. \`npm run build\`, переконатись що
   \`dist/config.json\` існує; панель за замовчуванням лишається доступною і
   в production-білді (пише зміни в localStorage браузера, не на сервер —
   див. "The config menu" в \`docs/config.md\`), тож \`grep -r devmenu dist/\`
   знаходить її код навмисно. Якщо потрібен dev-only варіант — постав умову
   \`import.meta.env.DEV && config.dev.menu\` в \`index.js\`.
`

const migrationPrompt = `# Промпт для Claude Code: доведення config-kit до готовності

Цей файл згенеровано інсталятором \`config-kit/install.mjs\` після встановлення
core kit у цей проєкт. Він призначений для запуску як промпт у Claude Code —
відкрий цей проєкт у Claude Code і попроси виконати інструкції з цього файлу
(наприклад: "Виконай інструкції з MIGRATION_PROMPT.md").

## Контекст

У проєкт щойно встановлено \`config-kit\` — систему рантайм-конфігурації для
лендінгу-гри, перенесену з chicken-road-example. Ядро (\`src/js/config/config.js\`,
\`assets.js\`, \`devmenu.js\`, \`vite-plugins/config-writer.js\`) вже на місці й
game-агностичне — воно не потребує змін. \`vite.config.js\`${viteConfigPatchedNow ? ' щойно пропатчено' : ' вже був підключений раніше'} для роздачі
\`public/config.json\` та dev-only ендпоінту запису конфігу.

${existingGameSection}

## Довідка

- \`docs/config.md\` (в корені проєкту) — повний опис core-частини конфігу і
  розділ "Extending for a new mechanic" з покроковим патерном розширення.
- \`config-kit/README.md\` — опис структури kit-а й того, що для чого.
- \`config-kit/game-template/\` — робочий приклад застосування патерну.
${missingAliases.length ? `\n**Увага:** інсталятор повідомив, що в \`template.config.js\` бракує аліас(ів):
${missingAliases.join(', ')}. Додай їх у блок \`aliases\` перед тим, як імпорти
\`@js/config/*\` запрацюють:
\`\`\`js
'@js': 'src/js',
'@styles': 'src/styles',
'@img': 'src/assets/img',
'@sound': 'src/assets/sound',
\`\`\`\n` : ''}
Постав уточнюючі питання, якщо щось у наявній грі незрозуміло, а не вгадуй.
`

fs.writeFileSync(promptPath, migrationPrompt, 'utf8')
log(`\nЗгенеровано ${path.relative(TARGET, promptPath)}.`)

// ---------------------------------------------------------------------------
// Підсумок
// ---------------------------------------------------------------------------

log(`\nГотово. Наступні кроки:`)
log(`  1. Переглянь git diff / git status у проєкті — переконайся, що зміни очікувані.`)
log(`  2. Відкрий проєкт у Claude Code і попроси виконати інструкції з MIGRATION_PROMPT.md`)
log(`     (наприклад: "Виконай інструкції з MIGRATION_PROMPT.md").`)
log(`  3. Перевір кожен edit самостійно перед комітом.\n`)
