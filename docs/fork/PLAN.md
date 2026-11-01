# PLAN — Fork de `rsc-harness` con gobernanza uniforme

Instrumento de aprobación de §14. Redactado en español porque es el idioma de interlocución; **todos los artefactos del producto irán en inglés** (D7).

Fuentes: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · [`LEDGER.md`](./LEDGER.md) · auditoría en [`audit/`](./audit/).

---

## 1. Evidencia y commit base

| Campo | Valor |
|---|---|
| Commit base de upstream | `6f7edd31d109b7f0211d637e2d084724f6dd8e26` |
| Release | `@ericrisco/rsc@3.7.1`, 2026-10-31 20:42 UTC |
| Carpeta de trabajo | `/Users/home/Development/rsc-harness-fork` |
| Catálogo | **274 skills**, 1 679 archivos, 11,55 MiB, 100 % con `evals/cases.yaml` |
| Asistentes en `SPEC` | **18** |
| Suite de tests | **1 537 tests, 2 h 16 m 55 s**, sin fallos imputables a upstream |

La auditoría se hizo en cinco frentes con revisión independiente de dos fases (§12): cuatro tracks de autoría más un revisor que redactó su Fase 1 sin ver ninguna conclusión ajena. El revisor corrigió a los cuatro tracks y al coordinador; el coordinador corrigió al revisor en un punto (R8). Todo queda trazado en el ledger separando **hecho comprobado por ejecución**, **inferencia por lectura** y **no verificado**.

---

## 2. Compatibilidad de licencias

**Sin bloqueo.** Repositorio MIT (© 2026 Eric Risco). Terceros: seis componentes MIT y uno Apache-2.0 (documentos de referencia de `design` derivados de *impeccable*). Ambas licencias permiten modificar, redistribuir y publicar el fork con otro nombre y otro paquete.

Obligaciones incorporadas a los criterios de aceptación:

1. Conservar íntegros y dentro del tarball: `LICENSE`, `skills/design/engine/LICENSE`, `skills/design/IMPECCABLE-LICENSE.txt`, `skills/design/THIRD_PARTY.md`, `skills/ux/THIRD_PARTY.md`, `skills/ux/upstream/*/LICENSE` y los `UPSTREAM.json`.
2. Conservar el copyright de Eric Risco; añadir el del fork como adicional, nunca sustitutivo.
3. **Apache-2.0 §4(b):** si se modifican los archivos derivados de *impeccable*, deben llevar aviso prominente de modificación. La estrategia recomendada lo evita por construcción.
4. **Apache-2.0 §6:** sin derechos de marca. El renombrado a `@lema017/rsc-governed` / `rscg` es coherente.
5. **Corregir la tabla de terceros del README**: acreditar `szilu/ux-designer-skill` y `hueyexe/frontend-agent-skills` (hoy sólo en `skills/ux/THIRD_PARTY.md`).
6. Añadir una nota explicando por qué `schema/ecc-originality.u64` no requiere licencia de terceros (son huellas SHA-256 truncadas e irreversibles, con fuente y revisión acreditadas; ver R8).

---

## 3. Comparación arquitectónica y recomendación

### Las dos estrategias

- **A — edición directa:** modificar los `SKILL.md` del fork para incorporar el contrato.
- **B — snapshot intacto + transformación generada:** mantener `skills/` como espejo del commit de upstream incorporado y aplicar la gobernanza mediante una transformación determinista e idempotente en build/instalación.

### Evaluación contra los ocho criterios de §4

