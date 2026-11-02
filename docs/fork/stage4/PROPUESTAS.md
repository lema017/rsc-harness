# Etapa 4 — lo que propongo cambiar **fuera** de mi etapa

Regla del encargo: si un hallazgo exige tocar algo de otra etapa, **no se toca**; se propone con
archivo y fragmento. Nada de este documento está aplicado.

---

## 1. Etapa 5 (mantenimiento) — la base de una skill borrada sobrevive al borrado

**Medido**, y afirmado en `tests/governance-upstream-change.test.js` para que no quede como
suposición:

```
assert.equal(existsSync(join(cwd, '.claude', 'skills', 'flutter')), false, 'the delivered link is pruned');
assert.equal(existsSync(join(cwd, '.rsc',    'skills', 'flutter')), true,
  'the shared base is NOT pruned for an id outside RETIRED_SKILLS — stated, not promised');
```

El motivo está en `scripts/install-apply.js:334-335`:

```js
const prunedBases = Object.keys(readBaseVersions(cwd))
  .filter((id) => isRetired(id) && !skillIds.includes(id) && !stillRecordedElsewhere(id));
```

`isRetired` consulta `RETIRED_SKILLS`, un mapa **escrito a mano** en
`scripts/lib/retired-skills.js`. Consecuencia: cuando upstream **borra** una skill, el consumidor
conserva en `.rsc/skills/<id>/` una base **gobernada** de una skill que ya no existe, hasta que
alguien añada la entrada al mapa.

**Propuesta para la Etapa 5.** El punto de entrada de mantenimiento, al detectar la clase *baja*,
debe hacer tres cosas y ninguna en silencio:

1. Añadir el id al registro de retiradas **con su sucesor o con `null`** si no lo hay — hoy el mapa
   sólo sabe expresar «se fundió en X», no «desapareció».
2. Avisar de que esa entrada es una **divergencia nueva con upstream** en un archivo que upstream
   edita, igual que ya se avisa de `targets/claude.js`, `scripts/doctor.js` y `tests/apply.test.js`.
3. Reportar la personalización huérfana por su nombre. Eso ya funciona (criterio 12, clase baja) y
   no hay que tocarlo.

**Lo que NO propongo:** podar la base por el simple hecho de que el id no esté en el catálogo. Una
base que `rsc` no recuerda haber creado puede ser trabajo de alguien, y el propio instalador apoya
la propiedad en el registro de versiones, no en el nombre. Cambiar eso aquí sería arreglar un
problema de mantenimiento con un borrado heurístico.

---

## 2. Deuda heredada — `tests/knowledge-sync.test.js` es sensible a la carga, en upstream

**Hecho, por experimento** (`VERIFICATION.md` §7): el archivo falla 4 de 52 sobre el árbol del fork
a carga 2,6, y **9 de 52 sobre un worktree prístino de `origin/main`** a carga alta. El conjunto que
falla crece con la carga y es un superconjunto. No es del fork.

**Hipótesis del mecanismo, declarada como hipótesis porque no ejecuté el experimento que la
zanja.** `targets/knowledge-sync.mjs:84`:

```js
const LOCAL_TIMEOUT_MS = 4_000;
```

Toda operación **local** de git del módulo corre con 4 s de tope, y `run()` (`:101-113`) convierte
el fallo en `{ ok: false }`, que la mayoría de los llamantes no distingue de «no había nada». Los
cuatro modos de fallo observados encajan uno a uno con esa forma: `ks63` recibe cadena **vacía**,
`ks61` pierde la **premisa de su fixture**, `ks48` pierde una edición, y `ks30` **dice algo** cuando
no debía decir nada. Y el ledger ya había registrado un `git commit: spawnSync git ETIMEDOUT`.

**El experimento que lo zanjaría**, en una ventana de ~35 min con la máquina quieta:

```sh
# brazo A: tal cual
node --test --test-concurrency=1 --test-timeout=1800000 tests/knowledge-sync.test.js
# brazo B: la MISMA corrida con LOCAL_TIMEOUT_MS = 60_000 (mutación, revertir después)
```

Si B pasa 52/52 de forma repetida y A no, el mecanismo queda demostrado.

**Lo que propongo entonces, y no antes:**

- **No subir el tope a ciegas.** Un tope de 4 s sobre git local es una decisión de producto
  razonable: el módulo corre dentro de un gancho de sesión y colgarse ahí sería peor.
- **Sí hacer el fallo ruidoso.** Hoy un `run()` agotado es indistinguible de un resultado vacío. Un
  `{ ok:false, timedOut:true }` que el llamante pueda nombrar convertiría cuatro fallos
  desconcertantes en cuatro mensajes claros, y es un cambio que no altera el comportamiento en el
  camino feliz.
- **Y declarar el archivo como no determinista** en la documentación de la suite, mientras no se
  arregle. Es la consecuencia que más afecta a quien lea un log rojo.

Destinatario: quien lleve la deuda heredada (hoy `stage1/evidence/inherited-debt.md`) y la Etapa 8.

