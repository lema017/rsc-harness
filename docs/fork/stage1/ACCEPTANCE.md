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
| 3 | Instalación reproducible en clon limpio | **D** | Instalar **dos veces** en dos directorios desechables distintos dentro de `.fork-tmp/`, con `HOME` aislado, desde el tarball de `npm pack`. Paso: los dos árboles resultantes son **byte-idénticos** (`diff -r`), salvo una lista explícita y justificada de rutas con marca de tiempo | pendiente |
| 4 | Toda skill distribuida porta el contrato, por validador determinista sobre las 274 | **D** | Validador nuevo del fork, sobre el árbol **ya transformado**. Paso: **274 de 274** portan el bloque marcado y la clave plana de frontmatter; `0` parciales; `0` duplicados. Un 273 es un fallo, no un 99,6 % | pendiente — instrumento condicionado a la verificación del transformador en curso |
| 5 | Transformador idempotente | **D** | Ejecutarlo dos veces seguidas sobre el mismo árbol. Paso: `diff` vacío entre la primera y la segunda salida, **y** un solo bloque marcado por archivo (no dos anidados) | pendiente |
| 6 | Licencias, avisos, `THIRD_PARTY`, `UPSTREAM.json` y scripts presentes en el tarball; README acredita los dos componentes omitidos | **D + I** | `npm pack --dry-run --json` y comprobar las **ocho** rutas obligatorias. Línea base medida hoy sobre 3.7.4 sin transformar: **1 782 archivos, 5,3 MB, 8/8 artefactos de licencia, 274 `SKILL.md`, 274 `cases.yaml`**. Paso: tras la transformación, las 8 siguen presentes y los dos recuentos de 274 no bajan. La parte **I** es que el README del fork acredite `ux-designer` (© Szilárd Hajba) y `ux-usability-foundations` (© hueyexe), que el padre omite | instrumento ✅ verificado y con línea base; acreditación pendiente |
| 7 | Subárboles vendorizados intactos | **D** | `tests/ux-upstream.test.js` (existe, 3.7.4). Paso: verde, antes y después de la transformación | pendiente |
| 8 | Personalización leída antes de aplicar; original si no existe; archivo ilegible o contradictorio **no** se trata como ausente | **D + E** | **D:** un archivo ilegible (permisos, YAML roto, vacío) produce un **error declarado**, no el camino de «no existe» — test negativo. **E:** conductas **G1** (consulta) y **G2** (fidelidad), umbral ≥ 90 % con intervalo reportado | pendiente — la parte D condicionada a la verificación de asistentes en curso |
| 9 | Las personalizaciones sobreviven a instalación, `sync`, `repair`, actualización y clon limpio, con test negativo | **D** | Escribir una personalización, ejecutar los cinco caminos, comprobar que sigue byte-idéntica. **Y el test negativo:** quitar la exclusión que la protege debe hacer **fallar** la suite. Paso: cinco caminos verdes **y** el negativo rojo al sabotearlo | pendiente |
| 10 | Análisis brownfield operativo, distinguiendo convención aprobada, patrón observado, deuda, excepción, migración y evidencia insuficiente | **D + E** | **D:** el artefacto de salida valida contra un esquema que exige una de las **seis** categorías por hallazgo, más su evidencia. Un hallazgo sin categoría o sin evidencia invalida el archivo. **E:** conducta **G5** (preguntar cuando falta evidencia), umbral ≥ 85 %, con los **dos** modos de fallo medidos | pendiente |
| 11 | Mantenimiento manual funcional y reanudable, con evidencia | **D** | Simular las cuatro clases de cambio de upstream sobre un repositorio de prueba local; interrumpir el proceso a mitad y reanudarlo. Paso: el resultado tras reanudar es idéntico al de una pasada sin interrupción, y queda un registro con la evidencia de cada decisión | pendiente |
| 12 | Alta, baja, modificación y renombrado cubiertos; huérfana sobrevive y se reporta; renombrado **no** silencioso | **D** | Cuatro tests, uno por clase. Paso: la personalización de una skill eliminada **sigue en disco** y aparece reportada como huérfana; un renombrado produce un **informe de migración que exige decisión** y **no** se aplica solo. Un renombrado aplicado en silencio es fallo aunque el resultado sea correcto | pendiente |
| 13 | Actualización automática desde el fork, sin reinstalar el padre, con activación coherente y sin estados parciales | **D**, con una limitación real | Instalar desde un **tarball local** (`npm pack` + `npm install ./x.tgz`) y ejecutar la actualización; comprobar que no queda ningún estado intermedio tras una interrupción. **Limitación:** la ida y vuelta por el registro de npm **no se puede verificar sin publicar**. Hasta que se publique, este criterio se reporta como «verificado contra tarball local, no contra registro» — ver §3 de este documento | pendiente |
| 14 | Evaluaciones aprobadas según umbrales, dentro de ~600 ejecuciones, con cobertura pendiente registrada sin bajar umbrales | **E** | [`EVALUATION.md`](./EVALUATION.md): 180 celdas, N=3, 540 ejecuciones y 60 de reserva. Paso: cada conducta sobre su umbral **y** el recuento de ejecuciones ≤ 600 **y** lo no cubierto escrito en el informe. Bajar un umbral para que pase es un fallo del criterio, no un ajuste | pendiente |
| 15 | README con las dos imágenes, fuentes editables, texto alternativo y renderizado validado en GitHub | **I** | Los tres SVG de `docs/fork/diagrams/` ya existen, son XML válido, llevan `<title>`/`<desc>` y se verificaron por renderizado real a 1280 px. Paso: incrustados en el README **y** comprobados en la vista renderizada de GitHub, no sólo en local — GitHub sanea el SVG y puede no mostrar lo que el navegador sí muestra | fuentes ✅ hechas; incrustado y validación en GitHub pendientes |
| 16 | Versiones, commits y limitaciones residuales documentadas, incluida Windows y los límites por asistente | **I** | Un apartado del README y el cierre del ledger. Paso: constan el commit auditado (`6f7edd31`, 3.7.1), la base de trabajo (`481b1ec9`, 3.7.4), Windows como no verificable, y **por asistente** qué se impone por código y qué sólo se aconseja | pendiente — depende de la verificación de asistentes en curso |

