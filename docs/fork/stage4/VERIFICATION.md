# Etapa 4 — Verificación

**Alcance:** `PLAN.md` §11, criterios **4, 5, 6, 7 y 12**, más la medición autoritativa de la suite.
**Instrumento:** [`INSTRUMENT.md`](./INSTRUMENT.md). Todo lo de aquí se **ejecutó**.
**Árbol de trabajo sin commitear:** los commits los hace el coordinador.

> **Lo que esta etapa entrega es conformidad, no cumplimiento.** Que las 274 skills distribuidas
> porten el contrato es una propiedad del **artefacto**, determinista y comprobable sobre las 274.
> Que el modelo **obedezca** el contrato es otra pregunta: se mide con las evaluaciones G1–G6 y no
> se garantiza nunca, salvo donde una guarda de código **deniegue** — y `ARCHITECTURE.md` §5 ya
> midió que la aplicación de una skill **no es un evento observable** en ninguno de los cinco
> asistentes. `REQUIREMENTS.md` §6 prohíbe equiparar las dos cosas.

---

## 0. La invariante

Comprobada al cerrar la etapa, con los dos comandos que pide el encargo:

```
$ git diff --stat origin/main -- skills/
                                          # vacío
$ ls skills | wc -l
     274
```

Nada de esta etapa escribe en `skills/`. Los instrumentos nuevos no son una excepción: el de
conformidad instala en un proyecto desechable bajo `.fork-tmp/`, y el de las cuatro clases de cambio
materializa sus skills sintéticas en un directorio temporal con la forma que `ensureBase` produce,
nunca dentro del espejo de upstream.

---

## 1. Criterio 4 — las 274 **instaladas** portan el contrato

La Etapa 2 midió la transformación **en memoria** sobre los 274 archivos del catálogo, y una
instalación real de **4** skills. El criterio 4 pide otra cosa: *toda skill **distribuida***, es
decir el árbol que un asistente lee de verdad. Instrumento nuevo:
`scripts/verify-catalog-conformance.js`.

```sh
node scripts/verify-catalog-conformance.js \
  --cwd .fork-tmp/stage4/c4/proj --home .fork-tmp/stage4/c4/home \
  --json .fork-tmp/logs/c4-conformance-18.json
```

**274 skills instaladas, 18 destinos, 3 pasadas, EXIT=0, `failures: 0`.**

| Medida | Pasada 1 | Pasada 2 | Pasada 3 |
|---|---|---|---|
| Base distribuida conforme (`.rsc/skills/<id>/SKILL.md`) | **274 / 274** | **274 / 274** | **274 / 274** |
| Directorios de base materializados | 274 | 274 | 274 |
| Entrega por skill conforme, en **cada uno** de los 18 destinos | **274 / 274** | **274 / 274** | **274 / 274** |
| Superficie always-on con bloque de gobernanza | **0 de 18** | **0 de 18** | **0 de 18** |
| Parciales | 0 | 0 | 0 |
| Duplicados | 0 | 0 | 0 |
| Digest incorrecto | 0 | 0 | 0 |

Las definiciones de «parcial», «duplicado» y «digest incorrecto» se fijaron **antes** de medir y
están en [`INSTRUMENT.md`](./INSTRUMENT.md) §3. **Un 273 habría sido un fallo**, no un 99,6 %: el
script enumera cada skill y sale 1 con una línea por incumplimiento.

### Los 18 destinos, no los 5

`PLAN.md` §9 limita las **promesas** de gobernanza a cinco asistentes y eso no cambia. Pero
`ARCHITECTURE.md` §4 pide la entrega por skill **en los 18**, y `CONTRACT.md` §1 afirma algo
concreto sobre *«17 de 18»* que **nada había medido**. Medido ahora:

| Familia | Destinos | Entrega | Bloque | Tres claves | Always-on (bytes) |
|---|---|---|---|---|---|
| symlink a la base | `claude`, `codex`, `opencode`, `deepseek`, `amp`, `jules`, `zed`, `gemini`, `antigravity`, `copilot`, `windsurf`, `cline`, `roo`, `continue`, `junie`, `kiro`, `aider` — **17** | el directorio resuelve a la base gobernada y los bytes coinciden | **sí**, 274/274 en los 17 | **sí** | `claude` **7 280 B** en `.rsc/governance/always-on.md`; los 16 de familia `AGENTS.md`/`GEMINI.md`/… **6 946 B** |
| reescrita | `cursor` — **1** | `.cursor/rules/<id>.mdc` | **sí**, y **byte-idéntico al bloque renderizado**, 274/274 | **no, por diseño** — afirmado explícitamente | **6 676 B** |

Los 7 280 B de `claude` son exactamente el `skills/suggest/SKILL.md` prístino de upstream: el coste
de gobernanza en la superficie por sesión es **0 B**, y se comprueba por igualdad de bytes, no por
un techo.

### Qué cubre y qué no

- **Cubre** la base distribuida y las 18 entregas, en tres estados de instalación distintos:
  instalación en limpio, reinstalación y refresco forzado de base.
- **No cubre** que el modelo lea nada. Eso es G1–G6.
- **No cubre** `.rsc/skills/` de un proyecto cuyo usuario lo haya editado a mano después de
  instalar: el validador mide lo que la instalación entrega, no lo que alguien haga luego con ello.
- **Y hay un camino del propio producto que lo deshace, medido:** `rsc restore` devuelve la base al
  estado previo, y si ese estado venía de upstream la deja **sin gobernar**, sin avisar. Es un hueco
  real en el **alcance** del criterio, no un defecto del transformador — `restore` es una máquina
  del tiempo y el siguiente `install`/`sync` re-gobierna. La medición literal y las dos soluciones
  posibles están en [`PROPUESTAS.md`](./PROPUESTAS.md) §3. El fondo del asunto es que **el validador
  del criterio 4 corre en el repositorio del fork, no en la máquina del consumidor**: ningún comando
  del producto responde hoy *«¿están gobernadas mis 274?»*.

---

## 2. Criterio 5 — idempotencia sobre las instaladas

Dentro de la misma corrida, dos formas distintas de «segunda ejecución», porque sólo una de ellas
ejerce de verdad la transformación:

| Forma | Qué ejerce | Resultado |
|---|---|---|
| **Reinstalación** (pasada 2) | `ensureBase` **no** vuelve a copiar; se mide que `governBase` sobre un árbol ya gobernado sea un no-op real | **274 / 274 byte-idénticas**, 0 derivas |
| **Refresco forzado** (pasada 3) | `.rsc/.base-versions.json` borrado: cada base se re-materializa desde el catálogo prístino y se transforma otra vez | **274 / 274 byte-idénticas**, 0 derivas |

Con sólo la primera forma, el criterio podría pasar sin que la transformación se hubiera ejecutado
una segunda vez. Es la razón de que haya tres pasadas y no dos.

---

## 3. Criterio 6 — tarball, licencias y los dos recuentos

```sh
npm pack --dry-run --json
```

| Medida | Línea base registrada (3.7.4 sin transformar) | Medido ahora | Veredicto |
|---|---|---|---|
| Archivos (`entryCount`) | 1 782 | **1 789** | **+7, 0 perdidos** |
| Tamaño del tarball | «5,3 MB» | **5 602 330 B = 5,34 MiB** | sin cambio real — ver nota |
| Rutas obligatorias de licencia | 8/8 | **9/9 rutas presentes** | cumplido |
| `skills/<id>/SKILL.md` | 274 | **274** | no baja |
| `skills/<id>/evals/cases.yaml` | 274 | **274** | no baja |
| `docs/` dentro del tarball | — | **0 archivos** | correcto: por eso existe la copia en `schema/` |

