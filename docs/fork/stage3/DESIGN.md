# Diseño del análisis brownfield — Etapa 3

Documento interno (español). Los cuatro artefactos de producto de esta etapa van en inglés por D7; este explica por qué son como son.

**Lo que esta etapa entrega:** especificación y diseño. Ni una línea de código. No se tocó `scripts/`, `targets/`, `tests/`, `package.json` ni `skills/`, ni `docs/fork/LEDGER.md` ni `docs/fork/stage1/`.

---

## 1. La tesis del diseño

El análisis brownfield es **casi todo conducta del modelo**. La parte que una máquina puede garantizar es estrecha y se puede nombrar con precisión: *un artefacto mal formado se rechaza*. Nada más.

Eso no es un defecto del diseño; es la consecuencia de F32. La aplicación de una skill no es un evento observable en ningún asistente — cero coincidencias de `Skill` como herramienta o matcher en todo el repositorio (`CONTRACT.md` §12) — así que no existe el punto donde una guarda pudiera interceptar «está a punto de aplicar una skill sin haber analizado el proyecto». Y lo que el código deniega es una llamada a herramienta, que es otro evento.

De ahí la forma de los cuatro documentos: **especifican qué se le pide al modelo, y declaran por separado qué parte queda comprobada por máquina.** Requisito §6 lo exige explícitamente y `CONTRACT.md` §0 ya fijó la frontera; esta etapa la respeta en vez de ensancharla.

El peligro concreto que esto evita: escribir «el análisis brownfield garantiza que no se impondrá una migración». No lo garantiza. Lo que se puede garantizar es que *un registro de migración que no diga cuál es el estado actual, cuál el objetivo y que requiere una decisión, no valida* — regla 11 de `CONFLICT-RECORD.md` §7. La diferencia entre esas dos frases es todo el contenido de este diseño.

---

## 2. Decisiones de diseño, una línea de motivo cada una

