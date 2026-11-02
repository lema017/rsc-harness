# Arquitectura de la gobernanza — Etapa 1

Documento interno (español). Escrito sobre la evidencia medida en [`evidence/transformer-feasibility.md`](./evidence/transformer-feasibility.md) y [`evidence/assistants-enforcement.md`](./evidence/assistants-enforcement.md), ambos con instalaciones reales y citas `archivo:línea`.

**Veredicto: la Estrategia B es viable.** El catálogo completo se transformó en una copia desechable y todos los validadores ejecutables pasan con salida idéntica a la línea base. Dos partes del diseño propuesto quedan invalidadas y se corrigen abajo (§4 y §3).

---

## 0. Dos máquinas, no una

| | **Mantenimiento del fork** | **Análisis del proyecto** |
|---|---|---|
| Cuándo corre | Cuando el mantenedor integra upstream, a mano | Cuando un proyecto instala o pide análisis |
| Sobre qué opera | El catálogo de 274 | El código del proyecto y sus personalizaciones |
| Qué produce | El catálogo transformado y un informe de integración | Personalizaciones por skill con evidencia |
| Quién decide | El mantenedor | El usuario del proyecto |

No comparten estado ni se invocan entre sí. Confundirlas fue un riesgo real del diseño inicial: un análisis de proyecto que pudiera reescribir el catálogo convertiría cada instalación en una bifurcación silenciosa.

---

## 1. La invariante

`skills/` permanece **byte-idéntico** al commit de upstream incorporado. Comprobado hoy y después del merge de 3.7.4. La gobernanza no se edita en el origen: se **aplica sobre la copia**. §2 explica por qué eso es estructural y no disciplina.

---

## 2. El punto de transformación: existe, y es uno

**`scripts/install-apply.js:66`** — el `cpSync` dentro de `ensureBase()` (`:60-69`).

Por qué es el único punto necesario, medido:

- **Ningún asistente lee `skills/`.** Todos consumen `.rsc/skills/<id>/`. `targets/index.js:9-13` lo dice literalmente: *«real skill files live here exactly once»*.
- **17 de 18** reciben un symlink a esa base; Cursor la relee (`cursor.js:5`); y la superficie always-on sale de ahí (`install-apply.js:294`).
- **Install, sync y auto-update desembocan en la misma función.** No hay tres caminos que mantener sincronizados.
- Verificado de extremo a extremo instalando de verdad para claude, cursor, codex, deepseek y windsurf.

**Por qué no un `prepack`:** operaría sobre el árbol de trabajo, que es exactamente donde vive la invariante byte-idéntica. El punto correcto es la frontera donde el catálogo deja de ser espejo y empieza a ser entrega.

Consecuencia: la invariante se preserva **por construcción**. No depende de que nadie se despiste.

### Condiciones que la transformación debe respetar

| Condición | Evidencia | Por qué |
|---|---|---|
| Delimitadores de código en columna 0 **equilibrados** | `scripts/lib/skill-lint.js:15-28` | Un bloque con un cierre impar rompe el linter |
| `origin:` dentro de los primeros **2048 B** | `scripts/doctor.js:183-190` | El `origin:` más profundo está en el **offset 878** de 2048, así que el margen son **1 170 B**, no 878 — 878 es el desplazamiento. Las tres claves del fork (~114 B) caben con holgura; un bloque **antes** del frontmatter no |
| Profundidad 2 | Los 274 `SKILL.md` están a profundidad 2 | `tests/ux-upstream.test.js:17,24-32` congela por hash `skills/ux/upstream/**`; limitar a profundidad 2 excluye los subárboles congelados **por construcción** |
| Idempotencia por marcadores | `targets/_md-block.js:11-12`, regex de `scripts/lib/onboarding.js:131` | Reimplementado y ejecutado dos veces: **274/274 byte-idénticos** tras la segunda pasada, ninguna skill con dos bloques |

*(Corrección: el regex está en `onboarding.js:131`, no en `:129` como registró el ledger. Y `agents-md-shadow.js:37` no escribe, sólo detecta.)*

---

## 3. El canal: el cuerpo, y sólo el cuerpo

**Esto invalida la mitad del diseño del contrato.** `targets/cursor.js:7` **reemplaza el frontmatter entero** por `description` + `alwaysApply` (`stripFrontmatter` en `:28-30`). Medido: el `.mdc` que recibe Cursor **no contiene** la clave añadida aunque la base sí la tenga. `_md-block.js:28,73-74` también la descarta en la superficie always-on.

