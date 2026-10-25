import { NUMBER_LOCALES, type Locale } from './locale'
import { TEAM_BUDGET } from './simulation/cost'

// French separates thousands with a narrow space that most fonts draw almost invisibly: « 1000 ». A plain
// non-breaking space reads as « 1 000 ».
const numberIn = (locale: Locale) => (value: number) =>
  value.toLocaleString(NUMBER_LOCALES[locale]).replaceAll('\u202f', '\u00a0')
const dayIn = (locale: Locale) => {
  const format = new Intl.DateTimeFormat(NUMBER_LOCALES[locale], { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return (day: string) => format.format(new Date(`${day}T12:00:00Z`))
}
const copiesOf = (copies: number) => (copies > 1 ? ` (×${copies})` : '')

const number = numberIn('fr')
// « 1 000 », as French writes thousands.
const budget = number(TEAM_BUDGET)
const frenchPlural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`
const frenchOrdinal = (rank: number) => (rank === 1 ? '1er' : `${rank}e`)
const frenchPercent = (share: number) => `${Math.round(share * 100)}\u00a0%`

/**
 * The texts of index.html, by the key each element carries: `data-i18n` for its content (HTML), `data-i18n-<attribute>`
 * for an attribute. The French ones repeat the page, which is written in French.
 */
const frenchPage = {
  title: 'PokéBrawl · Combats de masse entre Pokémon',
  description: 'Compose ton équipe de Pokémon avec 1 000 points et bats la horde du jour, ou défie tes amis.',
  manifest: '/manifest.webmanifest',
  loading: 'Chargement de l’arène…',
  menuTagline: 'Choisis deux camps et regarde-les s’affronter.',
  blueSide: 'Camp bleu',
  redSide: 'Camp rouge',
  terrain: 'Terrain',
  seed: 'Graine',
  random: 'Au hasard',
  sameSize: 'Même nombre de Pokémon par camp',
  startBattle: 'Lancer le combat',
  backToComposer: '← Composer ton équipe',
  composer: 'Composer ton équipe',
  whoWins: 'Qui gagne ?',
  matchupsPath: '/combats/',
  watchShort: 'Regarder un combat',
  otherLanguage: 'English',
  otherLanguagePath: '/en/',
  otherLanguageCode: 'en',
  install: 'Installer l’application',
  iosInstall: 'Pour l’installer : Partager, puis « Sur l’écran d’accueil ».',
  homeLabel: 'Accueil',
  back: 'Retour',
  play: 'Jouer',
  takeChallenge: 'Relever le défi',
  otherModes: 'Autres modes',
  trainingHint: 'Bats une horde au choix, autant de fois que tu veux.',
  challengeFriendHint: 'Envoie-lui ton équipe à battre.',
  daily: 'Défi du jour',
  training: 'Entraînement',
  friendMode: 'Défi d’un ami',
  ranking: 'Classement',
  rankingDay: 'Jour du classement',
  today: 'Aujourd’hui',
  yesterday: 'Hier',
  loadingShort: 'Chargement…',
  horde: 'Horde',
  hordeToBeat: 'Horde à battre',
  difficulty: 'Difficulté',
  easy: 'Facile',
  normal: 'Normal',
  hard: 'Difficile',
  yourTeam: 'Ton équipe',
  nickname: 'Ton pseudo',
  nicknameForChallenge: 'Ton pseudo pour le défi',
  challengeFriend: 'Défier un ami',
  teamHint: 'Touche un Pokémon du catalogue pour l’ajouter, et un Pokémon de ton équipe pour le retirer.',
  achievements: 'Succès',
  catalogue: 'Catalogue',
  search: 'Rechercher',
  searchPokemon: 'Rechercher un Pokémon',
  type: 'Type',
  generation: 'Génération',
  sort: 'Trier',
  cheapest: 'Prix ↑',
  dearest: 'Prix ↓',
  pokedexOrder: 'N° Pokédex',
  myPokedate: '★ Mes Pokémon PokéDate',
  pokedateImport: 'Récupère les Pokémon attrapés sur PokéDate',
  pokedateShort: '★ Mes Pokémon PokéDate',
  pokedatePokedex: 'https://pokedate.fr/pokedex?from=pokebrawl',
  clear: 'Vider',
  fill: 'Compléter',
  fillTitle: 'Compléter l’équipe au hasard',
  publish: 'Publier au classement',
  editTeam: 'Modifier mon équipe',
  rematch: 'Revanche',
  share: 'Partager',
  battleControls: 'Contrôles du combat',
  pause: 'Pause',
  speed: 'Vitesse',
  skip: 'Voir le résultat',
  result: 'Résultat',
  moreOptions: 'Plus d’options',
  newBattle: 'Nouveau combat',
  record: 'Enregistrer la vidéo',
  mute: 'Couper le son',
  fullscreen: 'Plein écran',
  recording: 'Enregistrement…',
  stop: 'Arrêter',
  videoReadyLabel: 'Vidéo prête',
  videoReady: 'Ta vidéo est prête&nbsp;!',
  download: 'Télécharger',
  close: 'Fermer',
}

export type PageKey = keyof typeof frenchPage

const englishPage: Record<PageKey, string> = {
  title: 'PokéBrawl · Mass Pokémon battles',
  description: 'Build your Pokémon team with 1,000 points and beat the daily horde, or challenge your friends.',
  manifest: '/manifest-en.webmanifest',
  loading: 'Loading the arena…',
  menuTagline: 'Pick two sides and watch them fight.',
  blueSide: 'Blue side',
  redSide: 'Red side',
  terrain: 'Terrain',
  seed: 'Seed',
  random: 'Random',
  sameSize: 'Same number of Pokémon on each side',
  startBattle: 'Start the battle',
  backToComposer: '← Build your team',
  composer: 'Build your team',
  whoWins: 'Who wins?',
  matchupsPath: '/en/battles/',
  watchShort: 'Watch a battle',
  otherLanguage: 'Français',
  otherLanguagePath: '/',
  otherLanguageCode: 'fr',
  install: 'Install the app',
  iosInstall: 'To install it: Share, then “Add to Home Screen”.',
  homeLabel: 'Home',
  back: 'Back',
  play: 'Play',
  takeChallenge: 'Take the challenge',
  otherModes: 'Other modes',
  trainingHint: 'Beat any horde you like, as often as you like.',
  challengeFriendHint: 'Send them your team to beat.',
  daily: 'Daily challenge',
  training: 'Training',
  friendMode: 'Friend’s challenge',
  ranking: 'Ranking',
  rankingDay: 'Ranking day',
  today: 'Today',
  yesterday: 'Yesterday',
  loadingShort: 'Loading…',
  horde: 'Horde',
  hordeToBeat: 'Horde to beat',
  difficulty: 'Difficulty',
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  yourTeam: 'Your team',
  nickname: 'Your nickname',
  nicknameForChallenge: 'Your nickname for the challenge',
  challengeFriend: 'Challenge a friend',
  teamHint: 'Tap a Pokémon in the catalogue to add it, and a Pokémon in your team to remove it.',
  achievements: 'Achievements',
  catalogue: 'Catalogue',
  search: 'Search',
  searchPokemon: 'Search for a Pokémon',
  type: 'Type',
  generation: 'Generation',
  sort: 'Sort',
  cheapest: 'Price ↑',
  dearest: 'Price ↓',
  pokedexOrder: 'Pokédex no.',
  myPokedate: '★ My PokéDate Pokémon',
  pokedateImport: 'Bring the Pokémon caught on PokéDate',
  pokedateShort: '★ My PokéDate Pokémon',
  pokedatePokedex: 'https://pokedate.fr/en/pokedex?from=pokebrawl',
  clear: 'Clear',
  fill: 'Fill up',
  fillTitle: 'Fill the team at random',
  publish: 'Post to the ranking',
  editTeam: 'Change my team',
  rematch: 'Rematch',
  share: 'Share',
  battleControls: 'Battle controls',
  pause: 'Pause',
  speed: 'Speed',
  skip: 'Show the result',
  result: 'Result',
  moreOptions: 'More options',
  newBattle: 'New battle',
  record: 'Record a video',
  mute: 'Mute',
  fullscreen: 'Full screen',
  recording: 'Recording…',
  stop: 'Stop',
  videoReadyLabel: 'Video ready',
  videoReady: 'Your video is ready!',
  download: 'Download',
  close: 'Close',
}

export type ServerError =
  | 'finished'
  | 'invalidRequest'
  | 'invalidTeam'
  | 'notFound'
  | 'methodNotAllowed'
  | 'refused'
  | 'tooMany'
  | 'server'
export type NicknameError = 'tooShort' | 'tooLong' | 'characters' | 'refused'

const french = {
  page: frenchPage,
  days: (count: number) => `${frenchPlural(count, 'jour')} d’affilée`,
  ordinal: frenchOrdinal,
  teamTitles: {
    type: (name: string) => `Type ${name}`,
    legendaries: 'Légendaires',
    yours: 'Ton équipe',
    horde: (pool: string) => `Horde ${pool}`,
  },
  // Composer
  allTypes: 'Types',
  allGenerations: 'Générations',
  friendTitle: (name: string) => `Défi de ${name}`,
  friendStatus: (size: number, points: number) =>
    `Bats son équipe de ${size} Pokémon (${points} points) avec tes ${budget} points. Même combat pour vous deux.`,
  dailyEyebrow: (day: string) => `Défi du ${dayIn('fr')(day)}`,
  dailyGoal: 'La même horde pour tout le monde. Bats-la avec le moins de points possible pour monter au classement.',
  dailyBest: (best: number) => `Ton record du jour\u00a0: ${number(best)} points. Peux-tu gagner avec moins\u00a0?`,
  hordeSummary: (size: number, points: number, beaten: boolean) =>
    `${size} Pokémon · ${number(points)} points${beaten ? ' · déjà battue ✓' : ''}`,
  effectiveTypes: 'Efficaces contre elle :',
  tapToFilter: 'touche pour filtrer',
  showType: (type: string) => `Montrer les Pokémon de type ${type}`,
  budgetSummary: (used: number, size: number, full: boolean) =>
    `${number(used)} / ${budget} points · ${size} Pokémon${full ? ' (maximum)' : ''}`,
  remove: (name: string) => `Retirer un ${name}`,
  challengeText: (name: string, size: number, points: number) =>
    `${name} te défie sur PokéBrawl : bats mon équipe de ${size} Pokémon (${points} points) avec tes ${budget} points !`,
  composeFirst: 'Compose d’abord ton équipe.',
  challengeCopied: 'Lien copié : envoie-le à un ami !',
  challengeSent: 'Défi envoyé !',
  shareFailed: 'Partage impossible ici.',
  welcomed: (names: string[]) =>
    `${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`} ${names.length === 1 ? 'a' : 'ont'} rejoint ton équipe : complète-la, puis bats la horde du jour !`,
  noCollection: 'Aucun Pokémon attrapé sur PokéDate pour l’instant : entre des dates là-bas pour en attraper.',
  collection: (count: number) =>
    `${count} Pokémon reçu${count > 1 ? 's' : ''} de PokéDate\u00a0: le catalogue n’affiche plus qu’eux (filtre ★).`,
  addCollection: 'Les ajouter à mon équipe',
  collectionAdded: (count: number) =>
    count === 0
      ? 'Plus de place dans ton équipe\u00a0: retire d’abord des Pokémon.'
      : `${count} Pokémon PokéDate ${count > 1 ? 'ont' : 'a'} rejoint ton équipe\u00a0: complète-la, puis bats la horde du jour\u00a0!`,
  aFriend: 'Un ami',
  friendTeam: (name: string) => `Équipe de ${name}`,
  friendLost: (name: string) => `L’équipe de ${name} a gagné. Change ton équipe !`,
  friendWon: (name: string) => `Tu as battu l’équipe de ${name} !`,
  challengeBackText: (name: string) =>
    `${name} a battu ton équipe sur PokéBrawl. À ton tour : bats la sienne avec tes ${budget} points !`,
  dailyLost: 'Raté ! Change ton équipe et retente ta chance.',
  dailyWon: (points: number, record: number | null, streak: number) =>
    `Défi réussi avec ${points} points !${record === null ? '' : ` · record : ${record}`} · 🔥 ${frenchPlural(streak, 'jour')} d’affilée`,
  dailyShare: (day: string, horde: string, points: number, streak: number) => [
    `PokéBrawl · défi du ${dayIn('fr')(day)}`,
    `${horde} battue avec ${points} points 💪`,
    `🔥 Série : ${frenchPlural(streak, 'jour')}`,
    'Fais mieux que moi :',
  ],
  // After a battle
  battleTitle: (first: string, second: string) => `${first} contre ${second} · PokéBrawl`,
  rankLine: (result: string, rank: number, total: number) => `${result} · ${frenchOrdinal(rank)} sur ${total}`,
  sendBack: 'Renvoyer le défi',
  backHome: 'Retour à l’accueil',
  overBudget: (points: number) => `${number(points)} points\u00a0: retire des Pokémon pour revenir à ${budget}.`,
  showWholeTeam: (count: number) => `Toute l’équipe (${count})`,
  showLessTeam: 'Réduire',
  linkCopied: 'Lien copié !',
  unlocked: (titles: string[]) =>
    `${titles.length > 1 ? 'Succès débloqués' : 'Succès débloqué'} : ${titles.join(', ')}`,
  // Controls
  resume: 'Reprendre',
  replay: 'Revoir le combat',
  exitFullscreen: 'Quitter le plein écran',
  changeTeams: 'Changer les équipes',
  unmute: 'Remettre le son',
  terrains: { grass: 'Prairie', sand: 'Désert', snow: 'Toundra', cave: 'Grotte' },
  // Ranking
  rankingUnreachable: 'Classement injoignable : ton score est gardé sur cet appareil.',
  rankingUnavailable: 'Classement indisponible pour le moment.',
  rankingSummary: (total: number, you: { rank: number; points: number } | null) =>
    `${frenchPlural(total, 'joueur')}${you ? ` · toi : ${frenchOrdinal(you.rank)} avec ${you.points} points` : ''}`,
  rankingEmptyToday: 'Personne n’a encore battu la horde du jour\u00a0: sois le premier\u00a0!',
  rankingEmptyYesterday: 'Personne n’a battu la horde d’hier.',
  rankingEntry: (points: number, size: number) => `${points} pts · ${size} Pokémon`,
  watch: 'Voir',
  watchBattleOf: (name: string) => `Revoir le combat de ${name}`,
  // End screen, drawn in the canvas
  draw: 'Égalité\u00a0!',
  teamWins: (team: string) => `${team} gagne\u00a0!`,
  survivorCount: (count: number) => frenchPlural(count, 'survivant'),
  mostValuable: 'Meilleur Pokémon',
  runnersUp: 'Ensuite',
  survivors: 'Survivants',
  others: (count: number) => `et ${count} autres`,
  knockOuts: (count: number) => `${count}\u00a0K.O.`,
  fighterStats: (knockOuts: number, damage: number) => `${knockOuts}\u00a0K.O. · ${number(damage)} dégâts`,
  // Report
  weakHits: (share: number) =>
    `${frenchPercent(share)} de tes attaques étaient peu efficaces ou sans effet : vise les faiblesses de l’adversaire.`,
  strongHitsTaken: (share: number, type: string) =>
    `${frenchPercent(share)} des coups reçus étaient super efficaces, surtout sur tes Pokémon ${type}.`,
  bestValue: (name: string, copies: number, knockOuts: number, points: number) =>
    `Meilleur rapport : ${name}${copiesOf(copies)}, ${knockOuts}\u00a0K.O. pour ${points} points.`,
  worstValue: (name: string, copies: number, damage: number, points: number) =>
    `Le moins rentable : ${name}${copiesOf(copies)}, ${damage} dégâts pour ${points} points.`,
  // Nicknames and the server
  nicknameErrors: {
    tooShort: 'Ton pseudo est trop court.',
    tooLong: 'Ton pseudo est trop long (20 caractères).',
    characters: 'Lettres, chiffres, espaces, tirets et apostrophes seulement.',
    refused: 'Ce pseudo n’est pas accepté.',
  } satisfies Record<NicknameError, string>,
  serverErrors: {
    finished: 'Ce défi est terminé.',
    invalidRequest: 'Requête invalide.',
    invalidTeam: 'Équipe invalide.',
    notFound: 'Introuvable.',
    methodNotAllowed: 'Méthode non permise.',
    refused: 'Requête refusée.',
    tooMany: 'Trop d’envois, réessaie dans une minute.',
    server: 'Erreur du serveur.',
  } satisfies Record<ServerError, string>,
  challengePreviewTitle: (name: string) => `${name} te défie sur PokéBrawl`,
  challengePreviewDescription: (size: number, points: number) =>
    `Bats son équipe de ${size} Pokémon (${points} points) avec tes ${budget} points.`,
}

type Messages = typeof french

const englishNumber = numberIn('en')
const englishBudget = englishNumber(TEAM_BUDGET)
const englishPlural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
const englishOrdinal = (rank: number) => {
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' }
  const teen = Math.floor(rank / 10) % 10 === 1
  return `${rank}${(!teen && suffixes[rank % 10]) || 'th'}`
}
const englishPercent = (share: number) => `${Math.round(share * 100)}%`

const english: Messages = {
  page: englishPage,
  days: (count) => `${englishPlural(count, 'day')} in a row`,
  ordinal: englishOrdinal,
  teamTitles: {
    type: (name) => `${name} Type`,
    legendaries: 'Legendaries',
    yours: 'Your team',
    horde: (pool) => `${pool} Horde`,
  },
  allTypes: 'Types',
  allGenerations: 'Generations',
  friendTitle: (name) => `${name}’s challenge`,
  friendStatus: (size, points) =>
    `Beat their team of ${size} Pokémon (${points} points) with your ${englishBudget} points. The same battle for you both.`,
  dailyEyebrow: (day) => `${dayIn('en')(day)} challenge`,
  dailyGoal: 'The same horde for everyone. Beat it with as few points as you can to climb the ranking.',
  dailyBest: (best) => `Your best today: ${englishNumber(best)} points. Can you win with fewer?`,
  hordeSummary: (size, points, beaten) =>
    `${size} Pokémon · ${englishNumber(points)} points${beaten ? ' · already beaten ✓' : ''}`,
  effectiveTypes: 'Effective against it:',
  tapToFilter: 'tap to filter',
  showType: (type) => `Show ${type}-type Pokémon`,
  budgetSummary: (used, size, full) =>
    `${englishNumber(used)} / ${englishBudget} points · ${size} Pokémon${full ? ' (maximum)' : ''}`,
  remove: (name) => `Remove a ${name}`,
  challengeText: (name, size, points) =>
    `${name} challenges you on PokéBrawl: beat my team of ${size} Pokémon (${points} points) with your ${englishBudget} points!`,
  composeFirst: 'Build your team first.',
  challengeCopied: 'Link copied: send it to a friend!',
  challengeSent: 'Challenge sent!',
  shareFailed: 'Sharing is not possible here.',
  welcomed: (names) =>
    `${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`} joined your team: fill it up, then beat the daily horde!`,
  noCollection: 'No Pokémon caught on PokéDate yet: go on dates there to catch some.',
  collection: (count) => `${count} Pokémon received from PokéDate: the catalogue now shows only them (★ filter).`,
  addCollection: 'Add them to my team',
  collectionAdded: (count) =>
    count === 0
      ? 'No room left in your team: remove some Pokémon first.'
      : `${count} PokéDate Pokémon joined your team: fill it up, then beat the daily horde!`,
  aFriend: 'A friend',
  friendTeam: (name) => `${name}’s team`,
  friendLost: (name) => `${name}’s team won. Change your team!`,
  friendWon: (name) => `You beat ${name}’s team!`,
  challengeBackText: (name) =>
    `${name} beat your team on PokéBrawl. Your turn: beat theirs with your ${englishBudget} points!`,
  dailyLost: 'Missed! Change your team and try again.',
  dailyWon: (points, record, streak) =>
    `Challenge beaten with ${points} points!${record === null ? '' : ` · best: ${record}`} · 🔥 ${englishPlural(streak, 'day')} in a row`,
  dailyShare: (day, horde, points, streak) => [
    `PokéBrawl · ${dayIn('en')(day)} challenge`,
    `${horde} beaten with ${points} points 💪`,
    `🔥 Streak: ${englishPlural(streak, 'day')}`,
    'Do better than me:',
  ],
  battleTitle: (first, second) => `${first} vs ${second} · PokéBrawl`,
  rankLine: (result, rank, total) => `${result} · ${englishOrdinal(rank)} of ${total}`,
  sendBack: 'Send the challenge back',
  backHome: 'Back to the home page',
  overBudget: (points) => `${englishNumber(points)} points: remove some Pokémon to get back to ${englishBudget}.`,
  showWholeTeam: (count) => `Whole team (${count})`,
  showLessTeam: 'Show less',
  linkCopied: 'Link copied!',
  unlocked: (titles) => `${titles.length > 1 ? 'Achievements unlocked' : 'Achievement unlocked'}: ${titles.join(', ')}`,
  resume: 'Resume',
  replay: 'Watch the battle again',
  exitFullscreen: 'Exit full screen',
  changeTeams: 'Change the teams',
  unmute: 'Unmute',
  terrains: { grass: 'Meadow', sand: 'Desert', snow: 'Tundra', cave: 'Cave' },
  rankingUnreachable: 'The ranking cannot be reached: your score is kept on this device.',
  rankingUnavailable: 'The ranking is unavailable for now.',
  rankingSummary: (total, you) =>
    `${englishPlural(total, 'player')}${you ? ` · you: ${englishOrdinal(you.rank)} with ${you.points} points` : ''}`,
  rankingEmptyToday: 'Nobody has beaten today’s horde yet: be the first!',
  rankingEmptyYesterday: 'Nobody beat yesterday’s horde.',
  rankingEntry: (points, size) => `${points} pts · ${size} Pokémon`,
  watch: 'Watch',
  watchBattleOf: (name) => `Watch ${name}’s battle again`,
  draw: 'Draw!',
  teamWins: (team) => `${team} wins!`,
  survivorCount: (count) => englishPlural(count, 'survivor'),
  mostValuable: 'Best Pokémon',
  runnersUp: 'Runners-up',
  survivors: 'Survivors',
  others: (count) => `and ${count} more`,
  knockOuts: (count) => `${count} KO${count === 1 ? '' : 's'}`,
  fighterStats: (knockOuts, damage) => `${knockOuts} KO${knockOuts === 1 ? '' : 's'} · ${englishNumber(damage)} damage`,
  weakHits: (share) =>
    `${englishPercent(share)} of your attacks were not very effective or had no effect: aim at the opponent’s weaknesses.`,
  strongHitsTaken: (share, type) =>
    `${englishPercent(share)} of the hits you took were super effective, mostly on your ${type} Pokémon.`,
  bestValue: (name, copies, knockOuts, points) =>
    `Best value: ${name}${copiesOf(copies)}, ${englishPlural(knockOuts, 'KO')} for ${points} points.`,
  worstValue: (name, copies, damage, points) =>
    `Least worth it: ${name}${copiesOf(copies)}, ${damage} damage for ${points} points.`,
  nicknameErrors: {
    tooShort: 'Your nickname is too short.',
    tooLong: 'Your nickname is too long (20 characters).',
    characters: 'Letters, digits, spaces, hyphens and apostrophes only.',
    refused: 'This nickname is not accepted.',
  },
  serverErrors: {
    finished: 'This challenge is over.',
    invalidRequest: 'Invalid request.',
    invalidTeam: 'Invalid team.',
    notFound: 'Not found.',
    methodNotAllowed: 'Method not allowed.',
    refused: 'Request refused.',
    tooMany: 'Too many submissions, try again in a minute.',
    server: 'Server error.',
  },
  challengePreviewTitle: (name) => `${name} challenges you on PokéBrawl`,
  challengePreviewDescription: (size, points) =>
    `Beat their team of ${size} Pokémon (${points} points) with your ${englishBudget} points.`,
}

export const MESSAGES: Record<Locale, Messages> = { fr: french, en: english }

/** The attributes index.html translates, each from its `data-i18n-<attribute>` key. */
export const TRANSLATED_ATTRIBUTES = ['content', 'href', 'hreflang', 'lang', 'placeholder', 'aria-label', 'title']