| # | Decisión | Motivo |
|---|---|---|
| **1** | Los ocho pasos de §7 se conservan numerados 1:1 como B1–B8 | Es la especificación literal; renumerarla u «optimizarla» rompe la trazabilidad con el requisito y con el criterio 10 |
| **2** | Cada paso lleva entradas, salida y **criterio de parada** | Un paso sin criterio de parada es una invitación a leer para siempre, que es el modo de fallo que este procedimiento existe para acotar |
| **3** | Las seis categorías **no se redefinen**: son la tabla de `CUSTOMIZATION-SCHEMA.md` §2, `#"The six categories, and what each one licenses"`, tal cual | Un segundo vocabulario para lo mismo es la fuente de verdad duplicada que §5 prohíbe. Lo que falta al esquema se propone como cambio (§6 de este documento), no se duplica |
| **4** | Los siete campos de §7 son del **conflicto**; la categoría es de cada **posición** | El ejemplo del propio §7 lo exige: la pregunta es si BLoC es vigente, legado o migración — tres categorías para *un* lado. Una categoría por conflicto no puede expresarlo |
| **5** | Paso B4 tipa cada afirmación de la skill en requisito · restricción · preferencia · supuesto | Es lo que decide si perder contra el proyecto cuesta una excepción, una deuda, nada, o es una pregunta de alcance. Sin este tipado, una preferencia se convierte en mandato |
| **6** | B5 detecta, B6 resuelve; nunca en el mismo movimiento | Detectar y resolver a la vez es la resolución silenciosa que `CONTRACT.md` §8 prohíbe |
| **7** | El test de conflicto es de tres partes (mismo alcance · mismo sujeto · no satisfacibles a la vez) | Convierte «hay conflicto» en algo refutable. Lo que falla una de las tres es **adyacencia**, y la adyacencia no se reporta |
| **8** | Antes de declarar un conflicto skill↔skill se leen las cláusulas `NOT` | 273 de 274 declaran su frontera explícitamente (medido). La mayoría de los solapamientos aparentes ya están resueltos ahí |
| **9** | Los candidatos a competidor se **calculan** con `descriptionCollisions`, con el umbral **declarado en B1: `0.45`** | Reutiliza código existente, y `0.45` es el que usa de verdad el auditor (`routing-audit.js#"descriptionCollisions(buildTextCorpus(manifest.skills), 0.45)"`). El `0.80` de `#"maxCollision: 0.80"` es el **techo de fallo**, no un umbral de búsqueda: medido sobre las 274, a `0.80` salen **cero** parejas, así que el conjunto quedaría inoperante. Un inventario «por impresión» no es refutable; uno vacío tampoco |
| **9b** | El conjunto calculado no es sólo una ayuda: es un **criterio de parada de cobertura**. El inventario debe contener **toda** pareja ≥ `0.45`, toda arista `recommends:` y todo nombrado en cláusula `NOT` | Es el único **suelo de recall** de todo el diseño, y no cuesta ni una ejecución de agente: el catálogo está en disco. Medido: 46 parejas ≥ `0.45` sobre 65 skills de 274. Lo comprueba la regla 16 de `CONFLICT-RECORD.md` §7. Cubre un eje, no el problema — ver §5, propiedad 13 |
| **10** | «Material» se define con cuatro tests (M1–M4), no con adjetivos | §7 dice «ambigüedades materiales» y no lo define. Un adjetivo no es un criterio; y G5 penaliza los dos sentidos, así que hacía falta un filtro aplicable |
| **11** | Las decisiones pendientes bloquean por **alcance ∩ compromiso con una posición**, y cada `pending-decision` **enumera** sus acciones bloqueadas | El alcance es computable; el compromiso es juicio, y con `Scope: repo` (legal, y es el de C2) la mitad computable es vacua. Por eso la lista se **escribe**, no se deriva: hace revisable el bloqueo y hace **visible** el sobre-bloqueo, que es el modo de fallo que `QUESTIONS.md` §7 llama el más fácil de cometer — y que esta etapa cometió en C2 |
| **12** | El procedimiento se distribuye como documento en `.rsc/governance/brownfield-v1.md`, no como skill nueva | La Estrategia B congela `skills/` byte-idéntico (`ARCHITECTURE.md` §1) y el validador de conformidad exige 274 de 274 (`CONTRACT.md` §1). Una skill 275 mueve las dos cosas |
| **13** | La asimetría con el contrato (que sí necesita el preámbulo porque `.rsc/` no existe en un clon limpio) se declara y se justifica | Este procedimiento nunca se necesita antes de instalar: analiza un proyecto cuyo harness ya está instalado. `CONTRACT.md` §0 resolvió el otro caso por una razón que aquí no aplica |
| **14** | El informe de la corrida vive en `02-DOCS/wiki/brownfield/<slug>.md` | Un nivel de subdirectorio, que es lo único que `wiki-protocol.md` admite (un solo nivel de subdirectorio de tema); e indexable en `index.md` como cualquier artículo |
| **15** | La decisión de alcance de skill va en la personalización; la transversal va al log del proyecto y se **cita** | Es la regla que upstream ya escribió: «Link out, do not duplicate» (`codebase-onboarding/SKILL.md#"Link out, do not duplicate"`). Duplicarla crea las dos fuentes que la regla de documento obsoleto (`CONTRACT.md` §6) castiga |
| **16** | La casa del registro de decisiones **no se elige aquí**: se lee la del proyecto, por **primera coincidencia de tres ramas** | `decision-records/SKILL.md#"**Where to store** (first match wins):"` pone la convención existente primera, **`docs/adr/` segunda para un repo de código sin convención** — el caso central del brownfield, que el primer borrador se saltó — y `02-DOCS/wiki/decisions/` tercera para un workspace de harness. Elegir yo una casa sería inventar el log paralelo que `#"never spawn a competing second log"` prohíbe |
| **16b** | Los documentos de esta etapa citan `docs/fork/stage1/`, el código y las skills por **sección + fragmento entrecomillado**, nunca por número de línea | Dos hechos medidos: la transformación de gobernanza inserta **13 líneas** antes del cuerpo, así que `skills/<id>/SKILL.md` y `.rsc/skills/<id>/SKILL.md` discrepan en cada línea del cuerpo; y la Etapa 1 reescribió `CUSTOMIZATION-SCHEMA.md` después de cerrar esta etapa, desplazando **todas** sus citas de línea. Una sección y una frase sobreviven a las dos cosas. `CONFLICT-RECORD.md` §2.1 lo convierte de convención en regla validada |
| **17** | El ciclo de vida se **mapea** a los vocabularios existentes en vez de crear uno | Hay tres en upstream (`draft/approved/superseded`, `proposed/accepted/…`, `selected/deferred/excluded`). Un cuarto sería la deuda que este diseño dice evitar |
| **18** | La revalidación **reporta y propone, nunca aplica** | Es el comportamiento medido de `rsc reassess`: «nothing has been installed» (`scripts/rsc.js#"Review a new plan; nothing has been installed"`). Una revalidación que reescribe sola es una re-decisión silenciosa |
| **19** | En greenfield se cierran por regla las categorías que afirman código existente | Convierte «sin inventar evidencia de código existente» (§7) en una comprobación determinista en vez de una aspiración |
| **20** | Las fixtures del ejemplo trabajado se marcan `FIXTURE (synthetic, D9)`, y **las cifras de ejemplo que no son medidas se marcan también** | D9 ya decidió que las fixtures brownfield son sintéticas. Marcarlas evita que un revisor las lea como medición, que sería inventar evidencia en el documento que prohíbe inventarla. La fila de ejemplo de B1 iba sin marca con un `0.83` que además es **imposible** en este catálogo: la colisión máxima real es `0.737` (`linkedin-carousels`/`linkedin-content`). Corregida a un valor plausible y etiquetada como ilustrativa |
| **21** | La evidencia se cita en una de **cuatro formas admisibles**, y «la línea existe» no es una de ellas | La regla 4 original sólo comprobaba que la línea citada **existiera**, de modo que una cita desplazada pasaba en silencio — y eso es exactamente el error que esta etapa cometió con `skills/flutter/SKILL.md:14-15`. Ahora el fragmento manda y la línea es una pista subordinada: cuando discrepan, falla y **dice dónde está el fragmento de verdad**. Un instrumento que no detecta el error de su propio autor no es un instrumento |
| **22** | Se admite `evidence: user-decision, <fecha>` (forma F4) para una decisión tomada en conversación | Sin ella, en greenfield **toda** posición del lado del proyecto era inválida por construcción, o se degradaba a `insufficient evidence` algo que el usuario acababa de decidir — y registrar esa decisión es lo único que §7 asigna al greenfield. F4 es provisional: se asciende a F2 en cuanto la decisión aterriza en su archivo, y nunca sostiene `observed pattern`, `debt` ni `migration` |

---