Los **+7** archivos, enumerados contra `git ls-tree -r origin/main` para que no quede en inferencia:
`schema/governance/contract-v1.md`, `schema/governance/preamble-v1.txt`,
`scripts/governance-sync.js`, `scripts/lib/customization-validator.js`, `scripts/lib/governance.js`,
`scripts/validate-customizations.js` y `scripts/verify-catalog-conformance.js` (el instrumento de
esta etapa). **Ningún archivo de upstream desaparece del tarball:** la comprobación inversa —
archivos de `origin/main` bajo los globs de `files` que no estén en el tarball — da **0**.

> **Corrección de unidad en la línea base, no de la cifra.** «5,3 MB» eran **MiB**: el tarball mide
> hoy 5,34 MiB. Leído como MB decimales, los +7 archivos de texto habrían «pesado» 300 KB
> comprimidos, que es imposible. Queda anotado para que nadie persiga una regresión que no existe.

### Las ocho obligaciones, enumeradas

`PLAN.md` §2 obligación 1 lista **ocho** entradas, y una de ellas (`UPSTREAM.json`) cubre dos
archivos, de ahí que las rutas individuales sean nueve. Las nueve, presentes en el tarball:

`LICENSE` · `skills/design/engine/LICENSE` · `skills/design/IMPECCABLE-LICENSE.txt` ·
`skills/design/THIRD_PARTY.md` · `skills/ux/THIRD_PARTY.md` ·
`skills/ux/upstream/ux-designer/LICENSE` · `skills/ux/upstream/ux-usability-foundations/LICENSE` ·
`skills/design/engine/UPSTREAM.json` · `skills/ux/upstream/UPSTREAM.json`

### Y «tras la transformación», que es donde el criterio tiene filo

Bajo la Estrategia B el tarball es **anterior** a la transformación por construcción: lo que se
distribuye es el espejo de upstream más el transformador. El estado **posterior** a la
transformación es el árbol instalado, y ahí es donde hay que repetir el recuento. Medido sobre el
proyecto de la §1:

| Medida en `.rsc/skills/` tras instalar las 274 | Resultado |
|---|---|
| `SKILL.md` | **274** |
| `evals/cases.yaml` | **274** |
| Los 8 artefactos de licencia | **8 / 8 presentes** |
| Archivos totales | **1 679**, exactamente los 1 679 de `skills/` en el repositorio |

La transformación **añade bytes a 274 archivos y no añade ni quita ninguno**. La parte **I** del
criterio 6 — que el README acredite `ux-designer` (© Szilárd Hajba) y `ux-usability-foundations`
(© hueyexe) — es de la Etapa 7 y **no se toca aquí**; sigue pendiente.

---

## 4. Criterio 7 — subárboles vendorizados intactos

```
$ node --test --test-concurrency=1 --test-timeout=1800000 tests/ux-upstream.test.js
# tests 5
# pass 5
# fail 0
EXIT=0
```

Y, porque el criterio dice *«antes y después de la transformación»* y ese test sólo lee el
repositorio, la comprobación que falta: los dos subárboles **en el árbol entregado**, tras instalar
las 274.

```
$ diff -r skills/ux/upstream     .../.rsc/skills/ux/upstream       # idénticos
$ diff -r skills/design/engine   .../.rsc/skills/design/engine     # idénticos
```

Byte a byte, que es más fuerte que la lista de hashes del test. La razón estructural está en
`ARCHITECTURE.md` §2: la transformación sólo reescribe `<base>/SKILL.md`, profundidad 2, así que los
subárboles quedan fuera **por construcción** y no por una exclusión que alguien tenga que recordar.

---

## 5. Criterio 12 — alta, baja, modificación y renombrado

Instrumento nuevo: `tests/governance-upstream-change.test.js`, **un test por clase**, como pide
`ACCEPTANCE.md`. 4 tests, 4 pasan.

