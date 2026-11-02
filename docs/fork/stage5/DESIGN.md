# Etapa 5 — Mantenimiento manual de upstream: decisiones, mecanismo y lo que se midió

Sirve a `REQUIREMENTS.md` §2 («incorporar cambios del padre mediante mantenimiento iniciado
manualmente», «conservar las funciones originales del arnés»), §7, §9, §10 y §11, y al encargo
literal de `PLAN.md` §8, viñeta «Mantenimiento (§9)».

Documento interno, en español. El artefacto de producto es
[`MAINTENANCE.md`](./MAINTENANCE.md), en inglés (D7).

---

## 1. Qué entrega la etapa

| Archivo | Qué es |
|---|---|
| `scripts/upstream-maintain.js` | El punto de entrada. Diez fases, reanudable, autorización por ejecución |
| `scripts/lib/upstream-survey.js` | Consulta de upstream y clasificación. No escribe nada, no decide nada |
| `scripts/lib/upstream-gate.js` | **La puerta**: qué acepta este fork como prueba de compatibilidad funcional |
| `scripts/lib/upstream-state.js` | El diario en disco, que es todo lo que significa «reanudable» |
| `tests/governance-upstream-maintenance.test.js` | 22 tests, **22/22, 0 cancelados, 9,0 s** |

Nada de esto toca `skills/`. La invariante del fork sigue en pie y el propio flujo la mide: la fase
`govern` compara `git diff --numstat upstream/main -- skills/` antes y después de aplicar la
transformación, y falla si cambió.

---

## 2. La decisión central: el merge no es la prueba

> **Nota de nomenclatura.** La Etapa 6 ha creado `scripts/gate.js` (`npm run gate`), que es la puerta
> determinista **permanente** del repositorio: responde «¿está sano este árbol?». La de aquí es la
> **puerta de mantenimiento**: responde «¿es seguro promover *esta* integración?», es específica de
> un cambio de upstream y se evalúa por ejecución. Son cosas distintas con la misma palabra; ver la
> propuesta 7 de §11 para el punto donde deberían encontrarse.

`PLAN.md` §8 lo exige en una frase: «Un merge sin conflictos textuales no se acepta como prueba de
compatibilidad funcional». Una regla escrita en un documento es una regla que nadie ejecuta, así que
está implementada como una **negativa**:

- el resultado del merge se guarda como **evidencia** con `counts: false` y una nota que lo dice;
- el veredicto se calcula **sólo** a partir de las doce comprobaciones G1–G12;
- `gateVerdict` comprueba **cobertura antes que resultado**: cualquier comprobación obligatoria que
  no aparezca en los resultados cuenta como fallo, por su id.

Esa última parte es una corrección a mi propio código que **encontró mi propio test**. La primera
versión de `gateVerdict` devolvía `pass` cuando la lista de resultados estaba vacía, porque «ninguna
comprobación obligatoria falló» es verdad de una puerta que no corrió. Es exactamente la vacuidad
que la Etapa 4 ya había tenido que corregir en otro instrumento: «un validador que no puede fallar
informa lo mismo que uno que pasa». Medido después del arreglo:

```
gateVerdict([],      merge limpio) → blocked, notRun: G1..G12   (12 de 12 sin medir)
gateVerdict(5 de 12, merge limpio) → blocked, notRun: G6,G7,G8,G9,G10,G12,G11
gateVerdict(12 de 12 en verde)     → pass,    merge.counts: false
```

### Qué sí se acepta como prueba

| # | Comprobación | Instrumentada | Qué mide |
|---|---|---|---|
| G1 | `skills/` sigue siendo espejo byte-idéntico | sí | `git diff --numstat <upstream> -- skills/` = 0 líneas |
| G2 | El catálogo integrado es exactamente el de upstream | sí | Conjunto de ids idéntico; nada perdido, nada inventado |
| G3 | Conformidad del contrato en alta y modificación | sí | `applyInstall` real en un proyecto desechable; bloque, 3 claves, digest, un solo marcador |
| G4 | Idempotencia en el mismo alcance | sí | Segunda instalación byte-idéntica |
| G5 | Subárboles vendorizados intactos | sí | Diff contra upstream **y** contra la copia entregada |
| G6 | Avisos de terceros nuevos o cambiados, reconocidos | sí | Delta de `LICENSE` / `THIRD_PARTY.md` / `UPSTREAM.json` |
| G7 | Cada divergencia del fork sobrevivió **en intención** | sí | Sondas de fragmento citado, de presencia y de ausencia |
| G8 | El subconjunto de tests impactado corre sin fallos **nuevos** | sí | Instrumento medido; fallos preexistentes declarados con procedencia |
| G9 | Las personalizaciones sobreviven; baja huérfana, renombrado no re-alojado | sí | Criterio 12 desde el lado del mantenimiento |
| G10 | La consecuencia de una baja queda registrada | sí | `RETIRED_SKILLS`, ver §6 |
| G12 | El merge no restauró la identidad del padre | sí | `package.json`: nombre, `bin`, referencia de registro |
| G11 | Evaluaciones semánticas de lo nuevo y lo modificado | **NO** | Corre sobre los agentes de la sesión (D5/D9) |

**G11 es la parte honesta.** `REQUIREMENTS.md` §11 y D5/D9 ponen las evaluaciones semánticas sobre
los agentes de la sesión anfitriona, así que ningún script puede ejecutarlas. Está marcada
`required: true, instrumented: false`: no puede aprobarse sola y no puede olvidarse, porque la
promoción se bloquea hasta que se registra un resultado contra ella. **Decidible ≠ instrumentado**,
y aquí la distinción está en el tipo de dato, no en un comentario.

### Por qué G12 existe

Es la única comprobación que añadí fuera de la lista evidente, y el motivo es específico del
mantenimiento: upstream es dueño de `package.json`, el fork lo ha modificado, y un merge a tres
bandas de un bump de versión puede devolver en silencio el nombre del paquete padre, su `bin` o su
referencia de registro. `REQUIREMENTS.md` §10 trata exactamente de eso — «evitar reinstalar
accidentalmente el padre» — y un `"name": "@ericrisco/rsc"` reinstaurado mandaría la
auto-actualización de cada consumidor al padre. G12 comprueba **sólo** lo que este merge pudo
deshacer; la auditoría completa de identidad es de la Etapa 6.

---

## 3. La máquina: fases, autorización y reanudación

```
survey → classify → prepare → integrate → govern → validate → evaluate → remediate → evidence → publish
└── survey ──┘   └────── integrate ──────┘   └───────── validate ─────────┘        └── publish ──┘
                              (ámbito de autorización mínimo por fase)
```

**La autorización es un techo, comprobado por fase.** §9.10 pide publicar «únicamente según la
autorización de esa ejecución», así que el ámbito concedido al empezar se guarda en el diario y cada
fase declara el mínimo que necesita. Una fase por encima del techo queda `skipped` **con su motivo
escrito**, no omitida en silencio: el informe dice qué no se hizo. Ensanchar el ámbito en un
`--resume` reabre las fases cerradas y estrecharlo las vuelve a cerrar; cada concesión queda en
`authorizationHistory` con su momento.

