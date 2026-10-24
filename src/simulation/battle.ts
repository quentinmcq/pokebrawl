import { battleStatsOf, expectedDamage, hits, rollDamage, type BattleStats } from './damage'
import { createRandom, type Random } from './random'
import { typeEffectiveness } from './typeChart'
import type { Move, PokemonTypes, Species } from './types'

// The arena is measured in abstract units with a 9:16 ratio, so that it fills a vertical video.
export const ARENA_WIDTH = 36
export const ARENA_HEIGHT = 64
// Close to half the drawn sprite size: a smaller body lets the crowd pile up into an unreadable heap.
export const FIGHTER_RADIUS = 0.8
export const TICKS_PER_SECOND = 20
const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND
const MAX_DURATION_SECONDS = 180
const SPAWN_MARGIN = 2
const SPAWN_ZONE_HEIGHT = 18
const MELEE_REACH = 0.4
const SPECIAL_REACH = 5
const RETARGET_INTERVAL_SECONDS = 0.5
const BASE_ATTACK_INTERVAL_SECONDS = 2.5
// Real HP would end a crowd battle in a few seconds; a deeper pool leaves time to follow it on screen.
const HEALTH_MULTIPLIER = 2
const BEST_MOVE_CHANCE = 0.75
const GRID_CELL_SIZE = 2 * FIGHTER_RADIUS

export type TeamIndex = 0 | 1
export type BattleOutcome = TeamIndex | 'draw'

export interface FighterSetup {
  species: Species
  moves: Move[]
}

export interface TeamSetup {
  label: string
  fighters: FighterSetup[]
}

export interface BattleSetup {
  teams: [TeamSetup, TeamSetup]
  seed: number
}

export interface Fighter {
  index: number
  team: TeamIndex
  species: Species
  types: PokemonTypes
  moves: Move[]
  stats: BattleStats
  maxHp: number
  hp: number
  x: number
  y: number
  /** Units per second. */
  moveSpeed: number
  attackIntervalSeconds: number
  attackCooldownSeconds: number
  targetIndex: number | null
  retargetCooldownSeconds: number
  knockOuts: number
  damageDealt: number
  knockedOutAtTick: number | null
}

export type BattleEvent =
  | {
      kind: 'hit'
      tick: number
      attacker: number
      target: number
      move: Move
      damage: number
      multiplier: number
      critical: boolean
    }
  | { kind: 'miss'; tick: number; attacker: number; target: number; move: Move }
  | { kind: 'knockOut'; tick: number; fighter: number; by: number }

export interface Battle {
  teamLabels: [string, string]
  tick: number
  fighters: Fighter[]
  /** Fighters act in a shuffled order so that neither team always strikes first within a tick. */
  actingOrder: number[]
  random: Random
  outcome: BattleOutcome | null
}

export interface BattleResult {
  outcome: BattleOutcome
  durationSeconds: number
  survivors: [Fighter[], Fighter[]]
  mostValuable: Fighter
}

export const secondsAt = (tick: number) => tick * SECONDS_PER_TICK
export const isAlive = (fighter: Fighter) => fighter.hp > 0
const reachOf = (move: Move) => (move.category === 'special' ? SPECIAL_REACH : MELEE_REACH)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function spawnPositions(count: number, team: TeamIndex, random: Random) {
  const usableWidth = ARENA_WIDTH - 2 * SPAWN_MARGIN
  const columns = Math.max(1, Math.ceil(Math.sqrt((count * usableWidth) / SPAWN_ZONE_HEIGHT)))
  const rows = Math.ceil(count / columns)
  const cellWidth = usableWidth / columns
  const cellHeight = SPAWN_ZONE_HEIGHT / rows
  const cells = Array.from({ length: columns * rows }, (_, cell) => ({
    column: cell % columns,
    row: Math.floor(cell / columns),
  }))
  return random
    .shuffle(cells)
    .slice(0, count)
    .map(({ column, row }) => {
      const depth = (row + 0.5 + random.between(-0.25, 0.25)) * cellHeight
      return {
        x: SPAWN_MARGIN + (column + 0.5 + random.between(-0.25, 0.25)) * cellWidth,
        y: team === 0 ? SPAWN_MARGIN + depth : ARENA_HEIGHT - SPAWN_MARGIN - depth,
      }
    })
}