## 3. Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| **Una skill nueva `brownfield` en `skills/`** | Rompe la invariante byte-idéntica (`ARCHITECTURE.md` §1) y el conteo 274/274 del validador (`CONTRACT.md` §1). Además `origin:` es `risco` en las 274 (medido), así que no hay identificador que distinga una skill propia del fork de una de upstream, que es el mismo problema que hace peligroso el renombrado |
| **Extender `skills/analyze` con un séptimo análisis** | Misma rotura de la invariante, y conceptualmente falso: `analyze` nunca abre un archivo de código (`analyze/SKILL.md#"never open a code file"`) y su unidad de entrada son cuatro documentos SDD. El brownfield lee código contra skills. Serían dos trabajos en una puerta, y la puerta dejaría de ser lo que su descripción promete |
| **Una categoría por conflicto en vez de por posición** | No puede expresar el propio ejemplo de §7. Y colapsaría los dos casos del ejemplo trabajado 1 (31 archivos `observed pattern` + 3 `debt`) en una fila, lo que autorizaría refactorizar los tres sin que nadie lo aprobara |
| **Un log de decisiones brownfield propio** | Lo prohíbe `decision-records/SKILL.md#"never spawn a competing second log"` literalmente. Y habría sido el cuarto log en un proyecto que ya tiene tres que no se ponen de acuerdo — el conflicto C2 que esta etapa reporta en vez de agravar |
| **Resolver C2 (qué log es el canónico) en este documento** | Me faltaba el único dato que lo decide: qué log tiene ya el proyecto. Resolverlo aquí sería elegir un lado, que es exactamente lo que `CONTRACT.md` §8 prohíbe. Queda `pending-decision` con su recomendación |
| **Un hook que deniegue aplicar una skill sin análisis previo** | F32: no hay evento observable al que enganchar. Especificar el matcher sería una elección de diseño presentada como hecho, que es lo que L3 de `ARCHITECTURE.md` §9 ya declaró como no verificable |
| **Exigir que todo conflicto se resuelva antes de empezar** | Lo prohíbe §7 («bloquean las acciones afectadas, no todo el trabajo independiente») y sería un rediseño del harness. El bloqueo por alcance ∩ posición es la alternativa que conserva el trabajo independiente |
| **Analizar las 274 skills en cada corrida** | `PLAN.md` §4 limita la operación a las seleccionadas. Y `CONTRACT.md` §10 (carga progresiva) lo prohíbe por coste: nada instruye a cargar todas las personalizaciones de golpe |
| **Escribir personalizaciones automáticamente donde se detecte un patrón** | `PLAN.md` §4: una personalización inventada a partir de una conjetura congela deuda técnica como si fuera decisión, que es peor que no tener ninguna. Cada escritura es una propuesta que el usuario aprueba |
| **Severidad (CRITICAL/HIGH/…) como campo de impacto** | §7 pide **impacto**, no ranking. «HIGH» no dice qué pasa. La severidad de `analyze/SKILL.md` §"Severity" se conserva para triaje del informe, separada del campo `Impact`, que se escribe como una acción |

---

## 4. Qué se reutiliza de upstream, por sección y fragmento

Un requisito del usuario es preservar las funciones originales del harness. Nada de lo siguiente se reimplementa.