**El estado vive en `docs/fork/stage5/runs/<runId>/state.json`**, con `report.md` y `evidence/` al
lado. Tres razones:

1. `.gitignore` lo permite (`docs/*` y luego `!docs/fork/`, verificado con `git check-ignore`), así
   que el diario de lo que se incorporó es **commiteable junto al merge que describe**. Un
   directorio de ejecución bajo una ruta temporal convertiría la evidencia de §9.9 en desechable.
2 .El puntero `latest` permite `--resume` sin id, pero **no es la fuente de verdad**: si se pierde,
   el directorio se escanea.
3. La escritura es **atómica** (`state.json.tmp` + `rename`), y el estado se graba **antes** de
   empezar cada fase, así que una caída deja `running` en disco y es visible.

**Una fase interrumpida se vuelve a ejecutar, nunca se da por terminada.** `resumeRun` devuelve a
`pending` todo lo que esté `running`, `failed` o `blocked`. Es seguro porque cada fase es
idempotente: `prepare` reutiliza su propia rama, `integrate` detecta que ya fusionó, `govern`
instala sobre un proyecto desechable nuevo. La alternativa —tratar `running` como «probablemente
acabó»— convierte una caída en un hueco silencioso en la cadena de evidencia.

Un diario corrupto es un **error**, nunca «no hay ejecución»: reanudar desde un diario truncado
repetiría trabajo que la evidencia dice que ya se hizo, u omitiría trabajo que dice que no. Medido:
un `state.json` truncado devuelve `error: ... An unreadable journal is not an absent one` y **ningún
estado inventado**.

### Qué hace `govern`, y qué no

Bajo Estrategia B la transformación corre en la **instalación** (`ensureBase` → `governBase`), así
que **no hay nada que escribir en `skills/`** para una skill nueva o modificada: §9.6 se cumple por
construcción. Lo que hace esta fase es **verificarlo**, con una instalación real y sólo de las
skills que el cambio tocó, y además medir que `skills/` no se escribió. Si alguna vez se escribiera,
la fase falla con «the fork invariant is broken».

### Los límites de la corrección automática

§9.8 pide corregir «dentro de límites acordados». Los límites son **dos**, nombrados y no
implícitos, y los dos regeneran archivos que el repositorio ya trata como generados:

- `manifest.json` → `node scripts/build-manifest.js`
- `schema/governance/*` → `node scripts/governance-sync.js`

Todo lo demás se convierte en una **acción manual con nombre**, derivada de la puerta y no
adivinada. En particular, **una entrada en `RETIRED_SKILLS` no se escribe aquí** (ver §6).

---

## 4. Las cuatro clases de cambio, y por qué «renombrado» no es una clase

Las clases se derivan de **los dos catálogos**, no de las letras del diff. Una skill existe en una
revisión cuando existe `skills/<id>/SKILL.md` allí:

- **alta** — ausente en la base, presente en la cabeza
- **baja** — presente en la base, ausente en la cabeza
- **modificación** — presente en ambas, y algo bajo `skills/<id>/` difiere
- **renombrado** — **no es una clase**, porque no puede serlo

`origin: risco` es el valor en **las 274** (medido: `grep -l '^origin: risco' skills/*/SKILL.md | wc
-l` → `274`, sobre `ls -d skills/*/ | wc -l` → `274`). El catálogo **no lleva identificador
estable**, así que un renombrado es indistinguible de una baja más un alta. La detección de
similitud de git se reporta como **evidencia sobre un par**, con su puntuación, y el par **se queda**
en `added` y en `removed` hasta que alguien decida. No hay ninguna rama de código que resuelva un
renombrado: `PLAN.md` §11 criterio 12 hace del re-alojamiento silencioso un fallo «aunque el
resultado sea correcto».

Medido sobre un repositorio fixture que entrega las cuatro clases en una sola release:

```
added:    [delta, gamma-renamed]     ← el alta nueva Y el destino del renombrado
removed:  [beta, gamma]              ← la baja Y el origen del renombrado
modified: [alpha]
renameCandidates: [ gamma → gamma-renamed, similarity 100%,
                    disposition: "migration requiring a decision, never an automatic rehome",
                    caveat: "the catalog has no stable skill identifier …" ]
```

Y el flujo **abre una decisión por id** (`rename:gamma->gamma-renamed`) cuyo texto nombra la ruta de
personalización que quedaría abandonada, para que un `--resume` la vea contestada o siga viéndola
abierta.

---

## 5. La superficie de divergencia: medida, no listada

`ARCHITECTURE.md` §4 dice «**3 archivos y 4 puntos**» y encarga a esta máquina «avisar de los tres».
**Medido cuando se escribió esto, eran ocho archivos**; hoy son **62** (§«La tabla, ampliada de 8 a
62»). Cuatro números distintos, los cuatro ciertos en su momento: por eso la medición es la única forma
de que la lista no envejezca, y por eso ni este documento ni el test citan una lista de archivos.

```
git diff --name-only --diff-filter=M origin/main HEAD -- . ':(exclude)docs/'
  .github/workflows/release.yml   .gitignore   package.json   scripts/doctor.js
  scripts/install-apply.js   targets/claude.js   targets/knowledge-sync.mjs   tests/apply.test.js
```

La tabla de `ARCHITECTURE.md` §4 menciona aparte `scripts/install-apply.js` («diverge por
necesidad») y `package.json` («tres scripts aditivos»), así que su cuenta de tres es defendible para
lo que esa sección estaba contando. Lo que **no** aparece en ninguna parte de esa sección son
`targets/knowledge-sync.mjs` (la corrección B-R1, 31 líneas añadidas), `.github/workflows/release.yml`
(R6) y `.gitignore` (B1) — y la sección termina con «La máquina de mantenimiento de §9 debe avisar
de los tres, no de uno», que es la lista que yo iba a usar. Por eso el flujo deriva la lista de git
en cada ejecución y **nunca** la lee de un documento.

### Las sondas de intención

La mitad que ninguna medición puede dar es **para qué** está una línea ahí. Un merge que triunfa
textualmente mientras revierte la intención es justo el fallo del que avisa `PLAN.md` §8. Así que
`DIVERGENCE_PROBES` es la **única** lista escrita a mano del módulo: por archivo, un fragmento
citado y el motivo. Dos tipos:

- `present` — el fragmento debe sobrevivir (`const relSource = sourceMd ? relative(...)` en
  `targets/claude.js`; `governBase(id, dest);` en `install-apply.js`; …)
- `absent` — lo que se **quitó** debe seguir quitado (`branches: [main]` y `erisco@icloud.com` en
  `release.yml`). Un disparador que debe seguir borrado no se puede comprobar por presencia.

**No se citan números de línea en ninguna sonda.** Y G7 falla también cuando un archivo de la
superficie medida **no tiene sonda**, así que una divergencia nueva se reporta en vez de quedarse sin
vigilar. Medido: `G7` con `surface.modified = ['scripts/install-apply.js', 'LICENSE']` →
`ok: false`, `unprobed: ['LICENSE']`.

### La tabla, ampliada de 8 a 62: el hueco que G7 denunciaba con razón

