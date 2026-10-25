import { parseHorde, TEAM_SELECTORS } from './simulation/teams'

/** What a player has done so far, from what the browser keeps. */
export interface AchievementState {
  /** Training hordes beaten, such as `horde:gen1:1000`. */
  trainingWins: string[]
  dailyStreak: number
  friendWins: number
  /** The best place reached in a daily ranking. */
  bestRank: number | null
}

/** A win that counts: the player's own team, against today's daily horde, a training horde or a friend. */
export interface CountedWin {
  /** The Pokémon of the winning team, repeats included. */
  speciesIds: number[]
  points: number
  /** The Pokémon caught on PokéDate. */
  collection: number[]
}

export interface Achievement {
  id: string
  title: string
  description: string
  /** The Pokémon pictured on the badge. */
  emblem: number
  /** How far along a long-term goal stands, for the ones that take several battles. */
  progress?: (state: AchievementState) => { done: number; total: number }
  isUnlocked: (state: AchievementState, win: CountedWin | null) => boolean
}

const GENERATION_POOLS = TEAM_SELECTORS.filter((selector) => selector.startsWith('gen'))
const TYPE_POOLS = TEAM_SELECTORS.filter((selector) => selector.startsWith('type:'))
const MAGIKARP = 129
const HARD_LEVEL = 1250

const poolsBeaten = (state: AchievementState) => new Set(state.trainingWins.map((win) => parseHorde(win)?.pool))
const goal = (done: number, total: number) => ({ done: Math.min(done, total), total })
const countIn = (pools: string[]) => (state: AchievementState) =>
  goal(pools.filter((pool) => poolsBeaten(state).has(pool)).length, pools.length)

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-win',
    title: 'Premier succès',
    description: 'Gagne ton premier défi.',
    emblem: 25,
    isUnlocked: (_, win) => win !== null,
  },
  {
    id: 'generations',
    title: 'Maître des générations',
    description: 'Bats les 9 hordes de génération à l’entraînement.',
    emblem: 493,
    progress: countIn(GENERATION_POOLS),
    isUnlocked: (state) => countIn(GENERATION_POOLS)(state).done === GENERATION_POOLS.length,
  },
  {
    id: 'types',
    title: 'Maître des types',
    description: 'Bats les 18 hordes de type à l’entraînement.',
    emblem: 133,
    progress: countIn(TYPE_POOLS),
    isUnlocked: (state) => countIn(TYPE_POOLS)(state).done === TYPE_POOLS.length,
  },
  {
    id: 'legendaries',
    title: 'Chasseur de légendes',
    description: 'Bats la horde des légendaires.',
    emblem: 150,
    isUnlocked: (state) => poolsBeaten(state).has('legendaries'),
  },
  {
    id: 'hard',
    title: 'Sans pitié',
    description: 'Bats une horde en difficulté Difficile.',
    emblem: 248,
    isUnlocked: (state) => state.trainingWins.some((win) => parseHorde(win)?.value === HARD_LEVEL),
  },
  {
    id: 'streak-7',
    title: 'Une semaine de feu',
    description: 'Réussis le défi du jour 7 jours de suite.',
    emblem: 77,
    progress: (state) => goal(state.dailyStreak, 7),
    isUnlocked: (state) => state.dailyStreak >= 7,
  },
  {
    id: 'streak-30',
    title: 'Un mois sans faillir',
    description: 'Réussis le défi du jour 30 jours de suite.',
    emblem: 250,
    progress: (state) => goal(state.dailyStreak, 30),
    isUnlocked: (state) => state.dailyStreak >= 30,
  },
  {
    id: 'podium',
    title: 'Sur le podium',
    description: 'Finis dans les 3 premiers du classement du jour.',
    emblem: 249,
    isUnlocked: (state) => state.bestRank !== null && state.bestRank <= 3,
  },
  {
    id: 'friend',
    title: 'Le plus fort',
    description: 'Bats l’équipe d’un ami.',
    emblem: 68,
    isUnlocked: (state) => state.friendWins > 0,
  },
  {
    id: 'thrifty',
    title: 'Économe',
    description: 'Gagne un défi avec moins de 500 points.',
    emblem: 52,
    isUnlocked: (_, win) => win !== null && win.points < 500,
  },
  {
    id: 'single-species',
    title: 'Clones',
    description: 'Gagne avec une équipe d’une seule espèce.',
    emblem: 132,
    isUnlocked: (_, win) => win !== null && new Set(win.speciesIds).size === 1,
  },
  {
    id: 'swarm',
    title: 'La nuée',
    description: 'Gagne avec au moins 60 Pokémon.',
    emblem: 15,
    isUnlocked: (_, win) => win !== null && win.speciesIds.length >= 60,
  },
  {
    id: 'few',
    title: 'Peu mais costauds',
    description: 'Gagne avec 10 Pokémon ou moins.',
    emblem: 149,
    isUnlocked: (_, win) => win !== null && win.speciesIds.length <= 10,
  },
  {
    id: 'magikarp',
    title: 'La revanche de Magicarpe',
    description: 'Gagne avec au moins 10 Magicarpe dans ton équipe.',
    emblem: MAGIKARP,
    isUnlocked: (_, win) => win !== null && win.speciesIds.filter((id) => id === MAGIKARP).length >= 10,
  },
  {
    id: 'pokedate',
    title: 'Dresseur de PokéDate',
    description: 'Gagne avec une équipe faite uniquement de Pokémon attrapés sur PokéDate.',
    emblem: 137,
    isUnlocked: (_, win) =>
      win !== null && win.collection.length > 0 && win.speciesIds.every((id) => win.collection.includes(id)),
  },
]

/** The achievements newly earned, given the ones already unlocked, after a win or any change of state. */
export const newlyUnlocked = (unlocked: Set<string>, state: AchievementState, win: CountedWin | null) =>
  ACHIEVEMENTS.filter((achievement) => !unlocked.has(achievement.id) && achievement.isUnlocked(state, win))
