# Etapa 6 — Diseño: distribución, actualización y recuperación

**Estado:** entregable de la Etapa 6. Documento interno, español.
**Sirve a:** §2 («conservar las funciones originales del harness», «mantener actualizaciones automáticas de los proyectos consumidores»), §9, §10; `PLAN.md` §8, viñetas «Distribución» y «Recuperación»; decisiones **D3**, **D11**, **D13**, y las decisiones 1 y 2 del coordinador de la sección 2m del ledger.
**Cómo cita:** sección + fragmento entrecomillado, nunca número de línea (decisión 5 del coordinador, §2m).

Este documento explica **por qué** cada pieza está construida así. Lo que se midió está en [`VERIFICATION.md`](./VERIFICATION.md); lo que el producto promete está en [`DISTRIBUTION.md`](./DISTRIBUTION.md).

---

## 1. La identidad: la regla que decidió sitio por sitio

El encargo era ancho: «busca con `grep` cada sitio donde el nombre se afirma y decide, sitio por sitio, si debe cambiar». Un `sed` global habría sido rápido y habría roto tres cosas distintas. La regla que se aplicó, y que es la que hay que recordar al integrar upstream:

> **Se renombra lo que el fork *es* y lo que un lector puede *ejecutar*. No se renombra lo que el fork *lee de un consumidor* ni lo que *otra cosa lee del fork*.**

Las cuatro clases, con lo que cada una decide:

| Clase | Ejemplo | Veredicto | Por qué |
|---|---|---|---|
| **Identidad del paquete** | `package.json#name`, `bin`, `homepage`, `repository`, `bugs` | **renombrar** | Es la identidad propia que exige §10. `bin` pasa a `rscg`/`rscg-install`: mantener `rsc` significaría que una instalación global del padre y una del fork se pisan, y el proyecto perdedor queda conducido por el CLI del otro, en silencio |
| **Comando ejecutable** | `npx @lema017/rsc-governed …`, `rscg sync`, `rscg doctor` | **renombrar** | Un mensaje que dice «ejecuta `rsc sync`» es **falso** cuando el binario es `rscg`. Esto incluye los textos de ayuda, los mensajes de error, las acciones de `doctor` y los cuerpos de los agentes generados |
| **Contrato en disco de un consumidor** | `.rsc/`, `.rsc.json`, `.rsc-state.json`, `.rsc/skills/`, `.codex/rsc/`, `.dsh/skills/` | **NO renombrar** | Renombrar rompe **toda** instalación existente, y además los leen el transformador, los 18 adaptadores y el instrumento del criterio 4. Es el único sitio donde «no tocar» es tan cargado de significado como «tocar» |
| **Protocolo con el exterior** | `RSC_NO_UPDATE_CHECK`, `RSC_LATEST`, `RSC_AUTO_UPDATE_CMD`, `RSC_ONBOARDING_INCOMPLETE`, `rscFixes`, los marcadores `rsc-governance:begin/end` | **NO renombrar** | Son contratos con cosas de fuera de este paquete: configuraciones de hook que un consumidor ya commiteó, y códigos de error que usuarios y CI emparejan. `RSCG_*` habría sido más limpio y habría roto todos |

### Tres trampas que el barrido encontró, y que un `sed` se habría llevado por delante

1. **`targets/memslop-offer.mjs` apunta a `ericrisco/mem-slop`**, que es **otro proyecto** del mismo autor, no el arnés. Un `grep ericrisco | sed` lo habría convertido en un 404. Test: `gi04`.
2. **`.rsc memory was tracked`** — el renombrado `\brsc (memory)\b → rscg memory` sí lo tocó, porque `.` es un no-palabra y `\b` casa dentro de `.rsc`. Convirtió una **ruta** en `.rscg memory`. Detectado y corregido con un barrido de `\.rscg`; está en `VERIFICATION.md` como defecto propio.
3. **`rsc` como nombre de subsistema, no de comando.** Cuatro excepciones documentadas que el renombrado deja intactas porque la palabra siguiente coincide con un subcomando por casualidad: `rsc copy guard:` (una etiqueta), `rsc memory:` (prefijo de salida de hook), `rsc knowledge-sync (` y `rsc knowledge-sync —` (idem). En ninguna se podía copiar y pegar nada, así que renombrarlas no arreglaba nada y sí rompía aserciones de hook.

