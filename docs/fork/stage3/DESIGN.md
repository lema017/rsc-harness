# Diseño del análisis brownfield — Etapa 3

Documento interno (español). Los cuatro artefactos de producto de esta etapa van en inglés por D7; este explica por qué son como son.

**Lo que esta etapa entrega:** especificación y diseño. Ni una línea de código. No se tocó `scripts/`, `targets/`, `tests/`, `package.json` ni `skills/`, ni `docs/fork/LEDGER.md` ni `docs/fork/stage1/`.

---

## 1. La tesis del diseño

El análisis brownfield es **casi todo conducta del modelo**. La parte que una máquina puede garantizar es estrecha y se puede nombrar con precisión: *un artefacto mal formado se rechaza*. Nada más.

Eso no es un defecto del diseño; es la consecuencia de F32. La aplicación de una skill no es un evento observable en ningún asistente — cero coincidencias de `Skill` como herramienta o matcher en todo el repositorio (`CONTRACT.md:219`) — así que no existe el punto donde una guarda pudiera interceptar «está a punto de aplicar una skill sin haber analizado el proyecto». Y lo que el código deniega es una llamada a herramienta, que es otro evento.

De ahí la forma de los cuatro documentos: **especifican qué se le pide al modelo, y declaran por separado qué parte queda comprobada por máquina.** Requisito §6 lo exige explícitamente y `CONTRACT.md:20` ya fijó la frontera; esta etapa la respeta en vez de ensancharla.

El peligro concreto que esto evita: escribir «el análisis brownfield garantiza que no se impondrá una migración». No lo garantiza. Lo que se puede garantizar es que *un registro de migración que no diga cuál es el estado actual, cuál el objetivo y que requiere una decisión, no valida* — regla 11 de `CONFLICT-RECORD.md` §7. La diferencia entre esas dos frases es todo el contenido de este diseño.

---

## 2. Decisiones de diseño, una línea de motivo cada una