| Clase | Qué afirma | Resultado |
|---|---|---|
| **Alta** | Una skill que **no está** en el catálogo se gobierna igual: bloque, tres claves, digest propio y ruta de personalización con **su** nombre. No hay lista que nadie tenga que actualizar; control negativo con un segundo id nuevo | ✅ |
| **Baja** | La personalización de una skill borrada **sobrevive byte-idéntica** tras `install`, se reporta `orphaned` y **no** es un error. Además, medido en el mismo test: el enlace entregado **sí** se poda, y la base compartida **no** | ✅ |
| **Modificación** | Un `SKILL.md` modificado por upstream se re-gobierna en sus **dos** formas reales — llega prístino, y llega **ya con el bloque viejo**. En ambas: un solo marcador de apertura, un solo cierre, una sola copia de cada clave, digest correcto y **las ediciones de upstream intactas** | ✅ |
| **Renombrado** | **Nada se re-aloja, en ninguna de las dos direcciones.** El nombre viejo se reporta como huérfano con el texto *«migration requiring a decision, never an automatic rehome»*, su archivo sigue en disco byte-idéntico, **no** se inventa nada en el nombre nuevo, y la base del nombre nuevo apunta a **su** ruta sin rastro de la vieja. Y mover el archivo al directorio nuevo sin cambiar su clave `skill:` es un hallazgo `R2`, no una migración silenciosa | ✅ |

**Un renombrado aplicado en silencio es un fallo de este criterio aunque el resultado sea
correcto**, y así está escrito en el test.

### Los tests no son vacuos: dos mutaciones

| Mutación | Qué debería caer | Qué cayó |
|---|---|---|
| `const orphaned = false` en `customization-validator.js:160` | las dos clases que dependen del informe de huérfanas | **baja** y **renombrado**, y sólo esas dos |
| `stripGovernance` deja de quitar el bloque viejo | la reinyección sobre un archivo ya gobernado | **modificación**, y sólo ésa |

Ambas revertidas; `git diff` limpio después de cada una.

### Un hallazgo que no es defecto de esta etapa, y que hay que conocer

En la clase **baja**, la base compartida `.rsc/skills/<id>/` **no se poda** salvo que el id esté en
`RETIRED_SKILLS` (`scripts/lib/retired-skills.js`), que es un mapa escrito a mano. Una skill que
upstream borre hoy deja su base en el proyecto hasta que alguien añada la entrada. Es
comportamiento de **upstream**, no una regresión del fork, y el test lo **afirma** en vez de
suponerlo, para que nadie lo lea como una garantía que no existe. La consecuencia para la Etapa 5
está en [`PROPUESTAS.md`](./PROPUESTAS.md) §1.

---

## 6. Las dos mutaciones que pidieron los revisores

### Mutación (a) — quitar `governBase(id, dest)` de `scripts/install-apply.js`

Línea 87, borrada entera. Resultado literal:

**Sobre el instrumento de conformidad** — y esto es lo que demuestra que el instrumento de la §1 no
es vacuo:

```
pass 1..3: base conformant 0/274
pass 1..3: cursor delivery conformant 0/274
pass 1..3: claude/codex/antigravity/deepseek delivery conformant 274/274
EXIT=1
```

Los cuatro destinos de symlink siguen en 274/274 y **eso es correcto**: su comprobación es
«la entrega es la base», y con la mutación ambas están igual de desgobernadas. **La ceguera está
declarada:** una auditoría de entrega por symlink **no puede** detectar una base sin gobernar; quien
lo detecta es la auditoría de la base, que es la que cae a 0.

**Sobre los tests** — 9 archivos, 134 tests, **123 pasan, 11 fallan**:

```
not ok 88  - claude — the body settings.json points the session hook at carries no governance
not ok 101 - the base an install materializes carries the contract, for every skill it installs
not ok 103 - a re-install over an already-governed base stays byte-identical
not ok 104 - an UPDATE over a base installed by upstream is governed too — the blind spot
not ok 125 - claude — the delivered SKILL.md keeps the block, the keys and a valid digest
not ok 126 - codex — …
not ok 127 - antigravity — …
not ok 128 - deepseek — …
not ok 129 - cursor — the .mdc keeps the block, which is the only place it can be lost unseen
not ok 130 - the block names the skill it was rendered for, so a mis-rendered path is visible
not ok 131 - governance travels with the referenced skill, not with the caller
```