---

## 3. Etapa 6 (recuperación) — `rsc restore` devuelve la base **sin gobernar**, y nadie lo dice

**Medido, no inferido.** Hay un segundo escritor dentro de `.rsc/skills/`: `restoreEntry`
(`scripts/lib/backups.js:112`, `cpSync(contentAbs, absPath, …)`). Y `scripts/install-apply.js:215`
mete `baseDir(step.id, cwd)` en los `managedPaths`, así que la instantánea **contiene los
directorios de base**. `createBackup` corre **antes** del bucle de instalación, luego la instantánea
guarda el estado **previo**.

Escenario, el que alcanza un consumidor real, y su resultado literal:

```
step 1 — base rewound to upstream shape, governed = false
step 2 — after the fork install, governed = true
         backups on disk: 2
step 3 — after `restore latest`, governed = false
         snapshot id: 20261102-052307-install-claude  operation: install
         base dir in the snapshot entries: true
         governance artifacts in the snapshot: ['.rsc/governance/v1.md', '.rsc/governance/always-on.md']
```

Reproducción (se ejecutó así; se deja aquí porque el script vivía en un temporal):

```js
import { applyInstall } from './scripts/install-apply.js';
import { restoreBackup } from './scripts/lib/backups.js';
import { governanceOf } from './scripts/lib/governance.js';
const md = join(cwd, '.rsc', 'skills', 'flutter', 'SKILL.md');
await applyInstall({ skillIds: ['suggest','flutter'], target: 'claude', home, cwd });
writeFileSync(md, readFileSync('skills/flutter/SKILL.md','utf8'));  // lo que deja UPSTREAM
await applyInstall({ skillIds: ['suggest','flutter'], target: 'claude', home, cwd });  // backup + gobierna
restoreBackup({ cwd, id: 'latest' });
governanceOf(readFileSync(md,'utf8')).complete;  // => false
```

**Qué es y qué no es.** No es un defecto del transformador: `restore` es una máquina del tiempo y
devolver un árbol que estaba sin gobernar a estar sin gobernar es **literalmente correcto**. Lo que
sí es, es un **hueco en el alcance del criterio 4**: tras un `restore`, los 17 destinos de symlink
leen de inmediato una skill **sin contrato**, y nada lo dice. El siguiente `install` o `sync` lo
re-gobierna — eso está probado (`governance-base.test.js`, *«an UPDATE over a base installed by
upstream is governed too»*) — pero entre los dos momentos la afirmación «toda skill distribuida
porta el contrato» es falsa en ese proyecto.

**Por qué no lo arreglo yo.** Qué debe significar `restore` es una decisión de producto, y
`restore` es materia de la Etapa 6 (*distribución, actualización y recuperación*). Hay dos
soluciones y no son equivalentes:

1. **Re-gobernar al restaurar.** Barato, pero convierte `restore` en algo que **no** devuelve
   exactamente lo que guardó, y eso es precisamente la propiedad por la que existe.
2. **Nombrarlo.** `rsc doctor` reporta una base sin gobernar, y `restore` avisa al terminar si
   acaba de devolver alguna. No toca la semántica de `restore` y es lo que `CONTRACT.md` §13 ya
   ordena: *«An ungoverned skill must be reported as such by the conformance validator»* — cláusula
   que hoy **no tiene implementación en el proyecto consumidor**, sólo en el repositorio del fork.

**Recomiendo la 2**, y además señala el agujero más general: el validador de conformidad del
criterio 4 corre en el repositorio del fork, no en la máquina del consumidor. Ningún comando del
producto responde hoy «¿están gobernadas mis 274?».

**No añadí un test para esto a propósito**, y conviene saber por qué: la suite autoritativa de esta
etapa ya estaba corriendo con su lista de 142 archivos congelada, y meter un archivo 143 lo habría
dejado fuera de la medición que el proyecto necesita. El test lo debe escribir quien decida entre
las dos opciones.

---

## 4. Correcciones al registro — `docs/fork/LEDGER.md`

No escribo en el ledger. Tres entradas que la medición de esta etapa contradice o matiza:

### 4.1 «`knowledge-sync` pasa 52 de 52 en 1 146 s» es **una observación**, no una propiedad

`LEDGER.md:891`. Esta etapa mide **48 de 52 en 969 s** con el mismo instrumento: **más rápido y con
cuatro fallos**. La explicación por contención medida en tiempo total de reloj no sostiene el caso,
porque la corrida que falló fue un **15 % más corta** que la que pasó. Fragmento propuesto:

> **Revisión (Etapa 4):** el 52/52 en 1 146 s queda como **una observación**, no como línea base.
> Con el mismo instrumento y la máquina sin trabajo propio en paralelo, el archivo dio **48/52 en
> 969 s**, y un worktree prístino de `origin/main` dio **43/52**. El archivo es **no determinista**
> y el conjunto que falla crece con la carga; la correlación no es con el tiempo total de la
> corrida.

