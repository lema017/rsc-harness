# Etapa 7 — Verificación: README, imágenes y documentación

**Alcance:** `REQUIREMENTS.md` §13 (los nueve apartados del README y las dos imágenes), `PLAN.md` §2
obligaciones 2, 5 y 6 (copyright, tabla de terceros, nota del corpus de originalidad), y los
criterios de aceptación **15** (README con las dos imágenes, fuentes editables, texto alternativo y
renderizado validado en GitHub) y **16** (versiones, commits y limitaciones residuales documentadas,
incluida Windows y los límites por asistente).

**Archivos entregados.** `README.md` (reescrito; **412** líneas al entregar, **484** tras la pasada
de correcciones de §11 — la entrega decía «410», que era falso por dos, medido con `wc -l`),
`SECURITY.md` (reescrito; 86 al entregar, **89** tras §11), **los tres** SVG de
`docs/fork/diagrams/` corregidos contra la implementación (el `02` entero en la pasada de §11, ver
A5 ahí, y el `01` y el `03` dos líneas cada uno),
`site/{index.html,es/index.html,llms.txt,sitemap.xml,robots.txt,diagram.svg,assets/rsc.js}`,
`tests/product-surfaces.test.js` (nuevo; 7 comprobaciones al entregar, **9** tras §11),
`package.json` (dos campos, §11 M4) y este documento.

> **Esta etapa fue BLOQUEADA por la revisión independiente** (ledger §2y: 5 ALTA, 12 MEDIO, 7 BAJO).
> El diagnóstico, que es el que importa: **validó los diagramas contra la implementación y no validó
> la prosa.** Las correcciones están en **§11**, y las afirmaciones falsas de este propio documento
> se han corregido **en su sitio**, no sólo añadido al final.

**Entorno.** Todo lo ejecutado aquí corrió con `. ./.fork-tmp/env.sh` (`HOME`, `TMPDIR`,
`XDG_*`, `npm_config_cache` y `GIT_CEILING_DIRECTORIES` dentro de `.fork-tmp/`). Sin instalaciones
globales, sin credenciales expuestas a ningún proceso del repositorio, sin commits, sin cambios de
ajustes del repositorio o de la cuenta, sin habilitar Actions y sin publicar nada. Las consultas a
`gh api` y por HTTP son **de lectura** sobre repositorios y registros públicos.

**Invariante de Estrategia B, comprobada al cerrar:**

```
$ git diff --numstat origin/main -- skills/
                                   # (vacío — 0 líneas)
```

---

## 1. Las dos imágenes que exige §13

| §13 pide | Archivo | Estado |
|---|---|---|
| 1. Skill → personalización opcional → ejecución | `docs/fork/diagrams/01-customize-existing-skill.svg` | entregada, corregida |
| 2. Mantenimiento manual → análisis y validación → publicación → actualización de proyectos | `docs/fork/diagrams/03-upstream-maintenance.svg` | entregada, corregida |
| *(extra, permitida)* alta de una skill en upstream | `docs/fork/diagrams/02-add-new-skill.svg` | **corregida en §11.** La entrega decía aquí *«sin cambios; no la desmiente nada de lo revisado»* y **eso era falso contra la tabla §2 de este mismo documento**: conservaba cinco de las nueve afirmaciones que §2 declara muertas, en el dibujo **y** en el `<desc>`, y el README lo enlaza. Certificar limpio un archivo que no se abrió es el defecto que la revisión llamó «validó los diagramas y no validó la prosa», cometido sobre un diagrama |

**Fuentes editables:** los tres archivos **son** la fuente. Son SVG escritos a mano, con `<style>` en
línea y texto en elementos `<text>`; no hay exportación binaria ni fuente paralela que pueda
desincronizarse. Esa es la razón por la que las correcciones de esta etapa son ediciones de texto
verificables una a una y no un re-render.

### 1.1 Propiedades de seguridad y accesibilidad — comprobadas, no asumidas

Comprobado con `xml.dom.minidom` sobre los tres archivos:

```
01-customize-existing-skill.svg  XML-OK role=img title=1 desc=1 bad=none ext-href=none import=False font-face=False
02-add-new-skill.svg             XML-OK role=img title=1 desc=1 bad=none ext-href=none import=False font-face=False
03-upstream-maintenance.svg      XML-OK role=img title=1 desc=1 bad=none ext-href=none import=False font-face=False
```

`bad` busca `script`, `foreignObject`, `image` e `iframe`; `ext-href` busca cualquier `href`/
`xlink:href` absoluto. Las tres son **cero**, y cada archivo lleva `role="img"` con `<title>` y
`<desc>` — el texto alternativo que pide §13. El `<desc>` de cada diagrama se corrigió con el mismo
cuidado que el dibujo: un lector de pantalla no puede quedarse con la versión obsoleta.

### 1.2 Renderizado en GitHub — medido en tres pasos, no supuesto

El criterio 15 pide «renderizado validado en GitHub». No se puede validar el README publicado porque
esta etapa **no commitea**, así que lo que se validó es la cadena completa que lo determina, y cada
eslabón por ejecución.

**Paso 1 — GitHub reescribe una ruta relativa de imagen a su propio host.** Medido en un repositorio
público ajeno cuyo README usa rutas relativas (`dernasherbrezon/r2cloud`), leyendo el DOM de la
página renderizada:

```
src = "/dernasherbrezon/r2cloud/raw/master/docs/diagram.png"     // el markdown dice docs/diagram.png
```

**Paso 2 — esa forma de URL sirve los SVG de este fork como imagen decodificable**, ejecutado desde
el origen `https://github.com`:

```js
new Image().src = 'https://github.com/lema017/rsc-harness/raw/fork/bootstrap/docs/fork/diagrams/01-customize-existing-skill.svg'
→ decode() ok, naturalWidth 1240, naturalHeight 850
   fetch → status 200, content-type image/svg+xml
```

**Paso 3 — control independiente por `raw.githubusercontent.com`**, los dos diagramas de §13:

```
01-customize-existing-skill.svg  200  image/svg+xml   decode 1240×850
03-upstream-maintenance.svg      200  image/svg+xml   decode 1240×820
```

Y, como testigo de que un `<img>` a un SVG sí se decodifica dentro de un README de GitHub, el README
del padre, cuya `site/lanes.svg` decodifica a 1200×700 en la página real.

**Por eso el README usa rutas relativas** (`docs/fork/diagrams/01-….svg`) y no una URL absoluta con
rama: la ruta relativa se resuelve contra la rama que el lector está viendo, así que funciona hoy en
`fork/bootstrap` y seguirá funcionando en `main` tras la fusión, sin que nadie tenga que reescribir
el README cuando la rama desaparezca. El coste es que en la página de npm esas imágenes dependen del
reescritor de npm; se acepta a cambio de que la propiedad que **el criterio nombra** —GitHub— sea la
que no puede romperse.

**Inspección visual.** Los dos archivos se abrieron renderizados y se fotografiaron. Se ven como una
tarjeta clara sobre el tema oscuro de GitHub, por el `<rect fill="#ffffff">` opaco: legible, no roto.

### 1.3 Desbordamiento de texto — medido con una mutación que lo prueba

Tras editar los textos, el riesgo real no es el XML sino que una línea nueva se salga de su caja.
Medido en el documento renderizado comparando `getComputedTextLength()` de cada `<text>` contra el
ancho disponible de su `<rect>` contenedor más pequeño:

```
01-customize-existing-skill.svg   53 textos, overflow: []
03-upstream-maintenance.svg       94 textos, overflow: []
```

**Y el comprobador se mutó antes de creerle:** alargando un texto con 40 caracteres de relleno, el
comprobador lo señala (`len 519 > avail 232`) y al restaurar vuelve a `0`. Una comprobación de
desbordamiento que no sepa fallar mide lo mismo que no comprobar nada.

**Re-medido en §11 sobre los tres archivos, y publicando el margen en vez de un booleano**, que es
el dato que de verdad dice si cabe. Ningún `<text>` cruza su `<rect>`, y el más justo de cada
diagrama:

```
01-customize-existing-skill.svg   53 textos, 0 cruces, margen mínimo 13 px  («governance preamble, paid on load, not per turn»)
02-add-new-skill.svg              69 textos, 0 cruces, margen mínimo 36 px  («Least privilege done; 2FA unproven.»)
03-upstream-maintenance.svg       94 textos, 0 cruces, margen mínimo 27 px  («promoted without conformance (G3).»)
```

Los 13 px del `01` son **anteriores a esta pasada** y no los introduce ninguna corrección: esa línea
no se ha tocado en ninguna de las dos. Se publica porque un «0 desbordes» con una holgura de 13 px
y otro con 36 no son el mismo resultado, y el booleano los igualaba. La mutación se repitió sobre
una línea **nueva** del `02` (`len 437 > avail 224` con 40 caracteres de relleno, `0` al restaurar).

---

## 2. Correspondencia con la implementación — frase por frase

Esto es lo que §13 llama «correspondencia con la implementación» y era lo único del encargo que
**no** estaba verificado. Los diagramas se dibujaron antes de las Etapas 5 y 6; nueve afirmaciones
dejaron de ser ciertas.

### 2.1 Diagrama 03 — mantenimiento

| Afirmación del diagrama | Qué mide la implementación | Acción |
|---|---|---|
| **`rscg upstream`** como punto de entrada | **No existe.** El punto de entrada son `npm run upstream:check` y `npm run upstream:maintain` (`MAINTENANCE.md`, *«The monthly run»*). Y no puede ser un subcomando de `rscg`: **D15** excluye la maquinaria de mantenimiento del tarball *«Y nada de mantenimiento en `bin`»*, porque §10 dice que los consumidores no integran upstream | corregido a `npm run upstream:check` + `npm run upstream:maintain`; el README añade por qué no es un subcomando |
| *«queries upstream and stops if there is nothing new»* | **Cierto.** `MAINTENANCE.md` §1: *«If upstream has nothing new it says so and stops, having prepared nothing»* | se conserva |
| *«publication happens only with the authorization given for that run»* | **Cierto.** `--authorize <survey\|integrate\|validate\|publish>`, y `--promote` *«needs `publish` and a pass»* | se conserva |
| *«consumers update themselves within the same major»* | **Cierto y medido.** `DISTRIBUTION.md` §3.3: `gi05`, `gi07`, `gi10`, `gi11` sobre la URL del registro, el `argv` de `npx`, la copia instalada del hook y un barrido recursivo | se conserva |
| «semantic evaluations cover new and modified skills plus a seeded stratified sample» | **G11 no está instrumentado** (`MAINTENANCE.md`, *«The semantic evaluations are not instrumented»*) y **ninguna evaluación se ha ejecutado**: no hay resultados en `docs/fork/` y el presupuesto de `EVALUATION.md` sigue sin gastar | corregido a *«specified, NOT instrumented and not yet executed (G11)»*, en el dibujo y en el `<desc>` |
| «Full suite takes 2 h 17 m» | **Cifra obsoleta.** Esa es la línea base de **3.7.1**, que el ledger §7 (NV2) marca explícitamente como **no comparable**. La medición autoritativa de la Etapa 4 §8 es `# tests 1588 / # pass 1581 / # fail 6 / # cancelled 0 / # duration_ms 5617237` ≈ **94 min** | corregido a *«1 588 tests, ~94 min, 6 attributed failures»* y *«Durations are not authoritative»* (L7) |
| «npm provenance, minimum permissions, 2FA …, trusted publishing where compatible» | Actions **desactivado** (`{"enabled":false}`, 0 workflows registrados): provenance **no disponible**, Trusted Publishing **no compatible**, 2FA **no verificado**, mínimo privilegio **hecho**, y **nada publicado** | corregido a las cuatro frases medidas |
| «No skill reaches a stable release without conformance» | G3 mide *«every added and modified skill … in a real install»*, no todas | corregido a *«No added or modified skill is promoted without conformance (G3)»* |
| pie: «upstream base 6f7edd3 · pending approval» | `6f7edd31` es el **commit auditado** (3.7.1). La base de trabajo es `481b1ec9` (3.7.4), y el plan está **aprobado** desde el 2026-11-01 (ledger §5) | corregido |

### 2.2 Diagrama 01 — personalización

| Afirmación del diagrama | Qué mide la implementación | Acción |
|---|---|---|
| `rscg install` | `rscg install` exige `--profile <p>`; el primer paso documentado es `onboard`. Verificado ejecutando `node scripts/rsc.js help` | corregido a `rscg onboard` |
| «own frontmatter key (schema is open)» | Son **tres** claves planas: `scripts/lib/governance.js` → `const KEYS = ['governance', 'governance-customization', 'governance-digest']` | corregido a «three own frontmatter keys» |
| «relative symlink, real copy on Windows» para los 5 asistentes | La Etapa 4 §1 mide **17 destinos por symlink y `cursor` por `.mdc` reescrito**; de los cinco gobernados, cuatro son symlink | corregido a «4 by relative symlink; real copy on Windows» |
| «The fork **will try to wire** codex, cursor and deepseek; antigravity has no provider hook» | Ya no es intención: es medición. `PreToolUse` sólo se cablea en `targets/claude.js`; `targets/deepseek-bridge.js` lo deja fuera por escrito (*«PreToolUse is left out»*); `codex`, `cursor` y `antigravity` no generan ninguno. `CONTRACT.md` §12 lo tabula | corregido a la medición |
| «fixed path — the audit proved the root is not configurable» | **Cierto.** `audit/track-c-assistants.md`: *«Verdict: FIXED. Not configurable in any way»* | se conserva |
| «Customizations survive … negative test that fails if the exclusion disappears» | **Cierto.** `targets/knowledge-sync.mjs` → `export const GOVERNED = Object.freeze(['02-DOCS/wiki/skills/'])`, con `gks01` (no se borra), `gks02` (**control**: un archivo ordinario sí se borra) y `gks03` (el predicado es un prefijo y nada más ancho) | se conserva |
| «Code-enforced today on Claude Code only» | **Cierto**, y el `<desc>` se amplía con lo que faltaba: esa guarda **se puede quitar con un ajuste commiteado** | ampliado |
| pie | igual que 03 | corregido |

---

## 3. La decisión especificador / URL, archivo por archivo

La regla aplicada: **comando o especificador → siempre el fork**; **URL → una por una**, donde un
enlace de **atribución** al padre sigue apuntando al padre y lo dice, un enlace que un lector usaría
para **usar este fork** apunta al fork, y donde el fork **no tiene** equivalente no se inventa un
enlace roto.

