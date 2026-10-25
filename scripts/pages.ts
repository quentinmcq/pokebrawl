import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import matchupResults from '../src/data/matchups.json'
import { MATCHUPS, matchupPath, shortTitle, type Matchup } from '../src/matchups'
import { pokedex } from '../src/pokedex'
import { SITE_URL } from '../src/site'
import type { MatchupResult } from './matchups'

/*
 * Writes a static page for each matchup into dist/ after the app's build, for search engines: they read plain HTML
 * best, and « Gen 1 contre Gen 3 : qui gagne ? » is the kind of question people type. The battles were simulated
 * beforehand by `bun run matchups`; this only lays out their results, plus the index, the sitemap and robots.txt.
 */
const DIST = join(import.meta.dirname, '..', 'dist')
const SHEET = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'sprites.json'), 'utf8')) as {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>
  meta: { size: { w: number; h: number } }
}
const results = new Map((matchupResults as MatchupResult[]).map((result) => [result.slug, result]))
const RELATED_LINKS = 12
// Counts the page read on the real site only, as the app does, and never for crawlers.
const COUNT_PAGE_VIEW = `<script>
      if (location.host === '${new URL(SITE_URL).host}' && !/bot|crawl|spider|slurp|lighthouse|headlesschrome|pagespeed/i.test(navigator.userAgent))
        navigator.sendBeacon('/api/events', new Blob(['{"name":"matchup-page"}'], { type: 'application/json' }))
    </script>`
const ONE_SIDED_SHARE = 0.95

