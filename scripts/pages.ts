import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import matchupResults from '../src/data/matchups.json'
import { HOME_PATHS, LOCALES, MATCHUPS_PATHS, NUMBER_LOCALES, type Locale } from '../src/locale'
import { MATCHUPS, matchupPath, matchupTitle, shortTitle, type Matchup } from '../src/matchups'
import { pokedex } from '../src/pokedex'
import { SITE_URL } from '../src/site'
import type { MatchupResult } from './matchups'

/*
 * Writes a static page for each matchup, in French and in English, into dist/ after the app's build, for search
 * engines: they read plain HTML best, and « Gen 1 contre Gen 3 : qui gagne ? » or « Gen 1 vs Gen 3: who wins? » is
 * the kind of question people type. The battles were simulated beforehand by `bun run matchups`; this only lays out
 * their results, plus each language's index, the sitemap and robots.txt.
 */
const DIST = join(import.meta.dirname, '..', 'dist')
const PUBLIC = join(import.meta.dirname, '..', 'public')
const SHEET = JSON.parse(readFileSync(join(PUBLIC, 'sprites.json'), 'utf8')) as {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>
  meta: { size: { w: number; h: number } }
}
const results = new Map((matchupResults as MatchupResult[]).map((result) => [result.slug, result]))
const RUNS = (matchupResults as MatchupResult[])[0]?.runs ?? 0
const RELATED_LINKS = 12
const ONE_SIDED_SHARE = 0.95
const SPRITE_SIZE = 48
// Counts the page read on the real site only, as the app does, and never for crawlers. A file of its own rather than
// an inline script, which the Content-Security-Policy refuses.
const COUNT_PAGE_VIEW = `if (location.host === '${new URL(SITE_URL).host}' && !/bot|crawl|spider|slurp|lighthouse|headlesschrome|pagespeed/i.test(navigator.userAgent))
  navigator.sendBeacon('/api/events', new Blob(['{"name":"matchup-page"}'], { type: 'application/json' }))
`