| Mecanismo upstream | Dónde | Para qué lo usa este diseño |
|---|---|---|
| `detectRepoProfile()` | `scripts/detect-repo.js`, `#"export function detectRepoProfile"` | Mitad determinista de B2: stacks, gestores, scripts, runners, monorepo y señales. Entra como **hecho**, nunca como categoría: detecta por presencia de archivo y no distingue convención de accidente (`CUSTOMIZATION-SCHEMA.md` §2, `#"it is deterministic and it cannot tell an approved convention from an accident"`) |
| `scanProject()` | `scripts/lib/onboarding.js`, `#"export function scanProject"` | `sourceFileCount` y `signals` son el discriminador greenfield/brownfield de B2 y §3 de `BROWNFIELD.md` |
| `recommendDeferredComponents()` | `scripts/lib/onboarding.js`, `#"export function recommendDeferredComponents"` | Disparador de revalidación «el proyecto cambió»: compara `sourceFileCount`, manifiestos y señales de complejidad contra la línea base aceptada |
| Estados `selected`/`deferred`/`excluded` + `reevaluateWhen` + `triggerRules` | `scripts/lib/onboarding.js`, el bloque `reevaluateWhen` / `triggerRules` | Vocabulario del ciclo de vida y de la condición de revisión. `reevaluateWhen` es el nombre que se propone reutilizar en el esquema |
| `rsc reassess` → `runReassessment()` | `scripts/rsc.js`, `runReassessment()` | Precedente de comportamiento: reporta, propone, **no instala** (`scripts/rsc.js#"Review a new plan; nothing has been installed"`) |
| `descriptionCollisions()` | `scripts/lib/text-rank.js`, `#"export function descriptionCollisions"` | Conjunto candidato de skills competidoras en B1, calculado |
| Umbral de búsqueda `0.45`, y techo de fallo `0.80` | `scripts/routing-audit.js`, `#"descriptionCollisions(buildTextCorpus(manifest.skills), 0.45)"` y `#"maxCollision: 0.80"` | B1 usa **`0.45`**, el de la llamada real. El `0.80` es el umbral de **fallo** del auditor (`#"if (collisions[0]?.score >= FLOORS.maxCollision)"`): a `0.80` el conjunto candidato sale **vacío** en este catálogo (medido), así que usarlo como umbral de búsqueda era el error de la primera versión |
| `.rsc.json` claves `skills`/`ownSkills`/`targets`/`catalogVersion` | `scripts/lib/manifest-file.js`, lectura de `.rsc.json` | Fuente del inventario B1, y `catalogVersion` como granularidad honesta para la clave de versión revisada |
| `.rsc/skills/<id>/` como única copia real | `targets/index.js`, `#"export function baseDir"` | Lo que B1 inventaría y B3 lee; ningún asistente lee `skills/`. **Y por eso la evidencia de skill se ancla ahí**: en un proyecto consumidor `skills/` no existe |
| Catálogo de sólo lectura, personalización en `02-DOCS` | `scripts/install-apply.js`, `#"Skills are read-only catalog (user customization lives in 02-DOCS)"` | Confirma que la dirección del diseño es la que el instalador ya declara. *(El borrador citaba `:58`; la frase está en `:62` — el archivo se modificó después de cerrar la etapa, que es el motivo de la decisión 16b.)* |
| `skills/codebase-onboarding` + `CODEBASE-MAP.md` | `codebase-onboarding/SKILL.md#"a single living file, \`CODEBASE-MAP.md\`"`, reglas `codebase-onboarding/SKILL.md#"**Breadth before depth.**"` y `codebase-onboarding/SKILL.md#"**Hypothesis before answer.**"`, §"The recon pass — ordered", `codebase-onboarding/SKILL.md#"**Commit it.**"` | B2 **consume** el mapa si existe y **delega** en la skill si no. No se reespecifica un método de reconocimiento |
| «Link out, do not duplicate» | `codebase-onboarding/SKILL.md#"**Link out, do not duplicate.**"` | La regla que separa el *qué es* (mapa, patrón observado) del *por qué* (ADR, convención aprobada) |
| `skills/decision-records` | `decision-records/SKILL.md` §"Decide home + naming once" (`decision-records/SKILL.md#"**Where to store** (first match wins):"`, sus **tres** ramas), §"The record spine" (`decision-records/SKILL.md#"MADR 4.0.0 template"`), §"Status lifecycle + immutability" | Casa, nombrado, espina MADR, ciclo de estados y ritual de supersesión. Nada de eso se redefine. La rama 2, `docs/adr/`, es la que el primer borrador se saltó |
| `02-DOCS/wiki/harness/decisions.md` formato `D-NNNN` con `supersedes:` | `init/references/accompaniment-and-profile.md` §"`02-DOCS/wiki/harness/decisions.md`"; comprobación en `init/scripts/verify.sh#"no decisions log at 02-DOCS/wiki/harness/decisions.md"` | Una de las casas del enrutado; y la única con código detrás (un `warn`, no un fallo) |
| Triaje `resolved-internally` / `inferable` / `must-ask` | `clarify/SKILL.md#"**Resolve what you already can.**"` y su clasificación | Los tres cubos de `QUESTIONS.md` §3, con sus nombres originales |
| Disciplina de pregunta (un lote, ranking por leverage, recomendación propia, no preguntar y responder en el mismo turno) | `clarify/SKILL.md#"**Rank by leverage.**"`, `#"**Carry your own recommendation**"`, `#"**One batch, ranked, then stop.**"`, `#"Thirty questions is noise that buries the three that matter"` | `QUESTIONS.md` §4 y §6 |
| «Declarar el destino de cada entrada» | `clarify/SKILL.md#"**Declare what you did with each entry.**"` | Cada candidato de B5 aparece en el informe con su destino; ninguno se cae en silencio |
| Regla absoluta «reportar, no resolver» + escala de severidad + `result-envelope` | `analyze/SKILL.md#"Report only. Resolve nothing"`, §"Severity", el bloque `result-envelope` | B5/B6, el triaje del informe y el bloque parseable de cierre |
| Ratificación explícita y log de enmiendas append-only | `constitution/SKILL.md`, la regla de ratificación por el usuario; `constitution/references/constitution-template.md` §"Amendment log" | Por qué una constitución `draft` no resuelve nada en B6, y por qué el análisis propone enmiendas sin escribirlas |
| Tabla de enrutado «tipo → casa exacta → quién escribe» | `continuous-learning/SKILL.md` §"Routing decision table"; `references/lesson-routing.md` §"A forward choice that surfaced mid-retro" y §"A one-off, low-stakes note" | La forma de la tabla de `DECISIONS.md` §2, y la posición P2 de C2 |
| Protocolo wiki: un nivel, OKF v0.1, `type:` no vacío, enlaces markdown | `harness/references/wiki-protocol.md`, la regla de un solo nivel de tema y la regla 1 de OKF con la exención de `index.md`/`log.md` | Donde vive el informe, y el hallazgo del `type:` que al esquema **ya no le falta**: la Etapa 1 lo añadió |

**Lo que se añade, que es poco a propósito:** el test de conflicto de tres partes, el tipado de B4 en cuatro clases, los cuatro tests de materialidad M1–M4, la regla de bloqueo por alcance ∩ posición **con lista enumerada**, la puerta de categorías en greenfield, el campo `Confidence` con su falsificador, las **cuatro formas de referencia de evidencia** de `CONFLICT-RECORD.md` §2.1, y el **suelo de recall** de B1. Todo lo demás es composición de piezas existentes.

**Por qué esta tabla ya no lleva números de línea.** Los llevaba, y era la decisión correcta hasta que se midió el coste: `install-apply.js` se modificó después de cerrar la etapa y dos de sus citas quedaron desplazadas; `CUSTOMIZATION-SCHEMA.md` se reescribió y **todas** las suyas. Un nombre de función exportada, un encabezado de sección y una frase literal son estables frente a las dos cosas; un número de línea no lo es frente a ninguna.

---

## 5. Comprobable de forma determinista frente a dependiente del modelo

Ésta es la tabla que §6 del requisito exige por separado y que `CONTRACT.md` §12 ya empezó. **D** = un validador da el mismo veredicto con la misma entrada. **M** = conducta del modelo. **E** = medido por evaluación con intervalo.

