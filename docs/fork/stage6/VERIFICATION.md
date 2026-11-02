# Etapa 6 — Verificación: qué se midió, con qué comando y con qué resultado

**Estado:** entregable de la Etapa 6.
**Regla de la casa en vigor:** «**verificado» significa EJECUTADO**, nunca leído. Lo que no se pudo ejecutar está en §9, **NO VERIFICADO con su motivo**.
**Instrumento:** todo lo de abajo corre tras `. ./.fork-tmp/env.sh`, con `HOME`, `TMPDIR`, `XDG_*`, `npm_config_cache` y `GIT_CEILING_DIRECTORIES` dentro de `.fork-tmp/`. Nada se instaló globalmente, nada tocó `~/.claude`, y ningún proceso del repositorio recibió credenciales del usuario.
**Condición 4 del instrumento (máquina ociosa) sigue siendo inalcanzable (L7).** Por tanto: **ninguna duración de este documento es autoritativa**, y la suite completa **no se ejecutó**. Se ejecutaron los archivos necesarios.

---

## 1. Línea base, antes de tocar nada

```
$ git status --porcelain                              → vacío
$ git diff --numstat origin/main -- skills/ | wc -l   → 0
$ node --test --test-concurrency=1 --test-timeout=1800000 \
    tests/auto-update.test.js tests/cli-usage.test.js tests/rsc-cli.test.js \
    tests/update-notice-symptoms.test.js tests/doctor-onboarding-readiness.test.js
  # tests 50 · # pass 50 · # fail 0 · # cancelled 0 · 122 s      EXIT 0
```

El subconjunto de la línea base es el que afirma sobre la identidad del paquete. Verde antes del cambio, lo que convierte cualquier rojo posterior en una regresión atribuible.

---

## 2. La invariante, al cerrar la etapa

```
$ git diff --numstat origin/main -- skills/ | wc -l
0
```

**Cero líneas.** `skills/` no se tocó en ningún momento. Lo comprueba además `npm run gate` como una de sus siete puertas, con su medición en el informe (`skills-invariant → 0 lines`) en vez de con un adjetivo.

---

## 3. El renombrado de identidad

### 3.1 El barrido, y lo que decidió

```
$ grep -rc "@ericrisco/rsc" scripts/ targets/ tests/ schema/ .github/ package.json | grep -v ':0$'
```

19 archivos antes. Después:

```
$ grep -rn "ericrisco" scripts/ targets/ tests/ schema/ .github/ package.json
targets/memslop-offer.mjs:58:  curl -fsSL https://raw.githubusercontent.com/ericrisco/mem-slop/main/install.sh | bash
scripts/lib/upstream-survey.js:310:   { kind: 'absent', fragment: '@ericrisco/rsc version', … }
tests/ingest-move.test.js:149          (afirma sobre skills/harness/SKILL.md — congelado)
tests/review-consolidate.test.js:170   (afirma sobre skills/review/SKILL.md — congelado)
tests/team-safe-default.test.js:370    (afirma sobre skills/suggest/SKILL.md — congelado)
tests/capabilities.test.js:227         (afirma sobre skills/suggest/SKILL.md — congelado)
tests/governance-identity.test.js:295  (el límite L-D5, fijado a propósito)
```

Las siete son correctas y deliberadas: `mem-slop` es **otro proyecto**; `upstream-survey.js` es de la Etapa 5 y su trabajo es **buscar** el nombre del padre; y las cuatro aserciones restantes apuntan a contenido **congelado** de `skills/`, donde renombrar el patrón las volvería **vacuas** contra un archivo que no puede cambiar.

`tests/worktree-reaper.test.js:336` se **amplió** en vez de renombrarse, por el mismo motivo: su `doesNotMatch` sobre `skills/ship/SKILL.md` ahora acepta las dos identidades, de modo que es estrictamente más fuerte y sigue siendo no vacuo.

### 3.2 Renombrado del comando: 22 formas, cuatro excepciones

```
$ grep -rnoE "\brscg [a-z-]+" scripts/ targets/ | sed 's/.*:rscg /rscg /' | sort | uniq -c | sort -rn
   9 rscg knowledge-sync     8 rscg git-permissions    7 rscg main         4 rscg restore
   4 rscg isolation          4 rscg doctor             4 rscg capabilities 4 rscg agents
   3 rscg sello              3 rscg review             3 rscg onboard      3 rscg agent-model
   3 rscg add                2 rscg sync               2 rscg memory       2 rscg audit
   1 rscg worktrees          1 rscg reassess           1 rscg install      1 rscg ingest
   1 rscg copy               1 rscg catalog
```

Cuatro excepciones, donde `rsc` nombra un **subsistema** y la palabra siguiente coincide con un subcomando por casualidad — y donde copiar y pegar nunca fue posible:

```
$ grep -rn "rsc copy guard\|rsc memory:\|rsc knowledge-sync (\|rsc knowledge-sync —" scripts/ targets/
targets/copy-guard.mjs:69              rsc copy guard: …
targets/session-memory-core.mjs:347-350  rsc memory: …                (4 líneas)
targets/session-memory-adapter.mjs:82    rsc memory: …
targets/knowledge-sync.mjs:1032          rsc knowledge-sync (already shown to the person)
```