| Criterio | A — edición directa | B — transformación generada |
|---|---|---|
| **Conflictos al incorporar upstream** | ❌ Peor caso. Cada skill editada es un conflicto potencial en cada merge mensual. Con 274 skills y un upstream que publicó 178 versiones, el coste de mantenimiento crece sin techo. | ✅ Decisivo. `skills/` se fusiona limpio porque la gobernanza no vive ahí. Los conflictos se limitan al transformador. |
| **Auditabilidad frente al padre** | ❌ `git diff upstream -- skills/` mezcla cambios de upstream con los del fork; separar ambos exige revisión manual. | ✅ El diff contra upstream en `skills/` queda vacío salvo el renombrado de identidad, que es mecánico y verificable. Toda divergencia está en el transformador y su salida. |
| **Idempotencia y reproducibilidad** | ⚠️ Depende de la disciplina humana; una edición repetida puede duplicar texto. | ✅ Función pura `(snapshot, config) → salida gobernada`. Verificable re-ejecutando y comparando bytes. |
| **Integridad de referencias, scripts y metadatos** | ⚠️ 3 854 referencias de ruta en riesgo con cada edición manual. | ✅ El transformador edita contenido **en el sitio**, nunca mueve ni renombra (A7), así que es neutro respecto a las referencias. `manifest.json` no lleva hashes de contenido (A1) y el esquema de frontmatter es abierto (A6). |
| **Cobertura de invocación** | ⚠️ Cubre lo editado; las skills nuevas de upstream llegan sin contrato. | ✅ Cubre por construcción toda skill distribuida, incluidas las nuevas de cada mantenimiento — exactamente lo que pide §9.6. |
| **Compatibilidad entre asistentes** | = Igual en ambas: el límite lo pone el proveedor, no la estrategia. | = Igual. El preámbulo viaja en el `SKILL.md` distribuido, que es lo único que llega a los 5 destinos (incluido Cursor, que sólo copia ese archivo). |
| **Coste de contexto** | = Igual por skill. | ✅ Mejor: permite inyectar un preámbulo compacto **por skill**, pagado sólo al cargarla, en vez de gastar el cuerpo always-on, que se paga **cada turno** y tiene **2 bytes** de holgura (R1). |
| **Facilidad de probar, actualizar y recuperar** | ⚠️ No hay artefacto único que validar. | ✅ Un validador determinista comprueba que **toda** skill distribuida porta el contrato; regenerar es recuperar. |

### Dos restricciones duras que la estrategia debe respetar

1. **Excluir los subárboles vendorizados.** `skills/ux/upstream/**` está fijado por sha256 por archivo **y por lista de archivos** (`tests/ux-upstream.test.js`); `skills/design/engine/**` no está fijado por hash pero arrastra una afirmación de atribución «unmodified». Ambos contienen **cero** referencias de identidad del padre (verificado por el coordinador y por el revisor), así que excluirlos no deja nada sin renombrar. Compatible con las obligaciones de licencia 1 y 3.
2. **El renombrado de identidad forma parte de la misma transformación.** Hay 85 referencias al padre dentro de `skills/` (10 en el cuerpo always-on, 8 en `cases.yaml` que controlan CI), así que la identidad byte-a-byte perfecta es imposible y §10 exige cambiarla. Se resuelve con un paso mecánico y auditable del mismo transformador, no con ediciones a mano.

### Recomendación

**Estrategia B, con el renombrado de identidad integrado y los dos subárboles vendorizados excluidos.**

El argumento decisivo es el mantenimiento mensual de §9: con 274 skills y un upstream muy activo, A convierte cada integración en una negociación de conflictos sobre cientos de archivos, mientras B la reduce a un merge limpio más una re-ejecución del transformador. El segundo argumento es que B satisface §9.6 por construcción —ninguna skill nueva puede llegar sin contrato— y el tercero es que confina el deber de aviso de Apache-2.0 al artefacto generado.

**Dónde vive el contrato, dado R1.** No en el cuerpo always-on: 2 bytes de holgura lo descartan. El diseño propuesto:

- **Canal primario:** preámbulo de gobernanza compacto inyectado por el transformador en cada `SKILL.md` distribuido (excluidos los subárboles congelados), más una clave propia en el frontmatter, que el esquema abierto admite (A6). Se paga sólo al cargar la skill y llega a los 5 destinos.
- **Contrato completo:** un documento versionado único bajo `.rsc/`, referenciado por puntero, con carga progresiva de contexto (§6).
- **Imposición por código:** donde existe un hook real y cableado. Hoy eso es **Claude Code** (R4). Cablear `codex`, `cursor` y `deepseek` es trabajo del fork y se intentará; `antigravity` no tiene mecanismo de proveedor y quedará declarado como sólo-instrucción.
- **El tope del cuerpo always-on no se eleva salvo necesidad demostrada**, y si se eleva será con medición y justificación escritas, como pide el comentario del propio test.

---

