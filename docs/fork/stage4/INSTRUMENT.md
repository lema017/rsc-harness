# Etapa 4 — el instrumento

Todo lo que esta etapa afirma se midió con la configuración de abajo. «Verificado» significa
**ejecutado**, nunca leído (`CONTRACT.md` §9). Lo que no se pudo ejecutar está en
[`VERIFICATION.md`](./VERIFICATION.md) §9 como **no verificado**, con su motivo.

---

## 1. Las cuatro condiciones, las cuatro aplicadas

```sh
# /Users/home/Development/rsc-harness-fork/.fork-tmp/env.sh
F=/Users/home/Development/rsc-harness-fork
export HOME=$F/.fork-tmp/home
export TMPDIR=$F/.fork-tmp/tmp
export XDG_CONFIG_HOME=$F/.fork-tmp/xdg-config
export XDG_DATA_HOME=$F/.fork-tmp/xdg-data
export npm_config_cache=$F/.fork-tmp/npm-cache
export GIT_CEILING_DIRECTORIES=$F/.fork-tmp
```

```sh
node --test --test-concurrency=1 --test-timeout=1800000 <archivos>
```

| # | Condición | Por qué, medido antes de esta etapa |
|---|---|---|
| 1 | `--test-concurrency=1` | Con paralelismo el tiempo de reloj por archivo se infla dos órdenes de magnitud y el corredor **cancela** archivos sanos: un intento mató 83. Un veredicto con archivos cancelados no se relaciona con el estado del código en ninguna de las dos direcciones |
| 2 | `--test-timeout=1800000` | El archivo más lento mide **1 146 s** en solitario. Con 600 s se reporta como cuelgue lo que sólo es lento |
| 3 | `GIT_CEILING_DIRECTORIES` sobre el temporal | Sin él, git sube desde el temporal hasta el repositorio del fork y **cinco tests fallan con mensajes verosímiles y falsos** |
| 4 | Máquina ociosa | Dos agentes de **sólo lectura** bastaron una vez para inflar ese archivo un 42 % y reventar un tope de 1 800 s |

**La cuarta no se cumplió, y no por mi causa.** Lo que sí se puede afirmar: **ningún trabajo propio
corrió en paralelo** — una sola suite a la vez, nunca dos, ningún subagente lanzado. Lo que **no** se
puede afirmar es que la máquina estuviera ociosa: durante la etapa hubo una VM del usuario que pasó
del 1,1 % al **94,4 %** de CPU, una suite de `vitest` de otro proyecto con 13 procesos, y un
`docker-scout` al 62 %. La medición completa de esas condiciones, con horas y con qué corrida pilló
qué, está en [`VERIFICATION.md`](./VERIFICATION.md) §10, y la carga queda anotada en la cabecera de
cada log más un muestreo cada 5 minutos durante la suite completa.

Regla de lectura que se aplicó en consecuencia: un «pasa» bajo ese fondo **sigue siendo un pasa**;
un «falla» **no se atribuye sin experimento** — el archivo se re-ejecuta solo, y si vuelve a fallar,
en un worktree prístino de `origin/main` antes de llamarlo defecto del fork
([`VERIFICATION.md`](./VERIFICATION.md) §7 y §8). Y las mediciones de conformidad son
**indiferentes a la carga**: comparan bytes, no tiempos.

## 2. Los dos límites que no se cruzaron

| Límite | Qué es | Verificado |
|---|---|---|
| **L2a** | `scripts/design-upstream.js` hace `GET` a `api.github.com` | `scripts/design-upstream.js:37,42,47`. **No ejecutado.** `npm run design:upstream` no se corrió |
| **L2b** | `scripts/eval-lint.sh` escribe en `/tmp` **literal** | `scripts/eval-lint.sh:192,195,203` → `/tmp/eval-lint.$$.err`. `TMPDIR` no lo redirige porque la ruta está escrita a mano |

Consecuencia sobre la suite: **`tests/eval-lint.test.js` queda fuera**, porque lanza el script de
verdad (`tests/eval-lint.test.js:45,84`, el segundo con `cwd: REPO`), así que ejecutarlo escribiría
fuera de la carpeta dedicada. Es el único archivo excluido, y el motivo es el límite, no el
resultado: sus tres fallos por falta de PyYAML ya estaban declarados como deuda de upstream.

**Y una afirmación del coordinador que hay que matizar, porque la medición no la respalda tal cual:**
`tests/design-engine.test.js` **no** toca la red. Llama a `checkUpstream` pasándole un
`fetchImpl` falso (`tests/design-engine.test.js:111,114,116`), así que el límite L2a recae sobre el
script invocado a mano, no sobre su archivo de tests. Ese archivo **sí** se ejecuta.