### 3.3 Un defecto propio del renombrado, encontrado y corregido

```
$ grep -rn "\.rscg" scripts/ targets/ tests/
targets/session-memory-core.mjs:350:  … '.rscg memory was tracked; …'
```

`\brsc (memory)\b` casó **dentro de la ruta `.rsc`**, porque `.` es un no-palabra y `\b` casa ahí. Convirtió una ruta en `.rscg`. Corregido y barrido: el grep de arriba sale vacío.

### 3.4 Los tests de identidad

```
$ node --test --test-concurrency=1 --test-timeout=1800000 tests/governance-identity.test.js
  # tests 13 · # pass 13 · # fail 0 · # cancelled 0      EXIT 0
```

| Test | Qué midió | Resultado |
|---|---|---|
| `gi01` | `name`, `bin`, `homepage`/`repository`/`bugs` | `@lema017/rsc-governed`; `bin` = `rscg` + `rscg-install`; **no** reclama `rsc` ni `rsc-install`; las tres URLs → `lema017/rsc-harness` |
| `gi02` | Atribución de upstream | `LICENSE` conserva «Copyright (c) 2026 Eric Risco»; `contributors` lo acredita |
| `gi03` | Barrido de `scripts/`, `targets/`, `schema/`, `.github/`, `package.json` | 0 referencias al padre, excluido `upstream-*` (Etapa 5) |
| `gi04` | `mem-slop` NO renombrado | la URL de terceros intacta; el paquete del arnés ausente |
| `gi05` | La URL del registro y el `argv` de `npx`, **sobre el código fuente** | `@lema017%2frsc-governed`, `` `@lema017/rsc-governed@${version}` ``, cero `ericrisco` |
| `gi06` | `updateNotice()` ejecutado con `RSC_LATEST=3.7.9` sobre `3.7.0` | «3.7.9 is out — you have 3.7.0» + `npx @lema017/rsc-governed@latest`; y silencio con `RSC_LATEST=3.7.0` |
| `gi07` | Mismo major vs nuevo major | «installing itself in the background» / «new major version» |
| `gi08` | Canal de síntomas | «a thing that was broken (fixed in 3.7.5)» |
| `gi09` | `RSC_*` NO renombrado, y ningún `RSCG_*` inventado | las cinco variables presentes; cero `RSCG_` |
| `gi10` | Instalación real: rutas en disco + copia instalada del hook | `.rsc/`, `.rsc/skills/`, `.rsc/.version`, `.rsc-state.json` (vía `targetPaths`), `.claude/skills/orient/SKILL.md`; ningún `.rscg/`; `.rsc/auto-update.mjs` nombra el fork en los dos sitios |
| `gi11` | Barrido recursivo de un proyecto instalado | 0 artefactos **escritos por el fork** nombran al padre |
| `gi13` | **El límite L-D5, fijado por conteo** | 81 en `skills/`, **10** en el cuerpo always-on, `npx @ericrisco/rsc add <id>` presente, copia enviada byte-idéntica |
| `gi12` | `rscg --version` | `rscg 3.7.4` |

### 3.5 `gi10` y `gi11` fallaron primero, y eso es el valor

- `gi10` falló por **mi** suposición sobre dónde vive `.rsc-state.json`. Corregido leyéndolo de `targetPaths` en vez de adivinando el directorio.
- `gi11` falló con un hallazgo **real**: `.rsc/governance/always-on.md` nombra al padre 10 veces. Es el límite L-D5, y ver §9.

---

## 4. Las actualizaciones automáticas siguen funcionando (§2)

Mecanismo localizado **en el código**, no en el README: `targets/auto-update.mjs`, copiado a `.rsc/auto-update.mjs` en la instalación. Guarda el nombre del paquete **dos veces** y **ningún test heredado toca ninguna de las dos** — todos cortocircuitan la consulta con `RSC_LATEST`/`RSC_LATEST_JSON` y el instalador con `RSC_AUTO_UPDATE_CMD`.

Verificado por **ejecución** en `gi06`, `gi07`, `gi08` (la conducta) y por aserción **sobre la fuente** en `gi05` y sobre **la copia instalada** en `gi10` (las dos cadenas que ningún test ejercita).

```
$ node --test … tests/auto-update.test.js tests/update-notice-symptoms.test.js
  (incluidos en §1 y en la regresión de §7; verdes antes y después)
```

**Conclusión:** el renombrado **no** rompe §2. Y sin los cambios de `gi05`/`gi10` lo habría roto de la peor manera posible: en silencio, con la suite entera verde.

---

## 5. Recuperación (§10, `PLAN.md` §8)

```
$ node --test --test-concurrency=1 --test-timeout=1800000 tests/governance-recovery.test.js
  # tests 14 · # pass 14 · # fail 0 · # cancelled 0      EXIT 0
```