| # | Decisión | Motivo |
|---|---|---|
| **1** | Los ocho pasos de §7 se conservan numerados 1:1 como B1–B8 | Es la especificación literal; renumerarla u «optimizarla» rompe la trazabilidad con el requisito y con el criterio 10 |
| **2** | Cada paso lleva entradas, salida y **criterio de parada** | Un paso sin criterio de parada es una invitación a leer para siempre, que es el modo de fallo que este procedimiento existe para acotar |
| **3** | Las seis categorías **no se redefinen**: son `CUSTOMIZATION-SCHEMA.md:60-69` tal cual | Un segundo vocabulario para lo mismo es la fuente de verdad duplicada que §5 prohíbe. Lo que falta al esquema se propone como cambio (§6 de este documento), no se duplica |
| **4** | Los siete campos de §7 son del **conflicto**; la categoría es de cada **posición** | El ejemplo del propio §7 lo exige: la pregunta es si BLoC es vigente, legado o migración — tres categorías para *un* lado. Una categoría por conflicto no puede expresarlo |
| **5** | Paso B4 tipa cada afirmación de la skill en requisito · restricción · preferencia · supuesto | Es lo que decide si perder contra el proyecto cuesta una excepción, una deuda, nada, o es una pregunta de alcance. Sin este tipado, una preferencia se convierte en mandato |
| **6** | B5 detecta, B6 resuelve; nunca en el mismo movimiento | Detectar y resolver a la vez es la resolución silenciosa que `CONTRACT.md:156` prohíbe |
| **7** | El test de conflicto es de tres partes (mismo alcance · mismo sujeto · no satisfacibles a la vez) | Convierte «hay conflicto» en algo refutable. Lo que falla una de las tres es **adyacencia**, y la adyacencia no se reporta |
| **8** | Antes de declarar un conflicto skill↔skill se leen las cláusulas `NOT` | 273 de 274 declaran su frontera explícitamente (medido). La mayoría de los solapamientos aparentes ya están resueltos ahí |
| **9** | Los candidatos a competidor se **calculan** con `descriptionCollisions` | Reutiliza código que ya existe y que ya tiene umbral en producción (`routing-audit.js:16`). Un inventario de competidores «por impresión» no es refutable |
| **10** | «Material» se define con cuatro tests (M1–M4), no con adjetivos | §7 dice «ambigüedades materiales» y no lo define. Un adjetivo no es un criterio; y G5 penaliza los dos sentidos, así que hacía falta un filtro aplicable |
| **11** | Las decisiones pendientes bloquean por **alcance ∩ compromiso con una posición** | Hace computable el «bloquean las acciones afectadas, no todo» de §7. Un análisis que lo paraliza todo es un rediseño del harness |
| **12** | El procedimiento se distribuye como documento en `.rsc/governance/brownfield-v1.md`, no como skill nueva | La Estrategia B congela `skills/` byte-idéntico (`ARCHITECTURE.md:24`) y el validador de conformidad exige 274 de 274 (`CONTRACT.md:56`). Una skill 275 mueve las dos cosas |
| **13** | La asimetría con el contrato (que sí necesita el preámbulo porque `.rsc/` no existe en un clon limpio) se declara y se justifica | Este procedimiento nunca se necesita antes de instalar: analiza un proyecto cuyo harness ya está instalado. `CONTRACT.md:18` resolvió el otro caso por una razón que aquí no aplica |
| **14** | El informe de la corrida vive en `02-DOCS/wiki/brownfield/<slug>.md` | Un nivel de subdirectorio, que es lo único que `wiki-protocol.md:82` admite; e indexable en `index.md` como cualquier artículo |
| **15** | La decisión de alcance de skill va en la personalización; la transversal va al log del proyecto y se **cita** | Es la regla que upstream ya escribió: «Link out, do not duplicate» (`codebase-onboarding/SKILL.md:115`). Duplicarla crea las dos fuentes que la regla de documento obsoleto (`CONTRACT.md:134`) castiga |
| **16** | La casa del registro de decisiones **no se elige aquí**: se lee la del proyecto | `decision-records/SKILL.md:40-41` pone «la convención existente del proyecto» como primera coincidencia. Elegir yo una casa sería inventar el log paralelo que `:31` prohíbe |
| **17** | El ciclo de vida se **mapea** a los vocabularios existentes en vez de crear uno | Hay tres en upstream (`draft/approved/superseded`, `proposed/accepted/…`, `selected/deferred/excluded`). Un cuarto sería la deuda que este diseño dice evitar |
| **18** | La revalidación **reporta y propone, nunca aplica** | Es el comportamiento medido de `rsc reassess`: «nothing has been installed» (`rsc.js:368`). Una revalidación que reescribe sola es una re-decisión silenciosa |
| **19** | En greenfield se cierran por regla las categorías que afirman código existente | Convierte «sin inventar evidencia de código existente» (§7) en una comprobación determinista en vez de una aspiración |
| **20** | Las fixtures del ejemplo trabajado se marcan `FIXTURE (synthetic, D9)` | D9 ya decidió que las fixtures brownfield son sintéticas. Marcarlas evita que un revisor las lea como medición, que sería inventar evidencia en el documento que prohíbe inventarla |

---