El **límite consciente** que esta sección declaraba —el test afirmaba la exhaustividad sobre los ocho
archivos de entonces y no sobre la superficie viva— **está cerrado**, y conviene dejar escrito cómo
estaba de abierto. Las Etapas 2, 5 y 6 y la decisión D16 llevaron la superficie de 8 a **53 archivos
modificados**; la tabla seguía con 8 entradas, así que **43 divergencias no tenían sonda** y G7
fallaba. Fallaba **bien**: una divergencia sin vigilar es exactamente lo que G7 existe para
denunciar. El agente de la Etapa 5 se negó a ampliar la tabla a ciegas —«ampliarla habría sido
inventar intenciones»— y tenía razón: decidir qué es cada divergencia exige leer los diffs.

**Y la superficie creció nueve archivos mientras se escribía la tabla.** La Etapa 7 commiteó
`README.md` primero y después `SECURITY.md` y los siete de `site/`: 53 → 54 → **62**. No es una
anécdota, es la demostración del diseño — G7 los denunció uno por uno, por su nombre, en la ejecución
siguiente. Los números de esta sección son los de la medición final; el único dato que no envejece es
el comando.

Leídos uno a uno (`git diff 481b1ec9 -- <archivo>`), las divergencias caen en **tres clases**:

| Clase | Cuántos | Qué dice la sonda |
|---|---|---|
| **Intención propia** | **23** | Un fragmento por punto, con su motivo. Las 8 de antes, más `ci.yml` (mínimo privilegio, `fetch-depth: 0`, `npm run gate`, y el `! grep` que convertía el exit 2 en PASS), `scripts/rsc.js` (`conformance`, `brownfield`, la rama *dry* de D13), `scripts/lib/backups.js` (`snapshotSkillBases`, M3), `scripts/lib/onboarding-apply.js` (D13 en el rollback), `targets/auto-update.mjs` (la URL del registro y el `argv` de `npx`), las dos aserciones negativas de `tests/hooks-path.test.js` y `tests/worktree-reaper.test.js`, y las siete superficies publicadas (`README.md`, `SECURITY.md`, `site/{index,es/index}.html`, `site/llms.txt`, `site/{robots.txt,sitemap.xml,assets/rsc.js}`) |
| **Renombrado de identidad (D16) y nada más** | **39** | Una sola frase repetida, escrita **una vez** en el *helper* `identity()`. La regla es la de `stage6/DESIGN.md` §1: se renombra lo que el fork **es** y lo que un lector puede **ejecutar** |
| **Sin sonda, por argumento** | 26 añadidos | Ninguna: ver abajo |

**Total: 62 entradas, 144 sondas** (85 `present`, 59 `absent`).

**La sonda de identidad es de dos caras, y las dos muerden.** `present` sobre el token renombrado del
archivo —corto a propósito: el token más el contexto justo para ser único, porque una línea larga se
rompe cuando upstream **reformatea** un comentario, que no es una reversión— y `absent` sobre
`@ericrisco/rsc`, **medido a 0 ocurrencias en cada archivo que la lleva** (39 de 62). La cara `absent` existe
porque `present` sola no ve el accidente que la Etapa 6 midió: un merge que **añade** una línea
nombrando al padre junto a la renombrada, y entonces *«habría pasado la suite completa y habría
enviado a cada consumidor a instalar el padre encima del fork»*. `targets/auto-update.mjs` lleva
además una sonda `absent` sobre `@ericrisco%2frsc`, porque la URL del registro va
**percent-encoded** y la sonda genérica no la ve.

**Dónde la sonda `absent` del padre NO se pone, decidido archivo por archivo y no por barrido.** Hay
una clase de divergencia en la que **nombrar al padre es el requisito y no el defecto**, y ponerle un
barrido la habría roto:

- **Las seis superficies documentales** — `README.md`, `SECURITY.md`, `site/llms.txt` y las dos
  `index.html`. §10 pide «evitar reinstalar accidentalmente el padre» en la **documentación**, y la
  forma de cumplirlo es precisamente nombrarlo: la revelación de que esto es un fork, el aviso de
  **no afiliación**, el **aviso de copyright MIT** del autor original, y —en el README— una tabla que
  imprime `@ericrisco/rsc` **al lado** de `@lema017/rsc-governed` justo para que no se confundan. En
  `SECURITY.md` va más lejos y es más importante: una vulnerabilidad en código **heredado** se
  reporta al formulario de avisos del padre, porque es el único que puede arreglarla para todos los
  de abajo. Sondas `present` (el especificador del fork, la frase de revelación, los comandos
  ejecutables); `absent` ninguna.
- `tests/worktree-reaper.test.js` **nombra al padre a propósito**, dentro de
  `/^npx @(ericrisco\/rsc|lema017\/rsc-governed) worktrees reap /m`. Es el mismo defecto que
  `tests/hooks-path.test.js`: un `doesNotMatch` que sólo nombra al padre pasa **gratis** en cuanto el
  fork se renombra. No lleva sonda `absent` del especificador del padre, y está dicho en su `why`.

**Y el reverso: tres superficies de `site/` donde el padre no es atribución sino un destino**, y ahí
la sonda `absent` es la más afilada de la tabla — sobre el *host* (`ericrisco.github.io`) o sobre la
ruta de la API (`repos/ericrisco/rsc-harness`), no sobre el especificador:

| Archivo | Qué pasa si upstream gana el merge |
|---|---|
| `site/robots.txt` | El `robots.txt` del fork manda a cada *crawler* al **sitemap del padre** |
| `site/sitemap.xml` | El sitemap del fork declara las páginas **del padre** como su conjunto canónico |
| `site/assets/rsc.js` | La página del fork anuncia las **estrellas del padre** como si fueran suyas |

Y la distinción fina que esto obliga a hacer en las dos `index.html`: el **host** de Pages del padre
nunca es atribución (sonda `absent`), pero su **enlace al repositorio** sí lo es — tres veces por
página, más dos al perfil del autor en el JSON-LD, que es lo que exige MIT. Mismo archivo, dos
veredictos opuestos sobre el mismo token: eso es lo que un `sed` o un barrido no pueden decidir.

**`site/` no viaja en el tarball** (`files` es `scripts targets schema skills manifest.json`), así que
una reversión aquí llega a **quien visita el sitio**, no al `node_modules` de un consumidor: ningún
test de instalación puede verla. Y `site/diagram.svg` lleva el `npx` **renderizado dentro de una
imagen**, donde no lo lee ningún test ni ningún linter. Son exactamente las divergencias que sólo una
sonda puede vigilar.

### Por qué la superficie vigilada son los **modificados** y no los 26 añadidos

No es una omisión: es que la sonda no puede fallar ahí. Un merge de upstream **no puede revertir** un
archivo que el fork añadió, porque upstream no tiene una versión suya con la que ganar. Lo único que
puede hacer es **crear la misma ruta**, y ese caso ya está instrumentado en otro sitio: `collisions()`
lo devuelve como `onForkAdded` con `severity: medium`. Y lo que esos archivos **significan** lo
sostienen sus propios tests, que G8 ejecuta. Una entrada de la tabla para ellos comprobaría, en cada
ejecución y para siempre, que un archivo que escribió el fork sigue diciendo lo que escribió el fork:
**una comprobación que no puede fallar**, que es el defecto A3 de esta misma etapa. El argumento está
**afirmado en el test**, no sólo escrito aquí: `live.added` no lleva sondas, y una colisión de
upstream sobre uno de ellos sí se reporta.