| Test | Qué se ejecutó | Resultado |
|---|---|---|
| `gr01` | `createBackup` → sobrescritura destructiva → `restoreBackup` | vuelve **byte a byte**; la instantánea sigue listable |
| `gr02` | `restoreBackup --dry-run` | reporta las rutas, **no cambia nada** |
| `gr03` | **D13 reproducido**, los cuatro pasos | `true → false → true → false`; y la entrega de `.claude` resuelve a esos mismos bytes sin gobernar |
| `gr04` | `rscg restore latest` tras ese escenario | dice «carry NO governance contract», nombra `flutter`, dice «run a sync here», «rscg conformance», y **«the restore is correct»** |
| `gr05` | `restore` cuando la instantánea tenía bases gobernadas | **silencio** |
| `gr06` | `ungovernedAmong` con 5 rutas, 3 de las cuales no son bases | sólo `['flutter']`, con su motivo |
| `gr07` | `rscg conformance` sobre 3 skills gobernadas | EXIT 0, «3/3 … (v1)», «claude: 3/3 delivered conformant … always-on clean» |
| `gr08` | `rscg conformance` con una base rebobinada a upstream | **EXIT 1**, `UNGOVERNED .rsc/skills/flutter/SKILL.md`, «2/3», y la vía de vuelta |
| `gr09` | Identidad de la función, no coincidencia de nombre | `instrument.auditBase === lib.auditBase`; `verify-catalog-conformance.js` ya no define su copia |
| `gr10` | `rscg conformance` en un proyecto vacío | **EXIT 0** — «nothing is installed here» es un hecho, no un fallo |
| `gr11` | **Camino de fallo**: `applyAcceptedOnboarding` con un fallo inyectado en el paso de instalación | lanza `RSC_ONBOARDING_INCOMPLETE`, nombra la causa real, lleva el comando de recuperación, y **no deja recibo aceptado en `.rsc.json`** |
| `gr12` | El mismo rollback sobre un proyecto con una base sin gobernar | el error nombra las bases que dejó sin contrato y apunta a `rscg conformance` |
| `gr13` | `doctor` limpio y `doctor` sucio | `3/3` → `2/3` con `['flutter']`, la ruta, la acción; y **`healthy` no se mueve** |
| `gr14` | Un sync tras el restore, y un segundo sync | re-gobierna; el segundo es **byte-idéntico** (criterio 5), así que el consejo es seguro de repetir |

`gr11` y `gr12` fallaron primero por la firma de `buildOnboardingPlan` (es posicional, `(record, scan)`, no `({record, root})`). Corregido copiando la forma de `tests/onboarding-apply.test.js`.

### 5.1 `doctor`

```
$ node --test --test-concurrency=1 --test-timeout=1800000 tests/governance-doctor.test.js
  # tests 6 · # pass 6 · # fail 0      EXIT 0
```

`gd01` el campo existe siempre, incluso sin nada instalado · `gd02` el **código de salida** de `rscg doctor` no se mueve con una base sin gobernar · `gd03` un `SKILL.md` ausente se reporta como ilegible, no como gobernado ni como ausente · `gd04` con el directorio en `chmod 000`, `doctor` **devuelve un informe** en vez de lanzar · `gd05` la entrada usa la forma `{id, path, action}` de #277 · `gd06` `doctor` lee **sólo las bases** (`deliveries: false`).

---

## 6. `npm run gate` y la segunda raíz

```
$ npm run gate
PASS  validate            PASS  manifest:check      PASS  governance:check
VOID  governance:customizations
      nothing to validate here: this repository is not a consumer project.
      Non-vacuous only where 02-DOCS/ exists — see DISTRIBUTION.md §5
PASS  skills-invariant    PASS  drift:check         PASS  originality:check
7/7 passed (1 with nothing to check here) · 1,6 s – 36,7 s        EXIT 0
```

**`VOID` en vez de `PASS`, y es la tercera propiedad de la puerta.** `ARCHITECTURE.md` marcó tres
validadores heredados como «vacuos en clon limpio»: pasan por no tener nada que examinar. La
comprobación de artefactos de proyecto tiene **exactamente esa forma en este repositorio**, que no es
un proyecto consumidor y no tiene `02-DOCS/`. Así que la puerta lo dice **de sí misma** en vez de
dejar que «7/7 passed» insinúe una cobertura que no tiene. Fijado por `gg02b`.

*(La primera medición dio 8,4 s en `governance:customizations` porque el discriminador greenfield
recorría el árbol del fork sin que hubiera ningún informe brownfield que validar. Corregido: el
recorrido sólo se paga cuando existe la raíz.)*

**Y la duración no es autoritativa, como ninguna de este documento.** Las mismas siete verdes
midieron **13,3 s**, luego **36,7 s** con una suite corriendo al lado, luego **1,6 s** con la máquina
ya tranquila y la caché del sistema de archivos caliente. **Un factor 22 sobre trabajo idéntico.** Lo
afirmable es el orden de magnitud — **segundos, no minutos** — que es lo que la hace usable en el
ciclo de iteración donde `npm test` (1 h 33 m) no sirve. Afirmar «13,3 s» como propiedad sería repetir
el error que D11 convirtió en el límite L7: tomar una propiedad del entorno por una propiedad medida.
Tres mediciones de lo mismo son mejor argumento para esa cautela que cualquier frase.

