import { execFileSync } from 'node:child_process'

/** Runs a query on the `pokebrawl` D1 database, the live one or the local one of `bun run dev:api`, through Wrangler. */
export function queryD1<Row>(sql: string, { local = false } = {}): Row[] {
  const output = execFileSync(
    'bunx',
    ['wrangler', 'd1', 'execute', 'pokebrawl', local ? '--local' : '--remote', '--json', '--command', sql],
    { encoding: 'utf8' },
  )
  return (JSON.parse(output) as { results: Row[] }[])[0]?.results ?? []
}