**Cláusula de cierre, literal del plan:** *ningún componente esencial queda simulado, sin configurar o sin probar.* Un criterio cuyo instrumento no se pudo ejecutar se reporta como **no verificado**, nunca como cumplido.

---

## 1. Lo que ya está cumplido

Dos de los dieciséis, ambos del arranque de la Etapa 1 y ambos comprobados por ejecución, no por lectura del parche:

- **Criterio 1** — remotos, `.gitignore` y primer commit. El `.gitignore` se verificó con `git check-ignore`, que es lo que exigía el bloqueo B1; leer el patrón no habría bastado, porque una negación `!docs/fork/` es inerte bajo una regla de directorio.
- **Criterio 2** — `release.yml` sin disparador por push y sin identidad ajena. Revalidado **después** del merge de 3.7.4, porque ese merge reescribió el archivo entero.

---

## 2. Criterios cuyo instrumento depende de la evidencia en curso

Tres verificaciones de la Etapa 1 están midiendo ahora mismo lo que estos criterios necesitan para ser falsables:

| Criterio | Qué le falta |
|---|---|
| 4 | Si existe un punto único de transformación que cubra a todos los asistentes, y si los validadores heredados toleran un bloque marcado y una clave plana. Sin eso, «las 274 portan el contrato» no es comprobable con un solo validador |
| 8 (parte D) | Cuál de los cinco asistentes puede **denegar** por código. Donde no pueda, la lectura de la personalización no es imponible y el criterio sólo se puede cerrar por evaluación, con el límite declarado |
| 16 | La tabla por asistente de qué se impone y qué se aconseja |

Ninguno se declara cumplido antes de que esa evidencia esté escrita.

---

## 3. La limitación honesta del criterio 13

El criterio pide **actualización automática desde el fork**. Verificarlo de extremo a extremo exige que el paquete exista en el registro de npm, porque el camino real del consumidor es resolver una versión publicada.

Lo que **sí** se puede verificar sin publicar: empaquetar con `npm pack`, instalar el tarball en un directorio desechable, ejecutar la actualización, interrumpirla y comprobar que no queda estado parcial. Eso cubre la lógica entera salvo la resolución de versión contra el registro.

Lo que **no**: que el registro entregue la versión esperada y que el `dist-tag` sea coherente.

Publicar es una acción irreversible y hacia fuera: una versión en npm no se puede retirar sin dejar rastro, y un `unpublish` tiene ventana limitada. Por eso **no se publica para probar**. La decisión de publicar —y con qué `dist-tag`— es del usuario, y hasta entonces el criterio queda reportado como *verificado contra tarball local, no contra registro*. Las condiciones están ya puestas: el camino de release es sólo manual, GitHub Actions está desactivado en el fork y `npm whoami` responde, así que publicar es un acto deliberado y nunca un efecto secundario.