> **El cuerpo es el único canal que llega a los 18 asistentes.**

Las tres claves planas de frontmatter se mantienen, pero su papel cambia: **dos de las tres** pasan a ser redundantes respecto al bloque del cuerpo (`governance` y `governance-customization`, cuya información va también en el bloque). Nada que el modelo deba saber vive sólo en el frontmatter.

**Corrección de la revisión: `governance-digest` NO es redundante**, porque no tiene copia en el cuerpo, y el frontmatter se despoja justo en las superficies que el modelo lee. Su alcance queda declarado en vez de exagerado: **protege la base distribuida `.rsc/skills/`**, que es donde corre el validador de conformidad del criterio 4. Las superficies entregadas (el `.mdc` de cursor, el `AGENTS.md` compartido) **se regeneran desde esa base en cada instalación y `sync`**, así que su integridad se deriva de la base y no se afirma por separado. No se mueve el digest al cuerpo: costaría bytes en las 274 para proteger artefactos que se reescriben solos.

| Canal | Para quién | Qué lleva |
|---|---|---|
| **Bloque marcado en el cuerpo** | El modelo | Las cinco reglas. Completas, autosuficientes |
| **Claves planas de frontmatter** | El validador y la máquina de mantenimiento | Versión, ruta de personalización, digest de integridad |

Es una separación limpia: frontmatter para máquinas, cuerpo para modelos. La alternativa sería parchear `targets/cursor.js:7`, que ya es divergencia de código y no transformación de contenido.

---

## 4. `suggest` también porta el contrato — y no hay que tocar ningún techo

**Decisión del usuario, 2026-11-01: llegar a 274.** Sin exclusiones; esas son las skills actuales. La decisión se mantiene íntegra. Lo que cambia es el precio: **cuesta cero.**

### RETRACTACIÓN: los tres techos no se rompen. Esta sección decía lo contrario y era falso

Lo encontró la revisión independiente de la etapa y lo verifiqué por mi cuenta. **Los tres techos miden el archivo fuente del repositorio, no la copia transformada:**

| Techo | Qué lee |
|---|---|
| `tests/clone-bootstrap.test.js:340` | `readFileSync(new URL('../skills/suggest/SKILL.md', import.meta.url))` |
| `tests/ftd-lane.test.js:20` | `read('skills','suggest','SKILL.md')`, con `read` resuelto contra la raíz del repo |
| `tests/always-on-body.test.js:12` | `readFileSync(join(ROOT, 'skills/suggest/SKILL.md'))` |

Y bajo la invariante de la Estrategia B (§1) ese archivo **es byte-idéntico a upstream para siempre**: 7 280 B, medido. Por tanto **los tres tests siguen verdes sin cambiar una sola cifra**, y los valores 8 061 / 8 061 / 8 192 que esta sección ordenaba eran innecesarios.

Peor que innecesarios: habrían **destruido el triñquete en vez de moverlo**. Con el techo en 8 061, un fuente de 8 059 B pasaría mientras su entrega transformada pesaría **8 844 B** — **652 B** por encima del límite exterior (con el preámbulo actual: 785 B renderizados para `suggest`). El techo habría quedado midiendo una magnitud equivocada por exactamente el tamaño del preámbulo, y se habrían pagado **tres divergencias permanentes** en archivos que upstream edita, a cambio de nada.

### Lo que sí era real: el coste por turno, y que ningún test lo vigilaba

El preámbulo **sí** llegaba al cuerpo always-on, porque ese cuerpo se renderiza desde la copia **transformada**: `scripts/install-apply.js:294` llama a `wireHook(target, paths, join(ensureBase('suggest', …), 'SKILL.md'))`, y `ensureBase` es el punto de transformación de §2. De ahí los **785 B renderizados en cada turno, en los 17 asistentes sin gancho por turno** (779 con el preámbulo de entonces; el actual mide 787 B de plantilla).

Las dos cosas juntas dan el diagnóstico completo: **el coste caía en la superficie más cara del producto y los tres techos no lo medían**, porque miran el fuente. Elevarlos no habría arreglado nada; habría dejado un cuarto validador vacuo.

### Y el bloque ahí no tiene referente