const escape = (text: string) => text.replaceAll(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
const percent = (count: number, total: number) => `${Math.round((100 * count) / total)} %`
const decimal = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
const nameOf = (id: number) => pokedex.pokemon[id - 1]!.names.fr

// « la Gen 3 », « les Pokémon Feu », « les légendaires »: how a team reads in a sentence.
function inSentence(selector: string) {
  if (selector.startsWith('gen')) return `la ${shortTitle(selector)}`
  if (selector === 'legendaries') return 'les légendaires'
  return `les Pokémon ${shortTitle(selector)}`
}
const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
// « la Gen 3 gagne », but « les Pokémon Feu gagnent ».
const agreed = (selector: string, singular: string, plural: string) => (selector.startsWith('gen') ? singular : plural)

function sprite(id: number) {
  const { x, y, w, h } = SHEET.frames[String(id)]!.frame
  const { w: sheetWidth, h: sheetHeight } = SHEET.meta.size
  const style = `--x:${x};--y:${y};--w:${w};--h:${h};--extent:${Math.max(w, h)};--sheet-w:${sheetWidth};--sheet-h:${sheetHeight}`
  return `<span class="sprite" style="${style}" aria-hidden="true"></span>`
}

function headline({ teams }: Matchup, result: MatchupResult) {
  const [first, second, draws] = result.wins
  const winner: 0 | 1 = first >= second ? 0 : 1
  const share = percent(result.wins[winner], result.runs)
  const sentence = `${capitalised(inSentence(teams[winner]))} ${agreed(teams[winner], 'gagne', 'gagnent')} ${share} des combats`
  return { winner, sentence, draws, first, second }
}

function page({ title, description, path, body }: { title: string; description: string; path: string; body: string }) {
  const url = `${SITE_URL}${path}`
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="PokéBrawl" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE_URL}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#12131f" />
    <link rel="icon" href="/icons/favicon.png" type="image/png" />
    <link rel="stylesheet" href="/combats/style.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="logo" href="/">Poké<span>Brawl</span></a>
      <a class="header-link" href="/">Jouer</a>
    </header>
    <main>
${body}
    </main>
    ${COUNT_PAGE_VIEW}
    <footer class="site-footer">
      <p>PokéBrawl, projet de fan non officiel et sans but commercial. Pokémon © Nintendo / Game Freak / The Pokémon Company. Données : PokeAPI.</p>
    </footer>
  </body>
</html>
`
}

function matchupPage(matchup: Matchup) {
  const result = results.get(matchup.slug)
  if (!result) throw new Error(`Résultats absents pour ${matchup.slug} : lance « bun run matchups »`)
  const { teams, title } = matchup
  const { winner, sentence, draws, first, second } = headline(matchup, result)
  const names: [string, string] = [shortTitle(teams[0]), shortTitle(teams[1])]
  const watch = `/?${new URLSearchParams({ a: teams[0], b: teams[1], seed: String(result.exampleSeed) })}`
  const related = MATCHUPS.filter(
    (other) => other !== matchup && other.teams.some((team) => teams.includes(team)),
  ).slice(0, RELATED_LINKS)
  const winnerName = capitalised(inSentence(teams[winner]))
  const description = `${winnerName} ${agreed(teams[winner], 'l’emporte', 'l’emportent')} dans ${percent(result.wins[winner], result.runs)} des ${result.runs} combats simulés à ${result.size} Pokémon contre ${result.size}. Résultats, Pokémon décisifs et un combat à regarder.`
  // A one-sided matchup is not « open »: it becomes a challenge to overturn.
  const outlook =
    result.wins[winner] / result.runs >= ONE_SIDED_SHARE
      ? `${winnerName} ${agreed(teams[winner], 'l’emporte', 'l’emportent')} presque à chaque fois&nbsp;: à toi de trouver l’équipe qui renverse la tendance, en composant la tienne pour défier les hordes de PokéBrawl.`
      : `${winnerName} ${agreed(teams[winner], 'mène', 'mènent')} ici, mais chaque combat reste ouvert&nbsp;: regarde-en un, ou compose ta propre équipe pour défier les hordes de PokéBrawl.`
  const body = `      <nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/combats/">Combats</a> › ${escape(title)}</nav>
      <h1>${escape(title)} : qui gagne&nbsp;?</h1>
      <p class="lead">Sur ${result.runs} combats simulés à ${result.size} Pokémon contre ${result.size}, <strong>${escape(sentence.charAt(0).toLowerCase() + sentence.slice(1))}</strong>.</p>
      <div class="scoreboard" role="img" aria-label="${escape(`${names[0]} ${percent(first, result.runs)}, ${names[1]} ${percent(second, result.runs)}`)}">
        <div class="scoreboard-names"><span class="blue">${escape(names[0])} · ${percent(first, result.runs)}</span><span class="red">${percent(second, result.runs)} · ${escape(names[1])}</span></div>
        <div class="scoreboard-bar"><span class="blue" style="width:${(100 * first) / result.runs}%"></span><span class="red" style="width:${(100 * second) / result.runs}%"></span></div>
      </div>
      <ul class="facts">
        <li><strong>${result.averageSeconds}&nbsp;s</strong> de combat en moyenne</li>
        <li><strong>${result.averageSurvivors}</strong> survivants en moyenne</li>
        <li><strong>${draws}</strong> match${draws > 1 ? 's' : ''} nul${draws > 1 ? 's' : ''}</li>
      </ul>
      <div class="actions">
        <a class="button primary" href="${escape(watch)}">Regarder un combat</a>
        <a class="button" href="/">Compose ton équipe</a>
      </div>
      <h2>Les Pokémon qui font la différence</h2>
      <ol class="top">
${result.top
  .map(
    ({ id, team, knockOuts }) =>
      `        <li>${sprite(id)}<span class="top-name ${team === 0 ? 'blue' : 'red'}">${escape(nameOf(id))}</span><span class="top-detail">${escape(names[team]!)} · ${decimal(knockOuts)}&nbsp;K.O. par combat</span></li>`,
  )
  .join('\n')}
      </ol>
      <h2>Comment sont simulés ces combats&nbsp;?</h2>
      <p>Chaque combat met face à face autant de Pokémon de chaque camp, tirés au hasard dans le plus nombreux. Tous sont au niveau 50, avec leurs vraies statistiques, leurs types et des attaques qu'ils apprennent en montant de niveau. Ils foncent sur l'ennemi le plus proche qu'ils peuvent toucher et frappent selon la formule de dégâts des jeux : bonus de type, coups critiques et part de hasard compris. ${outlook}</p>
      <h2>Autres combats</h2>
      <ul class="links">
${related.map((other) => `        <li><a href="${matchupPath(other)}">${escape(other.title)}</a></li>`).join('\n')}
        <li><a href="/combats/">Tous les combats</a></li>
      </ul>`
  return page({ title: `${title} : qui gagne ? · PokéBrawl`, description, path: matchupPath(matchup), body })
}

function indexPage() {
  const groups: [string, (matchup: Matchup) => boolean][] = [
    ['Générations', ({ teams }) => teams.every((team) => team.startsWith('gen'))],
    ['Légendaires', ({ teams }) => teams.includes('legendaries')],
    ['Types', ({ teams }) => teams.every((team) => team.startsWith('type:'))],
  ]
  const body = `      <nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › Combats</nav>
      <h1>Qui gagne&nbsp;? Générations et types de Pokémon face à face</h1>
      <p class="lead">${MATCHUPS.length} affiches, chacune jouée ${results.values().next().value?.runs ?? 0} fois par la simulation de PokéBrawl, à nombre égal de chaque côté.</p>
${groups
  .map(
    ([heading, belongs]) => `      <h2>${heading}</h2>
      <ul class="index">
${MATCHUPS.filter(belongs)
  .map((matchup) => {
    const result = results.get(matchup.slug)!
    const { winner } = headline(matchup, result)
    return `        <li><a href="${matchupPath(matchup)}">${escape(matchup.title)}</a> <span>→ ${escape(shortTitle(matchup.teams[winner]))} ${percent(result.wins[winner], result.runs)}</span></li>`
  })
  .join('\n')}
      </ul>`,
  )
  .join('\n')}`
  return page({
    title: 'Qui gagne ? Générations et types de Pokémon face à face · PokéBrawl',
    description:
      'Gen 1 contre Gen 3, Feu contre Eau, légendaires contre chaque génération : les résultats de centaines de combats de masse simulés entre Pokémon.',
    path: '/combats/',
    body,
  })
}

const STYLE = `:root{--background:#12131f;--surface:#1a1c2c;--text:#f4f3ff;--muted:#a9acd6;--blue:#3d9bff;--red:#ff4d5e;--accent:#ffd23f}
*{box-sizing:border-box}
body{margin:0;background:var(--background);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.55}
a{color:var(--accent)}
main{max-width:760px;margin:0 auto;padding:0 20px 48px}
.site-header{display:flex;align-items:center;justify-content:space-between;max-width:760px;margin:0 auto;padding:20px}
.logo{color:var(--text);font-size:28px;font-weight:900;letter-spacing:-.03em;text-decoration:none}
.logo span{color:var(--accent)}
.header-link{font-weight:700}
.breadcrumb{color:var(--muted);font-size:14px}
.breadcrumb a{color:var(--muted)}
h1{font-size:clamp(28px,6vw,40px);line-height:1.15;margin:12px 0}
h2{margin-top:40px}
.lead{font-size:19px;color:var(--muted)}
.lead strong{color:var(--text)}
.scoreboard{margin:24px 0;padding:16px;border-radius:16px;background:var(--surface)}
.scoreboard-names{display:flex;justify-content:space-between;font-weight:800;margin-bottom:8px}
.scoreboard-bar{display:flex;height:16px;overflow:hidden;border-radius:999px;background:#2a2d47}
.blue{color:var(--blue)}.red{color:var(--red)}
.scoreboard-bar .blue{background:var(--blue)}.scoreboard-bar .red{background:var(--red);margin-left:auto}
.facts{display:flex;flex-wrap:wrap;gap:12px;padding:0;list-style:none}
.facts li{padding:10px 14px;border-radius:12px;background:var(--surface);color:var(--muted)}
.facts strong{color:var(--text)}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}
.button{padding:14px 20px;border-radius:12px;background:#2a2d47;color:var(--text);font-weight:800;text-decoration:none}
.button.primary{background:var(--accent);color:#14162b}
.top{display:grid;gap:8px;padding:0;list-style:none}
.top li{display:grid;grid-template-columns:56px 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center;padding:8px 12px;border-radius:12px;background:var(--surface)}
.top .sprite{grid-row:span 2}
.top-name{font-weight:800}
.top-detail{color:var(--muted);font-size:14px}
.sprite{--size:48px;--k:calc(var(--size) / var(--extent));display:inline-block;width:calc(var(--w) * var(--k));height:calc(var(--h) * var(--k));background:url(/sprites.webp) no-repeat;background-size:calc(var(--sheet-w) * var(--k)) calc(var(--sheet-h) * var(--k));background-position:calc(var(--x) * var(--k) * -1) calc(var(--y) * var(--k) * -1);image-rendering:pixelated;justify-self:center}
.links,.index{padding-left:20px}
.index li{margin:4px 0}
.index span{color:var(--muted);font-size:14px}
.site-footer{max-width:760px;margin:0 auto;padding:24px 20px;color:var(--muted);font-size:13px;border-top:1px solid #2a2d47}
`

function write(path: string, content: string) {
  const directory = join(DIST, path)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'index.html'), content)
}

for (const matchup of MATCHUPS) write(matchupPath(matchup), matchupPage(matchup))
write('/combats/', indexPage())
writeFileSync(join(DIST, 'combats', 'style.css'), STYLE)
const urls = ['/', '/combats/', ...MATCHUPS.map(matchupPath)]
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n')}
</urlset>
`,
)
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
console.info(`OK : ${MATCHUPS.length} pages de combat, l'index, le sitemap et robots.txt dans dist/`)