| Archivo | Especificadores / comandos | URLs al padre que se conservan, y por qué | URLs reapuntadas al fork |
|---|---|---|---|
| `README.md` | 18 ocurrencias de `@ericrisco/rsc`, **10 líneas `npx` ejecutables** y **tres** menciones de instalación global → reescrito entero; quedan **2** ocurrencias, las dos en la fila de la tabla de identidad | `github.com/ericrisco/rsc-harness` ×4 (subtítulo «fork de», frase de atribución, fila de repositorio, créditos), `github.com/ericrisco` (el autor), `npmjs.com/package/@ericrisco/rsc` (la **cita** del paquete del padre en la tabla comparativa) | el repositorio, las releases y la documentación propia; **la imagen de portada del padre se retira** en vez de reapuntarse: es su identidad visual, y Apache-2.0 §6 no concede marca |
| `SECURITY.md` | 0 | `github.com/ericrisco/rsc-harness` (de qué proyecto es fork) y `…/security/advisories/new` (el canal del padre, **`{"enabled":true}` comprobado**, para el código heredado) | el canal del fork: **no existe** — `private-vulnerability-reporting` → `{"enabled":false}` y `has_issues: false`, así que **no se inventa**: se dice y se enruta al dueño del repositorio |
| `site/index.html`, `site/es/index.html` | 13 cada uno, incluido `npx @ericrisco/rsc@latest onboard` ×8 → fork. **Y un `rsc onboard` desnudo en el terminal simulado de la línea 126 que ningún recuento previo contaba** | el nodo `Person` de schema.org (Eric Risco y su perfil), un `isBasedOn` nuevo en `SoftwareApplication` y en `SoftwareSourceCode`, y el enlace visible «Forked from rsc-harness» que sustituye al de npm | `canonical`, `hreflang`, `og:url`, `og:image`, `@id`, `url`, `codeRepository`, `sameAs`, el botón de estrella y los enlaces del pie |
| `site/llms.txt` | 4, **y es el archivo de instrucciones para agentes** → fork, más `rsc sync/add/reassess/consult` → `rscg …`, más una nota de estado al principio porque el paquete no existe todavía | una línea de atribución y un enlace «Forked from» | `catalog.json` pasa a servirse **desde el repositorio** (`raw.githubusercontent.com/lema017/rsc-harness/main/site/catalog.json`, 200) y los dos enlaces «Website» se **retiran** diciendo por qué: no hay Pages del fork |
| `site/sitemap.xml`, `site/robots.txt` | 0 | — | 8 y 1 URL de **autoidentificación** del propio sitio |
| `site/diagram.svg` | **1 — `npx @ericrisco/rsc@latest` dibujado dentro de la imagen.** No aparecía en ningún recuento | — | — |
| `site/assets/rsc.js` | 0 | — | `api.github.com/repos/ericrisco/rsc-harness` → el fork: el contador cuenta las estrellas del repositorio que la página pide estrellar |

**Lo que NO se renombró, y es deliberado.** La prosa del sitio y el campo `name` de schema.org siguen
diciendo «rsc-harness», que además **es** el nombre del repositorio del fork. La identidad que §10
exige —paquete, binario, comandos, actualizador— sí es del fork en todas partes; el pie de las dos
páginas y la cabecera de `llms.txt` declaran la relación. Reescribir la prosa de marketing entera
estaba fuera de proporción para una superficie que **envía 0 archivos en el tarball y hoy no se
puede desplegar**.

### 3.1 Enlaces a páginas del fork que no existen

Medido el 2026-11-02, y por eso **ninguno de estos se enlaza**:

```
https://lema017.github.io/rsc-harness/              → 404   (Pages nunca desplegado, Actions off)
https://registry.npmjs.org/@lema017%2Frsc-governed  → 404   (nada publicado)
gh api repos/lema017/rsc-harness → has_issues: false        (no hay página de issues)
gh api repos/lema017/rsc-harness/private-vulnerability-reporting → {"enabled":false}
```

Las únicas apariciones que quedan del host de Pages del fork están **dentro de `site/`**, como
autoidentificación (`canonical`, `og:url`, `hreflang`, `sitemap`): no son enlaces que un lector
pulse, y pasan a ser correctas en el momento en que el dueño habilite Actions. En prosa — README y
`SECURITY.md` — el host sólo aparece **como el hecho medido de que devuelve 404**, y el test
distingue las dos cosas.

---

## 4. Enlaces — comprobados por HTTP y contra el árbol

Instrumento: `check-links.mjs`, que resuelve los destinos relativos contra el árbol y pide los
absolutos por HTTP. Sobre `README.md`, `SECURITY.md` y `site/**`:

- **`README.md`: 21 destinos locales, 16 remotos, 0 hallazgos.**
- **`SECURITY.md`: todos los destinos 200**, incluido el canal de advisories del padre.
- **`site/llms.txt`: 5 remotos, 0 hallazgos.**
- `site/index.html`, `site/es/index.html`, `site/sitemap.xml`: los únicos 404 son las **4 URLs de
  autoidentificación** del host de Pages del fork, declaradas arriba.

**El instrumento no es vacuo**, y se demostró con hallazgos reales antes de arreglarlos: señaló
`docs/fork/stage7/VERIFICATION.md` como ausente mientras este archivo no existía, y señaló los 404
de Pages. Un detalle que corrigió el propio instrumento: `npmjs.com` responde **403** a cualquier
petición que parezca automática, así que la existencia de un paquete se comprueba contra
`registry.npmjs.org`, que es además **lo que resuelve `npx`** — no es un rodeo, es la fuente correcta.

---

## 5. El test nuevo: `tests/product-surfaces.test.js`

**Por qué hacía falta otro.** El barrido de identidad de D16 (`tests/governance-identity.test.js`,
`gi11`) recorre un **proyecto consumidor instalado**. `README.md`, `SECURITY.md` y `site/` no están
ahí, y eran justo donde sobrevivía el padre. Este test cubre ese punto ciego, nombrando **archivo y
línea** en cada hallazgo.

| | Comprobación |
|---|---|
| `ps00` | el barrido tiene superficies que mirar (≥ 8 archivos, con `README.md`, `SECURITY.md` y `site/`) — un barrido sobre un conjunto vacío pasaría todo lo demás |
| `ps01` | **ningún comando ejecutable nombra al padre**: `npx`/`bunx`/`pnpm dlx`/`yarn dlx`/`npm i(nstall)` con el especificador o con el binario `rsc` desnudo, y `rsc <subcomando>` dentro de un code span |
| `ps02` | **toda mención restante del padre es atribución declarada**: lista de líneas exactas con su motivo escrito, más fragmentos declarados para las líneas generadas (JSON-LD, HTML). Y **una autorización que deja de coincidir también falla**, para que la lista no se pudra |
| `ps03` | el host de Pages **del padre** no aparece en ninguna superficie |
| `ps04` | ninguna superficie enlaza una página del fork que no existe (npm sin publicar, issues desactivados, Pages sin desplegar — este último sólo en prosa, y sólo si es un enlace) |
| `ps05` | **la inversa**: la identidad del fork está donde estaba la del padre. Una superficie vaciada del padre y que no nombre a nadie pasaría `ps01`–`ps04` |
| `ps06` | los detectores **disparan** sobre defectos plantados y **no** sobre los casos limpios parecidos (`\`rscg sync\``, la fila `| CLI command | \`rsc\` | \`rscg\` |`, `rsc-install`) |

```
$ . ./.fork-tmp/env.sh && node --test tests/product-surfaces.test.js
# tests 7 · # pass 7 · # fail 0 · # cancelled 0 · # skipped 0
```

### 5.1 Mutación de extremo a extremo — siete defectos plantados en archivos reales

`ps06` prueba los detectores sobre texto sintético; eso no prueba el barrido. Así que cada mutación
edita una **superficie real**, ejecuta el archivo de test de verdad, registra qué subtests con nombre
se ponen en rojo, restaura y comprueba que la restauración es **byte-idéntica** (sha-256):

```
BASELINE  passed=[ps00 ps01 ps02 ps03 ps04 ps06 ps05] failed=[]
M1 CAUGHT  README.md      — una línea npx del padre añadida            → [ps01 ps02]
M2 CAUGHT  README.md      — un enlace al sitio Pages del padre         → [ps02 ps03]
M3 CAUGHT  README.md      — un enlace a la página npm del fork (404)   → [ps04]
M4 CAUGHT  site/llms.txt  — el comando de instalación del fork borrado → [ps05]
M5 CAUGHT  site/llms.txt  — el archivo de agentes vuelve a ejecutar al padre (el defecto D16 exacto) → [ps01 ps02]
M6 CAUGHT  README.md      — una línea de atribución reescrita          → [ps02]
M7 CAUGHT  README.md      — un `rsc sync` desnudo en un code span      → [ps01]
          restauración byte-idéntica en las siete
AFTER ALL passed=[ps00 ps01 ps02 ps03 ps04 ps06 ps05] failed=[]
ALL MUTATIONS CAUGHT, TREE RESTORED
```