## 4. Alcance y exclusiones

### Dentro del alcance

- Fork público `lema017/rsc-harness`, paquete `@lema017/rsc-governed`, CLI `rscg`.
- Contrato de gobernanza versionado y uniforme (§6) aplicado a las 274 skills por transformación.
- Personalización por proyecto en `02-DOCS/wiki/skills/<nombre>/README.md`, ruta **fija** (el condicional de §5 es inerte: C1).
- Análisis brownfield operativo (§7) con registro de decisiones (§8).
- **Dos máquinas separadas, que el diseño no debe confundir.** El mantenimiento de §9 corre en el repositorio del fork, no conoce ningún proyecto consumidor y por tanto **no genera documentación de personalización para nadie**: produce un paquete. El análisis brownfield de §7 corre **en el proyecto**, sobre su código.
- **La instalación no genera personalizaciones en masa.** Sigue siendo determinista y rápida — hoy `detectRepoProfile` sólo detecta stacks, gestores, scripts, runners y monorepo por presencia de archivos, y `install-apply.js:58` ya declara que el catálogo es de sólo lectura porque «user customization lives in 02-DOCS». El análisis brownfield es una operación **aparte**, ofrecida al terminar la instalación e invocable cuando se quiera, limitada a las skills seleccionadas. Escribe una personalización **sólo donde hay evidencia** de conflicto real o convención aprobada, y cada escritura es una **propuesta que el usuario aprueba**: una personalización inventada a partir de una conjetura congelaría deuda técnica como si fuera decisión, que es peor que no tener ninguna.
- **Precedencia entre la constitución y la personalización por skill**, que §6 exige fijar. `02-DOCS/wiki/sdd/constitution.md` es la decisión **general** del proyecto; `02-DOCS/wiki/skills/<nombre>/README.md` es la **específica** de una skill. La específica manda dentro del alcance que documenta, pero **no puede contradecir en silencio** una regla constitucional ratificada: una contradicción es una **excepción**, se registra como tal con su justificación. Además, la constitución que escribe el onboarding es un **borrador** (`status: draft`, ratificada después por la fase `constitution` con el usuario delante), así que el paso de adaptación se **ofrece tras aceptar el plan y se vuelve a ofrecer tras la ratificación**, que es cuando la ley general existe de verdad.
- **La adaptación es incremental, no un acto único.** En un proyecto nuevo apenas hay evidencia que analizar, así que las pocas personalizaciones que se escriban vendrán de la intención declarada en la conversación, no del código. El valor se concentra en brownfield y se acumula con el tiempo, reutilizando el mecanismo que ya existe (`recommendDeferredComponents` reevalúa lo diferido cuando aparece evidencia nueva), como pide §8.
- **Corrección de B-R1:** excluir por código la ruta estándar de cualquier `checkout`/`rm`/push de knowledge-sync, con test negativo.
- **Corrección de R5:** extender `KEYS` de `.rsc.json` y detectar la pérdida de clave.
- **Corrección de B-R2:** identidad propia en `clone-bootstrap` y en los otros tres puntos ejecutables.
- **Construcción de B-R6:** staging y puerta de activación real, con lock, para eliminar las carreras.
- Punto de entrada de mantenimiento manual reanudable (§9).
- **Las cuatro clases de cambio de upstream** tratadas explícitamente por el mantenimiento: skill **añadida** (contrato por construcción, evaluación obligatoria), **modificada** (reinyección idempotente y reevaluación), **eliminada** (el fork sigue a upstream: la skill desaparece de `skills/`, del paquete y de `.rsc/skills/<id>/` del consumidor en la siguiente actualización. Conservarla exigiría adoptarla como propia del fork, que es una decisión explícita y no el comportamiento por defecto. Su personalización **queda huérfana y se reporta, nunca se borra**) y **renombrada** (el caso peligroso: `origin: risco` es constante en las 274, así que **no hay identificador estable**; se detecta por similitud de Git y **se confirma a mano**, porque aplicarlo en silencio dejaría la personalización indexada por el nombre viejo sin consultarse nunca).
- Actualización automática de consumidores desde el paquete del fork (§10).
- README con dos imágenes versionadas y fuentes editables (§13).
- Extensión documentada del protocolo wiki de un solo nivel para admitir `wiki/skills/<nombre>/`.

