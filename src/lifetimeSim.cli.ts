import { SEASON_OPTIONS } from './lifetimeConfig'
import { formatReport, runLifetimeSim } from './lifetimeSim'
import type { LeagueId } from './leagues'

// Uso:  npx tsx src/lifetimeSim.cli.ts [temporadas=100] [semilla] [liga=esp]
// Ejemplo para las tres duraciones:  npx tsx src/lifetimeSim.cli.ts 30 && npx tsx src/lifetimeSim.cli.ts 50 && npx tsx src/lifetimeSim.cli.ts 100
const seasons = Number(process.argv[2] ?? 100)
if (!(SEASON_OPTIONS as readonly number[]).includes(seasons)) {
  console.error(`Las duraciones válidas son ${SEASON_OPTIONS.join(', ')}`)
  process.exit(1)
}
const seed = process.argv[3] ? Number(process.argv[3]) : undefined
const leagueId = (process.argv[4] ?? 'esp') as LeagueId
const t0 = Date.now()
console.log(formatReport(runLifetimeSim({ seasons, seed, leagueId })))
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`)