**Y el arnés de mutación cayó primero en la trampa que esta sesión lleva registrada cuatro veces.**
Su primera versión pasaba `NODE_TEST_CONTEXT: ''` al proceso hijo. Una cadena vacía **sigue
definiendo** la variable, así que `node:test` creía estar anidado, imprimía *«run() is being called
recursively … skipping running files»* y **no ejecutaba nada**: las siete mutaciones salieron
`MISSED` con `failed=[]`, que es exactamente la firma de un instrumento que informa sin medir — el
mismo defecto que la Etapa 5 encontró en `runTests` de su puerta. Se arregló **borrando** la variable
del entorno del hijo, y queda escrito aquí porque el que lo cazó fue el propio experimento de
mutación: sin él, siete comprobaciones verdes habrían parecido siete comprobaciones buenas.

---

## 6. Obligaciones de licencia de `PLAN.md` §2

| | Obligación | Estado |
|---|---|---|
| 2 | conservar el copyright de Eric Risco y añadir el del fork **como adicional** | hecho: `LICENSE` intacto y la sección final del README dice *«in addition to the notice above, never in place of it»* |
| 5 | **corregir la tabla de terceros**: acreditar `szilu/ux-designer-skill` y `hueyexe/frontend-agent-skills` | hecho, con repositorio, commit (`c869d32`, `2841c07`), licencia y copyright leídos de `skills/ux/THIRD_PARTY.md` y `skills/ux/upstream/UPSTREAM.json` |
| 5+ | **un defecto extra que la revisión de la Etapa 0 había dejado abierto**: el README cerraba la tabla con *«Adapted, not mirrored»* para **todas** las filas, y eso era falso para `skills/ux/upstream/**` y `skills/design/engine/**`, que se envían **byte a byte** | corregido con una columna **Form** que distingue *adapted* de *mirrored*, y una frase que dice que el texto anterior era inexacto |
| 6 | nota sobre `schema/ecc-originality.u64` | hecha, y **sin exagerar**: se describe qué es (93 337 huellas de 64 bits de SHA-256 sobre 8-gramas, irreversibles, con fuente, revisión y normalización en `schema/ecc-originality.json`), se dice que la posición del fork es que no genera obligación de terceros, se dice **expresamente que es una posición y no asesoría legal**, se dice que el recibo **no registra campo de licencia**, y se acredita la fuente igualmente. El repositorio de origen es público y MIT hoy (`gh api repos/affaan-m/everything-claude-code` → `affaan-m/ECC`, `MIT`) |
| — | **`Executive-Lab/conectores-pymes` NO se acredita** | correcto: llega en 3.7.5, que por **D14** no se integra. Acreditar código que no se envía sería afirmar que se envía. El README dice que entrará en la misma ejecución de mantenimiento que lo integre |

Apache-2.0 §4(b) no aplica porque la Estrategia B no edita los archivos derivados de *impeccable*;
§6 se respeta: el README dice que no se reclama ni se concede ningún derecho de marca, y por eso
**no se reutiliza la imagen de portada del padre**.

---

## 7. Los nueve apartados de §13, y dónde están

| §13 pide | Sección del README |
|---|---|
| Propósito | «What this is, for someone who has not met `rsc` before» |
| Relación y atribución al padre | «Relation to the parent, and credit where it is due» + «Credits and third-party work» + «License» |
| Diferencias del fork | «What the fork changes» |
| Instalación y primeros pasos | «Install and first steps» |
| Personalizaciones | «Customizing a skill for your project» + diagrama 01 |
| Compatibilidad brownfield | «Working in an existing codebase (brownfield)» |
| Mantenimiento manual de upstream | «Keeping up with upstream» + diagrama 03 |
| Actualización automática de consumidores | «How your projects get updates» |
| Garantías y límites | «Guarantees and limits» |
| *«texto conciso … enlaza detalles avanzados»* | **484** líneas frente a las 672 heredadas (412 al entregar; las 72 que añade §11 son casi todas correcciones de verdad, no prosa nueva), con la tabla «Where the detail lives» como índice de los once documentos |

**Las cifras que el README cita, y de dónde salen.** `274/274` en `18` destinos y `3` pasadas, con
`failures: 0` → Etapa 4 §1. `1 588 tests / 1 581 pass / 6 fail / 0 cancelled / ~94 min` → Etapa 4 §8.
`787 B` de preámbulo → `wc -c docs/fork/stage1/PREAMBLE-v1.txt`. `274` skills y `18` destinos,
re-contados aquí: `ls -1 skills | wc -l` → 274, `ls -1 skills/*/SKILL.md | wc -l` → 274,
`TARGETS.length` → 18. `~95 %` de pérdida de `description` en Cursor → L6. No se cita ninguna cifra
que no se haya abierto.

---

## 8. Lo que se ejecutó, en bruto

```
$ . ./.fork-tmp/env.sh && node scripts/rsc.js help
Use: npx @lema017/rsc-governed onboard | reassess | add <id...> | install --profile <p> | … | help

$ cd .fork-tmp/probe-project && node …/scripts/rsc.js --version
rscg 3.7.4 · installed in this project: none

$ node …/scripts/rsc.js conformance                 # en un proyecto vacío
no .rsc/skills/ in this project — nothing is installed here      (exit 0, 0 archivos escritos)

$ node --test tests/product-surfaces.test.js        # 7/7
$ node mutate-surfaces.mjs                          # 7/7 mutaciones cazadas, árbol restaurado
$ node check-links.mjs README.md SECURITY.md site/…  # 0 hallazgos fuera de los 404 declarados
$ git diff --numstat origin/main -- skills/          # vacío

$ npm pack --dry-run --json --ignore-scripts
total files 1792 · site/ 0 · docs/ 0 · scripts/*upstream-* 0 · attribution files 9
README.md present: true · SECURITY.md present: false · ningún .tgz escrito
```

---

## 9. NO VERIFICADO en esta etapa, con su motivo

| | Elemento | Motivo |
|---|---|---|
| NV7-1 | **El README publicado no se ha visto renderizado en GitHub.** | Esta etapa no commitea (lo hace el coordinador), así que la página renderizada del README no existe todavía. Lo que sí se midió es **la cadena que la determina**: la reescritura de rutas relativas por GitHub, el `content-type` y el `decode()` de los dos SVG por las dos formas de URL que esa reescritura produce, y el testigo del README del padre. **La comprobación que queda para después del commit es una sola**: abrir `github.com/lema017/rsc-harness` y ver las dos imágenes. |
| NV7-2 | **El renderizado en la página de npm.** | Nada está publicado y publicar está fuera de alcance. Las imágenes del README son rutas relativas: en npm dependen del reescritor del registro, no comprobado. |
| NV7-3 | **La suite completa (L7) y `tests/eval-lint.test.js` (L2).** | Prohibidas por el encargo y por §1 respectivamente. Lo que se ejecutó es el archivo de test nuevo, 8 veces (una línea base, siete mutaciones y una verificación final). |
| NV7-4 | **El sitio de `site/` no se ha visto desplegado.** | Actions está desactivado y no se habilita. Las 4 URLs de autoidentificación del host de Pages del fork devuelven 404 hoy; eso está medido y declarado, no corregido. |
| NV7-5 | **2FA de la cuenta de publicación.** | Es un ajuste de cuenta de npm y leerlo exige la sesión del mantenedor, que §1 prohíbe exponer a estos procesos. Heredado como L-D3. |
| NV7-6 | **Que `private-vulnerability-reporting` del padre siga activo mañana.** | Se midió `{"enabled":true}` el 2026-11-02. Es un ajuste de un repositorio ajeno y puede cambiar sin aviso; `SECURITY.md` enruta allí porque hoy es el único canal que funciona. |
| NV7-7 | **Las evaluaciones semánticas (criterio 14).** | No es un hueco de esta etapa: **no se han ejecutado en ninguna**. Se declara aquí porque el README tenía que decirlo y lo dice, en vez de dejar que «conformidad» se lea como «cumplimiento». |

---

## 10. Afirmaciones del encargo que no resultaron exactas

Se registran porque el encargo pedía expresamente comprobarlas.