## 3. Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| **Una skill nueva `brownfield` en `skills/`** | Rompe la invariante byte-idéntica (`ARCHITECTURE.md:24`) y el conteo 274/274 del validador (`CONTRACT.md:56`). Además `origin:` es `risco` en las 274 (medido), así que no hay identificador que distinga una skill propia del fork de una de upstream, que es el mismo problema que hace peligroso el renombrado |
| **Extender `skills/analyze` con un séptimo análisis** | Misma rotura de la invariante, y conceptualmente falso: `analyze` nunca abre un archivo de código (`analyze/SKILL.md:16`) y su unidad de entrada son cuatro documentos SDD (`:28-33`). El brownfield lee código contra skills. Serían dos trabajos en una puerta, y la puerta dejaría de ser lo que su descripción promete |
| **Una categoría por conflicto en vez de por posición** | No puede expresar el propio ejemplo de §7. Y colapsaría los dos casos del ejemplo trabajado 1 (31 archivos `observed pattern` + 3 `debt`) en una fila, lo que autorizaría refactorizar los tres sin que nadie lo aprobara |
| **Un log de decisiones brownfield propio** | Lo prohíbe `decision-records/SKILL.md:31` literalmente. Y habría sido el cuarto log en un proyecto que ya tiene tres que no se ponen de acuerdo — el conflicto C2 que esta etapa reporta en vez de agravar |
| **Resolver C2 (qué log es el canónico) en este documento** | Me faltaba el único dato que lo decide: qué log tiene ya el proyecto. Resolverlo aquí sería elegir un lado, que es exactamente lo que `CONTRACT.md:156` prohíbe. Queda `pending-decision` con su recomendación |
| **Un hook que deniegue aplicar una skill sin análisis previo** | F32: no hay evento observable al que enganchar. Especificar el matcher sería una elección de diseño presentada como hecho, que es lo que L3 de `ARCHITECTURE.md:273` ya declaró como no verificable |
| **Exigir que todo conflicto se resuelva antes de empezar** | Lo prohíbe §7 («bloquean las acciones afectadas, no todo el trabajo independiente») y sería un rediseño del harness. El bloqueo por alcance ∩ posición es la alternativa que conserva el trabajo independiente |
| **Analizar las 274 skills en cada corrida** | `PLAN.md` §4 limita la operación a las seleccionadas. Y `CONTRACT.md:175-186` (carga progresiva) lo prohíbe por coste: nada instruye a cargar todas las personalizaciones de golpe |
| **Escribir personalizaciones automáticamente donde se detecte un patrón** | `PLAN.md` §4: una personalización inventada a partir de una conjetura congela deuda técnica como si fuera decisión, que es peor que no tener ninguna. Cada escritura es una propuesta que el usuario aprueba |
| **Severidad (CRITICAL/HIGH/…) como campo de impacto** | §7 pide **impacto**, no ranking. «HIGH» no dice qué pasa. La severidad de `analyze/SKILL.md:67-74` se conserva para triaje del informe, separada del campo `Impact`, que se escribe como una acción |

---

## 4. Qué se reutiliza de upstream, con `archivo:línea`

Un requisito del usuario es preservar las funciones originales del harness. Nada de lo siguiente se reimplementa.