### La mutación: la prueba de que las sondas muerden

Cuatro instrumentos de este proyecto han tenido una comprobación que no podía fallar, así que el
verde no se cree: se rompe. Dos divergencias **reales** del árbol, roturas distintas a propósito, y
restauradas después byte a byte (`git diff --numstat` vacío en las dos):

```
# targets/claude.js  — se revierte el fragmento `present` (el ejemplo de ARCHITECTURE §4)
# scripts/lib/upgrade.js — se añade `npx @ericrisco/rsc@latest`, la cara `absent`
FAIL G7  every fork divergence survived the merge in intent, not only in text
     scripts/lib/upgrade.js: reverted-to-upstream fragment reappeared · targets/claude.js: intent fragment missing
     unprobed=0  probe failures=2
```

G7 **nombra los dos archivos** y distingue las dos clases de fallo: «el fragmento de intención
falta» no es lo mismo que «el fragmento revertido reapareció». Restaurados, vuelve a `PASS`.

> **Límite que queda.** El test mide la superficie contra el **árbol de trabajo**, igual que G7. Si
> otra ronda modifica un archivo de upstream mientras esta suite corre, el test se pone rojo pidiendo
> una sonda para él. Eso **es** el comportamiento correcto —pasó durante esta misma sesión con
> `README.md`, y así se descubrió— pero significa que la tabla y el árbol se mantienen al día
> juntos, no por separado.

### La colisión, medida sobre datos reales

Una colisión no es un conflicto: git puede fusionarla limpiamente, y **ahí es donde es más
peligrosa**, porque nada le pide a nadie que mire. Sobre el delta real de upstream 3.7.5:

```
COLLISION (high): upstream changed package.json, which this fork has modified
nota: "A clean merge here proves nothing: re-check the intent probe for each file before accepting"
```

Y sobre el fixture, con la edición del fork y la de upstream a veinte líneas de distancia:
`severity: high`, **cero conflictos textuales**, merge limpio.

---

## 6. El punto 1 de `stage4/PROPUESTAS.md`: `RETIRED_SKILLS`

La propuesta pedía tres cosas al detectar una baja. Lo que hace esta etapa:

**(1) Añadir el id al registro de retiradas «con su sucesor o con `null`».** **No se hace, y la
propuesta no es implementable como está escrita.** Medido:

```js
const withNull = { ...RETIRED_SKILLS, vanished: null };
// replaceRetired mapea TODA lista declarada de skills a través de esta tabla:
['flutter','vanished'].map(retiredTo)  →  ['flutter', null]
```

Un sucesor `null` no significa «sin sucesor»: significa que un `null` aterriza en la lista de ids de
skills, que es lo que luego recorren `.rsc.json`, el estado por destino y el recibo de onboarding.
Hoy **todos** los valores del mapa son cadenas, y esa es la invariante de la que depende
`replaceRetired`. Expresar «desapareció» exige cambiar también `replaceRetired` y su **copia en
línea** en `targets/clone-bootstrap.mjs`, que `tests/retired-skills.test.js` mantiene equivalente.
Ninguno de los dos archivos es mío. Así que el mantenimiento **propone la entrada y nombra los dos
sitios**; no la escribe. Queda como propuesta en §11.

**(2) Avisar de que la entrada es una divergencia nueva.** Sí, y lo dice G10 en el mismo mensaje.

**(3) Reportar la personalización huérfana por su nombre.** Ya funcionaba (criterio 12, clase baja);
G9 comprueba que sigue funcionando y no lo toca.

Y lo que la propuesta pedía **afirmar para que no se lea como garantía**, afirmado:

```
isRetired('flutter') === false     → la base compartida NO se poda
G10 con removed:['flutter'] → ok:false, «keeps a GOVERNED base … Add the entry by hand»
G10 con removed:['eli5']    → ok:true  (ya está en el mapa)
G10 con --ack G10=<commit>  → ok:true  (sólo con reconocimiento registrado)
```

---

## 7. El hallazgo que un merge limpio y una suite verde no ven

Es el resultado más útil de la etapa, y salió de ejecutar el flujo contra **upstream de verdad**, no
contra un fixture. Upstream publicó **3.7.5** mientras esta etapa se escribía:

```
2 commits nuevos: 481b1ec9 → cb9e051d
clase: 1 modificación (connect-tool)   ·   0 altas, 0 bajas, 0 renombrados
merge: 0 conflictos textuales
subconjunto de tests impactado: 17 archivos → 165 pass, 1 fail (1 declarado, 0 nuevos), 0 cancelados
```

Todo verde. Y sin embargo el fork acaba de adquirir **tres obligaciones de atribución** que nadie le
cuenta:

```
NEW notice: skills/connect-tool/THIRD_PARTY.md
NEW notice: skills/connect-tool/bridge-kit/LICENSE          (MIT, © 2026 Executive Lab)
NEW notice: skills/connect-tool/bridge-kit/UPSTREAM.json    ("modified": false)
new vendored subtree: skills/connect-tool/bridge-kit
  repository: github.com/Executive-Lab/conectores-pymes   commit 99e17ff6   license MIT
```

`PLAN.md` §2 enumera las obligaciones **por nombre de archivo** y la tabla de terceros del README es
de la Etapa 7. Ninguna de las dos conoce esto. Por eso G6 existe y por eso **bloquea** hasta que se
registre el reconocimiento: un aviso que se distribuye sin que nadie lo haya reconocido sigue siendo
una obligación incumplida. Y nótese que el fork ahora tiene **tres** subárboles vendorizados, no los
dos que `PLAN.md` §3 congela — `vendoredSubtrees` los encuentra midiendo (`UPSTREAM.json` bajo
`skills/`), no por lista.

El veredicto completo sobre ese merge real, con el gate entero:

```
PASS G1  0 lines of difference
PASS G2  274 skills, identical id set
PASS G3  1 skill(s) conformant in a real install
PASS G4  1 skill(s) byte-identical across two installs
PASS G5  3 vendored subtree(s) identical
FAIL G6  3 notice change(s) NOT acknowledged — new vendored subtree: skills/connect-tool/bridge-kit
PASS G7  8 divergence(s) intact
PASS G8  17 file(s): 165 passed, 1 failed (1 declared, 0 unexpected), 0 cancelled
PASS G9  0 deletion(s) and 0 rename candidate(s)
PASS G10 no skill was removed by this change
FAIL G12 `name` is the parent package `@ericrisco/rsc` · `bin` exposes the parent command `rsc`
FAIL G11 1 skill(s) need a semantic evaluation (connect-tool) — not instrumented
```

G12 falla porque el worktree se construyó desde `HEAD`, donde el renombrado de identidad (D3)
**todavía no está commiteado**: es trabajo en curso de la Etapa 6. Sobre el árbol de trabajo vivo la
misma comprobación da `identity is @lema017/rsc-governed, bin rscg, rscg-install`. La puerta
distingue los dos árboles, que es la prueba de que no es vacua.