Los **cinco destinos** caen, como se esperaba. El `not ok 88` de `governance-always-on` cae por una
**aserción de premisa** (*«the base is governed — so pointing here would cost the block»*), que es la
razón correcta.

**¿Cayó poco?** No en los tests propios del fork: caen 11 de los 14 que podían caer. Pero el dato que
importa es el otro: `base-install`, `apply`, `fresh-install-coherence`, `always-on-body` y
`md-block-fidelity` — cinco archivos **heredados** que tocan exactamente la superficie de
instalación — dan **cero fallos**. Ningún test de upstream nota que la gobernanza desaparezca. Es lo
esperado bajo la Estrategia B (upstream no sabe que la gobernanza existe) y no es una regresión,
pero conviene escribirlo: **la red que protege el criterio 4 son los cuatro archivos del fork y
nada más**. Revertida; `git diff` limpio.

### Mutación (b) — `CATEGORIES[0]` en `scripts/lib/customization-validator.js`

Sustituida la resolución exacta (`CATEGORIES.includes(named) ? named : null`, línea 221). Resultado
sobre `tests/governance-customization.test.js`: **17 pasan, 2 fallan**.

```
not ok 8 - rule 6 — a decision with no category, and one with no evidence, are both named
not ok 9 - rule 6 — a HEDGED category is a finding, not silently promoted to the first match
```

El predicho (`not ok 9`) cae. Y cae **uno más** de lo anunciado, con razón: `CATEGORIES[0]` no sólo
promueve una categoría ambigua, también enmascara la **ausencia** de categoría. Revertida;
`git diff` limpio.

---

## 7. `tests/knowledge-sync.test.js` completo, y la atribución de sus fallos

La pregunta que traía el encargo era si el cambio del fork —mover el argumento de `byAuthor` de
`take` a `brought`— rompe `ks64`. **Refutado: `ks64` pasa en las tres observaciones**, dos sobre el
árbol del fork y una sobre upstream prístino.

| Corrida | Árbol | Carga al arrancar | Resultado | Duración |
|---|---|---|---|---|
| Archivo completo | fork | 2,59 | **52 tests, 48 pasan, 4 fallan** — `ks30`, `ks48`, `ks61`, `ks63` | 969 s (16 m 10 s) |
| Los 5 de interés, solos | fork | 2,72 | **5 / 5 pasan**, `ks64` incluido | 184 s |
| Archivo completo | **upstream prístino** (`.worktrees/upstream-main`, `481b1ec`) | 49,75, más una suite ajena | **52 tests, 43 pasan, 9 fallan** — `ks08`, `ks15`, `ks30`, `ks44`, `ks48`, `ks50`, `ks54`, `ks61`, `ks63` | 1 408 s (23 m 28 s) |

**Atribución, con tres brazos independientes y ninguna hipótesis:**

1. **Lógico, y decisivo.** `grep -n "wiki/skills" tests/knowledge-sync.test.js` da **cero**. Ningún
   test del archivo toca `02-DOCS/wiki/skills/`, luego `isGoverned()` es falso para toda ruta,
   `kept` es siempre `[]`, `removable === gone` y `brought === take`; y la guarda nueva
   `if (brought.length)` se entra exactamente cuando se entraba el `if (take.length)` de upstream.
   **El diff del fork es un no-op demostrable para los 52 tests.**
2. **Aislamiento.** Los mismos cuatro, más `ks64`, pasan los cinco al ejecutarse solos, con el mismo
   entorno y sobre el árbol del fork.
3. **Upstream prístino.** El mismo archivo en un worktree de `origin/main` sin una sola línea del
   fork falla un **superconjunto estricto**: los mismos cuatro y cinco más.

**Conclusión:** `tests/knowledge-sync.test.js` es **sensible a la carga en upstream**, y el conjunto
que falla crece con ella (4 fallos a carga 2,6; 9 a carga 49,8). No es del fork.