El preámbulo dice *«read this before applying the skill below»* y apunta a `02-DOCS/wiki/skills/suggest/README.md`. En el cuerpo always-on **no hay ninguna «skill below» que se esté aplicando**: es la capa ambiental de operaciones, presente siempre. `evidence/transformer-feasibility.md:520` lo había dicho antes: el bloque **ya está en la skill concreta cuando se la invoca**. (Un borrador de este párrafo citaba también a `EVALUATION.md` *«al excluir `suggest` de la muestra»* como apoyo. **Esa cita se retira:** `EVALUATION.md` §5 retiró esa exclusión por errónea, y apoyarse en un texto retractado no es apoyarse en nada. El argumento se sostiene solo: la superficie always-on no aplica ninguna skill, luego la regla no tiene referente ahí.) Se estaban pagando 785 B por turno para inyectar una regla que los propios documentos del fork declaraban sin significado en ese sitio.

### La decisión: despojar el bloque en la superficie always-on, y sólo ahí

El bloque sale de la superficie always-on y se queda en todo lo demás. **Dónde se implementa ese despojado es otra pregunta, y la primera respuesta que escribí era errónea:**

### CORRECCIÓN 2: el despojado NO puede vivir en `wireHook`. Lo encontró la re-revisión y lo verifiqué