| # | Propiedad | Clase | Instrumento, o por qué no hay |
|---|---|---|---|
| 1 | El inventario cubre todas las skills seleccionadas | **D** | `.rsc.json#skills` ∩ filas del inventario |
| 2 | El conjunto candidato de competidores es reproducible | **D** | `descriptionCollisions` con umbral declarado: misma entrada, misma salida |
| 3 | El inventario está **completo** respecto a las skills que el asistente puede usar | **ninguna** | Imposible: personal, globales y de plugin quedan fuera de la vista del harness. §8 prohíbe prometerlo. Se declara como evidencia insuficiente en cada corrida |
| 4 | Las seis dimensiones de B2 están rellenas o con ausencia declarada | **D** | Conteo de celdas; ninguna vacía |
| 5 | La muestra es **representativa** | **M** | Inverificable. Lo único determinista es que la población y el método estén escritos (propiedad 6) |
| 6 | Cada afirmación muestreada declara población, conteo y método | **D** | Presencia de los tres |
| 7 | Cada afirmación de skill está tipada en una de las cuatro clases de B4 | **D** | Valor ∈ cuatro |
| 8 | El tipo asignado es el **correcto** | **M** | Juicio sobre el texto de la skill. Ninguna evaluación lo mide hoy |
| 9 | Un conflicto detectado lleva los siete campos | **D** | `CONFLICT-RECORD.md` §7 reglas 1–9 |
| 10 | Cada posición lleva una de las seis categorías y ≥1 evidencia | **D** | Reglas 3–4 |
| 11 | Toda referencia de evidencia está en una de las cuatro formas admisibles, y **el fragmento citado sigue estando en el archivo** | **D** | Regla 4 reescrita (`CONFLICT-RECORD.md` §2.1). La versión anterior sólo comprobaba que la **línea** existiera, y así una cita desplazada pasaba en silencio: era determinista, barata y **ciega al error que esta etapa cometió**. Una búsqueda de subcadena cuesta menos que contar las líneas del archivo |
| 11b | Una referencia a una skill apunta a `.rsc/skills/<id>/`, no a `skills/<id>/` | **D** | Regla 4d. En un proyecto consumidor `skills/` no existe, y la transformación desplaza el cuerpo **13 líneas** (medido sobre `flutter` y `decision-records`) |
| 11c | Una referencia `user-decision` provisional se ha ascendido a sección+fragmento una vez escrita la decisión | **D** | Regla 4c. Lo que **no** es determinista es que las palabras citadas del usuario sean fieles: eso es **M** |
| 12 | La categoría asignada es la **correcta** (aprobada vs observada) | **M** | Es un juicio sobre si hay ratificación. Es la distinción que hace valioso el esquema (`CUSTOMIZATION-SCHEMA.md` §2, `#"collapsing \"observed pattern\" into \"approved convention\" would silently promote every accident in the codebase to law"`) y la que ninguna máquina puede tomar |
| 13a | Recall skill↔skill sobre parejas que **colisionan en su descripción** (≥ `0.45`), aristas `recommends:` y nombrados en cláusula `NOT` | **D** | **Nueva.** Regla 16 + el criterio de parada de B1: el inventario debe contener **toda** pareja por encima del umbral. El conjunto se calcula del catálogo en disco, así que es completo y cuesta cero ejecuciones. Medido: 46 parejas, 65 skills |
| 13b | Recall skill↔skill cuando las dos skills **chocan en el cuerpo** y se describen distinto | **ninguna** | Nada lo computa. Haría falta un gate semántico |
| 13c | Recall **project↔skill** — un conflicto con el proyecto que existe **fue detectado** | **ninguna** | Invisible por construcción: una corrida que lee el proyecto y no encuentra nada produce cero registros y pasa las dieciséis reglas, incluida la 16, porque la 16 sólo pregunta por parejas computables del catálogo. **Sigue siendo el hueco más grande del diseño** y se declara como tal |
| 14 | `Confidence` ∈ {high, medium, low} y lleva falsificador | **D** | Regla 6 |
| 15 | El valor de `Confidence` es **honesto** | **M** | Inverificable |
| 16 | ≥2 alternativas, y la recomendación es una de ellas | **D** | Reglas 7–8 |
| 17 | Una posición `migration` declara estado actual, objetivo y que requiere decisión | **D** | Regla 11; `CUSTOMIZATION-SCHEMA.md` §3 regla 7 |
| 18 | Una migración **no se ejecuta** por haberla detectado | **M** | Nada lo impide. `CONTRACT.md` §7 lo instruye; F32 impide imponerlo |
| 19 | Ninguna decisión pretende desactivar un permiso o guarda | **D** | Regla 12; `CUSTOMIZATION-SCHEMA.md` §3 regla 8 |
| 20 | Un `resolved-by-decision` cita archivo **y** sección | **D** | Regla 10 |
| 21 | La decisión citada **cubría** de verdad el alcance del conflicto | **M** | Requiere leer dos alcances y compararlos semánticamente |
| 22 | Una constitución o personalización `draft` **no** resuelve | **D** parcial | El `status` es comprobable; que el modelo respete la consecuencia es G4 (**E**, ≥95 %) |
| 23 | Precedencia constitución > personalización, con excepción registrada | **E** | G4, ≥ 95 %, ninguna celda en fallo (`EVALUATION.md` §8) |
| 24 | Se pregunta cuando falta evidencia, y **no** cuando ya estaba documentada | **E** | G5, ≥ 85 %, los dos modos (`EVALUATION.md` §8). Único gate que toca esta etapa |
| 25 | El sobre-preguntar queda detectado | **E** solamente | Ningún validador lo ve: cuarenta preguntas bien formadas pasan todas las reglas |
| 26 | Las pendientes bloquean sólo las acciones afectadas | **D** muy parcial, y **M** en lo que importa | «Afectada» es conjunción: alcance (computable) ∧ *compromete una posición* (**juicio**). Con `Scope: repo`, que es legal y es el de C2, la mitad computable **no acota nada**. Lo determinista se reduce a que la lista enumerada exista (regla 15); que sea la lista correcta es **M**. `QUESTIONS.md` §5 lo dice así en el artefacto de producto, no sólo aquí |
| 27 | Toda decisión escrita lleva condición de revalidación | **D** | Regla 1 del esquema: `reevaluate-when` ya es una de las **nueve** claves exigidas. Lo que sigue siendo grueso es la otra clave, `catalog-version`: ver `DECISIONS.md` §7 (d) |
| 28 | Greenfield no emite `observed pattern`, `debt` ni `migration` | **D** | Regla 13 + el discriminador `sourceFileCount`. Comprobación nueva y barata |
| 29 | La personalización de una skill eliminada sobrevive y se reporta huérfana | **D** | Criterio 12; `CUSTOMIZATION-SCHEMA.md` §4 |
| 30a | **Detectar** un renombrado | **M** | Aquí el razonamiento del primer borrador estaba invertido. No hay identificador estable — `origin: risco` en las 274, verificado — así que un renombrado sólo puede **conjeturarse por similitud de contenido**. La ausencia de identificador no hace la detección determinista: la hace imposible de hacer determinista |
| 30b | Un renombrado conjeturado **no se auto-aplica**: se reporta como migración que requiere decisión | **D** | *Ésta* sí es determinista, y es una **política**, no una detección: `CUSTOMIZATION-SCHEMA.md` §4, `#"A guess that is applied is a guess that has become invisible"`. Criterio 12 se cierra con esta mitad, no con 30a |
| 31 | El archivo escrito es OKF-conforme dentro del bundle `wiki/` | **D** parcial | La clave `type: skill-customization` ya es obligatoria (`CUSTOMIZATION-SCHEMA.md` §3, regla 4b), así que la parte que a esta etapa le faltaba está cerrada. Lo que sigue sin existir es un **comprobador OKF completo** en `scripts/` (verificado: ninguno), de modo que el resto de las reglas del bundle es prosa |
| 32 | El informe existe y está indexado en `02-DOCS/wiki/index.md` | **D** | Presencia de archivo y de fila. **Decidible y hoy no instrumentada**: nada lee `02-DOCS/wiki/brownfield/` — ver `BROWNFIELD.md` §6, ítem 2 |

