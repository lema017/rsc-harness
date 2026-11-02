# Criterios de aceptación, en forma comprobable — Etapa 1

Los 16 criterios aprobados en [`../PLAN.md`](../PLAN.md) §11 están escritos como objetivos. Aquí cada uno recibe **un instrumento, un comando y una condición de paso falsable**. Un criterio sin instrumento no es un criterio: es un deseo.

Tres clases de instrumento:

- **D — determinista.** Misma entrada, mismo veredicto. Es un test o un validador. Si falla no hay matiz que discutir.
- **E — evaluación.** Depende de una decisión del modelo. Se mide con ejecuciones de agente según [`EVALUATION.md`](./EVALUATION.md); el resultado es estadístico y se reporta con su intervalo.
- **I — inspección.** Juicio humano documentado (renderizado, redacción, acreditación). Se cierra con evidencia adjunta, no con una afirmación.

---

## Tabla de criterios

| # | Criterio | Clase | Instrumento y condición de paso | Estado |
|---|---|---|---|---|
| 1 | Fork accesible; remotos correctos; primer commit incluye `docs/fork/` y es commiteable | **D** | `git remote -v` da `origin`→fork y `upstream`→padre; `git check-ignore -v docs/fork/LEDGER.md` **sin coincidencia**; `git ls-files docs/fork/` lista los archivos. Paso: las tres a la vez | ✅ **CUMPLIDO** (`43ca7d8`, revalidado tras el merge de 3.7.4) |
| 2 | `release.yml` no publica por push a `main` ni usa identidad ajena | **D** | El bloque `on:` contiene **sólo** `workflow_dispatch`; `grep -E 'ericrisco\|Eric Risco\|erisco@' .github/workflows/` da **cero**; el YAML parsea. Paso: las tres | ✅ **CUMPLIDO** (`d15b2d2`) |
| 3 | Instalación reproducible en clon limpio | **D** | Instalar **dos veces** en dos directorios desechables distintos dentro de `.fork-tmp/`, con `HOME` aislado, desde el tarball de `npm pack`. Paso: los dos árboles resultantes son **byte-idénticos** (`diff -r`) tras normalizar únicamente lo **enumerado en el propio script de comparación**: los campos de marca de tiempo **y las rutas absolutas del árbol instalado**, que `scripts/lib/state.js:10` serializa tal cual desde `baseDir`/`skillDir` (`targets/index.js:11-13,166`) y que por construcción difieren entre dos directorios — sin esta segunda clase el criterio **no podía pasar nunca**, por una razón ajena a la reproducibilidad. Esa lista se **congela** al escribir el script: añadirle una ruta después de ver una diferencia es un **fallo del criterio**, no una excepción nueva — que es lo que hacía infalsable la redacción anterior. Y el temporal debe llevar **techo de git**. Los otros dos parámetros medidos hoy (concurrencia y timeout) son del **corredor de tests**, no de una comparación de dos árboles instalados: estaban injertados de otra medición | pendiente |
| 4 | Toda skill distribuida porta el contrato, por validador determinista sobre las 274 | **D** | Validador nuevo del fork sobre el árbol **ya transformado**. Paso: **274 de 274** con el bloque marcado y las tres claves, `0` parciales, `0` duplicados. Un 273 es un fallo, no un 99,6 %. **Decidido por el usuario el 2026-11-01: se llega a 274 sin exclusiones**, y sin tocar ningún techo: los tres miden el fuente del repo, que la Estrategia B congela (ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) §4) | instrumento ✅ verificado; **la letra del criterio se mantiene intacta** |
| 5 | Transformador idempotente | **D** | Ejecutarlo dos veces seguidas sobre el mismo árbol. Paso: `diff` vacío entre la primera y la segunda salida, **y** un solo bloque marcado por archivo (no dos anidados) | pendiente |
| 6 | Licencias, avisos, `THIRD_PARTY`, `UPSTREAM.json` y scripts presentes en el tarball; README acredita los dos componentes omitidos | **D + I** | `npm pack --dry-run --json` y comprobar las **ocho** rutas obligatorias. Línea base medida hoy sobre 3.7.4 sin transformar: **1 782 archivos, 5,3 MB, 8/8 artefactos de licencia, 274 `SKILL.md`, 274 `cases.yaml`**. Paso: tras la transformación, las 8 siguen presentes y los dos recuentos de 274 no bajan. La parte **I** es que el README del fork acredite `ux-designer` (© Szilárd Hajba) y `ux-usability-foundations` (© hueyexe), que el padre omite | instrumento ✅ verificado y con línea base; acreditación pendiente |
| 7 | Subárboles vendorizados intactos | **D** | `tests/ux-upstream.test.js` (existe, 3.7.4). Paso: verde, antes y después de la transformación | pendiente |
| 8 | Personalización leída antes de aplicar; original si no existe; archivo ilegible o contradictorio **no** se trata como ausente | **D + E** | **D:** un archivo ilegible (permisos, YAML roto, vacío) produce un **error declarado que nombra el archivo y la regla**, no el camino de «no existe» — test negativo. **Corregido tras la revisión: el validador tenía la mitad D sin punto de invocación, es decir un instrumento que nadie ejecutaba.** **Y la primera corrección lo cambió por un instrumento que no se puede ejecutar: `npm run gate` NO existe en `package.json`.** Hoy el punto de invocación real es **uno**, `install`/`sync` cuando existe `02-DOCS/wiki/skills/` (ver [`CUSTOMIZATION-SCHEMA.md`](./CUSTOMIZATION-SCHEMA.md) §3). **E:** conductas **G1** y **G2**, umbral ≥ 90 % con intervalo. **Acotado por medición:** «leída antes de aplicar» **no es imponible en ningún asistente**, porque la aplicación de una skill no es un evento observable (cero matchers de `Skill` en todo el repositorio). El criterio se cierra por evaluación, con ese límite escrito | pendiente, con el alcance de la parte D ya determinado |
| 9 | Las personalizaciones sobreviven a instalación, `sync`, `repair`, actualización y clon limpio, con test negativo | **D** | Escribir una personalización, ejecutar los cinco caminos, comprobar que sigue byte-idéntica. **Y el test negativo:** quitar la exclusión que la protege debe hacer **fallar** la suite. Paso: cinco caminos verdes **y** el negativo rojo al sabotearlo | pendiente |
| 10 | Análisis brownfield operativo, distinguiendo convención aprobada, patrón observado, deuda, excepción, migración y evidencia insuficiente | **D + E** | **D:** el artefacto de salida valida contra un esquema que exige una de las **seis** categorías por hallazgo, más su evidencia. Un hallazgo sin categoría o sin evidencia invalida el archivo. **E:** conducta **G5** (preguntar cuando falta evidencia), umbral ≥ 85 %, con los **dos** modos de fallo medidos | pendiente |
| 11 | Mantenimiento manual funcional y reanudable, con evidencia | **D** | Simular las cuatro clases de cambio de upstream sobre un repositorio de prueba local; interrumpir el proceso a mitad y reanudarlo. Paso: el resultado tras reanudar es idéntico al de una pasada sin interrupción, y queda un registro con la evidencia de cada decisión | pendiente |
| 12 | Alta, baja, modificación y renombrado cubiertos; huérfana sobrevive y se reporta; renombrado **no** silencioso | **D** | Cuatro tests, uno por clase. Paso: la personalización de una skill eliminada **sigue en disco** y aparece reportada como huérfana; un renombrado produce un **informe de migración que exige decisión** y **no** se aplica solo. Un renombrado aplicado en silencio es fallo aunque el resultado sea correcto | pendiente |
| 13 | Actualización automática desde el fork, sin reinstalar el padre, con activación coherente y sin estados parciales | **D**, con una limitación real | Instalar desde un **tarball local** (`npm pack` + `npm install ./x.tgz`) y ejecutar la actualización; comprobar que no queda ningún estado intermedio tras una interrupción. **Limitación:** la ida y vuelta por el registro de npm **no se puede verificar sin publicar**. Hasta que se publique, este criterio se reporta como «verificado contra tarball local, no contra registro» — ver §3 de este documento | pendiente |
| 14 | Evaluaciones aprobadas según umbrales, dentro de ~600 ejecuciones, con cobertura pendiente registrada sin bajar umbrales | **E** | [`EVALUATION.md`](./EVALUATION.md): 181 celdas, N=3, 543 ejecuciones y 57 de reserva. Paso: cada conducta sobre su umbral **y** el recuento de ejecuciones ≤ 600 **y** lo no cubierto escrito en el informe. Bajar un umbral para que pase es un fallo del criterio, no un ajuste | pendiente |
| 15 | README con las dos imágenes, fuentes editables, texto alternativo y renderizado validado en GitHub | **I** | Los tres SVG de `docs/fork/diagrams/` ya existen, son XML válido, llevan `<title>`/`<desc>` y se verificaron por renderizado real a 1280 px. Paso: incrustados en el README **y** comprobados en la vista renderizada de GitHub, no sólo en local — GitHub sanea el SVG y puede no mostrar lo que el navegador sí muestra | fuentes ✅ hechas; incrustado y validación en GitHub pendientes |
| 16 | Versiones, commits y limitaciones residuales documentadas, incluida Windows y los límites por asistente | **I** | Un apartado del README y el cierre del ledger. Paso: constan el commit auditado (`6f7edd31`, 3.7.1), la base de trabajo (`481b1ec9`, 3.7.4), Windows como no verificable, y **por asistente** qué se impone por código y qué sólo se aconseja. **Contenido ya medido** en [`ARCHITECTURE.md`](./ARCHITECTURE.md) §5, §7 y §10: denegación sólo en `claude` y sólo tras `rsc sync`, nunca en un clon; selección automática nativa en 2, ciega en 1, ausente en 2; y **seis** límites residuales L1–L6 (L6 es la ceguera de Cursor, decidida por el usuario el 2026-11-01: omitirla sería precisamente lo que este criterio existe para impedir) | pendiente de redactar; **evidencia completa** |