Y la cifra que corrige el documento de la Etapa 1: la puerta mide **13,3 s**, no «130 s» — ésa era una suma manual de seis scripts, y es la única fila de `CUSTOMIZATION-SCHEMA.md` §3 que esta etapa tenía permiso para tocar.

```
$ node --test --test-concurrency=1 --test-timeout=1800000 tests/governance-gate.test.js
  # tests 24 · # pass 24 · # fail 0 · # cancelled 0      EXIT 0
```

Casi todos son **negativos o mutaciones**, que es lo único que hace que el archivo valga la pena:

| Test | Qué comprueba |
|---|---|
| `gg01` | La puerta **existe**, incluye `governance:check`, `governance:customizations` y `skills-invariant`, y **declara** sus 8 exclusiones con su motivo |
| `gg02` | 7/7 en segundos, imprime su propia cobertura, no hay `SKIP` en este clon |
| `gg03` | `skillsInvariant` sobre un `git init` vacío → **`skip`** nombrando `origin/main`; sobre este repo → `pass` con «0 lines» |
| `gg04` | Ausencia de `02-DOCS/wiki/brownfield/` → estado válido, cero hallazgos |
| `gg05` | Un informe bien formado produce **la lista de errores vacía** |
| `gg06` | NEGATIVO: los seis campos ausentes se **nombran** uno por uno, con archivo y regla |
| `gg07` | NEGATIVO: un `path:line` desnudo se rechaza; un fragmento desplazado **dice la línea real** («the fragment is at `…:5`, not at the cited `:1`») |
| `gg08` | NEGATIVO: regla 4d — `skills/` en vez de `.rsc/skills/`, con el motivo de las 13 líneas |
| `gg09` | NEGATIVO: una categoría dudada o doble **es** el hallazgo («names 2 categories») |
| `gg10` | NEGATIVO: confianza sin falsificador; estado fuera de los seis |
| `gg11` | NEGATIVO: una recomendación que no es ninguna de las alternativas |
| `gg12` | NEGATIVO: regla 15 — `pending-decision` que no enumera nada |
| `gg13` | NEGATIVO: regla 12 — una posición que afirma desactivar una guarda |
| `gg14` | NEGATIVO: regla 13 — la **misma** corrida pasa como brownfield y falla como greenfield |
| `gg15` | NEGATIVO: `type:` ausente y `type:` equivocado |
| `gg16` | NEGATIVO: informe no indexado en `02-DOCS/wiki/index.md` (propiedad 32) |
| `gg17` | **Regla 16, las dos direcciones**: falla con una arista `recommends:` fuera del inventario, pasa al añadir la fila |
| `gg18` | `not-run` se imprime etiquetado, **no** cuenta como error, y aparecen exactamente **2** (reglas 13 y 16) cuando no se les dio el dato |
| `gg19` | `install` escribe `.rsc/governance/brownfield.json`, nombra el registro roto, y **la instalación completa igual** |
| `gg20` | `rscg brownfield` entrega el procedimiento por ruta, imprime el conjunto candidato, el umbral `0.45`, por qué no `0.80`, el suelo, y **lo que no hace** |
| `gg21` | `rscg brownfield --validate` → **EXIT 1** sobre un registro roto |
| `gg22` | **MUTACIÓN (A1)**: symlink → copia byte-idéntica ⇒ ahora es hallazgo |
| `gg23` | **MUTACIÓN (A2)**: cuerpo duplicado en el `.mdc` ⇒ «DUPLICATE: 2 opening markers»; bloque desplazado ⇒ «does not open the body»; restaurado ⇒ limpio |
| `gg24` | El suelo del denominador existe, acepta `--expect`, y **no hay un literal `274` en el código** (§3) |

### 6.1 El suelo de recall, medido por una vía distinta — y reproduce las cifras de la Etapa 3

El suelo de la regla 16 se calcula con `buildTextCorpus` + `descriptionCollisions`, así que vale
medir qué cuesta y qué sale, porque se paga en cada `install`/`sync` de un proyecto que tenga un
informe brownfield:

```
skills: 274 | buildTextCorpus: 39 ms | descriptionCollisions(0.45): 84 ms | pairs: 46
skills involved: 65
  threshold 0.80 ->  0 pairs      threshold 0.60 ->  9 pairs
  threshold 0.50 -> 34 pairs      threshold 0.45 -> 46 pairs      threshold 0.40 -> 71 pairs
max pair: linkedin-carousels/linkedin-content = 0.737
```

**123 ms en total**, y sólo cuando hay un informe que validar. Y las cifras coinciden **exactamente**
con las que la Etapa 3 registró en §2m del ledger — 0,80 → 0 parejas, 0,60 → 9, 0,50 → 34, 0,45 → 46
sobre 65 skills, 0,40 → 71, máximo real 0,737 — medidas aquí desde otro camino de código. Es
corroboración independiente, no una cita.

Lo que confirma de paso: **a `0.80` el conjunto candidato es literalmente vacío**, así que una
implementación que hubiera usado el techo de fallo como umbral de búsqueda habría informado «sin
competidores» en todas las corridas y habría parecido funcionar en todas.

### 6.2 Un defecto propio del parser, que el test negativo encontró

