import { parseArgs } from 'node:util'
import { dayOf } from '../src/daily'
import { TRACKED_EVENTS } from '../src/tracking'
import { queryD1 } from './d1'

/*
 * Reads the daily counters of the live site: visits and where they come from, battles by mode, wins, shares. Usage :
 * bun run audience [--days 7]
 */
const { values: options } = parseArgs({ options: { days: { type: 'string', default: '7' } } })
const days = Number(options.days)
if (!Number.isInteger(days) || days < 1) throw new Error('Usage : bun run audience --days 7')

const LABELS: Record<(typeof TRACKED_EVENTS)[number], string> = {
  visit: 'Visites',
  'arrival-pokedate': '  depuis PokéDate',
  'arrival-friend': '  par un lien d’ami',
  'arrival-matchup-page': '  depuis une page « qui gagne ? »',
  'arrival-search': '  depuis un moteur de recherche',
  'arrival-other-site': '  depuis un autre site',
  'arrival-direct': '  en direct',
  'matchup-page': 'Pages « qui gagne ? » lues',
  'battle-daily': 'Combats : défi du jour',
  'battle-training': 'Combats : entraînement',
  'battle-friend': 'Combats : défi d’ami',
  'battle-watch': 'Combats regardés',
  'win-daily': 'Défis du jour réussis',
  'win-training': 'Hordes d’entraînement battues',
  'win-friend': 'Défis d’amis gagnés',
  'share-daily': 'Scores partagés',
  'share-challenge': 'Défis envoyés à un ami',
  'share-back': 'Défis renvoyés',
  publish: 'Scores publiés au classement',
  install: 'Installations de l’appli',
  video: 'Vidéos enregistrées',
}

const shownDays = Array.from({ length: days }, (_, index) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - (days - 1 - index))
  return dayOf(date)
})
// The days come from dayOf, a strict date format, so they are safe inside the query.
const counts = queryD1<{ day: string; name: string; count: number }>(
  `SELECT day, name, count FROM event_counts WHERE day >= '${shownDays[0]}'`,
)
const players = queryD1<{ day: string; count: number }>(
  `SELECT day, COUNT(*) AS count FROM daily_scores WHERE day >= '${shownDays[0]}' GROUP BY day`,
)
const countOf = (name: string, day: string) => counts.find((row) => row.name === name && row.day === day)?.count ?? 0

const labelWidth = Math.max(...Object.values(LABELS).map((label) => label.length)) + 2
const cell = (value: string | number) => String(value).padStart(7)
console.info(`\n${''.padEnd(labelWidth)}${shownDays.map((day) => cell(day.slice(5))).join('')}${cell('total')}`)
for (const name of TRACKED_EVENTS) {
  const values = shownDays.map((day) => countOf(name, day))
  console.info(
    `${LABELS[name].padEnd(labelWidth)}${values.map(cell).join('')}${cell(values.reduce((a, b) => a + b, 0))}`,
  )
}
const ranked = shownDays.map((day) => players.find((row) => row.day === day)?.count ?? 0)
console.info(
  `${'Joueurs au classement'.padEnd(labelWidth)}${ranked.map(cell).join('')}${cell(ranked.reduce((a, b) => a + b, 0))}`,
)