### `rscFixes` se conserva con su nombre, y eso no es pereza

`targets/auto-update.mjs` lee `doc.rscFixes` del documento `/latest` del registro, que **es** el `package.json` publicado. Renombrar la clave habría vaciado el canal **en silencio**: el aviso seguiría apareciendo, sin síntomas, y nada habría fallado. Test `gi08` lo convierte en algo que falla si se rompe.

Las entradas heredadas (versiones 2.0.6–3.3.0) se conservan. `fixesSince` filtra por `isNewer(fixedIn, installed)`, así que para un consumidor en 3.7.x no aportan ninguna línea; conservarlas preserva la historia del arnés sin coste.

### La versión sigue a upstream, y es una decisión

**3.7.4**, el mismo número del commit incorporado. `catalog-version` del esquema de personalización registra «la versión del catálogo contra la que se revisó esta decisión», y toda la maquinaria de las Etapas 1 y 3 cita `3.7.4`. Un fork que reempezase en `0.1.0` dejaría esos registros ilegibles contra upstream. No hay riesgo de colisión porque la comprobación de actualización compara `.rsc/.version` contra **el documento del registro del fork**, nunca el del padre.

---

## 2. Lo que el renombrado estuvo a punto de romper, y que ningún test heredado cubría

Esta es la parte del diseño que importa, y vale escribirla como aviso para la Etapa 5 y para el mantenimiento mensual.

`targets/auto-update.mjs` guarda el nombre del paquete **dos veces**, y las dos son del tipo peligroso: la URL del registro que vigila, y el `argv` de `npx` que lanza en segundo plano. **Ningún test heredado toca ninguna de las dos.** Todos cortocircuitan la consulta con `RSC_LATEST`/`RSC_LATEST_JSON` y sustituyen el instalador con `RSC_AUTO_UPDATE_CMD`, precisamente para que la suite siga siendo offline.

Consecuencia que conviene tener escrita: **un fork que renombrase su paquete y dejase esas dos cadenas intactas habría pasado la suite completa y habría enviado a cada consumidor a instalar el padre encima del fork, en segundo plano, con temporizador.** Es literalmente el accidente que §10 pide evitar, y la suite no lo habría visto.

Por eso `gi05` afirma **sobre el código fuente** en vez de sobre el comportamiento, que es lo contrario de lo que suele ser correcto. Y `gi10` afirma sobre **la copia instalada** en `.rsc/auto-update.mjs`, porque «la fuente está bien» y «la copia que corre en la máquina del consumidor está bien» no son la misma afirmación — ésa es la corrección de B-R2 medida en vez de declarada.

### Lo que NO se arregló, y el argumento de por qué

El barrido de `gi11` encontró un defecto real de §10 que **esta etapa no debe cerrar sola**: `skills/` nombra al padre **81 veces**, **10 de ellas en el cuerpo always-on**, incluida `npx @ericrisco/rsc add <id>` — una instrucción **ejecutable** en la superficie que Claude Code reemite en cada arranque de sesión y tras cada compactación.

`PLAN.md` §3 ya asignó la respuesta: *«El renombrado de identidad forma parte de la misma transformación … un paso mecánico y auditable del mismo transformador, no con ediciones a mano.»* Pero esa transformación tiene dos propiedades declaradas que esta etapa no rompe desde el costado:

- **Reversibilidad.** `scripts/lib/governance.js` declara *«IDEMPOTENT BY SUBTRACTION, NOT BY DETECTION»*, y `tests/md-block-fidelity.test.js` afirma que estampar el bloque y quitarlo deja el archivo byte-idéntico. Reescribir identidad dentro de `transformSkillMd` **rompe** `stripGovernance(transform(x)) === x`.
- **Identidad byte-a-byte del always-on.** `writeAlwaysOn` envía `skills/suggest/SKILL.md` sin tocar a propósito, para que *«the governance cost of that surface is exactly zero bytes»* sea una afirmación exacta y comprobable; `tests/governance-always-on.test.js` y el instrumento del criterio 4 la afirman. Reescribir identidad sólo ahí **rompe** esa afirmación.

Cualquiera de las dos es una decisión sobre la invariante de otra etapa, tomada en una ronda paralela. El briefing de esta etapa es explícito: *«Si el renombrado rompe algo que §2 obliga a preservar, párate y repórtalo en vez de romperlo.»* Aquí es el caso simétrico — **no** renombrar rompe §10 — y la respuesta correcta es la misma: medirlo, fijarlo con un test, y reportarlo.

Así que `gi13` **fija el conteo**: 81 en el catálogo, 10 en el cuerpo always-on, y la copia enviada byte-idéntica. Si upstream cambia, o si el transformador empieza a reescribir identidad, el test lo dice en voz alta. Una limitación que nadie cuenta es una limitación que deriva.

---

## 3. Distribución: qué se puede prometer cuando las Actions están apagadas

Comprobado, no supuesto: `gh api repos/lema017/rsc-harness/actions/permissions` → `{"enabled":false,"sha_pinning_required":false}`, y `actions/workflows` → `total: 0`. Existen tres archivos de workflow y **ninguno está registrado ni puede correr**.

De ese único hecho se deducen las dos limitaciones de §2 de `DISTRIBUTION.md`, y conviene ver que **no son dos problemas, son uno**:

- **Provenance** exige, en palabras de la documentación de npm, *«a supported cloud CI/CD provider and a cloud-hosted runner»* — GitHub Actions o GitLab CI/CD. Un `npm publish` desde un portátil no puede llevar provenance: el flag no tiene de dónde sacar una identidad OIDC.
- **Trusted Publishing** es OIDC desde dentro de un workflow de CI. Proveedores soportados: GitHub Actions (runners de GitHub), GitLab CI/CD (runners compartidos de GitLab.com) y CircleCI (cloud); los runners autoalojados **no** están soportados.

Dos datos que cambian la recomendación y que verifiqué en la documentación en vez de recordarlos:

1. **Trusted Publishing genera provenance automáticamente** desde GitHub Actions y GitLab CI/CD, sin el flag `--provenance`. Así que encender Actions y migrar entrega **las dos cosas** a la vez, y permite retirar tanto el flag como el secreto `NPM_TOKEN`.
2. **No** la entrega vía CircleCI, que npm excluye explícitamente. Una migración a CircleCI satisfaría «Trusted Publishing» y **fallaría** «provenance» — exactamente la media respuesta que `PLAN.md` §8 pide documentar en vez de afirmar.

**La decisión:** Trusted Publishing es el destino correcto y está **bloqueado por un ajuste del repositorio que el fork no cambia por su cuenta**. No se intenta mientras las Actions estén apagadas, porque configurar una relación de confianza OIDC para un workflow que no puede correr es una configuración que nadie puede verificar — y configuración no verificable es exactamente lo que esta sesión lleva ocho secciones de ledger castigando.

### Permisos mínimos: estaban mal, y de la forma que importa

`release.yml` tenía `contents: write` + `id-token: write` a nivel de **workflow**, así que el job `news` — que sólo lee tags — recibía el token capaz de empujar a `main` y de acuñar una identidad OIDC para npm. El mínimo privilegio es **por job**, no por workflow. `ci.yml` **no tenía bloque `permissions:` en absoluto**, así que heredaba el permiso por defecto del repositorio, que puede ser de escritura — el hallazgo que `ARCHITECTURE.md` §"Dónde pueden correr" ya había señalado.