`gg05` falló con un hallazgo **falso**: «C1 lists 1 alternative» sobre un registro con dos. Causa: **`$` bajo el flag `m` significa fin de LÍNEA**, y `^` necesita `m`, así que cada lookahead truncaba su campo en el primer salto de línea. Un cuarto sitio usaba `\Z`, que **no es un escape de JavaScript**: casaba una «Z» literal.

Cuatro sitios corregidos a `(?![\s\S])`. La lección: un test que afirma «no hay hallazgo de tipo X» no habría visto nada de esto; `gg05` afirma la lista **vacía**, así que un defecto del parser aparece como **hallazgo falso** y no como silencio.

---

## 7. Las dos correcciones del instrumento del criterio 4, y su re-ejecución

Los dos huecos ALTA que la revisión independiente de la Etapa 4 demostró por mutación viajaron verbatim a la extracción. Corregidos en `scripts/lib/conformance.js` (la copia que sobrevive) y probados por mutación en `gg22`/`gg23`. Re-ejecución del instrumento completo:

```
$ node scripts/verify-catalog-conformance.js \
    --cwd .fork-tmp/stage6/conf-project --home .fork-tmp/stage6/conf-home \
    --expect 274 --json .fork-tmp/stage6/conformance.json

catalog: 274 skills with a SKILL.md
pass 1/2/3: base conformant 274/274
idempotence (reinstall):     274/274 bases byte-identical, 274/274 cursor .mdc byte-identical
idempotence (forcedRefresh): 274/274 bases byte-identical, 274/274 cursor .mdc byte-identical
failures: 0                                                     EXIT 0
```

Lo que **ahora** mide y antes no:

| Lo que la corrección añade | Medición |
|---|---|
| **Clase de entrega contada** (A1), de modo que «17 de 18 enlazan a la base» de `CONTRACT.md` §1 sea un número | **17 destinos × 274 `symlink`** (`claude codex opencode deepseek amp jules zed gemini antigravity copilot windsurf cline roo continue junie kiro aider`), **1 × 274 `cursor-mdc`**; **ninguna** otra clase, en las 3 pasadas |
| **Copia en vez de symlink** es un hallazgo (A1) | Probado por mutación en `gg22`: una copia byte-idéntica, que antes pasaba, ahora falla |
| **Duplicados y posición en el `.mdc`** (A2) | Probado por mutación en `gg23` |
| **El `.mdc` en la comparación de idempotencia** (A2) | `274/274` byte-idénticos en las dos re-pasadas. Antes **no se comparaba** |
| **Suelo del denominador** | `catalog: 274`, `manifestCount: 274`, `expected: 274`, los tres de acuerdo |

---

## 7b. La experiencia completa de un consumidor, ejecutada de punta a punta

No es un test: es la transcripción real de los cuatro comandos seguidos, en un proyecto desechable
bajo `$TMPDIR`, para que el producto se pueda leer tal como lo ve quien lo usa.

```
# instalado: suggest, flutter, decision-records (target claude)

$ rscg conformance
3/3 installed skills carry the governance contract (v1).
  claude: 3/3 delivered conformant (3 symlink), always-on clean
EXIT 0

# una base rebobinada a la forma de upstream, y otra instalación encima
# (la instantánea captura la base SIN gobernar; la instalación la gobierna después)

$ rscg restore latest
Restored 20261102-082604-install-claude
  …
⚠️  1 restored skill base(s) carry NO governance contract:
      flutter — no governance block
    That is what the snapshot held, so the restore is correct: it is not re-governed,
    because you asked for the earlier state and you got it. But every assistant reads
    these files now, and they no longer point at their project customization.
    To govern them again: run a sync here. The transformation is idempotent, so it
    changes nothing for the bases that are already governed.
    To see the whole picture first: rscg conformance

$ rscg conformance
UNGOVERNED .rsc/skills/flutter/SKILL.md: no governance block; no `governance` key; …

2/3 installed skills carry the governance contract (v1).
  claude: 3/3 delivered conformant (3 symlink), always-on clean

A delivery counts as conformant when it still tracks its base, so the deliveries above
are correct links to 1 base(s) that carry no contract. The assistant
is reading ungoverned content through a healthy link.

What puts it back: run an install or a sync in this project. …
EXIT 1
```

**Ese último párrafo se añadió por esta transcripción, y es el tipo de defecto que sólo se ve
ejecutando:** «2/3 gobernadas» y «3/3 entregadas conformes» se leen como una contradicción. No lo
son — una entrega es conforme cuando **sigue** a su base, que es la pregunta que la conformidad de
entrega hace, así que un symlink a una base sin gobernar es un symlink **correcto** a contenido
equivocado — pero un informe que no lo dice es un informe que se lee mal. Los dos números estaban
bien y sólo decirlo los hace legibles juntos.

