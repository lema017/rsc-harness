# Etapa 2 — Verificación

Todo lo de aquí se **ejecutó**. «Verificado» significa ejecutado, no leído (`CONTRACT.md` §9).

## 0. El instrumento

Las cuatro condiciones medidas, las cuatro aplicadas en cada corrida:

```sh
export HOME=/Users/home/Development/rsc-harness-fork/.fork-tmp/home
export TMPDIR=/Users/home/Development/rsc-harness-fork/.fork-tmp/tmp
export XDG_CONFIG_HOME=/Users/home/Development/rsc-harness-fork/.fork-tmp/xdg-config
export XDG_DATA_HOME=/Users/home/Development/rsc-harness-fork/.fork-tmp/xdg-data
export npm_config_cache=/Users/home/Development/rsc-harness-fork/.fork-tmp/npm-cache
export GIT_CEILING_DIRECTORIES=/Users/home/Development/rsc-harness-fork/.fork-tmp

node --test --test-concurrency=1 --test-timeout=1800000 <archivos>
```

Más la cuarta, que no es un parámetro de la línea de comandos: **la máquina ociosa**. Ninguna
corrida de esta etapa compartió la máquina con otro trabajo propio.

Sin instalaciones globales, sin red, sin credenciales, y sin escribir fuera de
`/Users/home/Development/rsc-harness-fork`.

## 1. La invariante

```
$ git diff --stat origin/main -- skills/
                                          # vacío
$ ls skills | wc -l
     274
```

Y con un test que lo vigila ejecutando una instalación real
(`tests/governance-base.test.js` → *«the invariant: an install never writes inside the repository
catalog»*), para que la invariante no dependa de que alguien se acuerde de mirar el diff.

## 2. La transformación sobre las 274 del catálogo

| Medida | Resultado |
|---|---|
| Skills transformadas | **274 / 274** |
| No idempotentes (2ª pasada ≠ 1ª) | **0** |
| Bloque incompleto o sin las tres claves | **0** |
| Digest que no cuadra con su propio bloque | **0** |
| Delimitadores de código desequilibrados | **0** antes, **0** después |
| Contenido perdido (más allá de una línea en blanco normalizada) | **0** |
| Offset más profundo de `origin:` | **880 B** (ventana de `scripts/doctor.js`: 2 048 B) |
| Crecimiento máximo | **+936 B** |
| Preámbulo renderizado para `suggest` | **785 B** |

## 3. Instalación real en los 5 asistentes

Proyectos desechables en `.fork-tmp/stage2/proj-<destino>`, `HOME` y `TMPDIR` dentro de la
carpeta dedicada. `skills/suggest/SKILL.md` de upstream = **7 280 B**.

| Destino | Superficie always-on | Bytes | ¿Lleva el bloque? | Entrega por skill | ¿Lleva el bloque? | ¿Las tres claves? |
|---|---|---|---|---|---|---|
| `claude` | `.rsc/governance/always-on.md`, **la ruta que guarda `settings.json`** | **7 280** | **no** | `.claude/skills/<id>` (symlink) | **sí** | sí |
| `codex` | `AGENTS.md` | 6 946 | **no** | `.codex/rsc/<id>` (symlink) | **sí** | sí |
| `cursor` | `.cursor/rules/rsc-suggest.mdc` | 6 676 | **no** | `.cursor/rules/<id>.mdc` (**convertido**) | **sí** | no, por diseño |
| `antigravity` | `.antigravity/AGENTS.md` | 6 946 | **no** | `.antigravity/rsc/<id>` (symlink) | **sí** | sí |
| `deepseek` | `AGENTS.md` | 6 946 | **no** | `.dsh/skills/<id>` (symlink) | **sí** | sí |

`.rsc/governance/v1.md` = **19 774 B** en los cinco.

Los tests no se quedan en el tamaño: afirman **igualdad byte a byte** del cuerpo always-on
contra el de upstream en los cinco, y en Cursor afirman que el bloque entregado es
**byte-idéntico al renderizado**, porque el `.mdc` es la única entrega transformada de verdad y
por tanto la única donde un fallo de renderizado no lo vería ni el validador de la base ni el
digest.

Y la ausencia de las claves en el `.mdc` se afirma **explícitamente** en vez de darse por sabida:
es el hueco que `CONTRACT.md` §1 declara, y si algún día deja de ser cierto, ese test es donde se
nota.

## 4. Los tests no son vacuos: cuatro mutaciones

Cada mutación se aplicó, se ejecutó y se revirtió.

| Mutación | Qué debería caer | Qué cayó |
|---|---|---|
| Regla 8 del validador desactivada | el test negativo | `not ok 3` (negativo), `not ok 13` (install), `not ok 15` (sync) |
| Líneas ilegibles de frontmatter ignoradas | el test negativo | las mismas tres |
| El paso `hook` vuelve a pasar la base gobernada | los 5 destinos | `not ok 1..5` — los cinco |
| `targets/claude.js` deja de honrar `sourceMd` | **sólo** `claude` | `not ok 1` y nada más |

