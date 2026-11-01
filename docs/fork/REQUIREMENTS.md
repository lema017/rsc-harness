Dirige la implementación de un fork de:

https://github.com/ericrisco/rsc-harness

El resultado debe ser funcional, documentado, probado y listo para usarse. Divide el trabajo en etapas ejecutadas por agentes, con revisión independiente y coordinación desde la sesión principal de Claude Code.

## 1. Persistencia y forma de trabajo

Trabaja en `~/Development/rsc-harness-fork`, o en la ruta local dedicada que indique el usuario. Esa carpeta será el clon de trabajo.

En la primera ejecución:

1. Crea la carpeta si no existe y clona en ella el repositorio original: `https://github.com/ericrisco/rsc-harness`.
2. Dentro del clon, guarda este prompt completo y sin modificar en `docs/fork/REQUIREMENTS.md`, como fuente de verdad de los requisitos, y crea `docs/fork/LEDGER.md` para progreso, decisiones, aprobaciones, evidencias y bloqueos. No los commitees antes de la aprobación.

Después de aprobar el plan, y según lo autorizado:

1. Crea el fork en GitHub en la cuenta u organización acordada, o el repositorio privado alternativo si se acordó esa opción en la sección 14.
2. Reconfigura el clon existente: `origin` apunta al fork o al repositorio privado acordado y `upstream` al repositorio original. No vuelvas a clonar.
3. Verifica los remotos y registra en el ledger el commit base de upstream.
4. Trabaja en ramas del fork o del repositorio privado acordado. El primer commit de la implementación incluye `docs/fork/`.

El mantenimiento de la sección 9 utiliza el remoto `upstream` de este mismo clon.

Si los archivos ya existen, léelos y conserva su contenido. No sobrescribas requisitos anteriores silenciosamente. Registra cualquier revisión de requisitos de forma explícita.

Antes de aprobar el plan, solo puedes:

- Crear el directorio dedicado si no existe.
- Crear y actualizar `REQUIREMENTS.md` y `LEDGER.md`.
- Clonar el repositorio original en el directorio dedicado, sin commits, sin cambiar remotos y sin pushes.
- Realizar consultas de solo lectura al repositorio y al entorno.
- Instalar dependencias únicamente de forma local dentro del clon y ejecutar los tests existentes para comprobar comportamientos, bajo las condiciones de aislamiento indicadas a continuación.

Para instalar dependencias y ejecutar tests antes de la aprobación:

- No realices instalaciones globales.
- Ejecuta los procesos con `HOME` y las variables de configuración apuntando a un directorio temporal dentro de la carpeta dedicada, para no tocar la configuración real de los asistentes del usuario, como `~/.claude`.
- No uses ni expongas a esos procesos credenciales, tokens o sesiones del usuario.
- Si un test o script requiere credenciales, servicios externos o escribe fuera de la carpeta dedicada, no lo ejecutes. Regístralo en el ledger como no verificado.
- Registra los resultados en el ledger como evidencia, separando lo comprobado por ejecución de lo inferido por lectura.

No crees el fork remoto ni el repositorio privado alternativo, hagas commits o pushes, cambies remotos, ejecutes código del repositorio fuera de la instalación local de dependencias y los tests existentes autorizados, realices instalaciones globales ni modifiques archivos fuera de ese directorio antes de la aprobación.

Todo agente debe recibir la ruta de `REQUIREMENTS.md`, las secciones aplicables y los criterios de aceptación de su tarea. Tras una compactación o al reanudar una sesión, relee ambos archivos antes de continuar.

Quiero intervenir al inicio para aclarar dudas, decidir alternativas relevantes y aprobar el plan completo. Después, ejecuta las etapas sin solicitar aprobaciones rutinarias.

Antes del plan:

- Inspecciona lo que puedas resolver con evidencia.
- Agrupa las preguntas pendientes.
- Presenta una recomendación y sus consecuencias.
- Verifica accesos sin revelar secretos.
- Aclara autorización para crear el fork, hacer commits y pushes, configurar workflows, abrir o fusionar PR y publicar paquetes o releases.

La aprobación del plan autoriza únicamente el alcance acordado. Si surge un bloqueo fuera de ese alcance, conserva el trabajo, continúa tareas independientes y explica lo pendiente.

El LEDGER determina la etapa actual y registra la aprobación del plan y su alcance. Las instrucciones de arranque solo aplican a la primera ejecución. Al reanudar, continúa desde el último estado registrado sin repetir preguntas resueltas ni solicitar nuevamente aprobaciones vigentes.