**Y una corrección al registro que hay que anotar.** El ledger registra *«`knowledge-sync` pasa 52
de 52 en 1 146 s»* como la medida limpia. Esta etapa obtiene **48 de 52 en 969 s** — es decir,
**más rápido y con cuatro fallos**. Un «52/52» es por tanto **una observación**, no una propiedad
del archivo, y la explicación por contención medida en **tiempo total de reloj** no la sostiene: la
corrida que falló fue un 15 % **más corta** que la que pasó. La hipótesis que queda, y se declara
**como hipótesis porque no se ejecutó el experimento que la zanjaría**, está en
[`PROPUESTAS.md`](./PROPUESTAS.md) §2.

---

## 8. La suite completa — la medición autoritativa

```sh
node --test --test-concurrency=1 --test-timeout=1800000 $(cat .fork-tmp/stage4/suite-files.txt)
```

**142 archivos** — los 143 de `tests/*.test.js` menos `tests/eval-lint.test.js`, excluido por el
límite L2 y por ninguna otra razón (§9). Log íntegro en `.fork-tmp/logs/full-suite.log`; muestreo de
carga en `.fork-tmp/logs/full-suite-load.log`.

```
START 23:14:32  load={ 7.17 7.99 7.71 }  files=142
# tests 1588
# suites 0
# pass 1581
# fail 6
# cancelled 0
# skipped 1
# todo 0
# duration_ms 5617237.208059
EXIT=1
DONE 00:48:10  load={ 3.66 2.97 2.93 }
```

**Recuento literal: 1 588 tests, 1 581 pasan, 6 fallan, 1 omitido, 0 cancelados, 1 h 33 m 37 s.**

Tres cifras que conviene leer con cuidado:

- **0 cancelados.** Es la condición que invalidó las mediciones anteriores del proyecto: un intento
  mató 83 archivos. Aquí no se canceló ninguno, así que el veredicto se refiere al estado del
  código y no al del corredor.
- **1 omitido**, y es el condicional autodocumentado de siempre:
  *«the materialized copy of the guard has not drifted from the source # SKIP no
  `.rsc/danger-guard.mjs` in this checkout (gitignored install state) — nothing to drift»*.
- **1 h 33 m 37 s**, frente a los **≈ 1 h 48 m** que `PLAN.md` §7 fija como restricción operativa.
  La cifra del plan era una **reconstrucción** (98,4 min medidos − 10 del tope + 19,1 de
  `knowledge-sync`); ésta es **una corrida medida de principio a fin**. La propuesta de registrarlo
  como revisión explícita está en [`PROPUESTAS.md`](./PROPUESTAS.md) §6.

### Los 6 fallos, uno por uno. Ninguno sin atribuir

| # | Test | Archivo | Atribución |
|---|---|---|---|
| 356 | `dsh06 · end to end: dsh's SessionStart reaches the installed memory hook through the bridge` | `deepseek-target.test.js:101` | **Upstream, preexistente.** Ya confirmado en worktree prístino por la Etapa 2. Declarado «no es tuyo» en el encargo |
| 361 | `A5 · the browser gate fails a known-bad page by name and passes the corrected one` | `design-engine.test.js:64` | **Upstream, intermitente.** 2 pases de 6 observaciones, una de ellas en worktree prístino de `origin/main`. Declarado en el encargo: rojo no es mío, verde no lo arregla |
| 796 | `ks30` | `knowledge-sync.test.js:375` | **Upstream, sensible a la carga.** §7 |
| 807 | `ks48` | `knowledge-sync.test.js:532` | ídem |
| 821 | `ks61` | `knowledge-sync.test.js:771` | ídem |
| 823 | `ks63` | `knowledge-sync.test.js:808` | ídem |

**No apareció ningún otro fallo.** No hubo que atribuir nada nuevo, y por tanto no hubo que elegir
entre un experimento y una hipótesis cómoda. Los cuatro de `knowledge-sync` son **exactamente el
mismo conjunto** que la corrida del archivo solo (§7): dos observaciones independientes, mismo
conjunto, sobre el árbol del fork.

