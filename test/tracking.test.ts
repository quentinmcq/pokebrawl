import { describe, expect, it } from 'vitest'
import { arrivalOf, isTrackedEvent } from '../src/tracking'

const arrival = (overrides: Partial<Parameters<typeof arrivalOf>[0]>) =>
  arrivalOf({ search: '', hash: '', referrer: '', host: 'pokebrawl.example', ...overrides })

describe('arrivals', () => {
  it('tells where a visitor came from', () => {
    expect(arrival({ search: '?equipe=ids:25' })).toBe('arrival-pokedate')
    expect(arrival({ hash: '#pokedex=1.AAA' })).toBe('arrival-pokedate')
    expect(arrival({ referrer: 'https://pokedate.fr/pokemon/25-pikachu' })).toBe('arrival-pokedate')
    expect(arrival({ search: '?defi=ids:25&de=Sacha&seed=1' })).toBe('arrival-friend')
    expect(arrival({ referrer: 'https://pokebrawl.example/combats/gen-1-contre-gen-3/' })).toBe('arrival-matchup-page')
    expect(arrival({ referrer: 'https://www.google.fr/' })).toBe('arrival-search')
    expect(arrival({ referrer: 'https://www.reddit.com/r/pokemon' })).toBe('arrival-other-site')
    expect(arrival({})).toBe('arrival-direct')
  })

  it('accepts only the listed events', () => {
    expect(isTrackedEvent('visit')).toBe(true)
    expect(isTrackedEvent('anything')).toBe(false)
  })
})