## 2. Objetivo

Agregar gobernanza uniforme a las skills oficiales de RSC para proyectos existentes —brownfield— y nuevos.

El fork debe:

- Analizar compatibilidad entre skills, código y documentación.
- Detectar contradicciones y decisiones pendientes.
- Preguntar cuando la evidencia no permita resolverlas.
- Persistir personalizaciones por proyecto.
- Consultarlas antes de aplicar cada skill.
- Usar la skill original cuando no exista personalización.
- Conservar las funciones originales del harness.
- Incorporar cambios del padre mediante mantenimiento iniciado manualmente.
- Mantener actualizaciones automáticas de los proyectos consumidores.
- Explicar las diferencias del fork mediante un README conciso y visual.

La autonomía de esta implementación no elimina las preguntas que el producto debe hacer a sus usuarios cuando sus proyectos contengan decisiones ambiguas.

## 3. Auditoría inicial obligatoria

Verifica el código, documentación, tests y licencias contra un commit concreto. No diseñes únicamente a partir del README.

Estos son hallazgos anteriores que debes comprobar:

- El catálogo tenía 274 skills.
- Los originales se distribuían desde `skills/<id>/`.
- El instalador copiaba contenido a `.rsc/skills/<id>/`.
- Los asistentes recibían enlaces, copias o instrucciones adaptadas.
- `.rsc.json` registraba selección y versión del catálogo.
- `sync` podía regenerar contenido y enlaces administrados.
- Las personalizaciones se esperaban en `02-DOCS/`.
- Skills como `suggest`, `ftd` y `sdd` participaban en el funcionamiento interno.
- Existían referencias relativas y archivos auxiliares.
- Flutter consultaba `02-DOCS/wiki/stack/flutter.md`, pero la convención no era uniforme.
- Las actualizaciones del mismo major se instalaban en segundo plano y se activaban en la siguiente sesión.
- Los cambios de major requerían confirmación.
- El actualizador apuntaba a `@ericrisco/rsc`.

Obtén el inventario actual; no fijes el número de skills en el código.

Verifica la licencia del repositorio y de los componentes o skills de terceros. Identifica permisos y condiciones para modificar, redistribuir y publicar el fork con otro nombre. Si faltan permisos o existe una restricción incompatible con la distribución prevista, repórtalo como bloqueo antes del plan. Conserva atribuciones y avisos obligatorios.

Comprueba también si la raíz de documentación es configurable y cuáles son las capacidades reales de cada asistente soportado por upstream.

Distingue hechos comprobados, inferencias y decisiones propuestas.

## 4. Decisión arquitectónica antes del plan

Compara al menos estas estrategias:

A. Modificar directamente los archivos fuente de las skills del fork.

B. Mantener `skills/` idéntico byte a byte al commit de upstream incorporado y aplicar la gobernanza mediante una transformación determinista e idempotente durante build o instalación, un overlay, wrapper u otro mecanismo generado.

Evalúa:

- Conflictos y esfuerzo de mantenimiento al incorporar upstream.
- Auditabilidad de las diferencias respecto al padre.
- Idempotencia y reproducibilidad.
- Integridad de referencias, scripts y metadatos.
- Cobertura de invocación explícita, automática e interna.
- Compatibilidad entre asistentes.
- Costo de contexto.
- Facilidad para probar, actualizar y recuperar.

Evalúa hooks de los asistentes para imponer verificaciones por código donde realmente existan eventos adecuados. No inventes hooks ni supongas que un mecanismo cubre todos los proveedores.

Presenta una recomendación razonada antes del plan. La estrategia final queda sujeta a mi aprobación inicial.

El requisito es que todas las skills distribuidas cumplan el contrato; no se exige modificar manualmente cientos de archivos fuente.

## 5. Personalización por proyecto

La ubicación estándar es:

`02-DOCS/wiki/skills/<nombre-oficial>/README.md`

Ejemplo:

`02-DOCS/wiki/skills/flutter/README.md`

`02-DOCS/` es la raíz de documentación predeterminada. Si la auditoría demuestra que esa raíz es configurable, respeta la configuración y conserva dentro de ella la estructura:

`wiki/skills/<nombre-oficial>/README.md`

El identificador debe coincidir con el de la skill oficial. Puede haber documentos auxiliares enlazados desde el README.

Comportamiento obligatorio:

1. Comprobar si existe la personalización.
2. Si existe, leerla antes de aplicar la skill.
3. Consultar sus referencias cuando sean pertinentes.
4. Aplicar las decisiones dentro del alcance documentado.
5. Si no existe, usar el contenido original sin ajustes específicos.