Y de paso, la puerta que mentía: el `! grep` de `ci.yml` convertía el **exit 2 de grep** —«no pude terminar el escaneo»— en **PASS**. Ahora distingue tres estados. Es textualmente lo que prohíbe `skills/verify/SKILL.md`: una comprobación que no puede correr no debe informar éxito. Es el mismo patrón que `eval-lint.sh` (falla en abierto) y la misma corrección.

### 2FA: no verificado, y el 401 es la prueba de que el aislamiento funciona

`npm profile get` con `HOME` apuntando al temporal dedicado → `E401 Unauthorized`. Eso **no** es un hallazgo sobre la cuenta: es el aislamiento haciendo lo que §1 ordena. 2FA es un ajuste de **cuenta** y leerlo exige la sesión del mantenedor, que estos procesos no tienen y no deben tener. Queda **NO VERIFICADO con su motivo**, que es lo que exige la regla de la casa, y el dueño del repositorio tiene que confirmarlo él.

---

## 4. Recuperación y D13: por qué «nombrar» es mejor que «arreglar»

D13 no se rediscute. Lo que sí vale escribir es el argumento, porque es contraintuitivo: **aquí la conducta correcta parece un defecto.**

`restore` es una máquina del tiempo. Hay dos escritores dentro de `.rsc/skills/` — `governBase`, que aplica el contrato, y `restoreEntry` de `scripts/lib/backups.js`, un `cpSync` crudo, que no — y `createBackup` corre **antes** de que la instalación escriba. Luego una instantánea tomada sobre una base que venía de upstream la captura **sin gobernar**, y devolverla sin gobernar es **literalmente lo que se pidió**. Re-gobernar al restaurar le daría al usuario un estado que no pidió, que es un fallo peor que el que oculta.

Lo que faltaba no era semántica: era que **nadie lo decía**, mientras los 17 destinos de symlink leen el archivo restaurado de inmediato. Tres sitios, y el reparto no es arbitrario:

| Sitio | Qué dice | Por qué ahí |
|---|---|---|
| `rscg restore` | Nombra cada base sin contrato, afirma que *el restore es correcto*, dice que un sync lo repone y que la transformación es idempotente | Es el momento en que ocurre. Un aviso que llega después es un aviso que no llega |
| El rollback de onboarding | `RSC_ONBOARDING_INCOMPLETE` nombra lo que el rollback dejó atrás | Es el **mismo** `restoreBackup`, invocado automáticamente. El matiz se conserva: un rollback devuelve el proyecto a un estado en el que ya estuvo, así que no inventa una falta de contrato que no estuviera |
| `rscg doctor` | Reporta la cuenta y los ids, **sin tocar `healthy`** | Es donde se mira sin que haya pasado nada. Y `healthy` significa «el arnés instalado funciona», que es lo que leen CI y las extensiones de editor desde #277; una skill sin gobernar **funciona**, sólo que sin contrato |

Y el aviso es **silencioso cuando no hay nada que decir** (`gr05`). Un aviso que sale siempre es un aviso que nadie lee.

### `rscg conformance` y el pecado que esta sesión ya cometió una vez

El fondo del hallazgo de la Etapa 4 lo dijo el agente mejor que el briefing: *«el validador del criterio 4 corre en el repositorio del fork, no en la máquina del consumidor»*. Ningún comando del producto respondía «¿están gobernadas mis 274?».

La tentación era escribir un validador nuevo, más simple, en el CLI. Eso es **exactamente** el defecto que esta sesión ya cometió con `contract-v1.md`: una copia que deriva. Así que:

**La auditoría se extrajo, no se duplicó.** `auditBase`, `auditDelivery` y `alwaysOnSurface` viven ahora en `scripts/lib/conformance.js`, una sola definición cada una, y `scripts/verify-catalog-conformance.js` las **importa y re-exporta**. `gr09` afirma que el instrumento de la Etapa 4 y el CLI comparten el **mismo objeto función**, no dos funciones que casualmente coinciden.