| Mecanismo upstream | Dónde | Para qué lo usa este diseño |
|---|---|---|
| `detectRepoProfile()` | `scripts/detect-repo.js:46-86` | Mitad determinista de B2: stacks, gestores, scripts, runners, monorepo y señales. Entra como **hecho**, nunca como categoría: detecta por presencia de archivo y no distingue convención de accidente (`CUSTOMIZATION-SCHEMA.md:71`) |
| `scanProject()` | `scripts/lib/onboarding.js:78` | `sourceFileCount` y `signals` son el discriminador greenfield/brownfield de B2 y §3 de `BROWNFIELD.md` |
| `recommendDeferredComponents()` | `scripts/lib/onboarding.js:391-424` | Disparador de revalidación «el proyecto cambió»: compara `sourceFileCount`, manifiestos y señales de complejidad contra la línea base aceptada |
| Estados `selected`/`deferred`/`excluded` + `reevaluateWhen` + `triggerRules` | `scripts/lib/onboarding.js:194-200` | Vocabulario del ciclo de vida y de la condición de revisión. `reevaluateWhen` es el nombre que se propone reutilizar en el esquema |
| `rsc reassess` → `runReassessment()` | `scripts/rsc.js:789`, `:355-375` | Precedente de comportamiento: reporta, propone, **no instala** (`:368`) |
| `descriptionCollisions()` | `scripts/lib/text-rank.js:102-112` | Conjunto candidato de skills competidoras en B1, calculado |
| Umbral de colisión `0.80` | `scripts/routing-audit.js:16` | Referencia de umbral ya en producción, en vez de inventar uno |
| `.rsc.json` claves `skills`/`ownSkills`/`targets`/`catalogVersion` | `scripts/lib/manifest-file.js:18` | Fuente del inventario B1, y `catalogVersion` como granularidad honesta para la clave de versión revisada |
| `.rsc/skills/<id>/` como única copia real | `targets/index.js:9-13` | Lo que B1 inventaría y B3 lee; ningún asistente lee `skills/` |
| Catálogo de sólo lectura, personalización en `02-DOCS` | `scripts/install-apply.js:58` | Confirma que la dirección del diseño es la que el instalador ya declara |
| `skills/codebase-onboarding` + `CODEBASE-MAP.md` | `SKILL.md:17`, reglas `:35-36`, pasada `:38`, esfuerzo `:76-82`, commit `:113` | B2 **consume** el mapa si existe y **delega** en la skill si no. No se reespecifica un método de reconocimiento |
| «Link out, do not duplicate» | `skills/codebase-onboarding/SKILL.md:115` | La regla que separa el *qué es* (mapa, patrón observado) del *por qué* (ADR, convención aprobada) |
| `skills/decision-records` | `SKILL.md:31`, `:40-43`, `:57`, `:164-168`, `:170-176` | Casa, nombrado, espina MADR, ciclo de estados y ritual de supersesión. Nada de eso se redefine |
| `02-DOCS/wiki/harness/decisions.md` formato `D-NNNN` con `supersedes:` | `skills/init/references/accompaniment-and-profile.md:87-108`; comprobación en `skills/init/scripts/verify.sh:62,87` | Una de las tres casas del enrutado; y la única con código detrás (un `warn`, no un fallo) |
| Triaje `resolved-internally` / `inferable` / `must-ask` | `skills/clarify/SKILL.md:79` | Los tres cubos de `QUESTIONS.md` §3, con sus nombres originales |
| Disciplina de pregunta (un lote, ranking por leverage, recomendación propia, no preguntar y responder en el mismo turno) | `skills/clarify/SKILL.md:81`, `:85`, `:87`, `:125` | `QUESTIONS.md` §4 y §6 |
| «Declarar el destino de cada entrada» | `skills/clarify/SKILL.md:43-45` | Cada candidato de B5 aparece en el informe con su destino; ninguno se cae en silencio |
| Regla absoluta «reportar, no resolver» + escala de severidad + `result-envelope` | `skills/analyze/SKILL.md:16`, `:67-74`, `:104-118` | B5/B6, el triaje del informe y el bloque parseable de cierre |
| Ratificación explícita y log de enmiendas append-only | `skills/constitution/SKILL.md:97`, `references/constitution-template.md:85` | Por qué una constitución `draft` no resuelve nada en B6, y por qué el análisis propone enmiendas sin escribirlas |
| Tabla de enrutado «tipo → casa exacta → quién escribe» | `skills/continuous-learning/SKILL.md:45-53`, `references/lesson-routing.md:64`, `:68-75` | La forma de la tabla de `DECISIONS.md` §2 |
| Protocolo wiki: un nivel, OKF v0.1, `type:` no vacío, enlaces markdown | `skills/harness/references/wiki-protocol.md:82`, `:839-840`, `:856-858`, `:866` | Donde vive el informe, y el hallazgo del `type:` que falta al esquema |

**Lo que se añade, que es poco a propósito:** el test de conflicto de tres partes, el tipado de B4 en cuatro clases, los cuatro tests de materialidad M1–M4, la regla de bloqueo por alcance ∩ posición, la puerta de categorías en greenfield, y el campo `Confidence` con su falsificador. Todo lo demás es composición de piezas existentes.