**Cláusula de cierre, literal del plan:** *ningún componente esencial queda simulado, sin configurar o sin probar.* Un criterio cuyo instrumento no se pudo ejecutar se reporta como **no verificado**, nunca como cumplido.

---

## 1. Lo que ya está cumplido

Dos de los dieciséis, ambos del arranque de la Etapa 1 y ambos comprobados por ejecución, no por lectura del parche:

- **Criterio 1** — remotos, `.gitignore` y primer commit. El `.gitignore` se verificó con `git check-ignore`, que es lo que exigía el bloqueo B1; leer el patrón no habría bastado, porque una negación `!docs/fork/` es inerte bajo una regla de directorio.
- **Criterio 2** — `release.yml` sin disparador por push y sin identidad ajena. Revalidado **después** del merge de 3.7.4, porque ese merge reescribió el archivo entero.

---

## 2. Criterios cuyo instrumento depende de la evidencia en curso

Dos de las tres verificaciones han llegado y están resueltas; la tercera sigue en curso:

| Criterio | Qué le faltaba | Resultado |
|---|---|---|
| 4 | Si existe un punto único de transformación y si los validadores toleran el bloque | ✅ **Sí a ambas.** Punto único en `install-apply.js:66`; catálogo completo transformado con salida de validadores idéntica. **La cifra del criterio es 274 y no cambia:** el bloque sale únicamente de la superficie **always-on**, que no aplica ninguna skill, no de la base distribuida sobre la que corre el validador. **Y el alcance del instrumento, acotado tras la re-revisión:** el validador mira la base; un tercer test cubre la entrega por skill en los 18 destinos, porque el `.mdc` de Cursor es la única entrega **transformada** y un fallo de renderizado ahí no lo verían ni el validador ni el digest |
| 8 (parte D) | Cuál de los cinco puede denegar por código | ✅ **Resuelto: sólo `claude`, y sólo tras `rsc sync`.** Y algo más duro: la aplicación de una skill no es observable en ninguno, así que esa cláusula no es imponible en ninguna parte |
| 16 | La tabla por asistente | ✅ **Medida completa** en `ARCHITECTURE.md` §5 y §7 |
| 14, y las puertas de 3/5/7/9/12 | Qué validadores heredados se adoptan como puerta y dónde pueden correr con Actions desactivado | ⏳ **En curso.** Dato ya medido: `routing:audit` falla antes y después con el mismo 84,9 %, delta cero — la gobernanza no empeora la deuda heredada |

Ninguno se declara cumplido antes de que su instrumento se haya ejecutado.

---

## 3. La limitación honesta del criterio 13

El criterio pide **actualización automática desde el fork**. Verificarlo de extremo a extremo exige que el paquete exista en el registro de npm, porque el camino real del consumidor es resolver una versión publicada.

Lo que **sí** se puede verificar sin publicar: empaquetar con `npm pack`, instalar el tarball en un directorio desechable, ejecutar la actualización, interrumpirla y comprobar que no queda estado parcial. Eso cubre la lógica entera salvo la resolución de versión contra el registro.

Lo que **no**: que el registro entregue la versión esperada y que el `dist-tag` sea coherente.

Publicar es una acción irreversible y hacia fuera: una versión en npm no se puede retirar sin dejar rastro, y un `unpublish` tiene ventana limitada. Por eso **no se publica para probar**. La decisión de publicar —y con qué `dist-tag`— es del usuario, y hasta entonces el criterio queda reportado como *verificado contra tarball local, no contra registro*. Las condiciones están ya puestas: el camino de release es sólo manual, GitHub Actions está desactivado en el fork y `npm whoami` responde, así que publicar es un acto deliberado y nunca un efecto secundario.