---

## 8. Red: accesos verificados sin revelar secretos

**Verificado por ejecución.** El repositorio padre es público y el acceso anónimo funciona:

```
git -c credential.helper= -c credential.interactive=false -c core.askPass= \
    ls-remote --heads https://github.com/ericrisco/rsc-harness.git refs/heads/main
→ cb9e051d2fd4bafb3919dd0b9fb4a3ae5f0b5955     EXIT 0
```

**Hallazgo de aislamiento que importa:** redirigir `HOME` **no** quita el helper de credenciales.
Medido:

```
git config --show-origin --get-all credential.helper
→ file:/usr/local/etc/gitconfig    osxkeychain
```

Vive en el gitconfig **del sistema**, así que `env.sh` no lo alcanza. Por eso cada invocación de git
del módulo lleva `-c credential.helper=` en la línea de comandos, `GIT_TERMINAL_PROMPT=0`, y
`GIT_ASKPASS`/`SSH_ASKPASS`/`GIT_CREDENTIAL_HELPER` **eliminados** del entorno en vez de apuntados a
otro sitio. No es que no hicieran falta: es que no se ofrecen. Y `redactUrl` tapa cualquier
`usuario:token@` antes de que llegue a un informe o a un `stderr`.

Esto se afirma **sobre la orden y el entorno calculados**, con un test, no por el éxito de un fetch:
un fetch anónimo que funciona no demuestra que no se ofreciera una credencial.

### Lo que `--check` hace con la red, y el defecto que esto corrigió

La primera versión no hacía fetch en `--check`, por parecer «de sólo lectura». **Era un error**, y
lo cazó un test del fixture: sin los objetos no se puede clasificar nada, así que un `--check` que
sólo leyera la referencia local informaría «no hay cambios» cada vez que nadie hubiera hecho fetch
últimamente — una respuesta equivocada con forma de respuesta correcta. (La primera corrida real de
`--check` acertó **por casualidad**, porque la referencia estaba fresca.) Ahora `--check` hace
fetch: eso actualiza `refs/remotes/<remote>/<ref>` y nada más — ninguna rama se mueve, ningún archivo
del árbol de trabajo cambia. `--no-fetch` es la salida estrictamente de sólo lectura, y entonces la
ejecución **dice** que el dato puede estar rancio y registra la clasificación contra la cabeza real
como **no verificada**.

### Lo que la red no demuestra, y el fixture sí

Toda la prueba del flujo corre contra un **par de repositorios fixture** construido en `os.tmpdir()`
(que honra `TMPDIR`, luego cae dentro de la carpeta dedicada), cuyo remoto `upstream` es una **ruta
local**. Eso ejercita `ls-remote` y `fetch` de verdad, con **cero red**, que además de ser la única
forma determinista de probar esto es lo que permite que la suite corra donde no haya red.

---

## 9. Lo que se midió, con su comando

| Afirmación | Comando | Resultado |
|---|---|---|
| Acceso anónimo a upstream | `git -c credential.helper= ls-remote --heads <url> refs/heads/main` | `cb9e051d…`, EXIT 0 |
| El helper vive en el gitconfig del sistema | `git config --show-origin --get-all credential.helper` | `file:/usr/local/etc/gitconfig osxkeychain` |
| Upstream se movió | `git rev-list --count 481b1ec9..cb9e051d` | `2` |
| 274 sin identificador estable | `grep -l '^origin: risco' skills/*/SKILL.md \| wc -l` | `274` de `274` |
| Superficie de divergencia | `git diff --name-only --diff-filter=M origin/main HEAD -- . ':(exclude)docs/'` | **8 archivos** |
| La colisión de 3.7.5 | `comm -12` de la superficie con el delta de upstream | `package.json` |
| El merge real es limpio | `git merge --no-commit --no-ff upstream/main` en worktree desechable | 0 conflictos |
| La invariante sobrevive al merge | `git diff --numstat upstream/main -- skills/` en el árbol fusionado | **0 líneas** |
| Validadores deterministas sobre el árbol fusionado | `build-manifest --check` / `--validate` / `governance-sync --check` / `drift-check` | EXIT 0, `manifest OK (274 skills)` |
| Subconjunto impactado sobre el árbol fusionado | `node --test --test-concurrency=1 --test-timeout=1800000 <17 archivos>` | 165 pass, 1 fail (declarado), **0 cancelados** |
| Flujo completo hasta `govern` | `node scripts/upstream-maintain.js --authorize integrate --worktree …` | 5 fases DONE |
| El gate sobre el merge real | `--resume --authorize validate` | `blocked`, fallan G6, G11, G12 |
| El gate con reconocimientos | `--resume --authorize validate --ack G6=… --ack G11=…` | `pass: 11/11` (antes de G12) |
| `null` en `RETIRED_SKILLS` | `node -e` sobre `replaceRetired` | `['flutter', null]` |
| La suite de la etapa | `node --test --test-concurrency=1 tests/governance-upstream-maintenance.test.js` | **22/22, 0 cancelados, 9,0 s** |
| **La superficie viva, tras las Etapas 2/5/6/7 y D16** | `git diff --name-status 481b1ec9 -- . ':!docs/fork'` | **62 modificados · 26 añadidos** |
| **La tabla cubre la superficie viva** | `DIVERGENCE_PROBES` vs. `divergenceSurface({ cwd, base })` | 62 entradas, **144 sondas** (85 `present`, 59 `absent`), `unprobed=0` |
| **G7 sobre la superficie viva** | `G7.run({ cwd, surface: divergenceSurface({ cwd, base: lastIncorporated(…).base }) })` | `PASS · 62 divergence(s) intact · unprobed=0 · failures=0` |
| **La mutación: G7 muerde y nombra** | Revertir el `present` de `targets/claude.js` y reañadir `@ericrisco/rsc` en `scripts/lib/upgrade.js` | `FAIL`, **nombra los dos**, `failures=2`; restaurados byte a byte |
| La suite de la etapa, ampliada | `node --test tests/governance-upstream-maintenance.test.js` | **51/51, 0 fallos** |

Todo con `. ./.fork-tmp/env.sh` cargado. **Ninguna duración medida aquí es autoritativa** (L7).

---

## 10. Lo que NO se verificó, y por qué