---

## 5. Comprobable de forma determinista frente a dependiente del modelo

Ésta es la tabla que §6 del requisito exige por separado y que `CONTRACT.md:203-234` ya empezó. **D** = un validador da el mismo veredicto con la misma entrada. **M** = conducta del modelo. **E** = medido por evaluación con intervalo.

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
| 11 | Toda referencia de evidencia resuelve a un archivo existente, y la línea citada existe | **D** | Regla 4. Determinista y barata |
| 12 | La categoría asignada es la **correcta** (aprobada vs observada) | **M** | Es un juicio sobre si hay ratificación. Es la distinción que hace valioso el esquema (`CUSTOMIZATION-SCHEMA.md:71`) y la que ninguna máquina puede tomar |
| 13 | Un conflicto que existe **fue detectado** (recall) | **ninguna** | Invisible por construcción: una corrida que no encuentra nada produce cero registros y pasa las catorce reglas. Es el hueco más grande del diseño y se declara como tal |
| 14 | `Confidence` ∈ {high, medium, low} y lleva falsificador | **D** | Regla 6 |
| 15 | El valor de `Confidence` es **honesto** | **M** | Inverificable |
| 16 | ≥2 alternativas, y la recomendación es una de ellas | **D** | Reglas 7–8 |
| 17 | Una posición `migration` declara estado actual, objetivo y que requiere decisión | **D** | Regla 11; `CUSTOMIZATION-SCHEMA.md:85` |
| 18 | Una migración **no se ejecuta** por haberla detectado | **M** | Nada lo impide. `CONTRACT.md:145` lo instruye; F32 impide imponerlo |
| 19 | Ninguna decisión pretende desactivar un permiso o guarda | **D** | Regla 12; `CUSTOMIZATION-SCHEMA.md:86` |
| 20 | Un `resolved-by-decision` cita archivo **y** sección | **D** | Regla 10 |
| 21 | La decisión citada **cubría** de verdad el alcance del conflicto | **M** | Requiere leer dos alcances y compararlos semánticamente |
| 22 | Una constitución o personalización `draft` **no** resuelve | **D** parcial | El `status` es comprobable; que el modelo respete la consecuencia es G4 (**E**, ≥95 %) |
| 23 | Precedencia constitución > personalización, con excepción registrada | **E** | G4, ≥ 95 %, ninguna celda en fallo (`EVALUATION.md:206`) |
| 24 | Se pregunta cuando falta evidencia, y **no** cuando ya estaba documentada | **E** | G5, ≥ 85 %, los dos modos (`EVALUATION.md:209`). Único gate que toca esta etapa |
| 25 | El sobre-preguntar queda detectado | **E** solamente | Ningún validador lo ve: cuarenta preguntas bien formadas pasan todas las reglas |
| 26 | Las pendientes bloquean sólo las acciones afectadas | **D** parcial | El conjunto bloqueado es computable desde `Scope`. Que el modelo no se bloquee de más es **M** |
| 27 | Toda decisión escrita lleva condición de revalidación | **D** | Tras el cambio (b) de §6; hoy no hay clave donde ponerla |
| 28 | Greenfield no emite `observed pattern`, `debt` ni `migration` | **D** | Regla 13 + el discriminador `sourceFileCount`. Comprobación nueva y barata |
| 29 | La personalización de una skill eliminada sobrevive y se reporta huérfana | **D** | Criterio 12; `CUSTOMIZATION-SCHEMA.md:107-111` |
| 30 | Un renombrado no se aplica en silencio | **D** | Criterio 12. Determinista porque no hay identificador estable: `origin: risco` en las 274, verificado |
| 31 | El archivo escrito es OKF-conforme dentro del bundle `wiki/` | **ninguna hoy** | No existe validador OKF en `scripts/` (verificado) y al esquema le falta `type:`. Cambio (c) de §6 |
| 32 | El informe existe y está indexado en `02-DOCS/wiki/index.md` | **D** | Presencia de archivo y de fila |

