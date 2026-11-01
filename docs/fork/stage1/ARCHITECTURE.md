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
| `origin:` dentro de los primeros **2048 B** | `scripts/doctor.js:183-190` | Margen actual 878/2048. Las tres claves del fork caben; un bloque **antes** del frontmatter no |
| Profundidad 2 | Los 274 `SKILL.md` están a profundidad 2 | `tests/ux-upstream.test.js:17,24-32` congela por hash `skills/ux/upstream/**`; limitar a profundidad 2 excluye los subárboles congelados **por construcción** |
| Idempotencia por marcadores | `targets/_md-block.js:11-12`, regex de `scripts/lib/onboarding.js:131` | Reimplementado y ejecutado dos veces: **274/274 byte-idénticos** tras la segunda pasada, ninguna skill con dos bloques |

*(Corrección: el regex está en `onboarding.js:131`, no en `:129` como registró el ledger. Y `agents-md-shadow.js:37` no escribe, sólo detecta.)*

---

## 3. El canal: el cuerpo, y sólo el cuerpo

**Esto invalida la mitad del diseño del contrato.** `targets/cursor.js:7` **reemplaza el frontmatter entero** por `description` + `alwaysApply` (`stripFrontmatter` en `:28-30`). Medido: el `.mdc` que recibe Cursor **no contiene** la clave añadida aunque la base sí la tenga. `_md-block.js:28,73-74` también la descarta en la superficie always-on.

> **El cuerpo es el único canal que llega a los 18 asistentes.**

Las tres claves planas de frontmatter se mantienen, pero su papel cambia: pasan a ser **redundantes respecto al bloque del cuerpo**. Nada que el modelo deba saber vive sólo en el frontmatter.

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

Peor que innecesarios: habrían **destruido el triñquete en vez de moverlo**. Con el techo en 8 061, un fuente de 8 059 B pasaría mientras su entrega transformada pesaría 8 836 B — 644 B por encima del límite exterior. El techo habría quedado midiendo una magnitud equivocada por exactamente el tamaño del preámbulo, y se habrían pagado **tres divergencias permanentes** en archivos que upstream edita, a cambio de nada.

### Lo que sí era real: el coste por turno, y que ningún test lo vigilaba

El preámbulo **sí** llegaba al cuerpo always-on, porque ese cuerpo se renderiza desde la copia **transformada**: `scripts/install-apply.js:294` llama a `wireHook(target, paths, join(ensureBase('suggest', …), 'SKILL.md'))`, y `ensureBase` es el punto de transformación de §2. De ahí los **779 B en cada turno, en los 17 asistentes sin gancho por turno**.

Las dos cosas juntas dan el diagnóstico completo: **el coste caía en la superficie más cara del producto y los tres techos no lo medían**, porque miran el fuente. Elevarlos no habría arreglado nada; habría dejado un cuarto validador vacuo.

### Y el bloque ahí no tiene referente

El preámbulo dice *«read this before applying the skill below»* y apunta a `02-DOCS/wiki/skills/suggest/README.md`. En el cuerpo always-on **no hay ninguna «skill below» que se esté aplicando**: es la capa ambiental de operaciones, presente siempre. `EVALUATION.md` ya lo había declarado al excluir `suggest` de la muestra — *«la conducta “consultar la personalización antes de aplicar esta skill” no significa lo mismo para ella»* — y `evidence/transformer-feasibility.md:522` lo había dicho antes: el bloque **ya está en la skill concreta cuando se la invoca**. Se estaban pagando 779 B por turno para inyectar una regla que los propios documentos del fork declaraban sin significado en ese sitio.

### La decisión: despojar el bloque en el renderizado always-on, y sólo ahí

La separación ya existe en el código y es exacta:

| Función | Qué es | Qué se hace |
|---|---|---|
| `writeSkill(id, fromDir, toPath)` | Renderizado **por skill**. `_md-block.js:23` enlaza o copia; `cursor.js:4` despoja el frontmatter y conserva el cuerpo; `claude.js:9` ídem | **No se toca.** Las 274 conservan el bloque en los 18 destinos, `suggest` incluida cuando se la invoca como skill |
| `wireHook(paths, sourceMd, policy)` | **Sólo** la superficie always-on. Tres implementaciones: `_md-block.js:27`, `cursor.js:11`, `claude.js:112`, y las tres ya hacen `stripFrontmatter(readFileSync(sourceMd,'utf8'))` | Se añade `stripGovernance()` junto a ese `stripFrontmatter`: borra entre `<!-- rsc-governance:begin v1 -->` y `<!-- rsc-governance:end -->` |

Determinista e idempotente, como el resto de la transformación, y en el punto donde ya se despoja contenido por la misma razón.

**Resultado, en las cuatro magnitudes que importan:**

| | Diseño retirado | Diseño adoptado |
|---|---|---|
| Conformidad | 274/274 | **274/274** |
| Coste por turno en 17 asistentes | 779 B (~200 tokens) | **0 B** |
| Techos que cambian | 3 | **0** |
| Divergencias permanentes con upstream | 3 (4 archivos) | **0** |

La decisión del usuario se cumple en su letra: el validador determinista del criterio 4 corre sobre la base distribuida `.rsc/skills/`, donde las 274 portan el contrato y un 273 es un fallo.

### Lo que hay que medir, ya que los techos de upstream no sirven para esto

Dos tests propios del fork, porque los tres de upstream se quedan midiendo lo que siempre midieron y **no se tocan**:

1. **Base distribuida:** las 274 de `.rsc/skills/<id>/SKILL.md` portan el bloque y las tres claves, con el digest correcto. Es el instrumento del criterio 4.
2. **Entrega always-on:** el cuerpo que escribe `wireHook` **no** contiene el bloque, y su tamaño es el de upstream — es decir, el fork **no añade ni un byte** a la superficie por turno. Test negativo, que es el que cierra la puerta a reintroducir el coste por descuido.

### Cuándo se aplica

En la **Etapa 4**, con el transformador. Los tres techos de upstream quedan **sin tocar**, así que ya no hay nada que coordinar con la medición de la línea base, ni archivos que marcar para la máquina de mantenimiento de §9 por este motivo.

---

## 5. Imposición: lo que el código puede denegar

| Asistente | ¿Deniega hoy? | Evidencia medida |
|---|---|---|
| **claude** | **Sí, con condición** | 4× `PreToolUse` en `targets/claude.js:191,206,222,300`; las guardas devuelven `permissionDecision:"deny"` (`danger-guard.mjs:28,38`, `gitmoji-guard.mjs:285-287`). **Sólo en una máquina donde se haya hecho `rsc sync`** |
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

La ceguera de Cursor es **la reparación más barata del informe**, porque `cursor.js:5` ya tiene el `SKILL.md` completo en mano. Es código del arnés, no del catálogo, así que arreglarlo no toca la invariante.

---

## 8. La configuración del fork va en su propio archivo

`.rsc.json` **descarta en silencio** las claves que no conoce: `manifest-file.js:18` (`KEYS`, doce cerradas), `:31-47` (`readManifest` es una proyección literal), `:60,64` (`writeManifest` itera `KEYS`). Demostrado: una clave `forkGovernance` committeada **desapareció en la primera instalación**, sin aviso. Agravante: `:28-30` sí trata el JSON corrupto como condición dura; el JSON válido con claves del fork recibe el trato opuesto.

**Decisión: archivo propio, `.rsc.fork.json`.** Extender `KEYS` cuesta poco pero **no resuelve el problema**, porque el CLI del padre instalado desde npm seguiría borrando las claves en un proyecto que tenga los dos. El archivo propio cuesta **cero líneas de divergencia** en archivos del padre (`manifestPath` sólo construye `.rsc.json`, `:15-16`).

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
| `npm test` | **Adoptar sólo como puerta de release** | 2 h 17 min. Nunca en el ciclo de iteración |
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