```
$ rscg brownfield
PROCEDURE: read .rsc/governance/brownfield-v1.md and follow B1–B8 in order. …
SCOPE:     the 2 selected skill(s) only, never the whole catalog.
REPORT:    02-DOCS/wiki/brownfield/<slug>.md, with `type: brownfield-run` frontmatter, …

B1 CANDIDATE COMPETITORS — computed, not guessed, at threshold 0.45
  codebase-onboarding    `decision-records` recommends: `codebase-onboarding`
  compose-multiplatform  named in `flutter`'s NOT clause
  constitution           `decision-records` recommends: `constitution`
  deployment             `flutter` recommends: `deployment`
  design                 `flutter` recommends: `design`
  knowledge-ops          `decision-records` recommends: `knowledge-ops`
  meeting-notes          `decision-records` recommends: `meeting-notes`
  plan                   `decision-records` recommends: `plan`
  react-native           named in `flutter`'s NOT clause
  sop-builder            `decision-records` recommends: `sop-builder`
  specify                `decision-records` recommends: `specify`

COVERAGE FLOOR: all 11 row(s) above, plus every selected skill, MUST appear in the inventory. …
WHAT THIS COMMAND DOES NOT DO … it does not read the project. …
```

Once candidatos, **todos con un motivo computado**: 9 aristas `recommends:` y 2 nombrados en cláusula
`NOT`. Ninguna colisión de descripción de esas dos skills alcanza `0.45`, que es un dato sobre este
par y no un fallo del método — y que a `0.80` habría salido igual de vacío por el motivo equivocado.

---

## 7c. Los tres cambios de `package.json` que pidió la Etapa 5

```
$ npm pack --dry-run --json      # tras añadir las dos negaciones a "files"
excluded ok    scripts/upstream-maintain.js
excluded ok    scripts/lib/upstream-gate.js
excluded ok    scripts/lib/upstream-state.js
excluded ok    scripts/lib/upstream-survey.js
present        scripts/lib/conformance.js
present        scripts/verify-catalog-conformance.js
present        scripts/validate-customizations.js
present        scripts/gate.js
present        schema/governance/brownfield-v1.md
licence paths present: 10 of 10
name: @lema017/rsc-governed | version: 3.7.4 | files: 1792   (1796 antes: exactamente los 4 excluidos)
```

`bin` sigue siendo `{rscg, rscg-install}` y **no** expone el mantenimiento, que es lo que §10 prohíbe
(«Los consumidores no integran upstream directamente»). `upstream:check` y `upstream:maintain`
existen como scripts de npm, que es cómo el mantenedor los arranca **en el repo del fork**.

Fijado por test para que no pueda regresar: `gi14` (la frontera de envío y la ausencia de `bin`) y
`gi15` (las rutas de licencia, **descubiertas con `find` en vez de escritas a mano**, que es cómo la
línea base antigua llegó a omitir `skills/ux/THIRD_PARTY.md` y a contar ocho donde había nueve).

**Discrepancia de conteo, declarada:** el coordinador dice **nueve** rutas de licencia; yo encuentro
**diez** con el barrido de `gi15`. La diferencia es `LICENSE` en la raíz del repositorio, que las
nueve del catálogo no incluyen. Las diez entran en el tarball, así que el criterio 6 pasa con
cualquiera de los dos conteos; `gi15` no fija el número, **descubre la lista**, de modo que una que
upstream añada tampoco se puede caer del check por olvido.

---

## 8. Regresión sobre todo lo que esta etapa tocó

49 archivos de test: los 4 nuevos, los 6 de gobernanza, los 4 de `doctor`, los de instalación/onboarding/CLI, y los que afirman sobre texto visible al usuario (`team-safe-default`, `knowledge-sync`, `ingest-move`, `audit`, `capabilities`, `review-consolidate`, `agent-overrides`, `hooks-path`, `worktree-reaper`…). **La suite completa no se ejecutó (L7).**

```
$ node --test --test-concurrency=1 --test-timeout=1800000 <49 archivos>
  (resultado en §8.1)
```

### 8.1 Resultado

```
# tests 729 · # pass 725 · # fail 3 · # cancelled 0 · # skipped 1
# duration_ms 2 078 200 → 35 min                              (.fork-tmp/stage6/regression-core.log)
```

**0 cancelados**, que es la propiedad que D11 convirtió en condición de una medición válida. Los tres
fallos, atribuidos uno por uno:

| Fallo | Atribución |
|---|---|
| `dsh06 · end to end: dsh's SessionStart reaches the installed memory hook through the bridge` | **Preexistente de upstream**, listado como tal en el encargo de esta etapa. No toca ninguna ruta renombrada |
| `gr07 · rscg conformance answers "are my skills governed?"` | **Mío, y ya corregido cuando la corrida terminó.** Añadí el conteo de clases de entrega (`(3 symlink)`) al informe **después** de lanzar la regresión, así que la corrida ejecutaba mi aserción vieja contra mi salida nueva |
| `ingest-move 10 · the text injected at session start…` | **Mío, y ya corregido.** Mi primera corrección de esa aserción puso `/rscg ingest/`, pero el texto de `targets/session-start.mjs` dice `npx @lema017/rsc-governed ingest <file>`. Comprobado leyendo la línea en vez de suponiéndola |

Re-ejecución de los dos archivos corregidos: **26 tests, 26 pass, 0 fail**. Y la red de gobernanza
completa más esos dos, como confirmación final: ver §8.2.