**Recuento: 17 propiedades deterministas, 8 dependientes del modelo, 4 medidas por evaluación, 3 sin instrumento posible** (3, 13, 31 — y la 31 sólo hasta que se acepte el cambio (c)).

**La línea que no se cruza.** La propiedad 13 es la que un lector apresurado podría leer como cubierta por las otras treinta. No lo está. Un análisis que no encuentra nada es indistinguible, para todo instrumento de este diseño, de un proyecto sin nada que encontrar. Por eso `BROWNFIELD.md` §5 lo dice en el documento de producto y no sólo aquí, y por eso §6 propone el gate que falta en vez de dejar que el recuento de reglas insinúe una cobertura que no hay.

---

## 6. Cambios propuestos a artefactos de la Etapa 1

Propuestos como cambios, no duplicados. La Etapa 1 es dueña de los dos archivos.

| # | Archivo | Cambio | Por qué |
|---|---|---|---|
| **(a)** | `CUSTOMIZATION-SCHEMA.md` §1 | Clave `catalog-version` (o `skill-version`) | §8 pide «skill y versión o commit revisado» y el esquema no tiene hueco. Sin ella, el disparador «la skill cambió» no tiene con qué comparar. `catalogVersion` ya está en `.rsc.json` (`manifest-file.js:18`); un digest de contenido por skill sería mejor y **no existe** — `governance-digest` resume el preámbulo, no la skill (`CONTRACT.md:36`), y crearlo es trabajo del transformador (Etapa 4) |
| **(b)** | `CUSTOMIZATION-SCHEMA.md` §1 | Clave `reevaluate-when` | §8 pide «fecha y condiciones de revisión»; `updated` da la fecha, no la condición. El nombre reutiliza `reevaluateWhen` (`onboarding.js:196-197`), que ya tiene evaluador (`:391-424`) |
| **(c)** | `CUSTOMIZATION-SCHEMA.md` §1 | Clave `type:` no vacía | `02-DOCS/wiki/` es un bundle OKF v0.1 donde todo `.md` no reservado la necesita (`wiki-protocol.md:839-840`); sólo `index.md` y `log.md` están exentos (`:856-858`), y `README.md` no lo está. Tal como está, el esquema produce un archivo no conforme dentro de un bundle conforme, y **ningún validador lo detecta** |
| **(d)** | `EVALUATION.md` | Un gate para el recall de detección de conflictos y otro para la corrección de categoría | Las propiedades 13 y 12 de §5 no las mide nada. Sin esto, el criterio 10 se cierra con G5, que mide preguntar, no detectar |

Las tres primeras son claves planas y aditivas, que es lo que exige el parser de frontmatter escrito a mano (`CONTRACT.md:26`).

---

## 7. Lo que no pude verificar, y por qué