| # | Elemento | Motivo |
|---|---|---|
| NV-E5-1 | **El fetch real desde el flujo del producto contra `github.com`.** Se verificó el **acceso** por ejecución (`ls-remote` anónimo, EXIT 0) y el `fetch` contra el **fixture local**, que ejercita el mismo código. El `fetchRemote` del flujo contra la red real no se ejecutó | Habría movido `refs/remotes/upstream/main` del repositorio del coordinador durante una ronda con otra etapa trabajando en paralelo. La referencia local ya estaba en `cb9e051d` cuando llegué |
| NV-E5-2 | **La suite completa** (143 archivos) | L7 y el encargo: la corrida autoritativa ya existe (1 588 tests, 6 fallos, 0 cancelados, 1 h 33 m). Se ejecutó el subconjunto impactado |
| NV-E5-3 | `tests/eval-lint.test.js` | Escribe en `/tmp` literal (L2, §1). **Nunca se ejecuta** y está declarado en `NEVER_RUN` con su motivo, para que «no verificado» no se lea como «aprobado» |
| NV-E5-4 | **La fase `publish` con `--promote`** | Habría fusionado una rama en `main` del fork. Se verificó la **puerta**: con veredicto distinto de `pass` la fase devuelve `blocked` y deja intacta la versión estable; sin `--promote` registra `authorized-not-performed` e imprime el comando |
| NV-E5-5 | La release de npm | No es de esta etapa. `release.yml` es `workflow_dispatch` (R6) y la distribución es de la Etapa 6. El flujo lo registra como la acción manual restante |
| NV-E5-6 | ~~G7 sobre la superficie **viva** tras el commit de la Etapa 6~~ **CERRADO.** La tabla pasó de 8 a **62 entradas / 144 sondas** leyendo los diffs uno a uno, y G7 pasa sobre la superficie medida en ejecución: `PASS · 62 divergence(s) intact · unprobed=0`. El test ya no cita una lista: la **mide** contra el árbol de trabajo, igual que G7. Y el verde está mutado: ver §5, «La mutación» | Lo que **sigue** sin verificar es el fetch real (NV-E5-1), que no cambia |

---

## 11. Lo que necesito de la Etapa 6, y lo que propongo fuera de mi etapa

### El fragmento exacto para `package.json` (lo aplica la Etapa 6)

Dentro de `"scripts"`, dos entradas aditivas:

```json
    "upstream:check": "node scripts/upstream-maintain.js --check",
    "upstream:maintain": "node scripts/upstream-maintain.js"
```

**Y nada en `"bin"`, a propósito.** El mantenimiento de §9 corre **en el repositorio del fork**, no
en un proyecto consumidor (`PLAN.md` §4, «dos máquinas separadas»), y `REQUIREMENTS.md` §10 dice
literalmente «Los consumidores no integran upstream directamente». Exponer
`rscg upstream:maintain` en el CLI que se distribuye crearía una superficie que invita justo a lo
que §10 prohíbe. Si la Etapa 6 decidiera lo contrario, la entrada sería
`"rscg-upstream": "scripts/upstream-maintain.js"`, una línea — pero no lo recomiendo, y el motivo es
un requisito, no un gusto.

### Propuestas (nada de esto está aplicado)

1. **`scripts/lib/retired-skills.js` + `targets/clone-bootstrap.mjs`** — hacer expresable «la skill
   desapareció sin sucesor». Hoy no se puede: ver §6, con la medición. La forma mínima es que
   `replaceRetired` filtre los valores falsy (`.filter(Boolean)` tras el mapeo) **y** que la copia en
   línea de `clone-bootstrap.mjs` haga lo mismo, porque `tests/retired-skills.test.js` las mantiene
   equivalentes. Dueño: quien posea esos dos archivos.
2. **`docs/fork/stage1/ARCHITECTURE.md` §4** — la tabla «3 archivos y 4 puntos» no menciona
   `targets/knowledge-sync.mjs`, `.github/workflows/release.yml` ni `.gitignore`, y termina
   encargando a esta máquina «avisar de los tres». Son **ocho** medidos. Propongo sustituir la lista
   por la orden que la mide y dejar la tabla sólo para la **intención** de cada punto, que es la
   parte que ninguna medición da.
3. **`docs/fork/PLAN.md` §2, obligación 1** — enumera los avisos por nombre de archivo. Upstream
   3.7.5 añade tres que no están. Propongo que la obligación se redacte como una **propiedad
   medible** («todo `LICENSE`/`THIRD_PARTY.md`/`UPSTREAM.json` presente en el commit de upstream
   incorporado está presente en el árbol y en el tarball») en vez de como una lista, y que la lista
   concreta se genere.
4. **README (Etapa 7)** — acreditar `Executive-Lab/conectores-pymes` (MIT) además de los dos
   componentes que `PLAN.md` §2.5 ya manda añadir. Son **tres** los subárboles vendorizados ahora.
5. **`package.json` `files` (Etapa 6)** — `"scripts"` entra entero en el tarball, así que mis
   archivos de mantenimiento viajan al consumidor aunque ningún `bin` los alcance. Son inertes, pero
   si se quiere una superficie limpia la exclusión es `"!scripts/upstream-*.js"` y
   `"!scripts/lib/upstream-*.js"`. No lo decido yo.
6. **Ledger §7** — registrar NV-E5-1 … NV-E5-6 de §10.
7. **`scripts/gate.js` (Etapa 6) + `scripts/lib/upstream-gate.js` (mío)** — la promoción a release
   debería invocar la puerta permanente, no sólo el subconjunto impactado. El punto de inserción es
   una comprobación nueva en `GATE_CHECKS`, obligatoria **sólo** cuando la ejecución lleva
   autorización `publish`, que haga `runNode(tree, ['scripts/gate.js'])` si el archivo existe. No lo
   he cableado porque `scripts/gate.js` no es mío, nació durante esta misma ronda y su alcance real
   lo conoce su autor; cablear una puerta cuya cobertura estoy adivinando sería exactamente el error
   que esta etapa existe para evitar. Decide la Etapa 6 o el coordinador.
8. **`ALWAYS_RUN` ya no es una lista** — la red de tests de gobernanza se **deriva** de
   `tests/governance-*.test.js`. Se cambió al ver que otras etapas añadieron tres archivos
   (`governance-gate`, `governance-identity`, `governance-recovery`, `governance-doctor`) mientras
   esto se escribía: una lista habría quedado obsoleta en el mismo día. Si alguien crea un test de
   gobernanza con otro prefijo, queda fuera de la red; el prefijo es la convención, y conviene que
   siga siéndolo.

---

## 12. Correcciones exigidas por la revisión independiente de la Etapa 5

Veredicto: **APROBADA CON CORRECCIONES**. La arquitectura sobrevivió al ataque y no se tocó: las
diez fases, la autorización como techo, el diario como única fuente, G1–G12 y la negativa a aceptar
un merge limpio como prueba siguen siendo exactamente lo que eran. Lo que cambió es que **la puerta
ya no puede pasar sin haber medido**, que **nada se escribe fuera de la carpeta dedicada**, y que
**cada comprobación tiene un caso donde falla**.

El hilo común de las tres ALTA es una sola frase, y es la lección que esta etapa no se había
aplicado a sí misma — la misma que la revisión de la Etapa 4 hizo sobre el otro instrumento del
proyecto:

> **Una medición que no ocurrió no es una medición de cero.** `[]` es *truthy*, una entrada ausente
> del contexto y una entrada que midió cero valen lo mismo, y una comprobación que no puede fallar
> informa exactamente lo que informa una que pasó.

### A1 — G7 pasaba habiendo medido cero cuando la medición fallaba

`divergenceSurface` devuelve `{ ok: false, …, modified: [] }` ante un fallo de git, y ni
`phaseClassify` ni G7 leían `.ok`. El `||` no salvaba nada porque `[]` es *truthy*:
`ctx.surface?.modified || Object.keys(DIVERGENCE_PROBES)` **nunca** caía al fallback. Medido por el
revisor, y reproducido antes de arreglarlo:

```
divergenceSurface({ base: 'deadbeef…' }) → { "ok": false, "error": "fatal: Invalid revision range…", "modified": [] }
G7 con esa superficie                     → PASS  "0 divergence(s) intact"   measured.files = []
report.md                                 → "collisions: none — upstream did not touch the fork's divergence surface"
```

Una tranquilidad **calculada a partir de un fallo**, impresa en un archivo que se commitea. G7
distingue ahora los **tres** estados que el `||` no podía expresar — `absent` (nadie midió, fallo de
cableado), `unmeasured` (git no pudo, **fallo**) y `measured` con cero archivos (el único que puede
pasar) — y `phaseClassify` falla antes de entregar nada aguas abajo. El fallback a las claves de
`DIVERGENCE_PROBES` desapareció también por una segunda razón: con `files` tomado de esa tabla,
`unprobed = files.filter((f) => !DIVERGENCE_PROBES[f])` era **necesariamente `[]`**, así que la mitad
«divergencia sin vigilar» no podía dispararse por ese camino. Una rama que no puede fallar no es un
fallback.

### A2 — el motor de la puerta escribía en `/tmp` literal (REQUIREMENTS §1)

`scopedConformance` usaba `mkdtempSync(join(tmpdir(), …))`, y `tmpdir()` sólo respeta `TMPDIR` si
alguien la exportó: sin ella es `/tmp` literal, **fuera de la carpeta dedicada**. Corría en
`phaseGovern` y en G3/G4/G5, es decir en **toda** ejecución de la puerta. Y el propio `NEVER_RUN` de
ese archivo excluye `tests/eval-lint.test.js` con el motivo *«writes to a literal /tmp outside the
dedicated folder (limit L2, REQUIREMENTS §1)»*: la regla que este archivo impone a otro, incumplida
por este archivo.

Arreglado por la vía que no depende de que nadie recuerde nada: el raíz se **deriva del árbol
auditado** (`SCRATCH_DIR = .rsc-upstream/tmp`), nunca de una variable de entorno, y
`scripts/lib/upstream-gate.js` ya no importa `node:os` en absoluto — un test lo afirma sobre el
código, de modo que la regresión no puede volver en silencio. `.rsc-upstream/` se añadió a
`.gitignore`, lo que de paso cierra la segunda mitad de M4 (un worktree huérfano ensuciaba
`git status`).

El mitigante que el revisor ya había medido sigue en pie y ahora está afirmado por test:
`applyInstall` recibe `home` explícito y `scripts/install-apply.js` no llama a `homedir()` ni una
vez, así que `~/.claude` era inalcanzable. **No exime**: la restricción §1 no dice «que no llegue a
`~/.claude`», dice «que no escriba fuera de la carpeta dedicada».

La segunda mitad de la corrección es documental, y era la peor parte: `MAINTENANCE.md` **no
mencionaba `TMPDIR`, `HOME` ni `env.sh` en ninguna parte**, así que quien ejecutara
`npm run upstream:maintain` como el documento enseñaba escribía fuera de la carpeta creyendo lo
contrario. Ahora el documento abre con el entorno, variable por variable y con su motivo.

### A3 — nada comprobaba que una comprobación PUDIERA fallar

El test «the gate is a real instrument» era de **forma**: afirmaba que cada comprobación tiene
`run()`, un `title` largo y un `kind` válido. Medido sobre el código anterior, con un contexto de
`{ cwd, upstreamRef }` y nada más, **las doce pasaban** (G8 con su resultado sustituido para no
pagar la suite). El revisor escribió «seis pasan» y enumeró ocho ids; el número correcto es **las
doce**, porque G1, G2 y G12 también pasan — ésas por una razón distinta y legítima: miden el árbol
real, que está sano. Las otras nueve pasaban porque **una entrada ausente es indistinguible de una
entrada que midió cero**.

La corrección es un **test de cobertura negativa**: `GATE_NEGATIVES` da, por cada comprobación, un
árbol o un contexto donde su propiedad es **falsa**, y el test **deriva el conjunto de claves de
`GATE_CHECKS`**, así que una comprobación nueva sin caso negativo rompe la suite en vez de unirse
calladamente a una puerta que nadie demostró que muerde.

**Y la misma corrección aplicada donde el diagnóstico también valía.** La frase del revisor —
«una entrada ausente es indistinguible de una entrada que midió cero» — no afectaba sólo a G7. Una
comprobación sin `classification` calculaba un alcance vacío y decía «no skill was added or modified
by this change», que es cierto de un cambio que nadie clasificó y se lee igual que la misma frase
sobre un cambio que de verdad no tocó ninguna skill; y G6 sin `attribution` caía a un literal
`{ added: [], … }` y decía «no notice changed». Medido sobre el código anterior y sobre el corregido,
con un contexto de `{ cwd, upstreamRef }` y nada más:

```
antes:  PASS G1 G2 G3 G4 G5 G6 G7 G8 G9 G10 G12 G11   → 12/12
ahora:  PASS G1 G2 G5 G12 · FAIL G3 G4 G6 G7 G8 G9 G10 G11   → 4/12
```

Las cuatro que siguen pasando son las que **no reciben ninguna medición**: leen el árbol ellas
mismas, y el árbol está sano. Un test afirma exactamente ese conjunto, así que una comprobación que
consuma una medición no puede volver a pasar sin que se la hayan entregado.

### Las seis MEDIO

| | Qué pasaba | Qué se hizo |
|---|---|---|
| **M1** | `state.json` llevaba `"repo": "/Users/home/…"`, `report.md` rutas absolutas y `evidence/impacted-tests.json` el **valor** de `GIT_CEILING_DIRECTORIES`, todo hacia un directorio commiteable de un repositorio destinado a publicarse | todas las rutas **relativas** al repositorio (`repoRelative`), `repo` pasa a ser el **nombre** del directorio, `gitCeiling` es un **booleano** (la puerta sólo lo usa así), y un barrido final reescribe la ruta absoluta fuera de cualquier prosa, traza o `why` |
| **M2** | el comentario de `runGate` decía que los acks venían «from the run journal, never from a flag»; venían exactamente de ahí, nada leía `state.decisions`, el bucle `recordDecision` estaba **dentro** del `if (resumeId)` y `--ack G6="anything at all"` daba `PASS G6` | el flag **registra** una decisión (en corrida fresca también), la puerta **lee** `state.decisions`, y cada ack se valida contra una forma comprobable: G6 una ruta que exista, G10 una revisión que `revParse` resuelva, G11 `N=<n>` más los ids que dice haber evaluado. Un ack rechazado se informa **como rechazado**, no como ausente |
| **M3** | `phaseRemediate` ejecutaba dos generadores que **escriben** y no había **ningún** `git commit` en el orquestador; `phasePublish` fusionaba después una rama que **no contenía** la remediación, con la fuerza de un veredicto anterior a esa escritura | se commitean las dos rutas acotadas en la rama de integración y **`validate` se reabre** (`status = 'pending'`) cuando algo cambió: la puerta vuelve a correr sobre el árbol que la remediación produjo. Sin cambios, no hay commit vacío ni segunda pasada |
| **M4** | sin `--worktree`, `integrate` hacía `git checkout <branch>` y ningún camino restauraba la referencia; bloquear es el resultado **normal** (G6, G10 y G11 necesitan a un humano) | `prepare` registra la referencia de partida, toda salida distinta de un run terminado la restaura, y un `--resume` que necesite el árbol integrado **vuelve a entrar** en la rama. Si git se niega, el informe nombra el comando en vez de afirmar un estado que no logró |
| **M5** | la superficie era un **rango** (`base..HEAD`), así que una divergencia del árbol de trabajo era invisible — y muerde justo donde importa: una resolución de conflicto sin commitear, y `classify` que no se re-ejecuta en un resume | se mide contra el **árbol** (`git diff <base>`, sin `..`), el objeto dice `measuredAgainst`, y `validate` **vuelve a medirla** sobre el árbol integrado en vez de reutilizar la de `classify` |
| **M6** | `runTests({ files: [] })` devolvía `{ ok: true, skipped: true }` **sin** `instrumentUnsound` ni `instrument`, así que G8 pasaba con `measured.instrument` en `undefined` justo cuando la corrida no ocurrió; y `alwaysRunFiles` se tragaba un fallo de `readdirSync` | un subconjunto vacío es un **fallo de enumeración**, no una ausencia de impacto: la red de gobernanza se deriva de `tests/` y siempre está dentro. `alwaysRunFiles` devuelve `{ files, error }`, G8 falla si la enumeración falla, y un `skipped` sin motivo declarado nunca cuenta como pass |