1. **«una es `npm i -g @ericrisco/rsc`».** Eran **tres** menciones de instalación global en el
   `README.md` heredado, no una: `npm install -g @ericrisco/rsc`, `npm i -g @ericrisco/rsc` y
   `npm install -g @ericrisco/rsc@latest && rsc sync`. Las 18 ocurrencias y las 10 líneas `npx`
   ejecutables sí eran exactas, re-contadas aquí.
2. **El inventario de `site/` estaba incompleto**, en el encargo y en el ledger §2t. A los 30
   especificadores de `index.html` (13), `es/index.html` (13) y `llms.txt` (4) hay que sumar
   **`site/diagram.svg`, que lleva `npx @ericrisco/rsc@latest` dibujado dentro de la imagen** — un
   comando ejecutable que ningún recuento mencionaba. Y dos archivos más tocaban al padre sin
   especificador: `site/assets/rsc.js` apuntaba el contador de estrellas al repositorio del padre y
   `site/robots.txt` declaraba el sitemap del padre.
3. **`site/index.html` y `site/es/index.html` mostraban `rsc onboard`** —el binario del padre, sin
   `npx`— en el terminal simulado de la línea 126. No es un «especificador», así que no entró en
   ninguno de los recuentos; lo encontró `ps01`, que es la razón de mirar comandos y no sólo cadenas.
4. **«§13 … y el criterio 16».** El criterio de las dos imágenes es el **15** («README con las dos
   imágenes, fuentes editables, texto alternativo y renderizado validado en GitHub»); el **16** es
   «Versiones, commits y limitaciones residuales documentadas, incluida Windows y los límites por
   asistente». Los dos son de esta etapa, y el README cubre los dos, pero no son el mismo.
5. **«los diagramas … ya están subidos»** es cierto para `origin/fork/bootstrap`, **no** para `main`.
   Importa para el README: por eso usa rutas relativas y no una URL absoluta con rama.
6. **«SECURITY.md 0 especificadores»** es cierto, y aun así el archivo era falso: afirmaba *«GitHub's
   private reporting, which is enabled on this repository»* cuando en el fork
   `private-vulnerability-reporting` devuelve `{"enabled":false}`. Un 0 en el recuento de
   especificadores no dice nada sobre si el contenido es verdad.
7. Lo verificado del encargo **y que sí se confirmó tal cual**: los tres SVG sin `foreignObject`,
   `<script>`, fuentes externas, `@import` ni `href` externos, con `role="img"` más `<title>`/`<desc>`
   y fondo blanco opaco; los dos diagramas que §13 exige son el **01** y el **03**; y
   `274 de 274 en 18 destinos, tres pasadas` es una medición real de la Etapa 4, citable.
8. **`site/` envía 0 archivos y `README.md` sí viaja — medido, no leído.** `npm pack --dry-run
   --json --ignore-scripts` dentro de la carpeta dedicada: **1 792 archivos**, de ellos
   `site/` **0**, `docs/` **0**, `scripts/*upstream-*` **0** (D15 confirmada), los **9** archivos de
   atribución presentes, y **`README.md` sí**. No creó ningún `.tgz` y el árbol de trabajo quedó
   igual. **Un hallazgo que esto añade:** `SECURITY.md` **no** entra en el tarball, así que es
   superficie de GitHub y no del paquete — el README, que sí entra, es el único de los tres que un
   consumidor lee desde `node_modules`.

---

## 11. Pasada de correcciones del bloqueo (ledger §2y)

**Entorno:** idéntico al de la cabecera. Todo con `. ./.fork-tmp/env.sh`; sin instalaciones
globales, sin credenciales expuestas a ningún proceso, sin commits, sin publicar, sin habilitar
Actions, sin cambiar ajustes del repositorio o de la cuenta, y **sin tocar `skills/`**:

```
$ git diff --numstat origin/main -- skills/
                                   # (vacío — 0 líneas)
```

**Sin `gh api` ni peticiones HTTP en esta pasada.** La restricción literal del usuario prohíbe
exponer credenciales o sesiones suyas a estos procesos, y `gh` usa su sesión. Todo lo que la entrega
había medido por red se re-verifica aquí **contra las referencias locales de Git**, que es la fuente
más fuerte para lo que importa: `origin/main` y `origin/fork/bootstrap` están en el repositorio.

### 11.1 Las cinco ALTA

| | Qué era falso | Qué dice ahora | Qué lo afirma |
|---|---|---|---|
| **A1** | *(del coordinador)* `gg25` declarada verde 31/31 sobre un archivo **sin rastrear** | corregida por él | **re-ejecutada aquí sobre el estado real: `gg25` 31/31, archivo 31/31** |
| **A2** | *«The fork's own settings live in a separate file, `.rsc.fork.json`, so the parent's CLI cannot silently drop them»*, en presente | el estado propio del fork vive bajo **`.rsc/governance/`**, escrito desde el paquete en cada instalación, así que **no hay nada del fork dentro de `.rsc.json` que el CLI del padre pueda borrar**; el archivo aparte es una **decisión registrada y no implementada** (`ARCHITECTURE.md` §8) | medición: `grep -rn 'rsc\.fork\.json' scripts/ targets/ tests/ schema/` → **0 archivos**; `governance.js:163` → `join(cwd, '.rsc', 'governance')` |
| **A3** | `git clone https://…/rsc-harness.git` + *«prints `rscg 3.7.4`»*. Sin `-b` trae la rama por defecto | `git clone -b fork/bootstrap …`, con el por qué, con cómo comprobar qué CLI te tocó, y con la nota de que el flag se retira al fusionar | **`ps07`**, más la reproducción por ejecución de abajo |
| **A4** | el ejemplo que el README manda copiar daba **2 errores de regla 6** del validador del propio fork | el ejemplo está en la forma del esquema y **da 0 hallazgos**; la prosa nombra **las tres** reglas que bloquean, no las dos que cumplía | **`ps08`**, que extrae el bloque del README y lo pasa por `validateCustomizationSource`, con control negativo |
| **A5** | `02-add-new-skill.svg` conservaba cinco falsedades **en el dibujo y en el `<desc>`**, y §1 de este documento lo certificaba limpio | las cinco corregidas en los dos sitios; §1 corregida en su sitio | `git diff --numstat` → **20 líneas**; XML/`role`/`title`/`desc` re-comprobados; desbordamiento re-medido |

**A3, reproducido por ejecución y sin red**, que es lo que convierte el hallazgo en un hecho:

```
$ git archive origin/main | tar -x -C .fork-tmp/mainprobe
$ node .fork-tmp/mainprobe/scripts/rsc.js --version
rsc 3.7.4                                        ← el PADRE, no el fork
package: @ericrisco/rsc 3.7.4 | bin: rsc,rsc-install
scripts/lib/governance.js exists: False
docs/ exists: False
```

Y lo más afilado del hallazgo, que conviene no perder: **la etapa razonó sobre este mismo hecho**
—que los diagramas están en `fork/bootstrap` y no en `main`— para elegir rutas relativas en las
imágenes (§1.2), y **no lo aplicó al comando de clonado tres secciones más abajo**. Por eso la
corrección no es sólo el flag: `ps07` fija la propiedad en los **tres** sitios donde el mismo hecho
muerde (el clonado, los campos de `package.json` y los enlaces en prosa al repositorio), y el
`FORK_BRANCH` del test es una sola constante que al fusionar obliga a mover todos los anclajes a la
vez.

**A4, con el contraste que cierra el caso:**

```
README (antes)            2 hallazgos  — R6 sin categoría, R6 sin `Evidence:`
README (ahora)            0 hallazgos
CUSTOMIZATION-SCHEMA §5   0 hallazgos  (el canónico, como contraste)
control negativo: quitando `scope:` el mismo validador pasa a 1 hallazgo en los dos
```

### 11.2 Los doce MEDIO