### Fuera del alcance (exclusiones explícitas)

- Gobernanza con garantías en los 13 asistentes no elegidos: siguen como upstream, sin afirmaciones.
- Validación por ejecución en Windows: no hay entorno; se registra como limitación residual (la ruta de Windows copia archivos en vez de enlazar).
- Arreglar la deuda heredada ajena al fork: `routing:audit` rojo al 84,9 % y `reviewer-guard.sh` vestigial se **registran** y se decide en la Etapa 1 si se adoptan como puerta.
- **Mejora del refinamiento de preguntas en `clarify` e `idea-refinement`** (método de árbol y frontera de `grilling`). **Aplazado por decisión del usuario**, lo abordará él más adelante. Con ello se excluye también el **mecanismo de overlays por skill**, que existía sólo para este uso y es el único punto donde la Estrategia B se acercaría a la A: sin consumidor no se construye. El análisis completo y el diseño del mecanismo quedan en el ledger para cuando se retome.
- Contribuir cambios a upstream.
- Cualquier servicio externo de pago (D9).

---

## 5. Etapas, agentes y dependencias

Un responsable y un **revisor distinto** por etapa (§12). El coordinador lanza cada agente y reconstruye su contexto desde los artefactos; no se asume persistencia de subagentes ni que puedan crear otros.

| Etapa | Contenido | Depende de | Paralelizable |
|---|---|---|---|
| **0** | Auditoría, licencias, alternativas, preguntas y plan | — | ✅ hecha |
| **1** | Arquitectura, contrato versionado, presupuesto de evaluaciones y criterios de aceptación | 0 | no |
| **2** | Consulta de personalizaciones e integración con los 5 asistentes | 1 | con 3 |
| **3** | Análisis brownfield y registro de decisiones | 1 | con 2 |
| **4** | Conformidad del catálogo mediante el transformador | 1 | tras 2 |
| **5** | Mantenimiento manual de upstream | 1, 4 | con 6 |
| **6** | Distribución, actualización y recuperación | 1, 4 | con 5 |
| **7** | README, imágenes y documentación | 2–6 | no |
| **8** | Validación independiente y entrega | todas | no |

**Primer paso de la Etapa 1, antes de cualquier push (R6):** corregir el disparador y la identidad de `release.yml` y la regla `docs/` de `.gitignore` en el mismo commit que reconfigura los remotos. Verificar con `git check-ignore`, no leyendo el patrón.

---

## 6. Decisiones y supuestos

Decisiones D1–D9 en el ledger. Supuestos que se declaran como tales:

- La línea base de tests se considera verde: los 39 fallos observados fueron 28 artefactos de concurrencia, 3 de aislamiento y 8 con causa no aislada por carga de máquina. **Se re-medirá en máquina descargada al inicio de la Etapa 1**; si algo reprodujera, pasa a bloqueo registrado.
- El transformador puede inyectar en `SKILL.md` sin romper la rúbrica. **A validar en la Etapa 1** sobre una muestra antes de aplicarlo al catálogo.
- Cablear hooks en `codex`, `cursor` y `deepseek` es viable con los mecanismos documentados por sus proveedores. **Supuesto, no hecho**: dos elementos de la tabla de hooks son de segunda mano (C: Windsurf vía Wayback, Continue vía issue). Se verificará contra documentación vigente en la Etapa 2.

---

## 7. Estrategia de pruebas y presupuesto

### Validadores deterministas (conformidad del catálogo completo)

Se reutilizan los 8 existentes y se añaden los que faltan: conformidad del contrato en toda skill distribuida, idempotencia del transformador (doble ejecución byte-idéntica), integridad de licencias y avisos en el tarball, preservación de la ruta estándar, y detección de identidad del padre en artefactos generados.

Se corrigen tres defectos heredados: `eval-lint.sh` **falla en abierto** (274 SKIPs y PASS), tres validadores son **vacuos** en clon limpio, y 6 de 12 comprobaciones **no corren en ningún workflow**.

### Pruebas exigidas por §11