La ausencia es válida: no crear archivos vacíos ni preguntar únicamente por esa ausencia. Esto no elimina las preguntas que requiera la tarea o la propia skill.

Un archivo existente pero ilegible, inválido o contradictorio no debe tratarse silenciosamente como ausente.

Las personalizaciones pertenecen al proyecto, se versionan en Git y no deben perderse durante instalación, `sync`, `repair`, actualización o reconstrucción de un clon.

Las rutas anteriores pueden conservar documentación técnica. La entrada única de personalización será la ruta estándar, que podrá enlazarlas. Diseña una transición que preserve decisiones existentes sin duplicar fuentes de verdad.

## 6. Contrato de gobernanza

Define un contrato versionado y uniforme que cubra:

- Descubrimiento y lectura de personalizaciones.
- Decisiones generales y específicas aplicables.
- Alcance por módulo, paquete o subproyecto.
- Precedencia.
- Documentación ausente, desactualizada o contradictoria.
- Excepciones y migraciones.
- Preguntas y resolución de conflictos.
- Evidencia y trazabilidad.
- Carga progresiva de contexto.

Las decisiones aprobadas del proyecto prevalecen sobre recomendaciones genéricas dentro de su alcance, respetando las instrucciones y políticas de mayor prioridad. No pueden desactivar permisos del entorno.

Considera todas las rutas de uso: invocación explícita, selección automática, referencia desde otra skill y flujos internos.

Documenta por separado:

- Garantías implementadas mediante código.
- Reglas dependientes del modelo.
- Comportamientos comprobados mediante evaluaciones.

No equipares la presencia de un preámbulo con cumplimiento garantizado.

## 7. Compatibilidad brownfield

Antes de considerar lista la configuración de skills:

1. Inventariar las seleccionadas y otras visibles que puedan competir, cuando sea posible inspeccionarlas.
2. Analizar documentación, dependencias, versiones, configuración, tests y muestras representativas de código.
3. Leer las skills y referencias relevantes.
4. Extraer requisitos, restricciones, preferencias y supuestos.
5. Detectar conflictos con el proyecto y entre skills.
6. Resolver lo respaldado por decisiones explícitas vigentes.
7. Preguntar solo por ambigüedades materiales.
8. Registrar las decisiones y revalidar.

Diferencia siempre:

- Convención aprobada.
- Patrón observado.
- Deuda técnica.
- Excepción.
- Migración en curso.
- Evidencia insuficiente.

Ejemplo: si una skill recomienda Riverpod y el proyecto utiliza BLoC, determina si BLoC es el estándar vigente, legado o parte de una migración. No impongas una migración por preferencia de la skill.

Cada conflicto debe incluir evidencia, alcance, impacto, confianza, alternativas, recomendación y estado.

Las preguntas deben explicar consecuencias y evitar repetir información claramente documentada. Las decisiones pendientes bloquean las acciones afectadas, no todo el trabajo independiente.

Para greenfield, aclara decisiones relevantes sin inventar evidencia de código existente.

## 8. Persistencia y evolución

Cada personalización debe registrar, según corresponda:

- Skill y versión o commit revisado.
- Decisiones, alcance y motivos.
- Evidencia.
- Excepciones.
- Estado de aprobación.
- Fecha y condiciones de revisión.

Cuando cambien las skills o el proyecto, identifica qué decisiones requieren revisión. Conservar el archivo no demuestra compatibilidad.

Preserva skills propias del usuario. Explica los límites para inspeccionar o controlar skills personales, globales y de plugins. No prometas que `.rsc.json` representa todas las skills utilizables si existen otras fuentes.

## 9. Mantenimiento manual desde upstream

Yo iniciaré el mantenimiento del fork desde Claude Code cada mes o cuando lo considere necesario.

No necesitas un servicio permanente ni una tarea programada de integración.

Entrega un punto de entrada documentado y reutilizable que:

1. Consulte upstream y compare contra el último commit incorporado.
2. Finalice informando si no hay cambios.
3. Prepare una rama o worktree si los hay.
4. Analice el impacto sobre skills, instalador, hooks, formatos y capacidades propias.
5. Integre los cambios.
6. Aplique la estrategia de gobernanza aprobada a skills nuevas y modificadas.
7. Ejecute validaciones y evaluaciones.
8. Corrija problemas dentro de límites acordados.
9. Entregue evidencia y resultado.
10. Fusione o publique únicamente según la autorización de esa ejecución.

Un merge sin conflictos textuales no demuestra compatibilidad funcional.