La cuarta es la que importa: el test de `claude` sigue la ruta guardada en `settings.json`, así
que cae exactamente cuando el reapuntado falla. Un test que mirase el valor de retorno de
`wireHook` habría seguido verde en las cuatro.

## 5. Divergencias con upstream que esta etapa añade

`ARCHITECTURE.md` §4 preveía **1**. Son **3 archivos / 4 puntos**, y la máquina de mantenimiento
de §9 debe avisar de los tres:

| Archivo | Punto | Por qué es necesario |
|---|---|---|
| `targets/claude.js` | `suggestRel` se deriva de `sourceMd` | Sin esto, `claude` paga el preámbulo en cada SessionStart y cada compactación, y G3 queda inmedible |
| `scripts/doctor.js` | `alwaysOnBytesFor` acepta `always-on` además de `suggest` en el nombre | Sin esto `doctor` **miente** sobre el coste por sesión: no casa la aguja, cae al fallback y cuenta la base gobernada |
| `tests/apply.test.js` | dos aserciones que fijaban `skills/suggest` en el cableado | Fijaban el cableado viejo. Se conserva su intención y se refuerza una de ellas (ahora exige que el archivo exista) |

`scripts/install-apply.js` ya divergía por necesidad: es el punto de transformación.

**Los tres techos de bytes de `suggest` no se tocaron**, y siguen verdes: leen el archivo del
repositorio, que la invariante congela.

## 6. Las corridas, literales

### 6.1 El paso obligatorio de L1 — los diez archivos que leen el cuerpo, más los cuatro nuevos

```sh
node --test --test-concurrency=1 --test-timeout=1800000 \
  tests/always-on-body.test.js tests/clone-bootstrap.test.js tests/ftd-lane.test.js \
  tests/catalog-diet.test.js tests/ux-upstream.test.js tests/design-engine.test.js \
  tests/skill-lint.test.js tests/frontmatter.test.js tests/manifest.test.js \
  tests/context-budget.test.js \
  tests/governance-base.test.js tests/governance-always-on.test.js \
  tests/governance-delivery.test.js tests/governance-customization.test.js
```

```
# tests 147
# pass 147
# fail 0
# duration_ms 448055.080858
EXIT=0
```

**L1 queda cerrado: 147 / 147, cero fallos.** Los tres techos de `suggest` incluidos, sin tocar
una cifra.

### 6.2 Los cinco destinos y la superficie de instalación — 21 archivos

```sh
node --test --test-concurrency=1 --test-timeout=1800000 \
  tests/deepseek-target.test.js tests/md-block-fidelity.test.js tests/hook-idempotency.test.js \
  tests/hook-once.test.js tests/hooks-path.test.js tests/base-install.test.js \
  tests/fresh-install-coherence.test.js tests/apply.test.js tests/doctor-hook-counts.test.js \
  tests/doctor-hook-scripts.test.js tests/doctor-exit-code.test.js tests/target-resolution.test.js \
  tests/memory-cross-target.test.js tests/backups.test.js tests/agent-install.test.js \
  tests/list-skills-symlinks.test.js tests/capabilities.test.js tests/purge.test.js \
  tests/purge-truth.test.js tests/repair.test.js tests/sync-skill-floor.test.js
```

```
# tests 267
# pass 266
# fail 1
# duration_ms 1058660.665115
EXIT=1

not ok 129 - dsh06 · end to end: dsh's SessionStart reaches the installed memory hook through the bridge
```

La primera pasada de este conjunto dio **18 fallos**, los tres defectos de §5 y sus réplicas.
Corregidos, queda **uno**, y es **preexistente**: falla idénticamente en un worktree prístino de
`origin/main` con el mismo entorno.

### 6.3 Las puertas deterministas

| Comando | Resultado |
|---|---|
| `npm run validate` | exit 0 |
| `npm run manifest:check` | exit 0 |
| `npm run drift:check` | exit 0 |
| `npm run originality:check` | exit 0 |
| `npm run governance:check` | exit 0, las dos copias byte-idénticas a `docs/fork/stage1/` |
| `node scripts/validate-customizations.js` sobre una fixture rota | exit 1, cuatro errores, **cada línea con su archivo y su regla** |

### 6.4 Fallos preexistentes: la lista del ledger necesita dos correcciones

| Test | Lo que dice el ledger | Lo medido |
|---|---|---|
| `design-engine` `A5 · the browser gate…` | *«candidato REAL a defecto de upstream»* | **Intermitente.** Falló en 2 de 3 observaciones —una de ellas en el worktree prístino de `origin/main`, lo que lo desliga de este cambio— y **pasó** en la tercera. No es un fallo determinista |
| `deepseek-target` `dsh06` | **no está en la lista** | **Preexistente.** Falla igual en el worktree prístino. La línea base del ledger se detuvo al 53 % y nunca llegó a evaluarlo |
| `eval-lint` (3 tests) | fallan por falta de PyYAML | **No reejecutado:** L2 lo prohíbe (`scripts/eval-lint.sh:192` escribe en `/tmp` literal) |