### Y lo que sí pasó, que es el dato del criterio 4

Todos los tests propios del fork están **verdes** en esta corrida, los cuatro nuevos de esta etapa
incluidos:

```
ok 640 - claude — the delivered SKILL.md keeps the block, the keys and a valid digest
ok 641 - codex — …
ok 642 - antigravity — …
ok 643 - deepseek — …
ok 650 - criterion 12 · ADDED  — a skill upstream adds is governed by construction, with no list to update
ok 651 - criterion 12 · REMOVED — the customization of a deleted skill survives byte-identical and is reported orphaned
ok 652 - criterion 12 · MODIFIED — a changed upstream skill is re-governed: one block, right digest, edit intact
ok 653 - criterion 12 · RENAMED — nothing is rehomed: the old name is orphaned, the new name gets its own path
```

### Condiciones de la corrida

La carga de 1 minuto arrancó en **7,17** y bajó: sólo los **primeros 15 minutos** estuvieron por
encima de 5, y los **78 restantes** se movieron entre **1,88 y 3,52**. Las 19 muestras están en el
log. Es la ventana más limpia que esta máquina dio en toda la etapa (§10).

### Las puertas deterministas, en la misma sesión

| Comando | Resultado |
|---|---|
| `npm run validate` | **exit 0** |
| `npm run manifest:check` | **exit 0** |
| `npm run drift:check` | **exit 0** |
| `npm run originality:check` | **exit 0** |
| `npm run governance:check` | **exit 0** — las dos copias byte-idénticas a `docs/fork/stage1/` |
| `node scripts/validate-customizations.js` | **exit 0**, *«no `02-DOCS/wiki/skills/` … absence is valid»* |

---

## 8bis. El criterio 4 por el camino real del producto, no sólo por `applyInstall`

Una objeción legítima al instrumento de la §1: mide llamando a `applyInstall`, que es una función.
El consumidor usa la **CLI**. Por lectura, `scripts/rsc.js` llama a `applyInstall` en `:702`, `:808`
y `:841` y a `syncInstalled` en `:645` y `:923-1010`, y `ensureBase` (`install-apply.js:64`) es el
**único** escritor que materializa `.rsc/skills/` — el único `cpSync` hacia `baseDir` está en
`:70`, dentro de esa función. Pero por lectura no basta, así que se ejecutó:

```sh
node scripts/rsc.js onboard --technical-level technical --project-kind software \
  --goal "…" --software-scope small --workflow main --target claude   # + --accept-plan
node scripts/rsc.js add flutter
node scripts/rsc.js sync
```

| Medida en el proyecto creado por la CLI | Resultado |
|---|---|
| Bases tras `onboard` | **32 / 32 conformes** |
| Bases tras `add` + `sync` | **33 / 33 conformes** |
| Entregado en `.claude/skills/` vs bases | **idéntico conjunto**, sin sobrantes ni faltantes |
| `.rsc/governance/v1.md` | presente |
| `.rsc/governance/always-on.md` | presente, **7 280 B**, **byte-idéntico** al `skills/suggest/SKILL.md` de upstream |
| Cuerpo always-on que `settings.json` cablea | `.rsc/governance/always-on.md`, y **no lleva el bloque** |

Los tres comandos salieron **exit 0**. El camino de la CLI entrega lo mismo que mide el instrumento.

---

## 9. Lo que NO se verificó, y por qué