Las 13 áreas de §11, hoy 4 existentes, 8 parciales y 1 ausente. Prioridad máxima a lo no cubierto: **personalización presente/ausente (hoy cero tests)**, prevención de reinstalación del padre, conflicto funcional, concurrencia y recuperación, clon limpio, idempotencia, documento ilegible o contradictorio, precedencia y alcance, monorepos, y transición desde documentación histórica.

Fixtures brownfield **sintéticas** (D9), extendiendo el precedente `team()` de `tests/knowledge-sync.test.js:27`: estándares contrarios al default, patrones mezclados, migración en curso, documentación ausente y desactualizada, conflictos entre skills, y un proyecto sin conflictos. Pruebas negativas y casos reservados que no guíen la implementación.

### Presupuesto de evaluaciones semánticas (D6)

| Elemento | Valor |
|---|---|
| Límite aprobado | **~600 ejecuciones de agente** |
| Repeticiones | **N=3** |
| Conjunto interno | **27 skills** (R2) → 40 escenarios → **147 ejecuciones** |
| Muestra estratificada | ~30 skills, selección **reproducible y con semilla** → ~300 ejecuciones |
| Reserva | bucle de corrección y reintentos, dentro del límite |
| Coste monetario | **ninguno**: corre sobre los agentes de la sesión (D5/§11) |

La Etapa 1 define casos, rúbricas, umbrales, fallos críticos que bloquean promoción, selección reproducible, modelos y configuración, límites de duración y reintentos, y tratamiento de resultados inconclusos — **todo dentro de este límite**. Si no alcanza, se registra la cobertura pendiente **sin bajar umbrales ni exceder el límite**, y no se marca como aprobado lo no verificado.

**Restricción operativa:** la suite tarda 2 h 17 m. CI y el mantenimiento de §9 usarán subconjuntos por impacto, reservando la suite completa para promoción a release.

---

## 8. Distribución, mantenimiento y recuperación

- **Distribución:** `@lema017/rsc-governed`, provenance de npm (ya activo en upstream), migración a Trusted Publishing si es compatible, permisos mínimos explícitos en los workflows y 2FA para acceso humano. Toda limitación se documenta.
- **Mantenimiento (§9):** punto de entrada reanudable que consulta upstream, informa si no hay cambios, prepara rama o worktree, analiza impacto, integra, aplica la gobernanza a skills nuevas y modificadas, valida, evalúa, corrige dentro de límites, entrega evidencia y publica sólo según la autorización de esa ejecución. Un merge sin conflictos textuales no se acepta como prueba de compatibilidad funcional.
- **Recuperación:** una verificación fallida conserva la instalación funcional y explica el bloqueo; respaldo y restauración comprobados; sin estados parcialmente activados.

---

## 9. Matriz de soporte y validación

| Asistente | Entrega de skills | Hook del proveedor | Cableado hoy con denegar | Objetivo del fork | Validación |
|---|---|---|---|---|---|
| `claude` | symlink a `.rsc/skills/` (copia en Windows) | ✅ real | ✅ **sí (único)** | contrato + imposición por código | ejecución en macOS |
| `codex` | `.codex/rsc/` + `AGENTS.md` | ✅ real (requiere confianza del usuario en `/hooks`) | ❌ | contrato + intentar cablear | ejecución en macOS |
| `cursor` | `.mdc` convertido, **sólo `SKILL.md`** | ⚠️ parcial: bloquea, **no puede inyectar** | ❌ | contrato en el `.mdc`; sin referencias | ejecución en macOS |
| `deepseek` | `.dsh/skills/` (ruta nativa) | ⚠️ parcial: sólo bloqueo PreToolUse | ❌ | contrato + intentar cablear | ejecución en macOS |
| `antigravity` | `.antigravity/rsc/` | ❌ ninguno; ruta **no documentada** | ❌ | **sólo instrucción**, límite declarado | lectura + prueba manual |
| otros 13 | como upstream | varía | ❌ | **sin afirmaciones de gobernanza** | sin cambios |

Límites que se declaran, no se prometen resolver: la **selección automática está ausente en 16 de 18** asistentes porque las skills sólo aterrizan en ruta descubrible por el proveedor en `claude` y `deepseek` (C3); **Cursor pierde `references/` y `scripts/`** y la descripción real de activación (C5); **toda guarda por código es desarmable** por un `.rsc.json` commiteado que viaja a los clones (C7); y **Windows no se valida por ejecución**.