| # | No verificado | Motivo |
|---|---|---|
| 1 | **Que los validadores de `CONFLICT-RECORD.md` §7 pasen sobre un archivo real** | No existen: esta etapa entrega especificación, no código, y escribir código colisionaría con las Etapas 2 y 4 |
| 2 | **Que `npm run gate` exista** — y **no existe** | Verificado negativamente por mi cuenta: `package.json` no define script `gate` (los 14 que define son otros). Durante esta ejecución la Etapa 1 corrigió `CUSTOMIZATION-SCHEMA.md:96` para decir lo mismo y asignarlo a la **Etapa 6**. Los artefactos de esta etapa se validan en ese punto, así que heredan la dependencia |
| 3 | **Cualquier comportamiento de la suite de tests** | Prohibido en esta ejecución: hay una medición de la suite completa corriendo en esta copia de trabajo. No se ejecutó `npm test` ni `node --test` ni ningún `verify.sh` |
| 4 | **Que `verify.sh` sea de verdad de sólo lectura y sin red en las 189 skills que lo traen** | Sólo 21 de los 189 lo declaran en el encabezado del script (medido). La convención está documentada por skill (p. ej. `decision-records/SKILL.md:202`), pero no está impuesta, y no ejecuté ninguno para comprobarlo |
| 5 | **Que `02-DOCS/wiki/skills/` funcione en un proyecto real** | Exigiría instalar y correr sobre un proyecto consumidor. No hay ninguno en esta carpeta, y crear uno es trabajo de las Etapas 2 y 6 |
| 6 | **El comportamiento del análisis bajo cada asistente** | Exigiría ejecutar clientes reales, que usan la sesión del usuario. §1 lo prohíbe. Mismo límite que L3 de `ARCHITECTURE.md:273` |
| 7 | **Que `drift:check` siga eximiendo la ruta en modo `knowledge`** | Medido lo contrario, y es un matiz que importa: `drift-check.js:134` exime `user-project` **sólo en modo `catalog`**; en modo `knowledge` «este repo ES el proyecto» y `02-DOCS/…` vuelve a ser una afirmación real. F35 vale para el catálogo. Si el fork llegara a correr `drift:knowledge` sobre su propia wiki, las rutas de ejemplo de estos documentos entrarían como enlaces a comprobar. No lo ejecuté |
| 8 | **El ejemplo trabajado 1 como medición** | Es mitad medido, mitad fixture: las posiciones de la skill están en `skills/flutter/SKILL.md:12,14,243`; las del proyecto son sintéticas por D9 y están marcadas `FIXTURE` |

---

## 8. Preguntas abiertas que requieren decisión del usuario

| # | Pregunta | Consecuencia | Recomendación |
|---|---|---|---|
| **1** | ¿Qué etapa implementa el comando que invoca el análisis, y cómo se llama? | `PLAN.md` §5 no asigna dueño. Sin él, el procedimiento es un documento que nadie ejecuta — el mismo defecto que la revisión independiente le encontró al validador de personalizaciones (`LEDGER.md:850`) | Que lo tome la Etapa 6 con la distribución, porque es ahí donde se regenera `.rsc/governance/` en instalación y actualización — y porque la Etapa 1 acaba de asignarle a la 6 el otro punto de invocación, `npm run gate` (`CUSTOMIZATION-SCHEMA.md:96`) |
| **2** | ¿Se aceptan los cambios (a), (b) y (c) a `CUSTOMIZATION-SCHEMA.md`? | Sin (a) y (b), el requisito §8 queda incompleto en los dos campos que sirven para revalidar, y el criterio 10 se cierra con un archivo que no sabe cuándo revisarse. Sin (c), cada personalización es un archivo no conforme dentro de un bundle OKF y nadie se enterará | Aceptar las tres. Son claves planas, aditivas, y ninguna cambia el significado del contrato, así que `governance: v1` no se mueve (`CONTRACT.md:34`) |
| **3** | ¿Se añade el gate (d) a `EVALUATION.md`, y de dónde salen las ejecuciones? | Hoy el criterio 10 se cierra con G5, que mide *preguntar*. El recall de detección y la corrección de categoría no los mide nada. Pero D6 fija el techo en ~600 ejecuciones y ya están asignadas | Añadir el gate y **declarar la cobertura pendiente** en vez de bajar los umbrales de G1–G6, que es lo que `PLAN.md` §11 criterio 14 ya exige para este caso |
| **4** | C2 — ¿hay una preferencia del usuario sobre dónde se registran las decisiones brownfield, o se resuelve por proyecto? | Afecta a cada decisión que esta etapa produzca. Tres skills instaladas apuntan a tres casas distintas, todas correctas dentro de su propia skill | Resolver por proyecto leyendo lo que ya existe, que es la regla de `decision-records/SKILL.md:40-41`. No hace falta decidirlo ahora; hace falta no inventar una cuarta casa |