const escape = (text: string) => text.replaceAll(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const isGeneration = (selector: string) => selector.startsWith('gen')

/** Every sentence of the pages, in each language, with the grammar each one needs. */
const TEXTS = {
  fr: {
    percent: (share: number) => `${Math.round(share * 100)} %`,
    // « la Gen 3 », « les Pokémon Feu », « les légendaires »: how a team reads in a sentence.
    team: (selector: string) =>
      isGeneration(selector)
        ? `la ${shortTitle(selector, 'fr')}`
        : selector === 'legendaries'
          ? 'les légendaires'
          : `les Pokémon ${shortTitle(selector, 'fr')}`,
    // « la Gen 3 gagne », but « les Pokémon Feu gagnent ».
    verb: (selector: string, singular: string, plural: string) => (isGeneration(selector) ? singular : plural),
    wins: ['gagne', 'gagnent'],
    prevails: ['l’emporte', 'l’emportent'],
    leads: ['mène', 'mènent'],
    headline: (team: string, verb: string, share: string) => `${team} ${verb} ${share} des combats`,
    lead: (size: number, sentence: string) =>
      `Sur ${RUNS} combats simulés à ${size} Pokémon contre ${size}, <strong>${sentence}</strong>.`,
    description: (team: string, verb: string, share: string, size: number) =>
      `${team} ${verb} dans ${share} des ${RUNS} combats simulés à ${size} Pokémon contre ${size}. Résultats, Pokémon décisifs et un combat à regarder.`,
    oneSided: (team: string, verb: string) =>
      `${team} ${verb} presque à chaque fois&nbsp;: à toi de trouver l’équipe qui renverse la tendance, en composant la tienne pour défier les hordes de PokéBrawl.`,
    open: (team: string, verb: string) =>
      `${team} ${verb} ici, mais chaque combat reste ouvert&nbsp;: regarde-en un, ou compose ta propre équipe pour défier les hordes de PokéBrawl.`,
    pageTitle: (title: string) => `${title} : qui gagne ? · PokéBrawl`,
    heading: (title: string) => `${title} : qui gagne&nbsp;?`,
    averageSeconds: (seconds: number) => `<strong>${seconds}&nbsp;s</strong> de combat en moyenne`,
    averageSurvivors: (survivors: number) => `<strong>${survivors}</strong> survivants en moyenne`,
    draws: (draws: number) => `<strong>${draws}</strong> match${draws > 1 ? 's' : ''} nul${draws > 1 ? 's' : ''}`,
    watch: 'Regarder un combat',
    compose: 'Compose ton équipe',
    topHeading: 'Les Pokémon qui font la différence',
    knockOuts: (value: string) => `${value}&nbsp;K.O. par combat`,
    howHeading: 'Comment sont simulés ces combats&nbsp;?',
    how: 'Chaque combat met face à face autant de Pokémon de chaque camp, tirés au hasard dans le plus nombreux. Tous sont au niveau 50, avec leurs vraies statistiques, leurs types et des attaques qu’ils apprennent en montant de niveau. Ils foncent sur l’ennemi le plus proche qu’ils peuvent toucher et frappent selon la formule de dégâts des jeux : bonus de type, coups critiques et part de hasard compris.',
    others: 'Autres combats',
    all: 'Tous les combats',
    breadcrumb: 'Fil d’Ariane',
    home: 'Accueil',
    battles: 'Combats',
    play: 'Jouer',
    otherLanguage: 'English',
    footer:
      'PokéBrawl, projet de fan non officiel et sans but commercial. Pokémon © Nintendo / Game Freak / The Pokémon Company. Données : PokeAPI.',
    indexTitle: 'Qui gagne ? Générations et types de Pokémon face à face · PokéBrawl',
    indexHeading: 'Qui gagne&nbsp;? Générations et types de Pokémon face à face',
    indexLead: (count: number) =>
      `${count} affiches, chacune jouée ${RUNS} fois par la simulation de PokéBrawl, à nombre égal de chaque côté.`,
    indexDescription:
      'Gen 1 contre Gen 3, Feu contre Eau, légendaires contre chaque génération : les résultats de centaines de combats de masse simulés entre Pokémon.',
    groups: ['Générations', 'Légendaires', 'Types'],
  },
  en: {
    percent: (share: number) => `${Math.round(share * 100)}%`,
    // « Gen 3 », « Fire Pokémon », « the legendaries »: how a team reads in a sentence.
    team: (selector: string) =>
      isGeneration(selector)
        ? shortTitle(selector, 'en')
        : selector === 'legendaries'
          ? 'the legendaries'
          : `${shortTitle(selector, 'en')} Pokémon`,
    // « Gen 3 wins », but « Fire Pokémon win ».
    verb: (selector: string, singular: string, plural: string) => (isGeneration(selector) ? singular : plural),
    wins: ['wins', 'win'],
    prevails: ['wins', 'win'],
    leads: ['leads', 'lead'],
    headline: (team: string, verb: string, share: string) => `${team} ${verb} ${share} of battles`,
    lead: (size: number, sentence: string) =>
      `Over ${RUNS} simulated battles at ${size} Pokémon a side, <strong>${sentence}</strong>.`,
    description: (team: string, verb: string, share: string, size: number) =>
      `${team} ${verb} ${share} of ${RUNS} simulated battles at ${size} Pokémon a side. Results, the deciding Pokémon and a battle to watch.`,
    oneSided: (team: string, verb: string) =>
      `${team} ${verb} almost every time: find the team that turns the tide by building your own to take on PokéBrawl’s hordes.`,
    open: (team: string, verb: string) =>
      `${team} ${verb} here, but every battle stays open: watch one, or build your own team to take on PokéBrawl’s hordes.`,
    pageTitle: (title: string) => `${title}: who wins? · PokéBrawl`,
    heading: (title: string) => `${title}: who wins?`,
    averageSeconds: (seconds: number) => `<strong>${seconds}&nbsp;s</strong> of battle on average`,
    averageSurvivors: (survivors: number) => `<strong>${survivors}</strong> survivors on average`,
    draws: (draws: number) => `<strong>${draws}</strong> draw${draws === 1 ? '' : 's'}`,
    watch: 'Watch a battle',
    compose: 'Build your team',
    topHeading: 'The Pokémon that make the difference',
    knockOuts: (value: string) => `${value}&nbsp;KOs per battle`,
    howHeading: 'How are these battles simulated?',
    how: 'Each battle pits as many Pokémon on each side, drawn at random from the larger one. All are level 50, with their real stats, their types and moves they learn by levelling up. They rush at the nearest enemy they can hit and strike with the damage formula of the games: type bonuses, critical hits and a share of luck included.',
    others: 'Other battles',
    all: 'All battles',
    breadcrumb: 'Breadcrumb',
    home: 'Home',
    battles: 'Battles',
    play: 'Play',
    otherLanguage: 'Français',
    footer:
      'PokéBrawl, an unofficial, non-commercial fan project. Pokémon © Nintendo / Game Freak / The Pokémon Company. Data: PokeAPI.',
    indexTitle: 'Who wins? Pokémon generations and types head to head · PokéBrawl',
    indexHeading: 'Who wins? Pokémon generations and types head to head',
    indexLead: (count: number) =>
      `${count} matchups, each played ${RUNS} times by PokéBrawl’s simulation, with equal numbers on each side.`,
    indexDescription:
      'Gen 1 vs Gen 3, Fire vs Water, the legendaries vs every generation: the results of hundreds of simulated mass battles between Pokémon.',
    groups: ['Generations', 'Legendaries', 'Types'],
  },
} satisfies Record<Locale, unknown>

const otherLocale = (locale: Locale): Locale => (locale === 'fr' ? 'en' : 'fr')

// Each page shows a few Pokémon: each gets a small image of its own, cut out of the app's sheet, rather than the
// whole sheet (some 700 kB) for every page.
const shownSprites = new Set<number>()
function sprite(id: number) {
  const { w, h } = SHEET.frames[String(id)]!.frame
  const scale = SPRITE_SIZE / Math.max(w, h)
  shownSprites.add(id)
  return `<img class="sprite" src="/combats/sprites/${id}.webp" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" alt="" loading="lazy" />`
}

function outcomeOf(result: MatchupResult) {
  const [first, second, draws] = result.wins
  const winner: 0 | 1 = first >= second ? 0 : 1
  return { winner, first, second, draws, share: result.wins[winner] / result.runs }
}

/** The same page in each language, for the alternates search engines read. */
type Paths = Record<Locale, string>

function page(
  locale: Locale,
  { title, description, paths, body }: { title: string; description: string; paths: Paths; body: string },
) {
  const text = TEXTS[locale]
  const url = `${SITE_URL}${paths[locale]}`
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <link rel="canonical" href="${url}" />
    <link rel="alternate" hreflang="fr" href="${SITE_URL}${paths.fr}" />
    <link rel="alternate" hreflang="en" href="${SITE_URL}${paths.en}" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${paths.fr}" />
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
      <a class="logo" href="${HOME_PATHS[locale]}">Poké<span>Brawl</span></a>
      <nav class="header-links">
        <a href="${paths[otherLocale(locale)]}" hreflang="${otherLocale(locale)}" lang="${otherLocale(locale)}">${text.otherLanguage}</a>
        <a class="header-link" href="${HOME_PATHS[locale]}">${text.play}</a>
      </nav>
    </header>
    <main>
${body}
    </main>
    <script src="/combats/count.js" defer></script>
    <footer class="site-footer">
      <p>${text.footer}</p>
    </footer>
  </body>
</html>
`
}

function matchupPage(matchup: Matchup, locale: Locale) {
  const text = TEXTS[locale]
  const result = results.get(matchup.slug)
  if (!result) throw new Error(`Résultats absents pour ${matchup.slug} : lance « bun run matchups »`)
  const { teams } = matchup
  const title = matchupTitle(matchup, locale)
  const { winner, first, second, draws, share } = outcomeOf(result)
  const names: [string, string] = [shortTitle(teams[0], locale), shortTitle(teams[1], locale)]
  const winnerTeam = teams[winner]
  const team = text.team(winnerTeam)
  const verb = (forms: string[]) => text.verb(winnerTeam, forms[0]!, forms[1]!)
  const percent = (count: number) => text.percent(count / result.runs)
  const sentence = text.headline(team, verb(text.wins), text.percent(share))
  const watch = `${HOME_PATHS[locale]}?${new URLSearchParams({ a: teams[0], b: teams[1], seed: String(result.exampleSeed) })}`
  const related = MATCHUPS.filter(
    (other) => other !== matchup && other.teams.some((selector) => teams.includes(selector)),
  ).slice(0, RELATED_LINKS)
  const outlook = (share >= ONE_SIDED_SHARE ? text.oneSided : text.open)(
    capitalised(team),
    verb(share >= ONE_SIDED_SHARE ? text.prevails : text.leads),
  )
  const decimal = (value: number) => value.toLocaleString(NUMBER_LOCALES[locale], { maximumFractionDigits: 1 })
  const body = `      <nav class="breadcrumb" aria-label="${text.breadcrumb}"><a href="${HOME_PATHS[locale]}">${text.home}</a> › <a href="${MATCHUPS_PATHS[locale]}">${text.battles}</a> › ${escape(title)}</nav>
      <h1>${text.heading(escape(title))}</h1>
      <p class="lead">${text.lead(result.size, escape(sentence))}</p>
      <div class="scoreboard" role="img" aria-label="${escape(`${names[0]} ${percent(first)}, ${names[1]} ${percent(second)}`)}">
        <div class="scoreboard-names"><span class="blue">${escape(names[0])} · ${percent(first)}</span><span class="red">${percent(second)} · ${escape(names[1])}</span></div>
        <div class="scoreboard-bar"><span class="blue" style="width:${(100 * first) / result.runs}%"></span><span class="red" style="width:${(100 * second) / result.runs}%"></span></div>
      </div>
      <ul class="facts">
        <li>${text.averageSeconds(result.averageSeconds)}</li>
        <li>${text.averageSurvivors(result.averageSurvivors)}</li>
        <li>${text.draws(draws)}</li>
      </ul>
      <div class="actions">
        <a class="button primary" href="${escape(watch)}">${text.watch}</a>
        <a class="button" href="${HOME_PATHS[locale]}">${text.compose}</a>
      </div>
      <h2>${text.topHeading}</h2>
      <ol class="top">
${result.top
  .map(
    ({ id, team: side, knockOuts }) =>
      `        <li>${sprite(id)}<span class="top-name ${side === 0 ? 'blue' : 'red'}">${escape(pokedex.pokemon[id - 1]!.names[locale])}</span><span class="top-detail">${escape(names[side]!)} · ${text.knockOuts(decimal(knockOuts))}</span></li>`,
  )
  .join('\n')}
      </ol>
      <h2>${text.howHeading}</h2>
      <p>${text.how} ${outlook}</p>
      <h2>${text.others}</h2>
      <ul class="links">
${related.map((other) => `        <li><a href="${matchupPath(other, locale)}">${escape(matchupTitle(other, locale))}</a></li>`).join('\n')}
        <li><a href="${MATCHUPS_PATHS[locale]}">${text.all}</a></li>
      </ul>`
  return page(locale, {
    title: text.pageTitle(title),
    description: text.description(capitalised(team), verb(text.prevails), text.percent(share), result.size),
    paths: { fr: matchupPath(matchup, 'fr'), en: matchupPath(matchup, 'en') },
    body,
  })
}

function indexPage(locale: Locale) {
  const text = TEXTS[locale]
  const groups: ((matchup: Matchup) => boolean)[] = [
    ({ teams }) => teams.every(isGeneration),
    ({ teams }) => teams.includes('legendaries'),
    ({ teams }) => teams.every((team) => team.startsWith('type:')),
  ]
  const body = `      <nav class="breadcrumb" aria-label="${text.breadcrumb}"><a href="${HOME_PATHS[locale]}">${text.home}</a> › ${text.battles}</nav>
      <h1>${text.indexHeading}</h1>
      <p class="lead">${text.indexLead(MATCHUPS.length)}</p>
${groups
  .map(
    (belongs, index) => `      <h2>${text.groups[index]}</h2>
      <ul class="index">
${MATCHUPS.filter(belongs)
  .map((matchup) => {
    const { winner, share } = outcomeOf(results.get(matchup.slug)!)
    return `        <li><a href="${matchupPath(matchup, locale)}">${escape(matchupTitle(matchup, locale))}</a> <span>→ ${escape(shortTitle(matchup.teams[winner], locale))} ${text.percent(share)}</span></li>`
  })
  .join('\n')}
      </ul>`,
  )
  .join('\n')}`
  return page(locale, { title: text.indexTitle, description: text.indexDescription, paths: MATCHUPS_PATHS, body })
}

const STYLE = `:root{color-scheme:dark;--background:#12131f;--surface:#1a1c2c;--text:#f4f3ff;--muted:#a9acd6;--blue:#3d9bff;--red:#ff4d5e;--accent:#ffd23f}
@view-transition{navigation:auto}
*{box-sizing:border-box}
body{margin:0;background:var(--background);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.55}
a{color:var(--accent)}
main{max-width:760px;margin:0 auto;padding:0 20px 48px}
.site-header{display:flex;align-items:center;justify-content:space-between;max-width:760px;margin:0 auto;padding:20px}
.header-links{display:flex;gap:16px;align-items:center}
.header-links a{color:var(--muted)}
.logo{color:var(--text);font-size:28px;font-weight:900;letter-spacing:-.03em;text-decoration:none}
.logo span{color:var(--accent)}
.header-links .header-link{color:var(--accent);font-weight:700}
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
.sprite{image-rendering:pixelated;justify-self:center}
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

for (const locale of LOCALES) {
  for (const matchup of MATCHUPS) write(matchupPath(matchup, locale), matchupPage(matchup, locale))
  write(MATCHUPS_PATHS[locale], indexPage(locale))
}
writeFileSync(join(DIST, 'combats', 'style.css'), STYLE)
writeFileSync(join(DIST, 'combats', 'count.js'), COUNT_PAGE_VIEW)
mkdirSync(join(DIST, 'combats', 'sprites'), { recursive: true })
const sheet = readFileSync(join(PUBLIC, 'sprites.webp'))
await Promise.all(
  [...shownSprites].map((id) => {
    const { x, y, w, h } = SHEET.frames[String(id)]!.frame
    return sharp(sheet)
      .extract({ left: x, top: y, width: w, height: h })
      .webp({ lossless: true })
      .toFile(join(DIST, 'combats', 'sprites', `${id}.webp`))
  }),
)

// Any other address answers 404 with this page, in both languages, rather than the app under a wrong address.
writeFileSync(
  join(DIST, '404.html'),
  `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta name="color-scheme" content="dark" />
    <title>Page introuvable · PokéBrawl</title>
    <link rel="icon" href="/icons/favicon.png" type="image/png" />
    <link rel="stylesheet" href="/combats/style.css" />
  </head>
  <body>
    <header class="site-header"><a class="logo" href="/">Poké<span>Brawl</span></a></header>
    <main>
      <h1>Page introuvable</h1>
      <p class="lead">Cette page n’existe pas, ou plus.</p>
      <div class="actions">
        <a class="button primary" href="/">Jouer</a>
        <a class="button" href="/combats/">Qui gagne&nbsp;?</a>
      </div>
      <h2 lang="en">Page not found</h2>
      <div class="actions" lang="en">
        <a class="button primary" href="/en/">Play</a>
        <a class="button" href="/en/battles/">Who wins?</a>
      </div>
    </main>
  </body>
</html>
`,
)

// Each address with its translations, so that search engines show each visitor the page in their language.
const pagesWithAlternates: Paths[] = [
  HOME_PATHS,
  MATCHUPS_PATHS,
  ...MATCHUPS.map((matchup) => ({ fr: matchupPath(matchup, 'fr'), en: matchupPath(matchup, 'en') })),
]
const alternates = (paths: Paths) =>
  LOCALES.map(
    (locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_URL}${paths[locale]}" />`,
  ).join('')
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pagesWithAlternates
  .flatMap((paths) =>
    LOCALES.map((locale) => `  <url><loc>${SITE_URL}${paths[locale]}</loc>${alternates(paths)}</url>`),
  )
  .join('\n')}
</urlset>
`,
)
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
console.info(
  `OK : ${MATCHUPS.length} pages de combat en ${LOCALES.length} langues, les index, ${shownSprites.size} sprites, la page 404, le sitemap et robots.txt dans dist/`,
)