---

## 10. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **No hay dónde poner el contrato** (2 B de holgura, puerta sólo en Claude, 139/274 descripciones sobre el techo blando) | Preámbulo por skill + contrato en `.rsc/` con puntero; no tocar el cuerpo always-on salvo decisión medida |
| 2 | **knowledge-sync muta documentos de gobernanza** por defecto | Exclusión por código de la ruta estándar + test negativo. Severidad acotada: recuperable desde historial; `install`/`sync`/`repair`/`clone` limpios |
| 3 | **`.claude/rsc-bootstrap.mjs` commiteado apunta al padre** en consumidores existentes | Identidad propia + detección y migración; sin clave que sobreviva hoy (R5) |
| 4 | **«Impuesto por código» es 1 asistente**, y los opt-outs se propagan | Declararlo con honestidad en contrato y README; separar garantías por código, reglas dependientes del modelo y comportamientos comprobados por evaluación |
| 5 | **El aparato de validación no puede certificar §11** | Corregir `eval-lint` (falla en abierto), los 3 validadores vacuos y las 6 comprobaciones fuera de CI; construir repeticiones y muestreo reproducible |
| 6 | **Primer push a `main` dispara bump y publicación** con identidad ajena | Corregir disparador e identidad en el mismo commit que reconfigura remotos; trabajar en ramas |
| 7 | Premisa transversal: cambiar el mecanismo escala la evaluación a ~1 210 ejecuciones | Definir «cambio relevante» en la Etapa 1 y ampliar por impacto dentro del límite |

---

## 11. Criterios de aceptación

1. Fork accesible; `origin`→fork, `upstream`→original; primer commit incluye `docs/fork/` **y es commiteable** (B1 corregido y verificado con `git check-ignore`).
2. `release.yml` no publica por push a `main` y no usa identidad ajena (R6).
3. Instalación reproducible en clon limpio, probada en entorno limpio.
4. **Toda** skill distribuida porta el contrato, comprobado por validador determinista sobre las 274.
5. Transformador **idempotente**: doble ejecución byte-idéntica.
6. Licencias, avisos, `THIRD_PARTY`, `UPSTREAM.json` y scripts preservados y presentes en el tarball; README acredita los dos componentes omitidos.
7. Subárboles vendorizados intactos: `tests/ux-upstream.test.js` verde.
8. Personalización en la ruta estándar: se lee antes de aplicar la skill; se usa el original si no existe; un archivo ilegible o contradictorio **no** se trata como ausente.
9. Personalizaciones **sobreviven** instalación, `sync`, `repair`, actualización y clon limpio, con test negativo que falle si la exclusión desaparece.
10. Análisis brownfield operativo, distinguiendo convención aprobada, patrón observado, deuda, excepción, migración y evidencia insuficiente.
11. Mantenimiento manual funcional y reanudable, con evidencia.
12. Alta, baja, modificación y renombrado de skills en upstream cubiertos con prueba: la personalización de una skill eliminada **sobrevive y se reporta como huérfana**, y un renombrado **no se aplica en silencio** — se reporta como migración que requiere decisión.
13. Actualización automática desde el fork, sin reinstalar el padre, con activación coherente y sin estados parciales.
14. Evaluaciones semánticas aprobadas según umbrales, dentro del límite de ~600 ejecuciones; cobertura pendiente registrada sin bajar umbrales.
15. README con las dos imágenes, fuentes editables, texto alternativo y renderizado validado en GitHub.
16. Versiones, commits y **limitaciones residuales** documentadas, incluida Windows y los límites por asistente.

Ningún componente esencial queda simulado, sin configurar o sin probar.

---

## 12. Lo que esta aprobación autoriza

El alcance descrito aquí y nada más. Si surge un bloqueo fuera de él: conservar el trabajo, registrarlo en el ledger, continuar las tareas independientes y reportar al cerrar la etapa (D8).

Prerrequisitos del usuario pendientes: **A1** `gh auth refresh -h github.com -s workflow` y **A2** `npm login`. Sin A1 no se configuran workflows; sin A2 no se publica. Lo que quede sin validar se registra como limitación residual.
