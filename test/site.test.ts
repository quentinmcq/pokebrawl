import { describe, expect, it } from 'vitest'
import { canonicalRedirect } from '../src/site'

describe('canonicalRedirect', () => {
  it('sends the old addresses to pokebrawl.fr, path and query kept', () => {
    expect(canonicalRedirect(new URL('https://pokebrawl.quentin-macq.workers.dev/?defi=ids:25&de=Ash&seed=1'))).toBe(
      'https://pokebrawl.fr/?defi=ids:25&de=Ash&seed=1',
    )
    expect(canonicalRedirect(new URL('https://www.pokebrawl.fr/en/battles/gen-1-vs-gen-3/'))).toBe(
      'https://pokebrawl.fr/en/battles/gen-1-vs-gen-3/',
    )
  })

  it('keeps the API and the service worker where they are, for the apps installed before the move', () => {
    expect(canonicalRedirect(new URL('https://pokebrawl.quentin-macq.workers.dev/api/daily/2026-10-25'))).toBeNull()
    expect(canonicalRedirect(new URL('https://pokebrawl.quentin-macq.workers.dev/sw.js'))).toBeNull()
  })

  it('leaves the site itself alone', () => {
    expect(canonicalRedirect(new URL('https://pokebrawl.fr/combats/'))).toBeNull()
  })
})