El párrafo anterior de esta sección afirmaba que las tres implementaciones de `wireHook` *«ya hacen `stripFrontmatter(readFileSync(sourceMd,'utf8'))»*, y que bastaba añadir un `stripGovernance()` al lado. **Es falso para `claude`, que es el único destino con imposición por código y el asistente de referencia de la evaluación.** Medido:

| Hecho | Evidencia |
|---|---|
| `claude.js` **nunca lee** `sourceMd` | `grep -c sourceMd targets/claude.js` → **1**, y es la firma (`:112`). El parámetro se ignora |
| `claude.js` no renderiza ningún cuerpo | Escribe `settings.json` y guarda una **ruta**: `suggestRel` (`:137`) apunta a `.claude/skills/suggest/SKILL.md` |
| El cuerpo lo lee el **hook, en ejecución**, entero | `targets/session-start.mjs:52`: `process.stdout.write(readFileSync(suggestMd,'utf8'))`. Ni frontmatter despoja |
| Y ese archivo **es** la skill transformada | `claude.js:9-15` → `linkOrCopy` (`targets/index.js:20-32`): `.claude/skills/suggest` es un **symlink** a `.rsc/skills/suggest`. Mismo archivo, mismo inodo |

Luego en Claude Code el bloque se inyectaría **en cada SessionStart y tras cada compactación**, y no hay ningún `stripFrontmatter` junto al que poner nada.

**Y la consecuencia peor, que no es de bytes:** `EVALUATION.md` elige `claude` como asistente de referencia para las 447 ejecuciones de amplitud. Si el arranque de sesión inyecta las cinco reglas, **toda** sesión de evaluación empieza con la gobernanza ya en contexto, porte o no la skill bajo prueba el bloque. Eso no encarece la medición: **la invalida**, y en particular hace **inmedible G3** (fallback sin personalización), que es una de las dos conductas de seguridad.

### El diseño correcto: el transformador emite su propio archivo always-on

Ni lo que yo escribí ni exactamente lo que propone la re-revisión. El mecanismo **ya existe en el código**: `claude.js:139-148` materializa `.rsc/suggest-always-on.md` y reapunta `suggestRel` cuando `codeHooks === false && !laneGate`. Se generaliza:

1. El transformador emite `.rsc/governance/always-on.md` = el cuerpo de `suggest` **sin el bloque**. Determinista e idempotente, como el resto.
2. `scripts/install-apply.js:294` pasa **esa** ruta a `wireHook` en vez de `join(ensureBase('suggest', …), 'SKILL.md')`.
3. `claude.js` reapunta `suggestRel` a ese archivo **en todos los casos**, no sólo en la rama `codeHooks === false && !laneGate`.

Lo que esto consigue y lo anterior no: `_md-block.js` y `cursor.js` **no se tocan** — leen el `sourceMd` que se les da, así que cambiar el argumento basta. El coste se concentra en dos archivos y uno de ellos iba a cambiar de todos modos.

### CORRECCIÓN 3: «0 divergencias» era falso. La cifra honesta es 1 añadida

La tabla anterior ponía **0** divergencias permanentes, y tres secciones antes este mismo documento ya clasificaba parchear un adaptador como *«divergencia de código, no transformación de contenido»*. Medir con dos varas.

| | Diseño retirado (techos) | Diseño adoptado |
|---|---|---|
| Conformidad | 274/274 | **274/274** |
| Coste por turno en los 17 sin gancho | 779 B con el preámbulo de entonces (hoy **785** renderizados para `suggest`) | **0 B** |
| Coste por sesión en `claude` | 785 B en cada SessionStart y tras cada compactación | **0 B** |
| Techos que cambian | 3 | **0** |
| Divergencias permanentes con upstream | **3** (`clone-bootstrap`, `ftd-lane`, `always-on-body`, más un comentario) | **1 añadida**: `targets/claude.js`, una línea. `scripts/install-apply.js` ya diverge por necesidad: es el punto de transformación y la razón de ser del fork |

**Por qué se paga esa divergencia en vez de evitarla:** sin ella, `claude` —el único destino que puede **denegar** y el de referencia de la evaluación— pagaría el bloque en cada sesión y la medición de G3 quedaría inservible. Una línea que reasigna una variable es además el conflicto más barato de resolver cuando upstream toque el archivo. La máquina de mantenimiento de §9 debe avisar cuando upstream toque `targets/claude.js`.

La decisión del usuario se cumple en su letra: el validador determinista del criterio 4 corre sobre la base distribuida `.rsc/skills/`, donde las 274 portan el contrato y un 273 es un fallo.

### Lo que hay que medir

Los tres techos de upstream se quedan midiendo lo que siempre midieron y **no se tocan**. Hacen falta **tres** tests propios, no dos:

1. **Base distribuida:** las 274 de `.rsc/skills/<id>/SKILL.md` portan el bloque y las tres claves, con el digest correcto. Instrumento del criterio 4.
2. **Entrega always-on, los 18 destinos:** el archivo que el hook de cada destino acaba leyendo **no** contiene el bloque, y su tamaño es el de upstream. **Para `claude` el test debe seguir la ruta que guarda `settings.json`**, no lo que devuelve `wireHook`, porque ahí `wireHook` no devuelve ningún cuerpo — era el defecto del test que esta sección definía antes, vacuo justamente en el único destino con imposición.
3. **Entrega por skill:** el `SKILL.md` entregado conserva el bloque en los 18, y el `.mdc` de Cursor también — que es la única entrega **transformada** (`cursor.js:7`) y por tanto la única donde un fallo de renderizado no lo vería ni el validador de la base ni el digest.

### Cuándo se aplica

En la **Etapa 4**, con el transformador.

---

## 5. Imposición: lo que el código puede denegar

| Asistente | ¿Deniega hoy? | Evidencia medida |
|---|---|---|
| **claude** | **Sí, con condición** | 4× `PreToolUse` en `targets/claude.js:195,209,225,311`; las guardas devuelven `permissionDecision:"deny"` (`danger-guard.mjs:28,38`, `gitmoji-guard.mjs:285-287`). **Sólo en una máquina donde se haya hecho `rsc sync`** |
| **codex** | No | `.codex/hooks.json` generado: `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PreCompact`, `SessionEnd`, `Stop`. **Sin `PreToolUse`** |
| **cursor** | No | `.cursor/hooks.json`: sólo `beforeSubmitPrompt`, que es pre-**turno**, no pre-herramienta |
| **antigravity** | No | No se genera ningún archivo de hooks; el modo de memoria resuelve a `unsupported` |
| **deepseek** | No, pero la maquinaria existe | `.dsh/hooks.json` sin `PreToolUse`; cableando uno a mano el puente devuelve `{"decision":"block"}` (`targets/deepseek-bridge.mjs:67-69,77`). **Dos líneas de distancia** |

**Dos hallazgos que acotan esto más de lo que estaba registrado:**

1. **No existe interceptación de la aplicación de una skill en ningún destino.** Los únicos matchers del repositorio son `'Bash'` (×4) y `'Edit|Write|MultiEdit|NotebookEdit'` (×1); `'Skill'` no aparece como herramienta ni como matcher en `scripts/`, `targets/` ni `tests/`. **El momento «ahora se aplica esta skill» no es observable.** Por tanto ninguna cláusula del contrato se puede imponer en el momento de aplicarse, en ningún asistente. Lo que el código puede denegar es una *llamada a herramienta*, que es otro evento.

2. **En un clon fresco, `claude` tampoco deniega.** `.claude/settings.json` y `.claude/rsc-bootstrap.mjs` viajan, pero `.rsc/` está en `.gitignore`, así que **ninguna guarda existe**. El bootstrap devuelve sólo `additionalContext`, y es deliberado y está documentado: `clone-bootstrap.mjs:371-374` — *«no `permissionDecision`: informing someone is not denying them»*.

**Y la superficie de manipulación está abierta:** `.claude/settings.json` viaja en git y **no** lo cubre el `.gitignore` generado, así que la entrada del hook se puede borrar en un commit.

> **Conclusión que la arquitectura asume:** la gobernanza es **consultiva en 4 de 5 asistentes y condicionalmente imponible en 1**. Ningún elemento del diseño depende de la denegación. Donde exista, es un refuerzo; donde no, el contrato sigue siendo texto que el modelo puede ignorar, y eso se mide en vez de prometerse.

---

## 6. El puntero: dónde puede apuntar y dónde no

| Destino | Veredicto medido |
|---|---|
| `02-DOCS/wiki/skills/<id>/README.md` | **Sobrevive y viaja en git.** Es contenido del proyecto; el adaptador de Cursor nunca lo toca. **El puntero funciona en los cinco** |
| `.rsc/skills/<id>/references/…` | Existe en disco pero **no viaja** (está en `.gitignore`). Frágil |
| `references/…` relativo al `.mdc` | **Roto.** 79 skills enlazan así hoy |

**Requisito que de esto se deriva: toda ruta del puntero va anclada en la raíz del proyecto, nunca relativa al archivo que la cita.** No es estilo; es la diferencia entre funcionar y no funcionar en Cursor.

Un matiz que corrige el hallazgo C5: Cursor **no pierde** los auxiliares del proyecto —existen en `.rsc/skills/<id>/references|scripts|evals` y su estado lo sabe (`"base": ".rsc/skills/<id>"`)— lo que pierde es **la capacidad de alcanzarlos por ruta relativa** desde su propia regla.

**Y una buena noticia medida:** `drift:check` es el **único** de los nueve validadores que lee el cuerpo de forma bloqueante, y **exime** la ruta `02-DOCS/wiki/skills/<id>/README.md` por clasificarla como `user-project` (`drift-check.js:126,134`). La ruta elegida en §5 de los requisitos no hace tropezar al único validador que podría tropezar. Un control negativo con un enlace no exento devuelve `EXIT=1` nombrando archivo y línea, así que el PASS no es vacuo.

**Límite a declarar, no a prometer:** el punto 3 de §5 de los requisitos («consultar sus referencias cuando sean pertinentes») es **estructuralmente imposible en Cursor** para las referencias de la propia skill.

---

## 7. Selección automática: lo que de verdad hay

| Asistente | Estado medido |
|---|---|
| **claude** | Nativa (`.claude/skills/<id>/SKILL.md`) |
| **deepseek** | Nativa (`.dsh/skills/<id>/SKILL.md`, *«discovers … natively»*) |
| **cursor** | **Ciega, no ausente.** El mecanismo existe, pero `cursor.js:7` escribe `description: rsc skill <id>`: medido **355→21 B**, **350→19 B**, **479→17 B**, ~95 % de pérdida |
| **codex** | Inexistente, y **nada les dice dónde están las skills** |
| **antigravity** | Inexistente, ídem |

Para `codex` y `antigravity` se verificó que ni su `AGENTS.md` ni el de la raíz mencionan la ruta, y que el bloque always-on usa rutas relativas que **desde la raíz del proyecto apuntan fuera del proyecto**. C3 confirmado: o la selección la dirige el usuario, o el fork construye el descubrimiento.

**Decisión del usuario, 2026-11-01: la ceguera de Cursor queda como límite declarado. No se arregla.** `PLAN.md:193` ya la enumeraba entre «los límites que se declaran, no se prometen resolver», y preguntado expresamente el usuario confirma esa línea.

El borrador anterior decía que era *«la reparación más barata del informe»*, y técnicamente lo es — `cursor.js:5` ya tiene el `SKILL.md` completo en mano, y es código del arnés y no del catálogo, así que no tocaría la invariante. Pero **barato no es lo mismo que dentro del alcance**, y `PLAN.md` §12 es explícito: la aprobación autoriza lo descrito y nada más. Presentar una ampliación de alcance como corolario técnico era un defecto de este documento, señalado por la revisión independiente.

Se registra en §10 como **L6**, con su cifra medida, para que el informe final no la omita ni la presente como un descubrimiento tardío. La consecuencia operativa, dicha sin rodeos: **en Cursor la selección automática de skills seguirá siendo mala**, y la gobernanza llega igual porque viaja en el cuerpo — lo que no llega es la descripción que haría que Cursor eligiera bien la skill a la que aplicarla.

---

## 8. La configuración del fork va en su propio archivo

`.rsc.json` **descarta en silencio** las claves que no conoce: `manifest-file.js:18` (`KEYS`, doce cerradas), `:31-47` (`readManifest` es una proyección literal), `:60,64` (`writeManifest` itera `KEYS`). Demostrado: una clave `forkGovernance` committeada **desapareció en la primera instalación**, sin aviso. Agravante: `:28-30` sí trata el JSON corrupto como condición dura; el JSON válido con claves del fork recibe el trato opuesto.

**Decisión: archivo propio, `.rsc.fork.json`.** Extender `KEYS` cuesta poco pero **no resuelve el problema**, porque el CLI del padre instalado desde npm seguiría borrando las claves en un proyecto que tenga los dos. El archivo propio cuesta **cero líneas de divergencia** en archivos del padre (`manifestPath` sólo construye `.rsc.json`, `:15-16`).

**Dos cosas que esta decisión debía al plan y que la revisión encontró sin pagar.** `PLAN.md:93` aprobó «extender `KEYS` de `.rsc.json` **y detectar la pérdida de clave**». Este diseño hace lo primero innecesario, pero la segunda mitad no desaparece con ello:

1. **Qué sustituye a la detección de pérdida de clave.** Con archivo propio la clave ya no se puede perder, pero sí puede quedar **obsoleta u huérfana** si el CLI del padre reescribe `.rsc.json` por debajo. Sustituto: `.rsc.fork.json` guarda la **huella del `.rsc.json` contra el que se escribió**, y `doctor` y `npm run gate` reportan la divergencia. Misma propiedad — enterarse — por otro mecanismo.
2. **Inventario de recuperación.** `scripts/install-apply.js:71-74` documenta que un archivo que el instalador escribe y el inventario omite queda **silenciosamente ausente del snapshot**, luego `rsc restore` no lo recupera. `.rsc.fork.json` entra en ese inventario. Sin esto, la decisión cambiaba un modo de fallo por otro.

**Esta es una revisión explícita de `PLAN.md:93`**, registrada como tal en el ledger según exige `REQUIREMENTS.md:25`, no una reinterpretación silenciosa.

**Y la no-desarmabilidad sale gratis:** la desarmabilidad es **opt-in por guarda**, no un marco global. `opt-outs.js:19-35` nombra las guardas una a una y `hydrateLocalDecisions` sólo escribe marcadores de nombres registrados. Una guarda del fork que no registre nombre ni consulte ese marcador **no es desarmable, con cero divergencia**.

---

## 9. Puertas de calidad

Medido sobre las 23 comprobaciones con nombre que define el repositorio. **8** corren en algún workflow; **0** corren en un hook de git (`core.hooksPath` sin fijar, sólo `*.sample`); **15 de las 23 no corren en ningún workflow**. La cifra de **6** que circulaba sale de restringirse a las 12 que contó la auditoría previa, y en ese subconjunto se confirma — pero sobre el inventario de 23 el hueco es 15, no 6, y decirlo con el denominador equivocado lo subestima por un factor 2,5. Tampoco es exacto «no corren en ninguna parte»: corren cuando alguien las invoca a mano como script de npm. Lo que no hay es nada que las invoque sola.

### La gobernanza no mueve `routing:audit`. Ni un caso.

Aplicado a las 274 el preámbulo literal de `PREAMBLE-v1.txt` más las tres claves: **0 de 274 entradas de manifest cambian**, y la cifra queda bit a bit en **84,91 %**. La razón es estructural: el corpus del ranker se construye sólo con `id`×3 + `tags`×2 + `description` (`scripts/lib/text-rank.js:69-80`) leídos de `manifest.json`, que `build-manifest.js:29-35` llena con cinco campos del frontmatter. **El cuerpo no entra nunca.** Y las claves nuevas pasan `validate` porque el esquema no fija `additionalProperties: false` (`schema/frontmatter.schema.json:1-12`).

**Tres contrafactuales medidos que condicionan el diseño:**

| Variante | Efecto | Lectura |
|---|---|---|
| La **misma frase irrelevante** en las 274 `description` | 84,91 % → **85,14 %, puerta VERDE** | El IDF nunca llega a cero, así que el texto compartido entra en el coseno. **Una puerta verde así no es prueba de nada** |
| Nombrar el **id de la skill** en su `description` | **84,47 %**, y rompe `rank-1` y `top-5` | Refuerza el auto-emparejamiento; el dueño le gana a la ruta declarada |
| Convertir personalizaciones en **entradas de catálogo** | Con **sólo 27** extra se rompen cuatro suelos (colisión 0,984) | Catastrófico |

> **Conclusiones que esto fija:** `02-DOCS/` es la raíz correcta, el **cuerpo** es el sitio correcto, la `description` es **intocable**, y las personalizaciones **no** pueden ser entradas de catálogo. Tres decisiones del diseño quedan confirmadas por medición en lugar de por criterio.

### Qué se adopta, qué se arregla, qué se descarta

| Comprobación | Veredicto | Motivo |
|---|---|---|
| `validate` | **Adoptar** | Determinista, ~5 s. Único guardián del frontmatter de las 274 |
| `manifest:check` | **Adoptar** | Determinista, ~5 s. Es el guardián de la **entrada** de `routing:audit` |
| `drift:check` | **Adoptar** | Determinista, 886 enlaces |
| `originality:check` | **Adoptar** | Determinista y **offline** (huellas fijadas en `schema/ecc-originality.u64`). Hoy sólo en `release`; debe estar en el paquete base |
| `npm test` | **Adoptar sólo como puerta de release** | **≈ 1 h 48 m medidos** en serie (~~2 h 17 m~~, cifra de 3.7.1 bajo contención, revisada el 2026-11-01). Nunca en el ciclo de iteración |
| `prepublishOnly` | **Adoptar y ampliar** | Ya activo y **no omitible** en `publish`; le faltan `eval-lint` y `routing:audit` |
| `eval-lint.sh` | **Arreglar primero** | Falla en abierto, y el arreglo es casi gratis: `warned_skip` se calcula bien y está **desconectado del código de salida** (`:220-230`). Su dependencia profunda (PyYAML) sería instalación global, prohibida por §1 |
| `routing:audit` | **Arreglar primero** | Rojo por **2 casos de 1 339**, con `top-5` exactamente en el suelo (margen 0). Mide ruido con la misma sensibilidad que señal |
| `drift:knowledge` | **Arreglar primero** | Vacuo por construcción, y **no hermético**: lee auto-memoria bajo `HOME` (`drift-check.js:210,267`) |
| `knowledge:doctor` | **Arreglar primero** | Vacuo: `process.exit(0)` en `knowledge-doctor.js:49-52` **antes de mirar nada** |
| `spec:gate` | **Arreglar primero** | Vacuo: `spec-gate.js:172-175` retorna sin tocar el contador de fallos |
| **Puerta de limpieza de `ci.yml:24-31`** | **Arreglar primero** | **Hallazgo nuevo:** el `! grep` convierte el **exit 2 de error de escaneo en PASS**. Comprobado por ejecución. Es textualmente lo que prohíbe `skills/verify/SKILL.md:90` |
| `reviewer-guard.sh` | **Descartar** | `exit 1` permanente; `plugins/` no existe y **los 6 encabezados que exige no están en ningún archivo**. Su doctrina ya vive en `skills/review/SKILL.md` |
| `design:upstream` | **Descartar** | Red obligatoria contra dos repositorios de terceros; su veredicto cambia sin que cambie este repositorio |
| `audit.js` | **Descartar** | Consultivo por diseño declarado (`:1-4`, *«never a hard error»*) |
| `skills/*/scripts/verify.sh` (189) | **Descartar** | Artefacto distribuido al consumidor, fail-open **declarado**. No es comprobación de este repositorio |
| `skill-*.workflow.js` (3) | **Descartar** | Dependen de ejecuciones de agente; no deterministas |

**`eval-lint` arreglado no crea deuda:** reimplementadas sus cuatro aserciones actuales sobre las 274 → **0 fallos**. Se puede poner estricto hoy y queda verde hoy. El único defecto real son **3 skills** (`ux`, `variant-explorer`, `viral-score`) con `capability` malformada, **invisible incluso a la validación profunda** porque `count()` sólo mide longitud de lista: hace falta una aserción de **forma**.

### Dónde pueden correr, con Actions desactivado: cinco sitios, ninguno suficiente

| Sitio | Garantiza | **No** garantiza |
|---|---|---|
| **Script local** (`npm run gate`) | Adoptable hoy sin tocar nada. **130 s medidos** para el paquete determinista completo | No obliga a nadie |
| **Hook de git** | La única imposición local disponible, y la maquinaria ya existe (`install-apply.js:987-996` instala `post-merge`; `hooksDir()`/`hooksDirIsOurs()` respetan `core.hooksPath`) | El propio repositorio escribe su punto débil en `tests/worktree-reaper.test.js:948`: *«a hook lives in .git/hooks, which is not cloned»*. `--no-verify` lo anula, un `core.hooksPath` ajeno lo deja inerte, y no impide ningún merge |
| **Hooks del arnés** (`SessionStart`/`Stop`) | Avisan | Son desarmables desde un `.rsc.json` commiteado, y viven en `.claude/`/`.rsc/`, ambos ignorados |
| **`prepublishOnly`** | **No omitible** en `publish` | No cubre commits, y le faltan tres comprobaciones |
| **Workflow** | Lo único **no omitible**, en clon limpio, con registro, y puede ser puerta de `main` | Habilitar Actions no es neutro: `ci.yml:3` dispara `on: [push, pull_request]` y **`pages.yml` despliega en push a `main` sin ejecutar ninguna comprobación**. Además `ci.yml` **no tiene bloque `permissions:`**, así que hereda el permiso por defecto; mínimo privilegio exigiría `contents: read` explícito |

**Estado del remoto, verificado por el coordinador** con `gh api` como parte de la verificación de accesos que el usuario pidió («Verifica accesos sin revelar secretos», §4b del ledger) — no por un proceso de build aislado, que no puede y no debe: Actions sigue **desactivado** (`{"enabled":false}`, reconsultado hoy). Esa es la mitigación más fuerte de R6 y se mantiene.

**Recomendación:** **script local + hook de git + el patrón de tres estados de `doctor.js:102-135`**, para que un hook desinstalado sea **visible** en lugar de silencioso. Es lo más fuerte alcanzable sin Actions, y no finge ser una garantía. Y una restricción que atraviesa los cinco sitios: **ninguno puede ejecutar `npm test`**, así que el diseño separa por cadencia el paquete determinista de 130 s de la suite de 2 h 17 min.

---

## 10. Límites residuales, declarados

| # | Límite | Por qué |
|---|---|---|
| L1 | **`node --test` no se ha ejecutado contra el catálogo transformado.** Diez archivos leen el cuerpo: `always-on-body`, `clone-bootstrap`, `ftd-lane`, `catalog-diet`, `ux-upstream`, `design-engine`, `skill-lint`, `frontmatter`, `manifest`, `context-budget` | La línea base ocupaba la máquina. **Paso obligatorio al terminar.** Las cinco comprobaciones replicadas a mano están verdes, pero cinco no son 1 537 |
| L2 | **`eval-lint.sh` no ejecutado** | Escribe en `/tmp` literal (`scripts/eval-lint.sh:192`), fuera de la carpeta dedicada. §1 lo prohíbe. Registrado como no verificado — y ese `/tmp` cableado es en sí mismo un hallazgo: un validador que escribe fuera del proyecto |
| L3 | **Si Claude Code expone un nombre de herramienta para la aplicación de una skill a `PreToolUse`: NO VERIFICABLE** | Exigiría ejecutar el cliente real, lo que usa la sesión del usuario. §1 prohíbe exponer credenciales o sesiones del usuario a estos procesos. **No se hará.** Mientras no se verifique, el matcher de una eventual guarda de gobernanza es una elección de diseño, no un hecho |
| L4 | ¿Aceptan de verdad un `deny` codex, cursor y antigravity? | Exigiría sus binarios, y no hay instalaciones globales |
| L5 | Windows | `targets/index.js` copia archivos reales en vez de crear symlinks; no hay entorno Windows |
| L6 | **La selección automática de Cursor es ciega**: `cursor.js:7` sustituye la `description` real por `rsc skill <id>` — medido **355→21 B**, **350→19 B**, **479→17 B**, ~95 % de pérdida | **Decisión del usuario (2026-11-01): queda como límite, no se arregla.** `PLAN.md:193` ya lo declaraba así. La gobernanza sí llega a Cursor, porque viaja en el cuerpo; lo que no llega es la descripción que le permitiría elegir bien la skill |