### Las BAJO

**B1** la mitad «rename» de G9 queda **declarada** como decidible-no-instrumentada en la propia
comprobación (`rehomeDetection`), no inflada: sólo detecta que alguien edite la constante que
`classifyCatalogChanges` escribe a mano, y detectar un re-alojamiento real exigiría un identificador
estable que el catálogo no tiene. · **B2** el `detail` de G10 se construye ahora **en la rama de
fallo**; antes un PASS imprimía «not in RETIRED_SKILLS … Add the entry by hand». · **B3** cubierto
por M2. · **B4** el puntero `latest` se escribe con el mismo `write`+`rename` que `state.json`, y un
`state.json.tmp` superviviente se borra en el siguiente guardado en vez de quedar en un directorio
commiteable. · **B5** el resultado de una fase **reemplaza** el anterior, incluso cuando es nulo, y
`resumeRun` documenta que conserva `data` **a propósito**, porque es la entrada del resume. · **B6**
el `ignore` de la superficie es `docs/fork/`, no `docs/`: upstream también posee archivos bajo
`docs/`, y hoy los dos conjuntos coinciden — medido. · **B7** cerrado: `NOTICE`, `COPYING`,
`LICENCE`, `AUTHORS`, `COPYRIGHT` y `PATENTS` cuentan como notas de atribución, porque
**Apache-2.0 §4(d) obliga a propagar `NOTICE`** y el fork ya carga material Apache-2.0. El matcher
**sobre-detecta a propósito** (hoy también dos documentos de referencia de skills que no son notas):
un falso positivo cuesta un `--ack`; un falso negativo cuesta una violación de licencia que se
publica. No son comparables.

### Un defecto encontrado al escribir la cobertura negativa, que la revisión no vio

`runTests` **no era parseable desde dentro de un proceso de test**. Node elige su reporter según el
contexto que cree tener: un hijo lanzado desde un `node --test` hereda `NODE_TEST_CONTEXT` y emite
el protocolo interno serializado en vez de TAP, así que `parseTap` devolvía `null` en todos los
contadores y la puerta medía «`null` pasados de `null` pruebas». No se había visto porque la corrida
real se lanza desde la shell, y **G8 nunca se había llamado desde un test** hasta ahora. Arreglado
con `--test-reporter=tap` explícito y borrando `NODE_TEST_CONTEXT` del entorno del hijo. Es el mismo
modo de fallo que M6: un instrumento que no informa nada no debe confundirse con uno que informó
cero problemas.

### Lo que la revisión acertó y lo que no

Acertó en los diecinueve hallazgos sustantivos: todos se reprodujeron sobre el código anterior antes
de tocarlo. Dos imprecisiones, ambas de cifra y ninguna de fondo:

1. **«seis pasan» en A3, seguido de una lista de ocho ids.** Pasaban **las doce**. La conclusión del
   hallazgo es más fuerte que su número.
2. **«`git diff base..HEAD` da 8; `git diff base` da 9».** Cierto cuando se midió. Hoy el árbol está
   limpio y la superficie son **51 archivos modificados y 25 añadidos**, porque la Etapa 6 commiteó.
   La lógica del hallazgo es exacta; la aritmética era de aquel momento.

Y una consecuencia que no era un error de la revisión sino el estado del árbol: **G7 fallaba sobre la
superficie viva**, con 43 divergencias sin sonda de intención. Era correcto — una divergencia sin
vigilar es un fallo, y es precisamente lo que G7 existe para decir —, y la tabla `DIVERGENCE_PROBES`
no se amplió *en esa ronda de revisión*: decidir qué es cada una de esas 43 divergencias no era una
corrección de revisión, era leerse los 43 diffs.

> **Cerrado después, en su propia ronda.** Eso es exactamente lo que se hizo: los diffs leídos uno a
> uno, las tres clases de §5, y la tabla de **8 a 62 entradas / 144 sondas**. G7 pasa sobre la
> superficie medida en ejecución, y el verde está mutado. La negativa a ampliarla a ciegas fue la
> decisión correcta: de los 62, **23 tienen intención propia** y habrían quedado tapados bajo una
> frase genérica, y dos (`tests/worktree-reaper.test.js`, `README.md`) necesitan **no** llevar la
> sonda que un barrido les habría puesto.

### Dos observaciones sobre mi propio diseño que no corrijo, y por qué

1. **La lista de acciones manuales de `remediate` derivada de la puerta es inalcanzable.** El bucle
   del orquestador hace `if (out.status !== 'done') break`, así que si `validate` bloquea el run se
   detiene ahí y `remediate` no llega a ejecutarse nunca. Su bucle `for (const r of ctx.gateResults)
   { if (r.ok) continue; … }` sólo puede recorrer comprobaciones fallidas si el veredicto fue
   `pass`, y un `pass` no tiene ninguna. La información no se pierde — la tabla de la puerta imprime
   cada `FAIL` con su `detail`, y las decisiones abiertas salen en su propia sección —, pero esas
   pistas concretas no se emiten. Arreglarlo exige cambiar el control de flujo de las fases, que es
   arquitectura de la etapa y no una corrección de revisión. Queda registrado.
2. ~~**`G7` falla hoy sobre la superficie viva** (43 de 51 divergencias sin sonda).~~ **Resuelto en
   una ronda posterior:** 62 entradas, 144 sondas, `PASS · unprobed=0`, con la mutación que lo
   prueba. Lo que queda escrito de esta observación es la razón por la que no se resolvió aquí, y
   que sigue siendo buena: una sonda inventada da falsa tranquilidad, que es el defecto A1 de esta
   misma etapa con otro disfraz.