| | Estado | Qué lo afirma |
|---|---|---|
| **M1** detector ciego a tres formas | corregido: `CLI_VERBS` pasa a la lista real de `scripts/rsc.js` **más `help`** (faltaban también `agent-model`, `catalog`, `knowledge-sync`, `git-permissions`, `main`, `isolation`); la clase de **sufijo** gana `. , ; : ! ? ) ] }`; la de **prefijo** gana `"`, `'` y `·`, y **deja fuera `/` y `-`** a propósito | **11 sondas que antes pasaban y ahora se detectan, en `ps06` una a una**, y 11 casos limpios que siguen limpios. Medido antes: **9 de 11 MISSED** |
| **M1+** *(hallazgo nuevo)* | ensanchar el prefijo encontró un defecto real que ningún barrido había visto: **`site/assets/rsc.js:236` escribía `$ rsc onboard`** en el terminal animado de la portada, como elemento de array entre comillas — en el archivo que §3 declaraba a «0 especificadores» | corregido a `rscg onboard`; la línea literal es ahora una de las sondas plantadas de `ps06`, y `M6` del arnés la vuelve a plantar en el archivo real |
| **M2** `ps05` no cubría las dos páginas | corregido: `ps05` exige en **ambas** el comando de instalación del fork, el especificador del fork en el JSON-LD y `rscg onboard` en el terminal; y además `name`/`bin` de `package.json` | `M9` y `M10` del arnés: borrar la identidad del fork de cada página pone `ps05` en rojo |
| **M3** la leyenda *Form* era falsa para una de sus dos filas | corregido declarando **dos fuerzas**: *mirrored, hash-pinned* (`ux`, con 31 y 6 SHA-256 en `UPSTREAM.json` y `tests/ux-upstream.test.js`) y *mirrored, commit-pinned* (`design/engine`, **sin mapa `files`**, 38 archivos que nada hashea). **No se genera el mapa**: es un cambio de mantenimiento con su propia evidencia. **Y el diagrama 03 también lo decía** —*«byte-identical and hash-checked»*— corregido a *«only ux/ is hash-checked»*; el `<desc>` no menciona los subárboles, así que no había nada que corregir ahí | medición: `design/engine/UPSTREAM.json` → claves `taste-skill`/`impeccable`, **`files` ausente**; `ux/upstream/UPSTREAM.json` → `files` de **31** y **6**; `grep -n hash` sobre el `03` |
| **M4** `package.json` no era superficie | corregido: `bugs.url` y `homepage` dejan de resolverse contra la rama por defecto, y **el archivo entra en el conjunto barrido** | `ps04` + `ps07`; `M4` y `M5` del arnés |
| **M5** las dos imágenes y el índice muertos en el paquete | **declarado con la cifra**: de los 21 destinos locales, **18 no están en el tarball** (`docs/` = 0, `SECURITY.md` fuera), y en la página de npm los 16 de `docs/fork/**` resuelven contra `main`, **donde `docs/fork/` no existe** | `npm pack --dry-run --json --ignore-scripts` + `git ls-tree origin/main docs/` (vacío) |
| **M6** *«see the catalog» / «prints the current set»* | corregido: **`rscg catalog`** imprime las 274; `rscg list` imprime lo instalado | ejecutado: `catalog` → **274 líneas**; `list` en proyecto vacío → `(nothing installed)` |
| **M7** la aritmética que `EVALUATION.md` rechaza por su nombre | corregido a **181 = 49 + 100 + 32**, con la frase de que **no** es el producto cartesiano y por qué | `EVALUATION.md` §3 (*«No es el producto cartesiano…»*) y §5 (49 escenarios / 100 / 4 × 8) |
| **M8** 18 y 5 sin reconciliar en la misma página | corregido con una cláusula bajo el diagrama 01: **medido en 18, prometido en 5**, y los otros 13 *«sin afirmaciones de gobernanza»* | `stage4/VERIFICATION.md` §1 («Los 18 destinos, no los 5») y `PLAN.md` §9 |
| **M9** «30 files» y «5 files» | corregidos a **31 (29 referencias + `GUIDE.md` + `LICENSE`)** y **6 (4 + `GUIDE.md` + `LICENSE`)**, diciendo que lo que faltaba era el `LICENSE` | `find … -type f \| wc -l` → 31 y 6 |
| **M10** «19 correcciones en el 03» no se reproduce | **unidad de conteo publicada abajo**, verificable con un comando | `git show --numstat 1cfe83f` |
| **M11** ilegibles a ancho de móvil, sin camino de zoom | corregido con **una línea por imagen**: las dos son ahora `[![alt](ruta)](ruta)`, un enlace a sí mismas, y el pie lo dice en una frase | sintaxis CommonMark; **el renderizado queda en NV7-8** (no se puede ver sin commitear) |
| **M12** la frase que se leía como garantía de cumplimiento | reescrita para decir **sólo** lo que lo que la sigue establece: que el texto **está presente**, en las 274, byte-comparable; y que obedecerlo *«is a different claim with a different answer»* | — |

**M10 — la unidad de conteo, que es un comando y no una memoria.** Lo verificable es **líneas
cambiadas**, no «afirmaciones corregidas», porque lo segundo depende de dónde se corte una frase:

```
$ git show --numstat --format= 1cfe83f -- docs/fork/diagrams/
7   7   docs/fork/diagrams/01-customize-existing-skill.svg
17  17  docs/fork/diagrams/03-upstream-maintenance.svg
                                       # el 02 no aparece: 0 líneas, que es el defecto A5
$ git diff --numstat HEAD -- docs/fork/diagrams/        # esta pasada
2   2   docs/fork/diagrams/01-customize-existing-skill.svg
20  20  docs/fork/diagrams/02-add-new-skill.svg
2   2   docs/fork/diagrams/03-upstream-maintenance.svg
```

Así que la entrega cambió **24 líneas** en dos archivos (7 y 17) y esta pasada cambia **24** en
**los tres** (2, 20 y 2). El «19» del ledger §2x no se reproduce con ningún comando y el propio
ledger ya lo retira en §2y.

### 11.3 Los siete BAJO

| | Estado |
|---|---|
| **B1** | corregido: el README son **484** líneas (412 al entregar), no 410. `wc -l`, en la cabecera y en §7 |
| **B2** | corregido: **1 588 = 1 581 + 6 + 1 omitido**, y L1 dice **cuál** es el omitido (el condicional autodocumentado del `danger-guard` no materializado) |
| **B4** | corregido: el `alt` del `01` en el README lleva ya la cláusula que sólo tenía el `<desc>` (*«where the guard can still be removed by a committed setting»*) **y** la de Cursor. **Y el método que lo hacía importar queda escrito**: dentro de un `<img>` el lector de pantalla recibe el **`alt`**, no el `<desc>`, así que el cuidado puesto en los `<desc>` sólo alcanza a quien abre el SVG suelto |
| **B5** | **NO corregido, y no es mío.** Ejecutado: `node scripts/rsc.js help` imprime *«without it, **rsc** uses the assistant already installed here»*. Está en `scripts/rsc.js`, fuera de la propiedad de archivos de esta pasada. **Y es más grande de lo que la revisión dice**: `targets/auto-update.mjs` tiene **10 líneas** de salida al usuario que nombran `rsc` literalmente — `===== rsc updated =====`, `===== rsc updating =====`, `===== rsc update available =====` ×2, y seis frases del tipo `rsc ${latest} is out — you have ${installed}`. **Por qué ningún test lo ve, y es la parte que vale la pena retener:** cada barrido de este proyecto busca o el **especificador** (`gg25`, `gi03`) o la forma `rsc <subcomando>` ejecutable (`ps01`). Esto no es ninguna de las dos: es el **nombre de producto del padre en prosa de salida**, y el fork se llama `rscg`. Queda como hallazgo con su ruta, sin instrumento, porque instrumentarlo sin poder arreglarlo sería dejar la puerta en rojo para el siguiente |
| **B6** | corregido: la celda de Cursor del `01` dice `cursor: SKILL.md only, no references/, no keys`, y el `<desc>` lo desarrolla. Es lo que mide `stage4/VERIFICATION.md` §1: las tres claves **no** llegan a Cursor, *«no, por diseño»* |
| **B7** | corregido: *byte-identical to upstream **at 3.7.4, commit `481b1ec9`***, más que upstream ya publicó **3.7.5 (`cb9e051d`)** y que **D14** no lo integra, así que `skills/` **no** es idéntico al `main` de upstream y no lo afirma |
| **B3** | la revisión no numeró ningún B3 — se registra para que no parezca perdido |