La transformación o adaptación debe ser idempotente y preservar licencias, metadatos, referencias y scripts. Ninguna skill nueva llega a una release estable sin conformidad.

Utiliza los agentes disponibles en la sesión para el análisis semántico. Scripts y CI complementan con comprobaciones deterministas. Si hacen falta servicios adicionales, acuerda accesos, costo y política de datos al inicio de esa ejecución.

Permite acordar alcance y permisos al comenzar cada mantenimiento y trabajar después sin consultas rutinarias.

Si una ambigüedad excede lo autorizado, bloquea la promoción afectada y conserva la versión estable.

Persiste commits, cambios, adaptaciones, decisiones, resultados y estado de publicación. Permite reanudar el proceso.

## 10. Actualización automática de consumidores

Una vez publicada una versión validada del fork, los proyectos podrán actualizarse automáticamente desde su paquete.

Los consumidores no integran upstream directamente.

Usa un paquete con scope e identidad propia. Revisa actualizador, hooks, bootstrap, recuperación, comandos sugeridos, documentación y workflows para evitar reinstalar accidentalmente el padre.

Conserva:

- Actualización automática compatible dentro del mismo major.
- Confirmación para major, salvo política explícita.
- Activación coherente en la siguiente sesión.
- Opción de desactivar actualizaciones automáticas.

Antes de activar:

- Verifica identidad, versión e integridad del artefacto.
- Comprueba compatibilidad de la gobernanza.
- Identifica decisiones locales que requieran revisión.
- Preserva documentación y trabajo del usuario.
- Mantén respaldo y recuperación.
- Evita carreras y estados parcialmente activados.

Distingue validaciones centrales de las locales. No presupongas credenciales de IA en cada proyecto.

Protege la publicación mediante permisos mínimos, 2FA para accesos humanos y mecanismos de publicación confiable y provenance de npm cuando sean compatibles. Verifica las capacidades actuales y documenta cualquier limitación.

Una verificación fallida debe conservar la instalación funcional y explicar el bloqueo.

## 11. Validación y presupuesto de evaluaciones

La conformidad del catálogo completo se comprueba con validadores deterministas.

Las evaluaciones semánticas deben cubrir:

- Skills nuevas o modificadas en cada integración.
- Skills internas del harness: `suggest`, `ftd`, `sdd` y las identificadas por la auditoría.
- Una muestra estratificada del resto del catálogo.

Define qué constituye un cambio relevante, incluyendo referencias, scripts y cambios compartidos del mecanismo de gobernanza. Si cambia un componente transversal, amplía la evaluación según el impacto.

En la Etapa 1 define:

- Casos y rúbricas.
- Número de repeticiones.
- Umbrales de aprobación.
- Fallos críticos que bloquean promoción.
- Selección reproducible de la muestra.
- Modelos y configuración.
- Límites de costo, duración y reintentos.
- Tratamiento de resultados inconclusos.

Los modelos, repeticiones, muestras y reintentos deben mantenerse dentro del presupuesto máximo aprobado al inicio. Si no alcanza, registra la cobertura pendiente sin reducir los umbrales ni exceder el límite. No marques como aprobado lo que quedó sin verificar.

Ejecuta tests originales y pruebas de:

- Personalización presente y ausente.
- Documento ilegible o contradictorio.
- Precedencia y alcance.
- Monorepos.
- Referencias y rutas de invocación.
- Preservación durante mantenimiento y actualización.
- Transición desde documentación histórica.
- Idempotencia.
- Nuevas skills y cambios de upstream.
- Conflictos textuales y funcionales.
- Recuperación, interrupciones y concurrencia.
- Clon limpio.
- Prevención de reinstalación del padre.

Evalúa con agentes fixtures brownfield que incluyan estándares contrarios al default, patrones mezclados, migraciones, documentación ausente o desactualizada, conflictos entre skills y proyectos sin conflictos.

Comprueba acciones observables: lectura de documentos, preguntas pertinentes, respeto de decisiones, uso del original sin personalización y ausencia de migraciones silenciosas.

Usa pruebas negativas y casos reservados que no hayan guiado la implementación. Distingue tests, evaluaciones y simulaciones. Los mocks no sustituyen pruebas de integraciones reales.

## 12. Agentes y etapas

La sesión principal es el coordinador. El estado durable reside en archivos y Git.

Verifica los límites de la versión de Claude Code utilizada. No bases el diseño en subagentes persistentes ni en que puedan crear otros subagentes. El coordinador lanza los agentes y reconstruye su contexto desde los artefactos.