Por qué una lib nueva y no importar del script: `verify-catalog-conformance.js` importa `install-apply.js` (necesita `applyInstall` para instalar las 274) y tiene un `await` de nivel superior. `rscg conformance` no necesita ni una cosa ni la otra — no instala nada —, y `onboarding-apply.js`, que también consulta la auditoría en el rollback, habría cerrado un ciclo de imports. La extracción resuelve las tres cosas sin duplicar una línea.

**Por qué las entregas son opcionales.** `auditInstalledProject({ deliveries: false })` existe para `doctor`: auditar las 18 entregas de cada skill convierte un diagnóstico en un barrido. La frontera queda afirmada en `gd06` — `doctor` responde barato, `rscg conformance` responde completo — porque si alguna vez se invierte, `doctor` se vuelve lento para todo el mundo.

### El código de salida, que es la parte que un CI lee

`rscg conformance` sale **1** cuando **corrió** y encontró algo, y **0** cuando no hay nada instalado. «Aquí no hay nada instalado» es un hecho sobre el proyecto, no un fallo de conformidad, y un CI que lea el código no debe confundirlos (`gr10`). Es la misma distinción que el validador de personalizaciones hace con la ausencia de `02-DOCS/wiki/skills/`.

---

## 5. Los dos huecos del instrumento del criterio 4, y lo que enseñan

La revisión independiente de la Etapa 4 encontró dos clases de fallo que el instrumento **declaraba medir y no medía**, y las demostró por mutación: el instrumento seguía informando `274/274, failures: 0` con el código roto. Viajaron verbatim a la extracción, que es lo que pasa cuando se extrae bien. Corregidos los dos, y **probados por mutación** en vez de por lectura.

### (A1) La clase symlink no se medía

El código era:

```js
if (lstatSync(dir).isSymbolicLink() && realpathSync(dir) !== realpathSync(basePath)) bad.push(…)
```

Si el directorio **no** es symlink, la rama no se entra y no hay hallazgo. Y la comparación de bytes que quedaba es byte-idéntica justo después de instalar **por construcción**. Mutación que lo prueba: forzar el camino de Windows de `linkOrCopy` (`cpSync`) → las 18 entregas pasan a ser copias reales y el instrumento dice 274/274.

La corrección separa las dos condiciones y añade `deliveryKind()`, **una definición con dos usos**: la auditoría la convierte en hallazgo y el informe la **cuenta**. Porque la frase de `CONTRACT.md` §1 sobre «17 de 18 destinos enlazan a la base» es justo la que hace falta poder sostener con un número, y nada lo estaba produciendo. Ahora sí: **17 destinos × 274 symlink, `cursor` × 274 `.mdc`**, medido en las tres pasadas.

En Windows copiar es **correcto por diseño**, así que ahí la clase se mide de otro modo —`treeDifferences`, el subárbol entero contra la base— y se declara como límite **L-D7**, porque esa rama nunca se ha ejecutado.

El hallazgo que esto deja: una copia que deja de seguir a la base **no falla en el momento de instalar**. Falla en el siguiente cambio gobernado, en silencio, para siempre. Es precisamente el fallo que un validador de conformidad existe para atrapar, y era el que no atrapaba.

### (A2) Los duplicados no se medían en el `.mdc` de Cursor

El `.mdc` es la **única** entrega realmente transformada, y la única donde el propio instrumento dice que un fallo de renderizado sería invisible al validador de la base y al digest. El bloque se extraía con `match(…)[0]` — la **primera** coincidencia — y el conteo de marcadores vivía sólo en `auditBase`, que nunca corría sobre un `.mdc`. Mutación: duplicar el cuerpo en `targets/cursor.js` → 2 marcadores de apertura, 2 de cierre, 35 712 B en vez de 17 885, y `274/274, failures: 0`.

Tres correcciones, no una:

1. Contar `opens`/`closes` en la rama `cursor`, como hace `auditBase`.
2. Exigir que el bloque **abra el cuerpo** tras el frontmatter que `targets/cursor.js` reescribe — «read this before applying the skill below» es falso si el bloque está en otro sitio, y la versión de esa comprobación en la base no puede hablar por un archivo cuyo frontmatter se sustituyó.
3. **Añadir el `.mdc` a la comparación de idempotencia** de las pasadas 2 y 3. Antes sólo se comparaban las bases, y el `.mdc` es el único artefacto **re-renderizado**: es el único sitio donde una no-idempotencia del renderizador podría manifestarse. Medido: **274/274 byte-idénticos** en las dos re-pasadas.

### El suelo del denominador

Todas las razones que el instrumento imprime son `n/ids.length`, así que un `skills/` truncado informaría «273/273, failures: 0» y parecería perfecto. §3 prohíbe fijar el número en el código —*«no fijes el número de skills en el código»*—, así que el suelo es un **cruce** contra `manifest.json`, que `npm run manifest:check` mantiene al día, más un `--expect <n>` explícito para una puerta de release que quiera fijar lo que midió. `gg24` afirma las dos cosas, incluida la ausencia de un literal `274` en el código.

---

## 6. La segunda raíz del validador (decisión 2 del coordinador)

`BROWNFIELD.md` §6 ítem 2 nombra el defecto exacto: `validateCustomizations` recorría **una** raíz, y el informe de la corrida y los registros de conflicto de `02-DOCS/wiki/brownfield/` **no los leía nada** (`grep -rn brownfield scripts/ package.json` → vacío). Luego las 16 reglas de `CONFLICT-RECORD.md` §7 y 22 propiedades deterministas de `DESIGN.md` §5 eran **decidibles y no instrumentadas** — el mismo defecto que la revisión de la Etapa 1 le encontró al validador de personalizaciones, un documento después.

### Qué se instrumentó y qué no, sin redondear

| Reglas | Estado | Nota |
|---|---|---|
| 1–12, 15 | **instrumentadas** | Decidibles desde el archivo. Cada hallazgo nombra el archivo, el registro, la posición y la regla |
| 13 (puerta greenfield) | **instrumentada, con el hecho inyectado** | Decidirla exige recorrer el árbol del proyecto (`scanProject`), que `install`/`sync` no tienen por qué pagar. Lo calculan `rscg brownfield --validate` y `npm run gate`; en `install`/`sync` la regla se reporta como **NOT RUN** |
| 16 (suelo de recall) | **instrumentada** | Única regla que comprueba *recall*. Umbral `0.45`, el del llamador real; colisiones + aristas `recommends:` + nombrados en cláusula `NOT`. Cero ejecuciones de agente |
| 14 | **NO instrumentada**, declarada | «Una posición `FIXTURE` nunca se cuenta como evidencia de proyecto por ningún paso posterior» es una propiedad de un paso **posterior**, no de un archivo. No hay nada aquí que comprobar, y se declara en vez de contarse como cubierta |

**La severidad `not-run` existe por esto.** Un validador con dos modos —error y silencio— obliga a elegir entre «falla una regla que no pude comprobar» y «callo como si hubiera pasado». Las dos son mentiras. `not-run` se imprime con su etiqueta, no cuenta como error, y `errorsOf` la excluye del código de salida. `gg18` afirma las tres cosas a la vez.

### Un defecto propio que el test negativo encontró, y que vale más que las reglas

`gg05` —«un informe bien formado no produce errores»— falló con un hallazgo **falso**: *«C1 lists 1 alternative»* sobre un registro con dos. La causa: `$` bajo el flag `m` significa **fin de línea**, no fin de entrada, y `^` necesita `m`. Luego **cada lookahead del parser truncaba su campo en el primer salto de línea** — y `Impact` y `Confidence` son rutinariamente de dos líneas. Había un cuarto sitio con `\Z`, que **no es un escape de JavaScript**: casaba una «Z» literal, y la expresión sólo funcionaba porque un encabezado posterior casaba primero.