### 11.4 El instrumento: `tests/product-surfaces.test.js`, de 7 a 9

| | Comprobación | Nuevo en esta pasada |
|---|---|---|
| `ps00` | el barrido tiene superficies que mirar | ahora **17** archivos (entra `package.json`) |
| `ps01` | ningún comando ejecutable nombra al padre | detector ensanchado (M1); **lista de excepciones con motivo y fecha** para el `rscFixes` heredado, con la misma regla anti-podredumbre que `ps02`; y **la cota que lo hace inofensivo, medida**: ningún `fixedIn` alcanza la versión del paquete, así que `fixesSince` no puede imprimirlo a un consumidor |
| `ps02` | toda mención restante del padre es atribución declarada | la fila de identidad del repositorio lleva ya la rama en su mitad del fork, y la autorización se actualizó con ella |
| `ps03` | el host de Pages del padre no aparece | — |
| `ps04` | ninguna superficie enlaza una página del fork que no existe | ahora **también sobre `package.json`**, que es donde estaba el `bugs.url` a los issues desactivados |
| `ps05` | la inversa: la identidad del fork está presente | **+ las dos páginas del sitio y `package.json`** |
| `ps06` | los detectores disparan sobre defectos plantados | **+11 sondas** que antes pasaban, una por forma, y **+5 casos limpios** de las formas que el fork usa de verdad |
| **`ps07`** | **nada que busque o enlace este fork resuelve al padre por la rama por defecto** | **nuevo (A3, M4)**: el clonado lleva `-b`, `homepage` y `bugs.url` llevan rama, `llms.txt` lleva las dos cosas, y en prosa no queda un enlace al repositorio sin rama. `site/**` es la excepción **declarada**, con el mismo motivo que `ps04` ya usa para el host de Pages del fork: son navegación y autoidentificación de dos páginas que envían **0 archivos** en el tarball y que **hoy no se pueden desplegar**. Medido: **9 URL así en cada página** |
| **`ps08`** | **el ejemplo que el README manda copiar pasa el validador de verdad** | **nuevo (A4)**: extrae el bloque del propio README y lo pasa por `validateCustomizationSource`, exigiendo 0 hallazgos, **con control negativo** — quitar `scope:` tiene que producir un hallazgo, porque un cero obtenido sobre una cadena vacía se lee igual que un cero bueno |

```
$ . ./.fork-tmp/env.sh && node --test tests/product-surfaces.test.js
# tests 9 · # pass 9 · # fail 0 · # cancelled 0 · # skipped 0
```

### 11.5 Mutación de extremo a extremo: 15 defectos plantados en archivos reales

`ps06` prueba los detectores sobre texto sintético; eso **no** prueba el barrido, y un 9/9 a la
primera es exactamente lo que hay que desconfiar. Así que cada mutación edita una **superficie
real**, ejecuta el archivo de test de verdad, registra qué subtests con nombre se ponen en rojo,
restaura y comprueba la restauración por **sha-256**:

```
BASELINE  passed=[ps00 ps01 ps02 ps03 ps04 ps06 ps05 ps07 ps08] failed=[]
M1  README        — el clonado pierde -b, así que trae al padre              → [ps07]
M2  README        — la decisión del ejemplo pierde su línea Category         → [ps08]
M3  README        — la decisión del ejemplo pierde su línea Evidence         → [ps08]
M4  package.json  — bugs.url vuelve a los issues desactivados                → [ps04 ps07]
M5  package.json  — homepage vuelve a la rama por defecto                    → [ps07]
M6  site/assets/rsc.js — el defecto real: comando del padre entre comillas   → [ps01]
M7  README        — un comando del padre que CIERRA una frase                → [ps01]
M8  README        — una `g` de menos en `rscg help`                          → [ps01]
M9  site/index.html    — el especificador del fork fuera del JSON-LD         → [ps05]
M10 site/es/index.html — el CLI del fork fuera del terminal                  → [ps05]
M11 site/llms.txt — la instrucción de clonado para agentes pierde la rama    → [ps07]
M12 package.json  — un `rscFixes` pasa a ser alcanzable por un consumidor    → [ps01]
M13 package.json  — un síntoma excusado se arregla: su autorización caduca   → [ps01]
M14 README        — la fila de identidad enlaza el repo sin rama             → [ps02 ps07]
M15 README        — el bloque-fixture del ejemplo se borra entero            → [ps08]
          restauración byte-idéntica en las quince
AFTER ALL passed=[ps00 ps01 ps02 ps03 ps04 ps06 ps05 ps07 ps08] failed=[]
ALL MUTATIONS CAUGHT, TREE RESTORED
```

El arnés borra `NODE_TEST_CONTEXT` del entorno del hijo en vez de vaciarlo, por el motivo que §5.1
dejó escrito: **una cadena vacía sigue definiendo la variable**, `node:test` se cree anidado y no
ejecuta nada, y las mutaciones salen `MISSED` con `failed=[]`.

### 11.6 Qué más se ejecutó, y sobre el estado real

**La lección de A1 aplicada literalmente: cada cifra de aquí se midió DESPUÉS de la última edición
que la afecta, no antes.**

```
$ . ./.fork-tmp/env.sh
$ node --test tests/product-surfaces.test.js      # 9/9
$ node --test tests/governance-gate.test.js       # 31/31  ← gg25 incluida, sobre el árbol real
$ node --test tests/governance-identity.test.js   # 15/15  ← gi01 lee homepage/bugs.url
$ node --test tests/base-install.test.js          #  6/6
$ node mutate-surfaces.mjs                        # 15/15 cazadas, árbol restaurado
$ node check-links.mjs                            # 38 destinos locales + 3 anclas internas, 0 hallazgos
$ node a4-probe.mjs                                # README 0 hallazgos · esquema 0 · control 1
$ git diff --numstat origin/main -- skills/        # vacío
$ npm pack --dry-run --json --ignore-scripts       # 1 792 archivos · docs/ 0 · README sí · SECURITY no
```

Y los conteos de `gg25` re-medidos con su propia regex **después** de todas mis ediciones, porque
una sola de ellas habría puesto la puerta en rojo: `README.md` **spec 2 / url 8**, `SECURITY.md`
**0 / 4**, las dos páginas **0 / 5**, `llms.txt` **0 / 2** — todos en su tope declarado, ninguno a
cero (una entrada a cero tiene que borrarse de esa lista, y borrarla no es mío). **Un borrador de
esta pasada añadía `@ericrisco/rsc` al README para explicar A3 y habría dejado `gg25` en 30/31 por
exceso de especificador**; se reescribió la frase sin nombrarlo. Es el mismo género que A1, cazado
antes de escribirlo porque esta vez se midió primero.

### 11.7 Un hallazgo que la revisión no trae, y es el más grande que queda

**14 subtests de seis archivos de test heredados están en rojo, y llevan en rojo desde la reescritura
del README.** Medidos aquí uno por uno:

```
domains          :: README links a folder for every skill in the manifest
onboarding-docs  :: every public surface sends humans and chat agents through canonical onboarding
onboarding-docs  :: public claims state the real guarantee boundary and no longer promise an opaque profile menu
public-surface   :: 3 · stated where it matters: the default lane has a name
public-surface   :: 3 · stated where it matters: the agent picks the lane and the person approves the spec
public-surface   :: 3 · stated where it matters: isolation is retired automatically once work lands
public-surface   :: 4 · the own-skills promise is still made, because it is finally true
positioning-docs :: public surfaces define rsc-harness as the guided harness builder
positioning-docs :: the public story names the Frankenstein risk and concrete best practices
positioning-docs :: the website leads with the agent handoff and demonstrates proportional judgment
catalog-counts   :: README agent and command inventory claims match the generated manifest
clone-bootstrap  :: AC#25 — the README does not send a clone to @latest while promising a pin
clone-bootstrap  :: AC#25 — the README describes the clone by symptom, and says the assistant announces it
clone-bootstrap  :: I4 — the README names the bootstrap among the things to commit
```