function createFighter(
  setup: FighterSetup,
  team: TeamIndex,
  index: number,
  position: { x: number; y: number },
  random: Random,
): Fighter {
  const stats = battleStatsOf(setup.species.stats)
  const baseSpeed = setup.species.stats.speed
  const attackIntervalSeconds = BASE_ATTACK_INTERVAL_SECONDS * clamp(1.25 - baseSpeed / 400, 0.75, 1.25)
  return {
    index,
    team,
    species: setup.species,
    types: setup.species.types,
    moves: setup.moves,
    stats,
    maxHp: stats.maxHp * HEALTH_MULTIPLIER,
    hp: stats.maxHp * HEALTH_MULTIPLIER,
    ...position,
    moveSpeed: 1 + baseSpeed / 60,
    attackIntervalSeconds,
    attackCooldownSeconds: random.between(0, attackIntervalSeconds),
    targetIndex: null,
    retargetCooldownSeconds: 0,
    knockOuts: 0,
    damageDealt: 0,
    knockedOutAtTick: null,
  }
}

export function createBattle({ teams, seed }: BattleSetup): Battle {
  const random = createRandom(seed)
  const fighters: Fighter[] = []
  teams.forEach((team, teamIndex) => {
    const positions = spawnPositions(team.fighters.length, teamIndex as TeamIndex, random)
    team.fighters.forEach((setup, position) =>
      fighters.push(createFighter(setup, teamIndex as TeamIndex, fighters.length, positions[position]!, random)),
    )
  })
  return {
    teamLabels: [teams[0].label, teams[1].label],
    tick: 0,
    fighters,
    actingOrder: random.shuffle(fighters.map((fighter) => fighter.index)),
    random,
    outcome: decideOutcome(fighters, 0),
  }
}

const distanceBetween = (a: Fighter, b: Fighter) => Math.hypot(a.x - b.x, a.y - b.y)

const canDamage = (attacker: Fighter, defender: Fighter) =>
  attacker.moves.some((move) => typeEffectiveness(move.type, defender.types) > 0)

function findTarget(battle: Battle, fighter: Fighter) {
  let nearest: Fighter | undefined
  let nearestDamageable: Fighter | undefined
  for (const other of battle.fighters) {
    if (other.team === fighter.team || !isAlive(other)) continue
    const distance = distanceBetween(fighter, other)
    if (!nearest || distance < distanceBetween(fighter, nearest)) nearest = other
    if (canDamage(fighter, other) && (!nearestDamageable || distance < distanceBetween(fighter, nearestDamageable)))
      nearestDamageable = other
  }
  return nearestDamageable ?? nearest
}

function chooseMove(fighter: Fighter, target: Fighter, usableMoves: Move[], random: Random) {
  const effectiveMoves = usableMoves.filter((move) => typeEffectiveness(move.type, target.types) > 0)
  const candidates = effectiveMoves.length > 0 ? effectiveMoves : usableMoves
  if (!random.chance(BEST_MOVE_CHANCE)) return candidates[random.integer(candidates.length)]!
  return candidates.reduce((best, move) =>
    expectedDamage(move, fighter, target) > expectedDamage(best, fighter, target) ? move : best,
  )
}

function attack(battle: Battle, fighter: Fighter, target: Fighter, gap: number, events: BattleEvent[]) {
  const usableMoves = fighter.moves.filter((move) => reachOf(move) >= gap)
  const move = chooseMove(fighter, target, usableMoves, battle.random)
  fighter.attackCooldownSeconds = fighter.attackIntervalSeconds
  const tick = battle.tick
  if (!hits(move, battle.random)) {
    events.push({ kind: 'miss', tick, attacker: fighter.index, target: target.index, move })
    return
  }
  const { damage, multiplier, critical } = rollDamage(move, fighter, target, battle.random)
  const damageDealt = Math.min(damage, target.hp)
  target.hp -= damageDealt
  fighter.damageDealt += damageDealt
  events.push({
    kind: 'hit',
    tick,
    attacker: fighter.index,
    target: target.index,
    move,
    damage: damageDealt,
    multiplier,
    critical,
  })
  if (isAlive(target)) return
  target.knockedOutAtTick = tick
  fighter.knockOuts++
  fighter.targetIndex = null
  events.push({ kind: 'knockOut', tick, fighter: target.index, by: fighter.index })
}

function act(battle: Battle, fighter: Fighter, events: BattleEvent[]) {
  fighter.attackCooldownSeconds -= SECONDS_PER_TICK
  fighter.retargetCooldownSeconds -= SECONDS_PER_TICK

  let target = fighter.targetIndex === null ? undefined : battle.fighters[fighter.targetIndex]
  if (!target || !isAlive(target) || fighter.retargetCooldownSeconds <= 0) {
    target = findTarget(battle, fighter)
    fighter.targetIndex = target?.index ?? null
    fighter.retargetCooldownSeconds = RETARGET_INTERVAL_SECONDS
  }
  if (!target) return

  const distance = distanceBetween(fighter, target)
  const gap = distance - 2 * FIGHTER_RADIUS
  const reach = Math.max(...fighter.moves.map(reachOf))
  if (gap > reach) {
    // Stop slightly inside the reach so that pushes from the crowd do not take the target out of range at once.
    const step = Math.min(fighter.moveSpeed * SECONDS_PER_TICK, gap - reach * 0.9)
    fighter.x += ((target.x - fighter.x) / distance) * step
    fighter.y += ((target.y - fighter.y) / distance) * step
  } else if (fighter.attackCooldownSeconds <= 0) {
    attack(battle, fighter, target, gap, events)
  }
}