**Recuento: 22 propiedades deterministas (una de ellas parcial), 9 dependientes del modelo, 4 medidas por evaluación, 3 sin instrumento posible** (3, 13b, 13c).

**Decidible no es instrumentado, y la tabla no debe leerse como si lo fuera.** Las 22 «D» dicen que *un validador daría el mismo veredicto con la misma entrada*. No dicen que exista. Hoy el único validador que corre es `validateCustomizations`, y recorre exactamente una raíz: `02-DOCS/wiki/skills/`. El informe de la corrida y los registros de conflicto que viven en `02-DOCS/wiki/brownfield/` **no los lee nada** — `grep -rn brownfield scripts/ package.json` sale vacío. Así que la mayoría de estas 22 son, ahora mismo, **decidibles y no instrumentadas**, y `BROWNFIELD.md` §6 nombra el módulo que hay que extender, la segunda raíz que hay que recorrer y la etapa que lo hace.

**La línea que no se cruza.** La propiedad **13c** es la que un lector apresurado podría leer como cubierta por las otras. No lo está. La 13a cierra un eje de recall, completamente y gratis, y es la mejora real de esta revisión; pero es el eje computable desde el catálogo. Un análisis que abre el proyecto y no encuentra nada sigue siendo indistinguible, para todo instrumento de este diseño, de un proyecto sin nada que encontrar. Por eso `BROWNFIELD.md` §5 lo dice en el documento de producto y no sólo aquí, por eso §6 propone el gate que falta con su coste, y por eso **el suelo de la 13a no debe presentarse como cobertura del hueco de la 13c**. Declarar no es mitigar.

---

## 6. Cambios propuestos a artefactos de otras etapas

Propuestos como cambios, no duplicados. Esta etapa no es dueña de ninguno de estos archivos.

**Lo que ya se aceptó, y por tanto deja de ser propuesta.** Las tres claves que esta etapa pidió a `CUSTOMIZATION-SCHEMA.md` §1 — `catalog-version`, `reevaluate-when` y `type` — **están en el esquema**, y su regla 1 exige ahora **nueve** claves. Dejarlas escritas como pendientes haría rehacer trabajo hecho o contradecir a la Etapa 1, así que se registran como cerradas:

| # | Archivo | Cambio | Estado |
|---|---|---|---|
| (a) | `CUSTOMIZATION-SCHEMA.md` §1 | Clave `catalog-version` | **aceptado y presente** |
| (b) | `CUSTOMIZATION-SCHEMA.md` §1 | Clave `reevaluate-when` | **aceptado y presente** |
| (c) | `CUSTOMIZATION-SCHEMA.md` §1 | Clave `type: skill-customization` | **aceptado y presente** |

**Lo que sigue abierto:**