La lección operativa, que es por qué los tests de esta etapa son casi todos negativos: **un test que afirma «no hay hallazgo de tipo X» no habría visto nada de esto.** `gg05` afirma que la lista de errores está **vacía**, así que un defecto del parser aparece como un **hallazgo falso** y no como un silencio.

### El umbral `0.45`, y por qué no `0.80`

`0.80` es `FLOORS.maxCollision`, un **techo de fallo**: medido sobre estas 274 produce **cero** parejas. Un conjunto de candidatos construido a `0.80` informaría «sin competidores» siempre y parecería funcionar siempre. `0.45` es el que usa el auditor real del catálogo. `rscg brownfield` imprime las dos cosas —el umbral y por qué no es el otro— porque un número sin su motivo es un número que alguien «corregirá».

---

## 7. `rscg brownfield` (decisión 1 del coordinador)

`BROWNFIELD.md` §1 ya había fijado la forma: el procedimiento es un **documento** propiedad del paquete, regenerado en `.rsc/governance/brownfield-v1.md` en cada instalación, **no** una skill 275 (una skill nueva movería la invariante byte-idéntica de `skills/` y el conteo 274/274 del validador). Se invoca **explícitamente**, y una corrida cubre **sólo las skills seleccionadas**.

Lo que el comando añade sobre «lee este documento» es la parte determinista, y es la parte cara de B1:

1. **Entrega el procedimiento por ruta**, y dice en voz alta cuando **falta** —«no improvises el procedimiento»— en vez de degradar a una versión de memoria.
2. **Calcula el conjunto candidato de competidores**: toda colisión ≥ `0.45`, toda arista `recommends:`, todo nombrado en cláusula `NOT`. Es el criterio de parada de cobertura de B1, el único suelo de recall del diseño, y cuesta **cero ejecuciones de agente** porque el catálogo está en disco.
3. **Con `--validate`**, corre las reglas sobre los informes que ya existen.

Y dice **lo que no hace**: no lee el proyecto. El recall project↔skill no tiene instrumento en ningún sitio del diseño — una corrida que lee el proyecto y no encuentra nada pasa las dieciséis reglas, incluido el suelo, porque el suelo sólo pregunta por parejas computables del catálogo. Eso se imprime en la salida del comando, no sólo en un documento interno: es la corrección que la revisión de la Etapa 3 llamó «la honestidad sube al producto en vez de bajar del documento».

### El procedimiento se envía por `governance-sync`, con su par autoritativo

`docs/fork/stage3/BROWNFIELD.md` → `schema/governance/brownfield-v1.md` es un tercer par en `scripts/governance-sync.js`, junto al preámbulo y el contrato. Mismo mecanismo y mismo motivo: el paquete envía `schema`, no `docs`, así que en la máquina de un consumidor el archivo autoritativo no existe. `npm run governance:check` afirma que la copia enviada es byte-idéntica a su fuente, de modo que una edición a mano en la copia **falla un binario** en vez de derivar.

---

## 8. `npm run gate`: composición heredada, no inventada

La tentación era elegir las comprobaciones por criterio propio. No hacía falta: `ARCHITECTURE.md` §"Qué se adopta, qué se arregla, qué se descarta" ya había dictaminado sobre **cada** comprobación heredada. La puerta es exactamente las **cuatro que adopta** (`validate`, `manifest:check`, `drift:check`, `originality:check`), más las **dos que el fork añadió** (`governance:check`, `governance:customizations` sobre las dos raíces), más la **invariante de la Estrategia B**, que es lo que el fork *es* y que ninguna puerta heredada podía contemplar.

Dos propiedades valen tanto como las comprobaciones:

- **Imprime lo que no cubre, con su motivo.** Ocho exclusiones, cada una con la frase que la explica. Una puerta que esconde su propia cobertura es peor que una que comprueba menos — y «7/7 passed» sin esa lista se lee como «todo está bien».
- **Lo que no puede correr imprime `SKIP`, nunca `PASS`.** `skills-invariant` necesita un ref `origin/main`; en un clon sin él lo dice y dice qué lo haría ejecutable. `gg03` lo prueba sobre un `git init` vacío.