### 4.2 La línea base del criterio 6 está en **MiB**, no en MB

`ACCEPTANCE.md` criterio 6 y el ledger registran «5,3 MB». El tarball mide hoy **5 602 330 B**, que
son **5,34 MiB** y **5,60 MB** decimales. Sin la nota, los +7 archivos del fork parecen haber
añadido 300 KB comprimidos, que es imposible. Fragmento propuesto: *«5,3 MiB (5 602 330 B medidos
en la Etapa 4; la cifra original estaba en MiB)»*.

### 4.3 El límite L2 es el **script**, no el archivo de tests de `design-engine`

El encargo de esta etapa decía *«no ejecutes `scripts/design-upstream.js` (GET a `api.github.com`)»*,
y eso es cierto. Pero **`tests/design-engine.test.js` no toca la red**: pasa un `fetchImpl` falso
(`:111`, `:114`, `:116`). Conviene que el ledger lo diga, porque si no cualquiera que lea «L2» puede
excluir ese archivo de la suite y perder cobertura real. **El único archivo que hay que excluir por
L2 es `tests/eval-lint.test.js`**, y el barrido que lo demuestra está en `INSTRUMENT.md` §2.

---

## 5. `docs/fork/stage1/ACCEPTANCE.md` — columna de estado de cinco criterios

No escribo en `stage1/`. Con la evidencia de esta etapa, cinco filas quedan desactualizadas:

| # | Estado actual | Estado propuesto |
|---|---|---|
| 4 | «Falta la pasada sobre las **274 instaladas** (Etapa 4)» | **Medido**: 274/274 en la base distribuida y en la entrega de los **18** destinos, 3 pasadas, 0 parciales, 0 duplicados, 0 digests incorrectos. Pendiente **sólo** la revisión independiente |
| 5 | «idempotencia medida 274/274 por la Etapa 2» | **Medido también sobre las instaladas**, en sus dos formas: reinstalación y refresco forzado de base, 274/274 byte-idénticas en ambas |
| 6 | «instrumento ✅ verificado y con línea base; acreditación pendiente» | Parte **D** **cumplida**: 1 789 archivos (+7, 0 perdidos), 9/9 rutas de licencia, 274 y 274 sin bajar, y los mismos recuentos sobre el árbol **instalado**. Parte **I** sigue pendiente (Etapa 7) |
| 7 | «pendiente» | **Cumplido**: `tests/ux-upstream.test.js` 5/5, y los dos subárboles byte-idénticos **en el árbol entregado** |
| 12 | «pendiente» | **Cumplido**: cuatro tests, uno por clase, con dos mutaciones que demuestran que no son vacuos |

---

## 6. `docs/fork/PLAN.md` §7 — la restricción operativa de duración

`PLAN.md` §7 fija «≈ 1 h 48 m en serie» como restricción operativa, cifra que ya era una revisión de
las 2 h 17 m de 3.7.1 — pero que era una **reconstrucción** (98,4 min medidos − 10 del tope + 19,1
de `knowledge-sync`), no una corrida. Esta etapa tiene la corrida: **1 h 33 m 37 s**
(`duration_ms 5617237`), **1 588 tests, 1 581 pasan, 6 fallan, 1 omitido, 0 cancelados**, sobre 142
archivos. Fragmento propuesto:

> **Revisión (Etapa 4):** la suite completa mide **1 h 33 m 37 s** medidos de principio a fin
> (1 588 tests, 142 archivos, concurrencia 1, tope 1 800 s, 0 cancelados). Sustituye a los
> ≈ 1 h 48 m, que eran una reconstrucción y no una corrida. **Advertencia de uso:** el recuento
> excluye `tests/eval-lint.test.js` por el límite L2, y 4 de los 6 fallos están en un archivo
> **no determinista** de upstream (`knowledge-sync`), así que la suite **no sirve como puerta
> binaria** sin una política explícita para ese archivo.

---

## 7. Lo que requiere decisión del usuario

Tres, y ninguna la puedo tomar yo:

1. **La máquina.** La condición 4 del instrumento no es alcanzable aquí (§10 de `VERIFICATION.md`).
   ¿Se acepta esta corrida como autoritativa con sus condiciones registradas —que es lo que
   recomiendo, porque los 78 de sus 93 minutos corrieron entre 1,88 y 3,52 de carga y no se canceló
   ningún archivo— o se repite en una máquina de verdad quieta?
2. **`knowledge-sync` como puerta.** El archivo es no determinista en upstream. Las opciones son
   adoptarlo con una política de reintento declarada, excluirlo de la puerta y declararlo deuda
   heredada, o arreglar el ruido primero (§2). Afecta a los criterios 3, 7 y 14 y a la
   recomendación de puertas.
3. **`rsc restore`** (§3): ¿re-gobernar al restaurar, o nombrarlo y no tocar la semántica de
   `restore`? Recomiendo lo segundo, y que de paso el producto gane una forma de responder
   *«¿están gobernadas mis 274?»* en la máquina del consumidor, que hoy no existe.