| # | Archivo / dueño | Cambio | Por qué, y qué cuesta |
|---|---|---|---|
| **(d)** | `EVALUATION.md` | Un gate para el recall **project↔skill** y otro para la corrección de categoría | Las propiedades 13c y 12 de §5 no las mide nada, y el criterio 10 se cierra hoy con G5, que mide *preguntar*, no *detectar*. **Coste:** son escenarios nuevos con proyecto de partida y marcadores binarios; a N=3 por celda, dos conductas nuevas con ~8 celdas cada una son ~48 ejecuciones, y D6 fija el techo en ~600 **ya repartidas** (181 celdas, 599 ejecuciones asignadas, 1 de holgura — `EVALUATION.md` §7). Así que o se reasigna, o se declara cobertura pendiente, que es lo que `PLAN.md` §11 criterio 14 exige para este caso. **No se bajan los umbrales de G1–G6** |
| **(e)** | `scripts/lib/customization-validator.js` / **Etapa 6** | Recorrer una **segunda raíz**, `02-DOCS/wiki/brownfield/`, y aplicar las 16 reglas de `CONFLICT-RECORD.md` §7 | Hoy el validador recorre sólo `CUSTOMIZATION_ROOT` (`#"join('02-DOCS', 'wiki', 'skills')"`) y nada lee el informe de la corrida (`grep -rn brownfield scripts/ package.json` vacío). Sin esto, 22 propiedades deterministas son **decidibles y no instrumentadas**, que es el mismo defecto que la revisión independiente de la Etapa 1 le encontró al validador de personalizaciones. **Puntos de invocación que ya existen:** `install`/`sync` (ya cableado en `scripts/install-apply.js`) y `npm run governance:customizations`. `npm run gate` es el tercero y **futuro**: no existe |
| **(f)** | **Etapa 4** (transformador) | Un digest de contenido **por skill** | `catalog-version` detecta «la skill cambió» con granularidad de catálogo y sobre-reporta. `governance-digest` no sirve: resume el preámbulo, no la skill (`CONTRACT.md` §1). Error en la dirección segura (nunca pierde un cambio, señala de más), y nombrarlo es más barato que dejar creer que el disparador es preciso |

(a)–(c) eran claves planas y aditivas, que es lo que exige el parser de frontmatter escrito a mano (`CONTRACT.md` §1).

---

## 7. Lo que no pude verificar, y por qué

| # | No verificado | Motivo |
|---|---|---|
| 1 | **Que los validadores de `CONFLICT-RECORD.md` §7 pasen sobre un archivo real** | No existen: esta etapa entrega especificación, no código, y escribir código colisionaría con las Etapas 2 y 4 |
| 2 | **Que `npm run gate` exista** — y **no existe** | Verificado negativamente: `package.json` no define script `gate`. Los que define son **17**, no 14 como decía el borrador: `manifest`, `manifest:check`, `validate`, `drift:check`, `drift:knowledge`, `knowledge:doctor`, `spec:gate`, `routing:audit`, `design:upstream`, `originality:check`, `governance:sync`, `governance:check`, `governance:customizations`, `test`, `coverage`, `version`, `prepublishOnly`. La conclusión no cambia; la cifra sí, y una cifra medida mal en un documento cuya regla es citar por evidencia es el mismo defecto a menor escala. `CUSTOMIZATION-SCHEMA.md` §3 dice lo mismo y lo asigna a la **Etapa 6** |
| 2b | **Que algo valide los artefactos de esta etapa** — y **no valida nada** | `validateCustomizations` recorre una sola raíz, `02-DOCS/wiki/skills/`; `grep -rn brownfield scripts/ package.json` sale vacío. Las 16 reglas de `CONFLICT-RECORD.md` §7 y las 22 propiedades «D» de §5 son **decidibles y no instrumentadas**. Cambio (e) de §6, dueño Etapa 6 |
| 3 | **Cualquier comportamiento de la suite de tests** | Prohibido en esta ejecución: hay una medición de la suite completa corriendo en esta copia de trabajo. No se ejecutó `npm test` ni `node --test` ni ningún `verify.sh` |
| 4 | **Que `verify.sh` sea de verdad de sólo lectura y sin red en las 189 skills que lo traen** | Sólo 21 de los 189 lo declaran en el encabezado del script (medido). La convención está documentada por skill (p. ej. el encabezado de `decision-records/scripts/verify.sh`), pero no está impuesta, y no ejecuté ninguno para comprobarlo |
| 5 | **Que `02-DOCS/wiki/skills/` funcione en un proyecto real** | Exigiría instalar y correr sobre un proyecto consumidor. No hay ninguno en esta carpeta, y crear uno es trabajo de las Etapas 2 y 6 |
| 6 | **El comportamiento del análisis bajo cada asistente** | Exigiría ejecutar clientes reales, que usan la sesión del usuario. §1 lo prohíbe. Mismo límite que L3 de `ARCHITECTURE.md` §9 |
| 7 | **Que `drift:check` siga eximiendo la ruta en modo `knowledge`** | Medido lo contrario, y es un matiz que importa: `drift-check.js`, la exención de `user-project`, exime `user-project` **sólo en modo `catalog`**; en modo `knowledge` «este repo ES el proyecto» y `02-DOCS/…` vuelve a ser una afirmación real. F35 vale para el catálogo. Si el fork llegara a correr `drift:knowledge` sobre su propia wiki, las rutas de ejemplo de estos documentos entrarían como enlaces a comprobar. No lo ejecuté |
| 8 | **Que las citas a `docs/fork/stage1/` sigan apuntando a la línea correcta mañana** — ya no aplica, porque **ya no se cita por línea** | El borrador apostó a remapear y reverificar. La apuesta se perdió: la Etapa 1 volvió a mover `CUSTOMIZATION-SCHEMA.md` después de cerrar la etapa y **35 de sus 36 citas de línea** quedaron desplazadas, varias a filas vecinas que *parecen* plausibles; la que sobrevivió lo hizo por casualidad. Las 31 de `CONTRACT.md`, las 2 de `ARCHITECTURE.md`, las 4 de `EVALUATION.md` y la de `ACCEPTANCE.md` sobrevivieron intactas, comprobadas una por una — pero sobrevivir por suerte no es un método. Toda cita a la Etapa 1, al código y a las skills está ahora en **sección + fragmento** (decisión 16b), así que este riesgo está retirado en lugar de gestionado |
| 9 | **El ejemplo trabajado 1 como medición** | Es mitad medido, mitad fixture. El lado skill está medido y ahora citado por fragmento contra `.rsc/skills/flutter/SKILL.md`; el lado proyecto es sintético por D9 y está marcado `FIXTURE`. **Y el borrador lo tenía mal en un punto:** P3 citaba `:14-15` entrecomillando una frase que sólo está en `:243`, y la regla 4 original lo dejaba pasar. Corregido, y la regla reescrita para que no vuelva a pasar |
| 10 | **Que la transformación desplace exactamente 13 líneas en las 274 skills** | Medido en **dos**, `flutter` (401 → 414) y `decision-records` (203 → 216), ejecutando `transformSkillMd` en lectura. El preámbulo es fijo, así que lo esperable es que sea constante, pero no lo comprobé en las 274 y no lo afirmo como tal |
| 11 | **Que `0.45` sea el umbral correcto y no sólo el que usa el auditor** | Medido: es el que usa `routing-audit.js` en su llamada real, la función por defecto usa `0.5`, y `0.80` es el techo de fallo. A `0.45` salen 46 parejas sobre 65 skills, que es un conjunto manejable. Que `0.45` sea el **mejor** compromiso entre recall y ruido para el análisis brownfield **no está medido**: haría falta contar falsos positivos sobre un catálogo real con conflictos conocidos, y no hay ninguno |

