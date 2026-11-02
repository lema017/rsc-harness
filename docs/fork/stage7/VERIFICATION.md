# Etapa 7 — Verificación: README, imágenes y documentación

**Alcance:** `REQUIREMENTS.md` §13 (los nueve apartados del README y las dos imágenes), `PLAN.md` §2
obligaciones 2, 5 y 6 (copyright, tabla de terceros, nota del corpus de originalidad), y los
criterios de aceptación **15** (README con las dos imágenes, fuentes editables, texto alternativo y
renderizado validado en GitHub) y **16** (versiones, commits y limitaciones residuales documentadas,
incluida Windows y los límites por asistente).

**Archivos entregados.** `README.md` (reescrito, 410 líneas), `SECURITY.md` (reescrito, 86 líneas),
`docs/fork/diagrams/01-customize-existing-skill.svg` y `…/03-upstream-maintenance.svg` (corregidos
contra la implementación), `site/{index.html,es/index.html,llms.txt,sitemap.xml,robots.txt,diagram.svg,assets/rsc.js}`,
`tests/product-surfaces.test.js` (nuevo) y este documento.

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
| *(extra, permitida)* alta de una skill en upstream | `docs/fork/diagrams/02-add-new-skill.svg` | sin cambios; no la desmiente nada de lo revisado |

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
| *«texto conciso … enlaza detalles avanzados»* | 410 líneas frente a las 672 heredadas, con la tabla «Where the detail lives» como índice de los once documentos |

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