La cifra de «130 s» de `ARCHITECTURE.md` era una suma manual de seis scripts. La puerta mide **entre 1,6 s y 36,7 s** sobre trabajo idéntico, según lo que más esté corriendo en la máquina; lo afirmable es **segundos, no minutos**. Ésa es la fila que se corrigió en `CUSTOMIZATION-SCHEMA.md` §3 — la única fila de ese archivo que esta etapa tenía permiso para tocar.

---

## 9. Lo que esta etapa deja abierto

### 9b. Un dato que la Etapa 5 necesita y que esta etapa cambió por seis

`ARCHITECTURE.md` lleva la **CORRECCIÓN 5** de la Etapa 5, que mide la superficie de divergencia
contra la base `481b1ec9` en vez de escribirla a mano — diseño correcto, porque una lista escrita se
queda corta y la suya ya lo demostró. Pero la **cifra** que registra es de antes de esta etapa:

```
$ git diff --name-only --diff-filter=M 481b1ec9 HEAD -- . ':!docs/fork' | wc -l
8                                    # lo que mide hoy el árbol commiteado

$ git diff --name-only --diff-filter=M 481b1ec9 -- . ':!docs/fork' | wc -l
51                                   # incluyendo el trabajo de esta etapa
```

**De 8 a 51.** El renombrado de identidad es, como decía el encargo, el cambio más ancho del fork, y
ahora tiene un número: toca 43 archivos que la lista de vigilancia de la Etapa 5 todavía no conoce
(`scripts/rsc.js`, `targets/auto-update.mjs`, los 18 adaptadores afectados, `.github/workflows/ci.yml`…).

Dos consecuencias, ninguna de las cuales es un defecto de la Etapa 5:

1. **Su máquina las recogerá sola**, porque mide en vez de leer una lista. Eso es exactamente lo que
   su corrección existía para garantizar, y aquí se le aplica el primer caso real.
2. **El coste del merge mensual sube**, y conviene saberlo antes del primer mantenimiento: los
   conflictos ya no se concentran en el transformador, sino también en cada archivo donde el fork
   reescribió una cadena que upstream sigue editando. La mitigación es la de siempre y no cambia —
   `skills/` sigue byte-idéntico, que es donde está el volumen — pero la cifra honesta de la
   superficie que sí diverge es **51**, no 8.

---

| # | Qué | Dueño propuesto |
|---|---|---|
| 1 | **El renombrado de identidad dentro de la transformación** (L-D5): 81 referencias al padre en el catálogo congelado, 10 en el cuerpo always-on, una de ellas ejecutable. `PLAN.md` §3 ya lo asigna a «la misma transformación»; choca con la reversibilidad de `transformSkillMd` y con la identidad byte-a-byte de `writeAlwaysOn` | Coordinador: decidir entre reescribir en la transformación (y cambiar `md-block-fidelity`) o sólo en `writeAlwaysOn` (y cambiar la afirmación de identidad byte-a-byte). **No es una decisión de una etapa en paralelo** |
| 2 | **Encender Actions**, y con ello provenance y Trusted Publishing de golpe | Dueño del repositorio. Nada en el código lo bloquea |
| 3 | **Confirmar 2FA** en la cuenta de npm (L-D3) | Dueño del repositorio; no es verificable desde aquí por diseño |
| 4 | **Rama de Windows del audit de entregas** (L-D7): `treeDifferences` está escrito y nunca se ha ejecutado | Sin entorno. Límite residual |
| 5 | **Regla 14 sin instrumento** (L-D8) | Declarada. Haría falta un paso posterior que leyera los registros |
| 6 | **Recall project↔skill** sigue sin instrumento, y sigue siendo el hueco más grande del diseño | Ya declarado como cobertura pendiente por la Etapa 3 (≈48 ejecuciones contra un techo repartido). Esta etapa no lo cierra ni finge cerrarlo |