Las regresiones que el renombrado **sí** causó aparecieron todas en la primera pasada y están todas
corregidas: eran aserciones de test que nombraban el paquete o el comando del padre (`cli-usage`,
`clone-bootstrap` ×5, `doctor-onboarding-readiness`, `rsc-cli`, `update-notice-symptoms` ×2,
`manifest-divergence`, `team-safe-default` ×5, `knowledge-sync` ×2, `agent-overrides`, `ingest-move`,
`audit`, `hooks-path`, `worktree-reaper`). El criterio aplicado en cada una está en §3.1: **se
renombra la aserción cuando apunta a código del fork; se conserva, o se amplía, cuando apunta a
contenido congelado de `skills/`.**

**Dos de los tres fallos eran míos y de la misma clase**, y vale decir cuál: cambié una salida y un
texto **después** de lanzar la medición. Es la versión en pequeño del defecto que esta sesión ya tiene
registrado tres veces — el autor de una afirmación invalidándola él mismo — y la única defensa que
funcionó fue volver a ejecutar en vez de dar por buena la corrida anterior.

### 8.2 Confirmación final: la red de gobernanza del fork

```
$ node --test --test-concurrency=1 --test-timeout=1800000 \
    tests/governance-{identity,recovery,gate,doctor,always-on,base,delivery,customization,knowledge-sync,upstream-change}.test.js \
    tests/md-block-fidelity.test.js tests/ingest-move.test.js
```

```
# tests 125 · # pass 125 · # fail 0 · # cancelled 0 · # skipped 0
# duration_ms 291 687 → 4 min 52 s        EXIT 0        (.fork-tmp/stage6/regression-final.log)
```

**125 de 125, cero fallos, cero cancelados.** Es la red que protege el criterio 4 y los entregables de
esta etapa, y es la que hay que volver a correr antes de promocionar: la Etapa 4 ya dejó escrito que
**de los tests heredados de upstream, cero notan que la gobernanza desaparezca**, así que estos
archivos son la única red que hay.

**Con una precisión, porque la cifra se movió después:** esa corrida de 125 precede a dos tests que
añadí al terminarla — `gg02b` (la puerta declara su propia comprobación vacua como `VOID`) y `gg20b`
(el procedimiento brownfield es una ruta **gestionada**, de modo que `restore` y `purge` lo conocen).
`tests/governance-gate.test.js` re-ejecutado solo: **26 tests, 26 pass, 0 fail, 11,4 s**. La red son
hoy **127**, de los cuales 125 están medidos en esa corrida conjunta y 2 en la del archivo solo.
Anotar 127 como si los hubiera medido todos juntos sería exactamente el redondeo que este documento
existe para no hacer.

### 8.3 Lo que esta etapa añade a esa red

| Archivo | Tests | Qué cubre |
|---|---|---|
| `tests/governance-identity.test.js` | **15** | La identidad del fork, el camino de auto-actualización, el contrato en disco que NO se renombra, la frontera de envío del tarball, las rutas de licencia, y el límite L-D5 fijado por conteo |
| `tests/governance-recovery.test.js` | **14** | Respaldo/restauración, D13 reproducido y nombrado, `rscg conformance`, el camino de fallo del onboarding y su rollback |
| `tests/governance-gate.test.js` | **26** | `npm run gate`, las 16 reglas de la segunda raíz (casi todas en negativo), y las dos mutaciones que prueban los huecos corregidos del instrumento |
| `tests/governance-doctor.test.js` | **6** | El campo de gobernanza de `doctor`, su código de salida, y la frontera barato/completo frente a `rscg conformance` |

**61 tests nuevos**, re-ejecutados juntos sobre el HEAD actual —que ya incluye el commit de la
Etapa 5— como última comprobación de la etapa:

```
$ node --test --test-concurrency=1 --test-timeout=1800000 \
    tests/governance-{identity,recovery,gate,doctor}.test.js
# tests 61 · # pass 61 · # fail 0 · # cancelled 0 · # skipped 0
# duration_ms 91 306 → 1 min 31 s        EXIT 0      (.fork-tmp/stage6/stage6-final.log)
```

Y una propiedad deliberada de los cuatro archivos: la mayoría son **negativos o
mutaciones**. Un validador que no puede fallar informa lo mismo que uno que pasa, y esta etapa ya
encontró tres defectos **propios** justamente porque los tests afirmaban la ausencia de hallazgos en
vez de la presencia de un hallazgo concreto: el `$` bajo `m` del parser, la salida del informe que
cambié después de medir, y la aserción de `ingest` que supuse en vez de leer.

---

## 9. NO VERIFICADO, con su motivo