// Overlapping fighters push each other apart, found through a spatial grid to avoid comparing every pair.
function separateFighters(battle: Battle) {
  const columns = Math.ceil(ARENA_WIDTH / GRID_CELL_SIZE)
  const cellOf = (fighter: Fighter) => ({
    column: Math.floor(fighter.x / GRID_CELL_SIZE),
    row: Math.floor(fighter.y / GRID_CELL_SIZE),
  })
  const grid = new Map<number, Fighter[]>()
  const alive = battle.fighters.filter(isAlive)
  for (const fighter of alive) {
    const { column, row } = cellOf(fighter)
    const key = row * columns + column
    const cell = grid.get(key)
    if (cell) cell.push(fighter)
    else grid.set(key, [fighter])
  }

  for (const fighter of alive) {
    const { column, row } = cellOf(fighter)
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        for (const other of grid.get((row + rowOffset) * columns + column + columnOffset) ?? []) {
          if (other.index <= fighter.index) continue
          const distance = distanceBetween(fighter, other)
          const overlap = 2 * FIGHTER_RADIUS - distance
          if (overlap <= 0) continue
          const angle =
            distance > 0 ? Math.atan2(other.y - fighter.y, other.x - fighter.x) : battle.random.between(0, 2 * Math.PI)
          const pushX = (Math.cos(angle) * overlap) / 2
          const pushY = (Math.sin(angle) * overlap) / 2
          fighter.x -= pushX
          fighter.y -= pushY
          other.x += pushX
          other.y += pushY
        }
      }
    }
  }

  for (const fighter of alive) {
    fighter.x = clamp(fighter.x, FIGHTER_RADIUS, ARENA_WIDTH - FIGHTER_RADIUS)
    fighter.y = clamp(fighter.y, FIGHTER_RADIUS, ARENA_HEIGHT - FIGHTER_RADIUS)
  }
}

function remainingHealthShare(fighters: Fighter[], team: TeamIndex) {
  const members = fighters.filter((fighter) => fighter.team === team)
  return members.reduce((total, fighter) => total + fighter.hp / fighter.maxHp, 0) / members.length
}

function decideOutcome(fighters: Fighter[], tick: number): BattleOutcome | null {
  const aliveInTeam = (team: TeamIndex) => fighters.some((fighter) => fighter.team === team && isAlive(fighter))
  const firstAlive = aliveInTeam(0)
  const secondAlive = aliveInTeam(1)
  if (!firstAlive && !secondAlive) return 'draw'
  if (!firstAlive) return 1
  if (!secondAlive) return 0
  if (secondsAt(tick) < MAX_DURATION_SECONDS) return null
  const firstShare = remainingHealthShare(fighters, 0)
  const secondShare = remainingHealthShare(fighters, 1)
  if (firstShare === secondShare) return 'draw'
  return firstShare > secondShare ? 0 : 1
}

export function stepBattle(battle: Battle): BattleEvent[] {
  if (battle.outcome !== null) return []
  battle.tick++
  const events: BattleEvent[] = []
  for (const index of battle.actingOrder) {
    const fighter = battle.fighters[index]!
    if (isAlive(fighter)) act(battle, fighter, events)
  }
  separateFighters(battle)
  battle.outcome = decideOutcome(battle.fighters, battle.tick)
  return events
}

export function summarizeBattle(battle: Battle): BattleResult {
  if (battle.outcome === null) throw new Error('The battle is not over yet')
  const survivorsOf = (team: TeamIndex) =>
    battle.fighters.filter((fighter) => fighter.team === team && isAlive(fighter))
  const mostValuable = battle.fighters.reduce((best, fighter) =>
    fighter.knockOuts > best.knockOuts ||
    (fighter.knockOuts === best.knockOuts && fighter.damageDealt > best.damageDealt)
      ? fighter
      : best,
  )
  return {
    outcome: battle.outcome,
    durationSeconds: secondsAt(battle.tick),
    survivors: [survivorsOf(0), survivorsOf(1)],
    mostValuable,
  }
}

export function runBattle(setup: BattleSetup, onEvents?: (events: BattleEvent[], battle: Battle) => void) {
  const battle = createBattle(setup)
  while (battle.outcome === null) {
    const events = stepBattle(battle)
    if (events.length > 0) onEvents?.(events, battle)
  }
  return { battle, result: summarizeBattle(battle) }
}