Barrido para no dejarlo en inferencia: el único escritor de `/tmp` literal en `scripts/`, `targets/`
y `tests/` es `eval-lint.sh`. Las otras apariciones de `/tmp` son cadenas de aserción
(`danger-guard`, `eval-integrity`, `roast-me`), un argumento de una función pura de rutas
(`clone-bootstrap.test.js:732`) o **texto de instrucciones** que nadie ejecuta
(`skill-harden.workflow.js:85-101`). 105 archivos de test usan `os.tmpdir()`, que **sí** honra
`TMPDIR`.

## 3. Los instrumentos nuevos de esta etapa

| Archivo | Qué mide | Criterio |
|---|---|---|
| `scripts/verify-catalog-conformance.js` | Instala las **274** en un proyecto desechable, para los **18** destinos, **tres veces**, y audita la base distribuida, la entrega por destino y la superficie always-on | **4** y **5** |
| `tests/governance-upstream-change.test.js` | Las cuatro clases de cambio de upstream, un test por clase | **12** |

### Por qué el instrumento del criterio 4 no podía ser el de la Etapa 2

`tests/governance-base.test.js` prueba la transformación **en memoria** sobre los 274 archivos del
catálogo, y prueba una instalación real de **4** skills. Eso no es lo que pide el criterio 4. El
criterio habla de *toda skill **distribuida***, y «distribuida» es el árbol que un asistente lee de
verdad: `.rsc/skills/<id>/SKILL.md` materializado por un `applyInstall` real, más la entrega que
cuelga de él. El instrumento nuevo recorre ese árbol.

### Qué cuenta como fallo, escrito antes de medir

- **Parcial:** bloque presente y alguna de las tres claves ausente, o claves presentes sin bloque.
- **Duplicado:** más de un marcador de apertura, de cierre, o más de una copia de cualquier clave.
- **Digest incorrecto:** el digest no es el del bloque que acompaña, **o** no es el del bloque
  renderizado para *esa* skill. Las dos comprobaciones, porque la primera sola aceptaría un bloque
  coherente pero de otra skill.
- **Fuera de sitio:** el bloque no abre el cuerpo. *«Lee esto antes de aplicar la skill de abajo»*
  es falso si está al final.
- **Entrega que no es la base:** en los 17 destinos de symlink, que el directorio entregado no
  resuelva a la base gobernada, o que los bytes difieran. Una copia que dejó de seguir a la base se
  leería perfectamente y envejecería para siempre.
- **El `.mdc` de Cursor:** bloque **byte-idéntico al renderizado** — es la única entrega realmente
  transformada, y la única donde un fallo de renderizado no lo verían ni el validador de la base ni
  el digest — y las tres claves **ausentes**, que es el hueco que `CONTRACT.md` §1 declara. Se
  afirma en vez de darse por sabido: si algún día deja de ser cierto, ese es el sitio donde se nota.
- **La superficie always-on:** ni marcador de apertura ni de cierre, en los 18. Para `claude` se
  sigue **la ruta que queda guardada en `settings.json`**, no el valor de retorno de `wireHook`,
  porque ese adaptador no renderiza ningún cuerpo — escribe una ruta y el gancho lee el archivo en
  ejecución. Un test que mirara el retorno sería verde pase lo que pase.

### Por qué 18 destinos y no 5

`PLAN.md` §9 limita las **promesas** de gobernanza a cinco asistentes, y eso no cambia.
Pero `ARCHITECTURE.md` §4 («lo que hay que medir») pide la entrega por skill **en los 18**, y
`CONTRACT.md` §1 afirma algo concreto sobre *«17 de 18»* que **nada había medido**. Esta etapa lo
mide, para que la frase sea evidencia y no inferencia. Los otros trece siguen sin promesas; lo que
se gana es saber qué reciben de hecho.

### Por qué tres pasadas y no dos

| Pasada | Qué ejerce |
|---|---|
| 1 | Instalación en limpio |
| 2 | Reinstalación sobre la base ya gobernada. Aquí `ensureBase` **no** vuelve a copiar, así que lo que se mide es que `governBase` sobre un árbol ya gobernado sea un no-op real |
| 3 | `.rsc/.base-versions.json` borrado antes de instalar. Eso fuerza a re-materializar cada base desde el catálogo prístino y a transformarla otra vez: es la **única** pasada donde la transformación corre dos veces sobre los mismos bytes en vez de no hacer nada |

El criterio 5 pide «doble ejecución byte-idéntica». Con sólo la pasada 2 se podría pasar el criterio
sin que la transformación se hubiera ejecutado una segunda vez.