| # | Elemento | Motivo |
|---|---|---|
| **NV-6a** | **2FA de la cuenta de npm.** | Ajuste de **cuenta**; leerlo exige la sesión del mantenedor. `npm profile get` con el `HOME` del sandbox → `npm error code E401 … GET /-/npm/v1/user`. Ese 401 es el aislamiento funcionando, no un hallazgo sobre la cuenta. Lo tiene que confirmar el dueño del repositorio |
| **NV-6b** | **npm provenance en una publicación real.** | Exige un proveedor de CI cloud con runner cloud (documentación de npm: *«you must use a supported cloud CI/CD provider and a cloud-hosted runner»*). Las Actions están **desactivadas** (`{"enabled":false}`, 0 workflows registrados). `release.yml` está **listo** y no puede correr |
| **NV-6c** | **Trusted Publishing.** | Misma precondición: es OIDC desde dentro de un workflow. Proveedores soportados: GitHub Actions, GitLab CI/CD, CircleCI cloud; runners autoalojados **no**. Configurar una confianza OIDC para un workflow que no puede correr sería configuración no verificable |
| **NV-6d** | **Que el artefacto publicado se instale limpio desde el registro.** | **No se publicó nada**, ni se hizo ningún dry-run autenticado contra el registro. `npm pack --dry-run` probó el **tarball** (`@lema017/rsc-governed@3.7.4`, **1 792** archivos, 5,4 MB empaquetado / 13,8 MB sin empaquetar; `LICENSE`, `manifest.json` y los tres artefactos de `schema/governance/` presentes; `docs/` ausente, como debe ser), que **no es la misma afirmación**. `curl registry.npmjs.org/@lema017%2frsc-governed` → **404**: el nombre está libre |
| **NV-6e** | **Los tres workflows corriendo.** | Actions desactivadas. Los cambios de permisos y la corrección del `! grep` se verificaron **por lectura del YAML**, no por ejecución. Declarado como tal |
| **NV-6f** | **La rama Windows del audit de entregas** (`treeDifferences`). | No hay entorno Windows (NV3 del ledger). El código está escrito y **nunca se ha ejecutado** |
| **NV-6g** | **Regla 14** de `CONFLICT-RECORD.md` §7. | Es una propiedad de un **paso posterior**, no de un archivo. No hay nada en el validador que comprobar. Declarada, no contada como cubierta |
| **NV-6h** | **Recall project↔skill.** | Sin instrumento posible, como ya declaró la Etapa 3. Una corrida que lee el proyecto y no encuentra nada pasa las 16 reglas, incluido el suelo |
| **NV-6i** | **La suite completa sobre este árbol.** | L7: condición 4 inalcanzable. La corrida autoritativa (1 588 tests, 6 fallos, 0 cancelados, 1 h 33 m) es la de la Etapa 4 y **no incluye** los 4 archivos nuevos de esta etapa ni los cambios de §3 |

---

## 10. Afirmaciones del encargo que resultaron falsas o imprecisas

| Afirmación | Qué resultó |
|---|---|
| «`PLAN.md` §3: hay **85** referencias al padre dentro de `skills/`» | **Medido: 81.** `grep -ro "@ericrisco/rsc" skills/ \| wc -l` → **81**, y `grep -ro "ericrisco" skills/ \| wc -l` → **81** también, así que la diferencia **no** es «el plan contó `ericrisco` a secas». La cifra de **10 en el cuerpo always-on** sí es exacta (`grep -n "@ericrisco/rsc" skills/suggest/SKILL.md`). Las 4 que faltan no se explican con ningún conteo que yo haya podido reproducir sobre este árbol; la cifra que esta etapa usa y fija por test es **81** |
| «`ARCHITECTURE.md`: el paquete determinista completo mide **130 s**» | **Medido: 13,3 s.** Era una suma manual de seis scripts, no una puerta |
| «`restoreEntry` en `backups.js:98-114`; `install-apply.js:215`; `onboarding-apply.js:342`» (citas por línea del encargo) | **Las tres eran correctas, y yo rompí dos.** Comprobado: `restoreEntry` sigue en `:98`; `baseDir(step.id, cwd)` está hoy en `:245` y `restoreBackup({cwd, id: transaction.id})` en `:349`, porque **mis propias ediciones** insertaron ~30 y ~7 líneas por encima de ellas. Anotarlo como «el encargo citó mal» habría sido exactamente el error que esta sesión lleva tres cadenas de revisión castigando. Es, de todos modos, el argumento más fuerte a favor de citar por sección + fragmento: el autor de la cita no tiene por qué ser quien la invalida |
| «el coordinador: el renombrado de `knowledge-sync` tumba `ks20` y `ks30`» | **Ya estaba corregido** cuando llegó el aviso: `tests/knowledge-sync.test.js:328` y `:378` afirmaban `/rscg knowledge-sync off/` desde el barrido de §3.1. El aviso describía un árbol anterior |
| «el coordinador: falta un modo de auditoría sobre un árbol existente, ~15 líneas» | **Ya construido** cuando llegó el aviso: `auditInstalledProject` + `rscg conformance`, con sus 6 tests (`gr07`–`gr10`, `gr13`, `gd01`–`gd06`) |
| «el coordinador: una línea, `if (ids.length !== 274) …`» | **No se hizo así**: §3 prohíbe fijar el número en el código. El suelo es un **cruce contra `manifest.json`** más un `--expect` opcional, y `gg24` afirma la ausencia del literal |
| «el criterio 4 está verificado al 274/274» (firmado en `ACCEPTANCE.md`) | Era cierto en sustancia y el instrumento **no podía ver** dos clases de fallo. Ahora las ve, probado por mutación, y el 274/274 se re-ejecutó: `failures: 0` |