| Qué | Motivo |
|---|---|
| `tests/eval-lint.test.js` (3 fallos conocidos de upstream por falta de PyYAML) | **Límite L2.** Lanza `scripts/eval-lint.sh` de verdad (`:45`, `:84` con `cwd: REPO`), y el script escribe en `/tmp` **literal** (`:192,195,203`). Ejecutarlo escribiría fuera de la carpeta dedicada. Instalar PyYAML globalmente está prohibido por §1 |
| `npm run design:upstream` | **Límite L2.** `GET` a `api.github.com` (`scripts/design-upstream.js:37,42,47`) |
| La mitad **E** de los criterios 4 y 8 | Son las evaluaciones G1–G6. No son de esta etapa |
| La parte **I** del criterio 6 (acreditación en el README) | Es de la Etapa 7 |
| Windows | No hay entorno. Limitación residual ya registrada |
| El mecanismo exacto de los fallos de `knowledge-sync` | Atribuidos a upstream por experimento (§7). **El mecanismo** queda como hipótesis con su experimento propuesto en [`PROPUESTAS.md`](./PROPUESTAS.md) §2 |
| **Máquina ociosa en sentido estricto** | Ver §10 |

---

## 10. La cuarta condición del instrumento no se cumplió del todo, y hay que decirlo

El encargo partía de que *«la máquina es tuya y nadie más la está usando»*. **Es falso**, y se
midió. Tres fuentes de carga ajena, ninguna mía:

- **Una VM del usuario al 94,4 % de CPU**, con **4 días y 1 hora** de proceso
  (`Virtualization.framework/.../com.apple.Virtualization.VirtualMachine`). A las 22:07 la misma VM
  marcaba **1,1 %**; a las 23:14, **94,4 %**. No es una constante que se pueda descontar: es carga
  ajena variable y grande.
- **Una suite de `vitest` de otro proyecto.** A las 22:57, **13 procesos**: un pool `tinypool` más
  `scripts/run-evals.mjs` de `/Users/home/Development/Marketing/snm-t100-items/api/`. El padre
  llevaba 5 m 43 s, o sea arrancó hacia las **22:50**.
- **`docker-scout` al 62,3 %**, arrancado a las ~23:12.
- Y de fondo, permanentes: `WindowServer` al 35 % y la aplicación de Claude sumando ~55 %.

Más una contribución **propia** que sí hay que reconocer: mi `git worktree add` (1 960 archivos)
disparó `syspolicyd` al **84,6 %** y la carga de 1 minuto a **49,75**. El worktree se eliminó al
terminar su medición.

**Consecuencia operativa, y es la más importante de esta sección: en esta máquina la condición 4 no
es alcanzable.** La espera a «carga de 1 minuto por debajo de 3,0» se abandonó tras comprobar que
la carga **subía** (6,08 → 8,87) con cero procesos de test ajenos, porque la VM sola la sostiene por
encima de ese umbral. La suite se lanzó con una puerta declarada —ningún `vitest`, `tinypool`,
`run-evals` ni `docker-scout`, y carga de 1 minuto < 9,0— y con un **muestreador que anota la carga
cada 5 minutos** durante toda la corrida (`.fork-tmp/logs/full-suite-load.log`), para que el log se
pueda interpretar en vez de tener que creérselo.

Lo que sí se puede afirmar: **ningún trabajo propio corrió en paralelo** — una sola suite a la vez,
nunca dos, ningún subagente. Y qué corrida pilló qué:

| Corrida | Ventana | Estado de la máquina |
|---|---|---|
| `knowledge-sync` completo (fork) | 22:20–22:36 | **antes** de la suite ajena; carga 2,59 al arrancar |
| Los 5 solos | 22:38–22:41 | **antes** de la suite ajena; carga 2,72 |
| `knowledge-sync` completo (upstream) | 22:43–23:07 | **contaminada**: mi worktree y, desde ~22:50, la suite ajena |
| Conformidad de las 274 | varias | **indiferente a la carga**: son comparaciones de bytes, no de tiempos |
| Suite completa | ver §8 | lanzada tras esperar a que no quedara ningún proceso ajeno y la carga de 1 min bajara de 3,0; la cabecera del log lo registra |

La corrida de upstream contaminada **no se usa para afirmar nada sobre tiempos**; se usa sólo para
el hecho binario de que upstream falla esos tests, que es a favor del fork y que una carga mayor
sólo puede reforzar.
