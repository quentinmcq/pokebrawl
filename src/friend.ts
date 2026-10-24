import { scoreOfTeam } from './leaderboard'
import { checkNickname } from './nickname'

/** A friend's team to beat, carried by a link: the team, who sent it, and the seed both players fight with. */
export interface FriendChallenge {
  team: string
  name: string
  seed: number
  points: number
  size: number
}

const FALLBACK_NAME = 'Un ami'
const MAX_SEED = 1_000_000

/**
 * Reads `?defi=ids:150*10,6&de=Sacha&seed=42`. A link can be edited by hand: a team breaking the rules gives no
 * challenge, and a nickname PokéBrawl would refuse is replaced, since it shows on screen and in link previews.
 */
export function readFriendChallenge(search: string): FriendChallenge | null {
  const query = new URLSearchParams(search)
  const team = query.get('defi')
  const score = scoreOfTeam(team)
  const seed = Number(query.get('seed') || Number.NaN)
  if (!team || !score || !Number.isSafeInteger(seed) || seed < 0 || seed >= MAX_SEED) return null
  const nickname = checkNickname(query.get('de'))
  return { team, name: nickname.ok ? nickname.nickname : FALLBACK_NAME, seed, ...score }
}

export const friendChallengeSearch = ({ team, name, seed }: Pick<FriendChallenge, 'team' | 'name' | 'seed'>) =>
  `?${new URLSearchParams({ defi: team, de: name, seed: String(seed) })}`

export const friendTeamTitle = (name: string) => `Équipe de ${name}`
