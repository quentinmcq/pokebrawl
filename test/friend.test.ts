import { describe, expect, it } from 'vitest'
import { friendChallengeSearch, readFriendChallenge } from '../src/friend'
import { scoreOfTeam } from '../src/leaderboard'

describe('friend challenge links', () => {
  it('reads back the challenge a link was made from', () => {
    const challenge = readFriendChallenge(
      friendChallengeSearch({ team: 'ids:66*3,6*2', name: 'Sacha', seed: 42 }),
      'Un ami',
    )
    expect(challenge).toEqual({ team: 'ids:66*3,6*2', name: 'Sacha', seed: 42, ...scoreOfTeam('ids:66*3,6*2') })
  })

  it('ignores a link whose team breaks the rules or lacks a seed', () => {
    expect(readFriendChallenge('?defi=ids:129*101&de=Sacha&seed=1', 'Un ami')).toBeNull()
    expect(readFriendChallenge('?defi=gen1&de=Sacha&seed=1', 'Un ami')).toBeNull()
    expect(readFriendChallenge('?defi=ids:25&de=Sacha', 'Un ami')).toBeNull()
    expect(readFriendChallenge('', 'Un ami')).toBeNull()
  })

  it('replaces a nickname that would be refused', () => {
    expect(readFriendChallenge('?defi=ids:25&de=fdp&seed=1', 'Un ami')?.name).toBe('Un ami')
    expect(readFriendChallenge('?defi=ids:25&seed=1', 'Un ami')?.name).toBe('Un ami')
  })
})
