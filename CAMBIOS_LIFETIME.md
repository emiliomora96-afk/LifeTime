# Lifetime · Val, cantera, desarrollo, declive y mercado

Copia el contenido de `src/` sobre tu `src/` (reemplaza y añade). Todo el balance se ajusta en **`src/lifetimeConfig.ts`**.

## Cómo funcionaba el Val antes
- Plantillas iniciales: `placeholderSquad` generaba picos alrededor del nivel del club y desplazaba el once hasta ese nivel. Niveles de 67 a 80,5 (media de 1.ª ≈ 73,6).
- Crecimiento: fracción fija de la distancia al pico (`REMAINING`) con topes por minutos. Pico a los 26.
- Cantera: potencial = nivel del equipo − 3 + bono + ruido (dependía del nivel del propio club, no de la inversión).
- Declive: tabla fija desde los 31 (porteros +3).
- Reposición de la IA: `TALENT_REF = 69` fijo (no seguía a la liga).
- Mercado: valor = f(Val o media Val/potencial) con curva fija; sueldo cuadrático. Élite = etiqueta permanente (precio ×1,3).

## Qué cambié
**Nuevos:** `lifetimeConfig.ts`, `lifetimeSim.ts` (simulación sin interfaz), `lifetimeSim.cli.ts`, `lifetime.test.ts`, `INFORME_VALIDACION.txt`.

**Modificados:** `players.ts`, `academy.ts`, `squads.ts`, `aiclubs.ts`, `engine.ts`, `market.ts`, `clubs.ts`, `config.ts`, `economy.ts`, `game.ts` (1 línea), y tests `players.test.ts`, `development.test.ts`, `ai.test.ts`.

1. **Distribución / punto de partida** (`engine.createLeague`, `START`): Val medio de 1.ª 81,5 y de 2.ª 73,5. `eliteClubsPerLeague = 4` (cámbialo a 3-6). Élite = presupuesto 150 M; resto: grande 30 M … 4,5 M. Máx. 2 jugadores 95+ por club (`VAL_LIMITS`), aplicado en desarrollo, fichajes de la IA y compras del usuario. No hay tope por categoría.
2. **Cantera** (`ACADEMY_TIERS`, `CANTERANO_EVENTS`): normal por nivel (73/81/89, σ 5, rangos 55-88/60-93/70-98), fracaso 6,5 %, joya 3 % con tope 95/95/98, 1-2 / 2-3 / 3-4 canteranos, costos anuales 0,75 / 2,5 / 6 M. Se añadió el nivel 0 «Mínima» solo porque tu interfaz ya tiene 4 niveles; la IA no lo usa.
3. **Desarrollo** (`newCanterano`, `progressPlayer`): llega 10-20 bajo su potencial, +3 a +5/año, pico real = 85-100 % del potencial, a los 22-26 años. Los ojeadores ven el rango alrededor del potencial sorteado (`pot`).
4. **Declive** (`DECLINE`): DEL 33-34, MED 34, DEF 34-35, POR 37-38; −1 a −3 por año y algunos bajan antes.
5. **Mercado/IA**: valor = Val + peso(edad)·(potencial − Val), con caída de edad por posición. Sueldos con curva `0,6·(Val−45)^4` (las estrellas son caras). La IA elige cantera según presupuesto y prestigio; no ficha si los sueldos pasan del 80 % de sus ingresos y vende a su mejor pagado si se pasa; vende a la fuerza si se arruina; compra promesas; sube a primer equipo a canteranos vendibles. Los fichajes de relleno usan la **media actual de la liga** (`leagueMean`), no un 69 fijo. El precio de «gigante» depende del prestigio, no de la etiqueta de élite. El prestigio alto se apaga si el club no está arriba (`PRESTIGE_FADE`; en `game.ts` también se aplica a tu club).
6. **Economía** (`economy.ts`): patrocinio por prestigio 45 k → 70 k, TV de 1.ª 9 → 11 M; sueldo/mercado recalibrados a la nueva escala de Val.

## Validación
`npx tsx src/lifetimeSim.cli.ts 30|50|100 [semilla] [liga]`. Resultados en `INFORME_VALIDACION.txt` (semilla por defecto): 1.ª 81-83, 2.ª 73-75, 85+ ≈ 14-20 % de 1.ª, 90+ ≈ 1-2 %, 95+ ≈ 0-0,4 %, nunca más de 2 por club, estable en 100 temporadas. Sin avisos.

### Ajustes que hice al ver la simulación
- Los élite se arruinaban (sueldos 37-40 M contra 35 M de ingresos): añadí tope salarial para fichar, venta forzada y reserva por prestigio.
- Los presupuestos se disparaban: venta forzada al 40 %, impuesto al superávit desde 50 M.
- Sin freno de prestigio los gigantes eran eternos: `PRESTIGE_FADE`.
- 90+ llegaba a 4,8 %: máxima exige 40 M y prestigio 45.

## Cosas que debes saber
- **Referencias del punto 2**: con media 81 y σ 5, «Alta» da ~25 % con 85+ (la referencia decía ~35 %). Para 35 % sube la media de Alta a ~83. Básica y Máxima salen cerca de la referencia.
- Aun con élite 4/4 siempre en el grupo top (prestigio ~90), 15-21 clubes no élite pasan 5+ temporadas en el grupo «top por presupuesto o prestigio» en 100 temporadas; el presupuesto es volátil. Es la medida más laxa; el prestigio solo es más estricto.
- Los presupuestos medios del resto subieron de 10 M a ~35-40 M.
- `TOTAL_SEASONS` sigue en 30 en `game.ts`/UI: la duración 30/50/100 solo está en `SEASON_OPTIONS` y en la simulación; conectarla a la partida requiere tocar la UI.
- No pude ejecutar vitest (sin red); corrí los tests con un simulador mínimo. `domestic.test.ts` y `clubs.test.ts` (títulos de gigantes) ya fallaban con tu código original.