---

## 8. Preguntas abiertas que requieren decisión del usuario

| # | Pregunta | Consecuencia | Recomendación |
|---|---|---|---|
| **1** | El comando que invoca el análisis: ¿confirma el usuario que lo implementa la **Etapa 6**, y con qué nombre? | `PLAN.md` §5 no asignaba dueño. Sin él, el procedimiento es un documento que nadie ejecuta — el mismo defecto que la revisión independiente le encontró al validador de personalizaciones (`LEDGER.md` §2h, E1-R4) | **El coordinador ya decidió: Etapa 6.** Es donde se regenera `.rsc/governance/` en instalación y actualización, y donde ya vive el otro punto de invocación. Queda abierto sólo el **nombre** del comando |
| **2** | ¿Se acepta el cambio (e): extender `scripts/lib/customization-validator.js` a una segunda raíz, `02-DOCS/wiki/brownfield/`? | Sin él, las 16 reglas de `CONFLICT-RECORD.md` §7 y 22 propiedades deterministas de §5 son **decidibles y no instrumentadas**: nada lee el informe de la corrida ni los registros de conflicto. Es, literalmente, «una mitad determinista que nadie ejecuta» | Aceptar, dueño Etapa 6. El módulo y la raíz están nombrados; los puntos de invocación ya existen (`install`/`sync`, y `npm run governance:customizations`), así que el trabajo es ampliar un recorrido, no construir un gate nuevo |
| **3** | ¿Se añade el gate (d) a `EVALUATION.md`, y de dónde salen las ejecuciones? | Hoy el criterio 10 se cierra con G5, que mide *preguntar*. El recall **project↔skill** y la corrección de categoría no los mide nada. El suelo de recall nuevo (propiedad 13a) cierra el eje skill↔skill computable **gratis**, y no toca ninguno de estos dos. D6 fija el techo en ~600 ejecuciones y están repartidas: 181 celdas, 599 asignadas, 1 de holgura | Añadir el gate y **declarar la cobertura pendiente** en vez de bajar los umbrales de G1–G6, que es lo que `PLAN.md` §11 criterio 14 ya exige para este caso. Coste estimado ~48 ejecuciones, que hoy **no existen**: hay que reasignar o declarar |
| **4** | C2 — ¿hay una preferencia del usuario sobre dónde se registran las decisiones brownfield, o se resuelve por proyecto? | Afecta a cada decisión que esta etapa produzca. **Dos** skills instaladas discrepan de verdad sobre la casa de una elección «forward» digna de ADR; las otras casas no están en conflicto, atienden preguntas distintas | Resolver por proyecto leyendo lo que ya existe, que es la **primera coincidencia** de `decision-records/SKILL.md#"**Where to store** (first match wins):"` — y recordando que su rama 2 es `docs/adr/`, el caso central del brownfield. No hace falta decidirlo ahora; hace falta no inventar otra casa |
| **5** | ¿Se acepta que la evidencia se cite por **sección + fragmento** y no por línea, en los cuatro artefactos de producto? | Es el cambio con más superficie de esta corrección. Hace que una cita desplazada **falle en voz alta** en vez de pasar en silencio, que es la clase de error que esta etapa sufrió; el coste es que las citas son más largas y hay que mantener el fragmento literal cuando upstream reescribe una frase | Aceptar. El coste de mantenimiento es real pero visible: si upstream reescribe la frase, la regla 4 falla y alguien lo arregla. El modelo anterior fallaba invisible |