Cada etapa tiene responsable y revisor distinto:

0. Auditoría, licencias, alternativas, preguntas y plan.
1. Arquitectura, contrato, presupuesto de evaluaciones y aceptación.
2. Consulta de personalizaciones e integración con asistentes.
3. Análisis brownfield y registro de decisiones.
4. Conformidad del catálogo mediante la estrategia aprobada.
5. Mantenimiento manual de upstream.
6. Distribución, actualización y recuperación.
7. README, imágenes y documentación.
8. Validación independiente y entrega.

Cada agente recibe objetivo, requisitos aplicables, entradas, alcance de archivos, dependencias y criterios de aceptación.

Los revisores reciben código, requisitos y criterios, sin las conclusiones del autor antes de emitir su evaluación inicial. Después pueden contrastar evidencia y resolver discrepancias.

Usa ramas o worktrees aislados y paraleliza solo tareas independientes. Registra handoffs, resultados y pendientes en el ledger.

La aceptación de etapas depende de pruebas y revisión técnica, sin solicitar mi aprobación entre ellas.

## 13. README y documentación visual

El README debe explicar:

- Propósito.
- Relación y atribución al padre.
- Diferencias del fork.
- Instalación y primeros pasos.
- Personalizaciones.
- Compatibilidad brownfield.
- Mantenimiento manual de upstream.
- Actualización automática de consumidores.
- Garantías y límites.

Utiliza texto conciso para públicos técnicos y no técnicos; enlaza detalles avanzados.

Incluye imágenes versionadas y renderizables en GitHub para:

1. Skill → personalización opcional → ejecución.
2. Mantenimiento manual → análisis y validación → publicación → actualización de proyectos.

Conserva fuentes editables, etiquetas claras y texto alternativo. Valida renderizado, enlaces y correspondencia con la implementación.

## 14. Aclaraciones y plan inicial

Resuelve al inicio:

- Propietario, nombre y visibilidad del fork. Un fork de GitHub de un repositorio público no puede ser privado; si se requiere privacidad, propón un repositorio privado nuevo con remoto `upstream` y explica qué se pierde, incluida la pertenencia a la red de forks de GitHub y sus funciones asociadas.
- Scope y nombre del paquete.
- Publicación y autorizaciones.
- Asistentes y plataformas objetivo.
- Credenciales y límites de ejecución.
- Presupuesto máximo para implementación y evaluaciones.
- Política de datos.
- Idioma del README, documentación, contrato e instrucciones inyectadas.
- Idioma de las preguntas y mensajes del producto.
- Tratamiento de bloqueos fuera del alcance aprobado.

No preguntes lo que puedas obtener mediante inspección autorizada.

Presenta un plan que incluya:

- Evidencia y commit base.
- Compatibilidad de licencias.
- Comparación arquitectónica y recomendación.
- Alcance y exclusiones.
- Etapas, agentes y dependencias.
- Decisiones y supuestos.
- Estrategia de pruebas y presupuesto.
- Distribución, mantenimiento y recuperación.
- Riesgos y criterios de aceptación.
- Matriz de soporte y validación por asistente y plataforma.

El detalle de evaluaciones definido posteriormente en la Etapa 1 debe permanecer dentro de los límites aprobados en este plan.

Espera mi aprobación antes de implementar.

## 15. Definición de terminado

Entrega:

- Fork implementado y accesible.
- Instalación reproducible.
- Gobernanza uniforme.
- Personalizaciones en la ruta estándar.
- Uso del original cuando no existan.
- Análisis brownfield operativo.
- Catálogo completo validado estructuralmente.
- Evaluaciones semánticas aprobadas según el plan.
- Mantenimiento manual de upstream funcional.
- Actualización automática desde el fork.
- Preservación y recuperación comprobadas.
- README con imágenes.
- Evidencia de pruebas.
- Guía de uso y mantenimiento.
- Versiones, commits y limitaciones residuales.

Prueba el artefacto distribuible en un entorno limpio. Valida publicación e infraestructura cuando formen parte del alcance autorizado.

No declares la solución lista si quedan componentes esenciales simulados, sin configurar o sin probar.

En la primera ejecución, empieza clonando el repositorio original en el directorio dedicado y persistiendo estos requisitos y el ledger dentro del clon. Continúa con la auditoría y los tests aislados permitidos en la sección 1, plantea las preguntas iniciales consolidadas, presenta el plan completo y espera mi aprobación.

En ejecuciones posteriores, relee los requisitos y el ledger y continúa desde la etapa registrada.