**No las causa esta pasada, y eso se midió, no se supuso.** Se extrajo `HEAD` entero con
`git archive HEAD | tar -x -C .fork-tmp/baseline` y se corrieron los seis archivos allí: **mismos
recuentos de fallo, uno a uno**. Lo que las rompe es que **asertan sobre la copia de producto del
PADRE** —la lista de carpetas por skill, el menú de perfiles, la prosa de carriles, el texto del
clone-bootstrap, `rsc@latest onboard`— y la Etapa 7 reescribió ese README a propósito. La corrida
autoritativa de la Etapa 4 (1 588 / 6 fallos) es **anterior** a esa reescritura, así que **L1
citaba un número que ya no describe el árbol**; el README lo dice ahora.

**No las arreglo**, y el motivo es de alcance, no de pereza: re-apuntar 14 aserciones heredadas a la
copia del fork es decidir qué promete el producto, no corregir una falsedad, y el encargo dice
expresamente que este bloqueo es *«de corrección, no de rediseño»*. Queda como **NV7-9**, con los
nombres arriba para que nadie tenga que volver a encontrarlos.

### 11.8 Lo que NO se corrigió, con su motivo

| | Elemento | Motivo |
|---|---|---|
| 1 | **`.rsc.fork.json` no se implementa** | decisión del coordinador, escrita en el encargo: a estas alturas añadir un archivo de estado nuevo —con su inventario de respaldo y su comprobación de divergencia— es más riesgo que valor. La prosa pasa a decir la verdad, que era el defecto |
| 2 | **el mapa `files` de `skills/design/engine/UPSTREAM.json`** | generarlo es un cambio de mantenimiento con su propia evidencia (38 hashes y un test nuevo). La revisión prefería corregir la leyenda, y corregir la leyenda es lo honesto cuando la alternativa es ensanchar el alcance para que la frase encaje |
| 3 | **`rscg help` y `targets/auto-update.mjs` imprimen `rsc`** (B5) | `scripts/**` y `targets/**` están fuera de la propiedad de archivos de esta pasada. Registrado arriba, con los dos casos extra que aparecieron al mirar |
| 4 | **los 18 enlaces al repositorio sin rama de las dos páginas del sitio** | declarados en `ps07` con el mismo motivo que `ps04` ya aplica al host de Pages del fork: navegación y autoidentificación de dos páginas que envían 0 archivos en el tarball y que no se pueden desplegar hoy. Se corrigen solos en la fusión, y reescribirlos ahora es trabajo que habría que deshacer |
| 5 | **`description` y `homepage` del repositorio en GitHub** (ledger §2x, hallazgo 1) | son ajustes de la cuenta del usuario y el encargo los deja pendientes de su decisión |
| 6 | **las 14 aserciones heredadas en rojo** | §11.7: es rediseño de la copia de producto, no corrección |

### 11.9 Qué de la revisión no resultó exacto

Lleva razón en lo esencial —las cinco ALTA se reprodujeron las cinco— y aun así:

1. **M1 se queda corta por su propio criterio.** Dice *«5 de 7 mutaciones no las detecta»*. Medido
   con la función real del test, las formas corrientes que pasaban eran **9 de 11**: a los sufijos
   `.` `,` `)` y a los verbos `help` / `agent-model` y a las comillas hay que sumar **`;`** y la
   forma `"clave":"rsc onboard"` del JSON-LD, que es un caso distinto del de la comilla suelta.
2. **M5 cuenta dos cosas distintas con el mismo número.** «18 de 21 muertos» es cierto **en el
   tarball**; en la **página de npm** el conjunto muerto es otro: los **16** de `docs/fork/**`,
   porque `SECURITY.md`, `LICENSE`, `manifest.json`, `schema/` y `skills/` **sí** existen en `main`.
   Las dos cifras importan y no son la misma, y el README las separa.
3. **M10 pide «una unidad de conteo verificable» y la da por líneas**, pero el «7» que llama
   verificable es `7 7` (añadidas y borradas), no 7 correcciones: es la misma ambigüedad que hace
   irreproducible el 19. Publicado como líneas cambiadas, con el comando (§11.2).
4. **A2 dice que la gobernanza «persiste de hecho en `.rsc/governance`»**, y conviene precisarlo
   porque cambia lo que el README puede prometer: lo que vive ahí no son *ajustes del fork* sino
   **artefactos del paquete** —contrato, cuerpo always-on, procedimiento brownfield—, `scripts/
   install-apply.js:136` *«Package-owned, not project-owned»*, **regenerados en cada instalación**.
   La propiedad verdadera no es «viven aparte, así que no se pierden» sino **«no hay nada que
   perder»**, y así está escrito.
5. **B3 no existe.** La lista BAJO salta de B2 a B4.
6. **Y una inexactitud que iba a ser mía, cazada antes de publicarla.** Un borrador de esta sección
   afirmaba que *«el diagrama 03 no usa la palabra hash-checked»* y que M3 se había equivocado al
   decir que el dibujo hereda el defecto. **Falso:** `grep -n hash` sobre el `03` devuelve
   *«Frozen vendored subtrees stay byte-identical and hash-checked.»* La revisión tenía razón, el
   defecto **sí** estaba también en el dibujo, y está corregido a *«only ux/ is hash-checked»*. Se
   deja escrito porque el género del error es el que bloqueó esta etapa: **afirmar sobre un archivo
   sin abrirlo**, esta vez en la propia sección que iba a reprochárselo a otro.
7. **Lo que la revisión verificó y pedía no rehacer aguanta**, re-comprobado donde una corrección lo
   cruzaba: `spec 2 / url 24`, las seis obligaciones de licencia, el 94,69 % de Cursor y que
   `Executive-Lab` no se acredite. Las dos cifras de archivos de la tabla de terceros eran la
   excepción, y eran suyas (M9).

### 11.10 NO VERIFICADO que añade esta pasada

| | Elemento | Motivo |
|---|---|---|
| **NV7-8** | **que el `[![…](…)](…)` se vea como imagen enlazada**, y la mejora real en un móvil | es sintaxis CommonMark estándar, pero el README renderizado no existe hasta el commit, y aquí no hay renderizador de Markdown ni se instala ninguno. Queda junto a NV7-1: **una** comprobación después del commit, abrir la página y pulsar una imagen |
| **NV7-9** | **las 14 aserciones heredadas en rojo** | §11.7. Medidas, atribuidas y **no** arregladas: son rediseño |
| **NV7-10** | **la escala de los diagramas a 375 px** | se hereda de la medición de la revisión (escala 0,249, cuerpo ≈3 px). Esta pasada mide el **margen dentro de la caja** (§1.3), que es otra propiedad: no se re-midió el viewport móvil |
| **NV7-11** | **que `homepage` y `bugs.url` resuelvan con 200** | `fork/bootstrap` y su `SECURITY.md` existen en `origin` (comprobado con `git cat-file -e`), y no hay ninguna rama llamada `fork` que haga ambigua la ruta `tree/fork/bootstrap`. Lo que **no** se hizo es pedirlas por HTTP: esta pasada no usa red |
| **NV7-12** | **la suite completa (L7) y `eval-lint` (L2)** | prohibidas por el encargo y por §1. Lo que **sí** se ejecutó: cuatro archivos de test completos (`product-surfaces` 9/9, `governance-gate` 31/31, `governance-identity` 15/15, `base-install` 6/6), los seis archivos de §11.7 en dos árboles distintos, y el arnés de mutación, que son **17** corridas del archivo de test (una línea base, quince mutaciones y una verificación final) |
