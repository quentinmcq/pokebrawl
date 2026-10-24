// The same rules as PokéDate's nicknames: names show publicly in the daily ranking.
export const NICKNAME_LENGTH = { min: 2, max: 20 } as const

const ALLOWED_CHARACTERS = /^[\p{L}\p{N} '_-]+$/u

const LOOKALIKE_LETTERS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
}

// Short words are only matched as whole words, so first names such as "Constance" stay allowed.
const BLOCKED_WORDS = ['con', 'cons', 'pd', 'fdp', 'ntm', 'tg', 'ass', 'cul', 'sex']
const BLOCKED_FRAGMENTS = [
  'connard',
  'connasse',
  'salop',
  'putain',
  'pute',
  'encul',
  'nique',
  'niquer',
  'batard',
  'bite',
  'couille',
  'chatte',
  'branl',
  'enfoir',
  'pede',
  'tapette',
  'gouine',
  'negre',
  'negro',
  'bougnoul',
  'youpin',
  'nazi',
  'hitler',
  'porn',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigg',
  'fagg',
  'whore',
  'dick',
  'pussy',
  'penis',
  'viagra',
  'casino',
]

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/[0134578]/g, (digit) => LOOKALIKE_LETTERS[digit] ?? digit)

export const cleanNickname = (value: unknown) => (typeof value === 'string' ? value.trim().replaceAll(/\s+/g, ' ') : '')

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; error: string }

export function checkNickname(value: unknown): NicknameCheck {
  const nickname = cleanNickname(value)
  if (nickname.length < NICKNAME_LENGTH.min) return { ok: false, error: 'Ton pseudo est trop court.' }
  if (nickname.length > NICKNAME_LENGTH.max) return { ok: false, error: 'Ton pseudo est trop long (20 caractères).' }
  if (!ALLOWED_CHARACTERS.test(nickname))
    return { ok: false, error: 'Lettres, chiffres, espaces, tirets et apostrophes seulement.' }
  const words = normalized(nickname).split(/[\s'_-]+/)
  const spelledOutWord = words.filter((word) => word.length === 1).join('')
  const isBlocked =
    words.some((word) => BLOCKED_WORDS.includes(word)) ||
    [...words, spelledOutWord].some((word) => BLOCKED_FRAGMENTS.some((fragment) => word.includes(fragment)))
  if (isBlocked) return { ok: false, error: 'Ce pseudo n’est pas accepté.' }
  return { ok: true, nickname }
}
