# Viabilidad del transformador — Estrategia B (Etapa 1)

**Fecha:** 2026-11-01 · **Base medida:** commit `4639e66` (worktree desechable).
Durante el trabajo `fork/bootstrap` avanzó a `a3d287c`; `git diff --name-only 4639e66 a3d287c -- skills tests scripts targets schema package.json manifest.json` sale **vacío** (sólo cambió `docs/`), así que todas las cifras siguen valiendo para el HEAD actual.

## Cómo leer este documento

Cada hallazgo está marcado:

- **[EJ]** comprobado por ejecución en este trabajo, con la salida citada.
- **[LE]** inferido por lectura del código. No ejecutado.
- **[NV]** no verificado, con el motivo.

### Aislamiento (comprobado)

**[EJ]** Todo se ejecutó en un worktree desacoplado (`git worktree add --detach .fork-tmp/wt-transformer HEAD`) con `HOME`, `TMPDIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME` y `npm_config_cache` dentro de `.fork-tmp/`. `node_modules` se reutilizó por symlink; **no se instaló nada** (`npm install` nunca se ejecutó). `~/.claude` conserva mtime `1793549705` idéntico antes y después. `git status --porcelain` del repositorio principal, vacío en todo momento. El worktree y el directorio de pruebas de instalación fueron eliminados al terminar (`git worktree list` muestra sólo el principal).

**No se ejecutaron** `npm test`, `node --test` ni `npm install`, por la línea base en curso.

### Lo que un verificador NO pudo hacer y por qué

- **`eval-lint.sh`: [NV]**. Escribe en una ruta `/tmp` **literal** (`scripts/eval-lint.sh:192` `2>/tmp/eval-lint.$$.err`, borrada en `:203`), fuera de la carpeta dedicada, incluso con `TMPDIR` redirigido. Por la restricción del usuario no se ejecutó. **[LE]** Es irrelevante para la transformación: lee `SKILL.md` sólo como prueba de existencia (`:163`, `:171`) y nunca su contenido.
- **`tests/catalog-diet.test.js:17`** invoca `npm pack --dry-run --json`. No ejecutado (es un test, y toca npm). Su lógica de huérfanos sí se replicó a mano.

---

## 1. Topes de tamaño

### 1.1 No existe ningún tope por skill ni por carga de skill

**[EJ]** Búsqueda exhaustiva de comparaciones de tamaño en `tests/`, `scripts/`, `targets/`, `schema/`
(`grep -rniE "(MAX|CEILING|LIMIT|BUDGET|CAP)_?(BYTES|SIZE|CHARS|LEN)|bytes <=|bytes <|BYTES ="`).
El resultado completo de topes de bytes es:

| Qué | `archivo:línea` | Cifra | Sujeto |
|---|---|---|---|
| Cuerpo always-on | `tests/always-on-body.test.js:16,20` | `BODY_CEILING_BYTES = 8000` (`<`) | sólo `skills/suggest/SKILL.md` |
| Cuerpo always-on | `tests/clone-bootstrap.test.js:350` | `bytes <= 7282` | sólo `skills/suggest/SKILL.md` |
| **Cuerpo always-on (tercer tope)** | **`tests/ftd-lane.test.js:24,57-58`** | **`SUGGEST_BYTES_BEFORE = 7282`** (`<=`) | sólo `skills/suggest/SKILL.md` |
| Puerta por turno | `tests/ftd-lane.test.js:23,46-47` | `GATE_BYTES_BEFORE = 905` | `SDD_GATE_TEXT` en `targets/hook-once.mjs` |
| Regla de `capabilities` | `tests/capabilities.test.js:226` | `bytes <= 300` | una sección de texto, no una skill |
| `description` (duro) | `schema/frontmatter.schema.json:7` | `maxLength: 1024` | frontmatter de toda skill |
| `description` (blando) | `scripts/build-manifest.js:109` | `DESCRIPTION_CEILING_CHARS = 350` | informativo, no bloquea |

**Ningún tope mide el tamaño de un `SKILL.md` que no sea `suggest`, ni el tamaño total del catálogo, ni la carga por skill.** `scripts/doctor.js:529,611` y `tests/context-budget.test.js` **miden** bytes por skill, pero sólo para informar: las aserciones de `context-budget.test.js` son `> 5000`, `> 100`, `> 0` — pisos, no techos.

### 1.2 Confirmación de los dos topes citados y del tercero

**[EJ]** `wc -c skills/suggest/SKILL.md` → **7280**. Replicando las tres aserciones sobre el archivo real:

```
[caps] suggest = 7280 B
  PASS  always-on-body.test.js:16   < 8000   (holgura 720 B)
  PASS  clone-bootstrap.test.js:350 <= 7282  (holgura 2 B)
  PASS  ftd-lane.test.js:57         <= 7282  (holgura 2 B)
```

Los dos números del encargo quedan **confirmados**, y la holgura efectiva es de **2 bytes**, como fijó R1 del LEDGER.

**Sí existe un tercer tope, y nadie lo había citado como tope:** `tests/ftd-lane.test.js:24` declara `const SUGGEST_BYTES_BEFORE = 7282;` y **lo asserta** en `:57-58`:

```js
test('6 · and the always-on body did not get bigger either', () => {
  assert.ok(Buffer.byteLength(SUGGEST) <= SUGGEST_BYTES_BEFORE,
    `always-on body: ${Buffer.byteLength(SUGGEST)} > ${SUGGEST_BYTES_BEFORE} bytes (context-budget)`);
});
```

R1 lo mencionó entre paréntesis como «fija además», sin registrarlo en su tabla de topes. Operativamente son **tres puertas**, no dos: elevar el presupuesto always-on exige tocar **tres archivos de test**, no dos.

### 1.3 Distribución real de los 274 `skills/*/SKILL.md`

**[EJ]** Los 274 `SKILL.md` están todos a profundidad 2 (`find skills -name SKILL.md | wc -l` = 274 = recuento a profundidad 2; no hay ninguno anidado más abajo).

| Estadístico | Bytes |
|---|---|
| Mínimo | **4 602** (`variant-explorer`) |
| p25 | 11 081 |
| **Mediana** | **12 506** |
| Media | 12 773,6 |
| p75 | 14 139 |
| p90 | 16 112 |
| p99 | 21 927 |
| **Máximo** | **30 307** (`specify`) |
| Total | 3 499 971 B (3,34 MiB) |

**Los cinco mayores:** `specify` 30 307 · `harness` 25 368 · `implement` 23 753 · `review` 21 927 · `presentations` 21 063.

**Los cinco menores:** `variant-explorer` 4 602 · `orient` 5 051 · `roast-me` 5 536 · `viral-score` 5 757 · `simplify-code` 6 115.

**El dato de diseño:** `suggest` (7 280 B) es el **13.º más pequeño de 274** y está sometido a un techo de 7 282 B. Sólo **16 de 274** skills caben hoy bajo 8 000 B y **13 de 274** bajo 7 282 B. Es decir: el presupuesto de 2 bytes **no es una propiedad del catálogo, es una propiedad exclusiva de `suggest`**. Para las otras 273 el margen es, en la práctica, ilimitado.

---

## 2. Qué asertan de verdad los validadores sobre un `SKILL.md`

Resumen. `(a)` = clave plana extra en el frontmatter. `(b)` = bloque marcado extra en el cuerpo.

| Validador | ¿Lee `SKILL.md`? | ¿Rompe (a)? | ¿Rompe (b)? |
|---|---|---|---|
| `manifest:check` | frontmatter | **No** | **No** |
| `validate` | frontmatter + cuerpo | **No** | **No**, con una condición |
| `drift:check` | **cuerpo (bloqueante)** | No | **Sí si el bloque trae un enlace de prosa que no resuelve** |
| `drift:knowledge` | no | No | No (vacuo) |
| `knowledge:doctor` | no | No | No (vacuo) |
| `spec:gate` | no | No | No (vacuo) |
| `routing:audit` | **no** | No | No |
| `originality:check` | **no** | No | No |
| `eval-lint.sh` | sólo existencia | No | No |

### `manifest:check` — `node scripts/build-manifest.js --check`

**[LE]** Compara byte a byte `manifest.json` con el regenerado (`scripts/build-manifest.js:141-146`: `if (current !== json) { … process.exit(1) }`). El manifiesto de cada skill se construye en `:27-36` con **exactamente cinco campos derivados del frontmatter**:

```js
return { id, description: fm.description, tags: fm.tags || [],
         recommends: (fm.recommends||[]).filter((r)=>known.has(r)),
         profiles: fm.profiles || [] };
```

**(a) no rompe** mientras la clave añadida no se llame `description`, `tags`, `recommends` ni `profiles`. **(b) no rompe**: el cuerpo no entra en el manifiesto. Confirma A1 del LEDGER.
**[EJ]** Con las 273 skills transformadas: `EXIT=0 · manifest OK (274 skills, 34 agentes, 53 comandos)`, idéntico a la base.

### `validate` — `node scripts/build-manifest.js --validate`

Dos aserciones, y sólo dos (`:125`: `[...validateFrontmatter(), ...validateBodies()]`).

1. **Frontmatter contra AJV** (`:78-89`) usando `schema/frontmatter.schema.json`. **[EJ]** El esquema **no tiene `additionalProperties: false`** (`schema/frontmatter.schema.json:1-11`), y lo probé con cuatro variantes sobre `skills/orient/SKILL.md`: clave plana `governance:`, clave con guion `governance-doc:`, y ambas colocadas inmediatamente después de `description:`. **Las cuatro: `ajv=OK`.** Confirma A6.
2. **Equilibrio de delimitadores de código** (`:94-103` → `scripts/lib/skill-lint.js:15-28`). `fenceBalance` cuenta delimitadores ` ``` ` o `~~~` **en la columna 0** (`skill-lint.js:8,23`) y alterna un flag; si queda abierto, falla con `${id}: unbalanced code-block delimiter opened at line …` (`build-manifest.js:99`).

**La condición de (b):** el bloque inyectado **no puede dejar un delimitador de código en columna 0 sin pareja**. Es la única restricción estructural que `validate` impone al cuerpo. No hay ninguna aserción sobre encabezados, secciones obligatorias, orden, ni longitud del cuerpo.
**[EJ]** Con las 273 transformadas: `frontmatter OK` / `skill bodies OK (code-block delimiters balanced)`, y la línea de peso de `description` **idéntica** a la base (`104.8 KB … 139 over the 350-char ceiling`, `heaviest: nlp (659), open-weights (624), …`).

### `drift:check` — `node scripts/drift-check.js` · **el único bloqueante que lee el cuerpo**

Es la puerta que de verdad restringe la transformación. Mecánica:

1. Recorre todo `.md` bajo `skills/` (`drift-check.js:198-206,257-261`).
2. Quita bloques cercados (`:41-59`) y spans de código inline (`:64-69`) — «*code shows; prose points*» (`:12-17`).
3. Extrae **sólo enlaces markdown en línea** `[texto](destino)` (`:77`, `:79-89`) cuyo destino parezca ruta (`:71-73`: extensión conocida o `/` final).
4. Clasifica (`:112-136`). Se **descartan** `placeholder` (`[<>*{}]`), `anchored` (`:\d+$` o `#`), `runtime` (`~` o `.rsc/`), `web-route` (empieza por `/`) y, **en modo catálogo**, `user-project`: `:126` → `/(^|\/)(02-DOCS|raw)\//`.
5. Lo que queda debe resolver **relativo al directorio del propio documento** y nada más (`:144-146`), **exacto en mayúsculas/minúsculas** segmento a segmento (`:161-178`). Si no resuelve: `process.exit(1)` (`:311-314,336`).

**(a) no rompe:** un valor plano del frontmatter no es un enlace markdown. `extractInlinePaths` (que sí mira rutas en backticks) **sólo corre en modo knowledge** (`:226-228`).

**(b) rompe si, y sólo si,** el bloque incluye un enlace de prosa `[…](ruta)` que no resuelva desde `skills/<id>/` y no caiga en una clase exenta.

**[EJ] Control negativo — la puerta está viva, el PASS no es vacuo.** Inyecté en `clarify` y `analyze` un bloque idéntico salvo el enlace, apuntando a `../_fork-governance/guia.md` (no exento, no existente):

```
EXIT=1
drift-check catalog: 888 prose link claim(s) checked, 7 classified as non-claims
FAIL: 2 link(s) do not resolve:
  skills/analyze/SKILL.md:130  →  ../_fork-governance/guia.md
  skills/clarify/SKILL.md:168  →  ../_fork-governance/guia.md
```

**[EJ] Y el hallazgo favorable:** un enlace a `02-DOCS/wiki/skills/<id>/README.md` —exactamente la ruta estándar que fija §5 y A2— queda clasificado **`user-project`** por `:126,134` y **se descarta antes de comprobarse**. Con las 273 transformadas apuntando ahí:

```
EXIT=0
drift-check catalog: 886 prose link claim(s) checked, 277 classified as non-claims
RESULT: PASS — every prose link in the catalog resolves
```

Las *claims* se mantienen en **886** (el mismo número que en la base) y los no-claims pasan de 4 a 277: los 273 enlaces nuevos entraron íntegros en la clase exenta. **La ruta de gobernanza de §5 es, por construcción, invisible para el único validador bloqueante que lee el cuerpo.**

### `drift:knowledge`, `knowledge:doctor`, `spec:gate` — los tres vacuos

**[LE] + [EJ]**

- `drift:knowledge` (`drift-check.js:267-281`) sólo mira `02-DOCS/wiki` y el directorio de auto-memoria de Claude Code (`:210-212 memoryDir(root, home)`). **Aviso de aislamiento:** `memoryDir` usa `homedir()` por defecto, así que **sin `HOME` redirigido este validador lee `~/.claude/projects/…`**. Con `HOME` en `.fork-tmp/`: `skipped — no knowledge tree found`.
- `knowledge:doctor` (`scripts/knowledge-doctor.js:49-53`) sale 0 de inmediato si no hay `02-DOCS/wiki/`. Lee `skills/` **sólo para los nombres de directorio** (`:88-95`, `extraSlugs`), nunca un `SKILL.md`.
- `spec:gate` (`scripts/spec-gate.js:14,16-24,173`) sólo lee `02-DOCS/wiki/sdd/specs/*.md`.

Los tres: **ninguna aserción sobre un `SKILL.md`**. (a) y (b) les son indiferentes. Confirma D3.3.
**[EJ]** Con las 273 transformadas: `EXIT=0` los tres, con el mismo texto de omisión que en la base.

### `routing:audit` — ciego al contenido del cuerpo

**[LE]** Consume **sólo dos fuentes**: `skills/<id>/evals/cases.yaml` (`routing-audit.js:29-31`) y `manifest.skills` (`:116,119`). El ranker (`scripts/consult.js:153-178`) y `buildTextCorpus` (`scripts/lib/text-rank.js:69-79`) se alimentan exclusivamente de `skill.id`, `skill.tags` y `skill.description`. **No abre ni un `SKILL.md`.** Verifiqué además que `consult.js` no tiene red, ni `spawn`, ni escrituras (`grep -n "fetch|http|spawn|execFile|writeFileSync|mkdirSync|homedir"` → sin resultados).

**[EJ]** Con las 273 transformadas la salida es **carácter por carácter idéntica** a la base, incluido el fallo heredado:

```
routing-audit: 274 skills · 3169 prompts
positive recall: rank-1 44.7% · top-3 63.9% · top-5 70.0%
negative owner-at-1: 4.3% · declared route top-5 84.9% · route beats owner 87.2%
FAIL: declared-route top-5 84.9% < 85%   → EXIT=1
```

Reproduce D3 exactamente (84,9 % < 85 %, umbral en `routing-audit.js:14` `routedTop5: 85`). **Está rojo antes y después: la transformación no lo empeora ni en una décima.** Sigue siendo deuda heredada del commit base, a decidir aparte.

### `originality:check` — no toca un byte de ninguna skill

**[LE]** `catalogDocuments()` (`originality-check.js:43-54`) devuelve **sólo** agentes y comandos:

```js
return [ ...stackAgents().map((agent) => ({ id: `agent:${agent.name}`, text: `${agent.desc}\n${agent.body}` })),
         ...commands.map((command) => ({ id: `command:${command.name}`, text: `${command.description}\n${command.body}` })) ];
```

`:44-46` lee `skills/` sólo para **comprobar que existe `SKILL.md`** y así formar la lista de ids que `resolveCommands` necesita. Confirma A5 del LEDGER.
**[EJ]** Con las 273 transformadas: `originality OK (82 documents vs 93337 corpus fingerprints; 0 exemptions)` — **82 documentos, el mismo número**, y las 273 skills transformadas no aportan ni uno.

### `eval-lint.sh`

**[LE]** Valida `skills/*/evals/cases.yaml`: `should_trigger>=5`, `should_not_trigger>=4`, `capability>=1` (`:32-34`) y resolución de `route_to` (`:100-112`). `SKILL.md` aparece **sólo** como prueba de existencia en `:163` y `:171`. Ni (a) ni (b) le afectan.
**[NV]** No ejecutado: escritura en `/tmp` literal (`:192,203`).

### Puertas que no son `npm run <script>` pero sí leen el cuerpo

Vale la pena registrarlas, porque son las que de verdad limitan la forma del bloque:

| Puerta | `archivo:línea` | Qué exige | Efecto de (a)/(b) |
|---|---|---|---|
| Referencias huérfanas | `tests/catalog-diet.test.js:26-41` | todo archivo de `references/` debe estar nombrado en el cuerpo que lo posee | **Ninguno**: añadir texto no puede huerfanizar nada. **[EJ]** replicado sobre las 273 transformadas → `[orphan refs] none` |
| Procedencia en `doctor` | `scripts/doctor.js:168,183-190` | `origin: risco` debe aparecer en **los primeros 2048 bytes** del `SKILL.md` instalado, o la skill se reporta como **obra del usuario** | **(a) puede romperlo** si empuja `origin:` más allá de 2048 B. **[EJ]** El `origin:` más profundo del catálogo transformado está en el **offset 878 de 2048**; `[doctor origin] misread as user-authored: none` |
| Hash de `ux/upstream` | `tests/ux-upstream.test.js:17,24-32` | sha256 por archivo bajo `skills/ux/upstream/**` + lista exacta de archivos | **Ninguno si la transformación opera sólo a profundidad 2.** `skills/ux/SKILL.md` **no** está en el ámbito congelado; `:43-44` sólo exige que haya **un solo** `SKILL.md` dentro de `skills/ux` |
| Peso de `description` en `doctor` | `scripts/doctor.js:503-510` | cifra informativa | **(a) la distorsiona** sólo si la clave se inserta **justo tras `description:`** y lleva guion: el *lookahead* es `(?=\n[a-z_]+:|$)`, que no acepta guiones. **[EJ]** `orient`: 520 B base → 520 B con la clave al final → **549 B** con `governance-doc:` inmediatamente tras `description:`. No es una puerta, pero inflaría el informe de presupuesto |

---

## 3. Dónde se puede insertar la transformación

### 3.1 El camino completo, de disco a asistente

**[LE]** Trazado de todas las lecturas y escrituras de `SKILL.md` en `scripts/` y `targets/`:

```
skills/<id>/SKILL.md                     (catálogo, byte-idéntico a upstream)
        │
        │  ensureBase() — install-apply.js:60-69
        │  :66  cpSync(join(ROOT,'skills',id), dest, {recursive:true})
        ▼
.rsc/skills/<id>/                        ◄── EL CUELLO DE BOTELLA
   «Project-local single source of truth. Real skill files live here exactly
    once; every assistant gets a lightweight pointer (symlink) back to it»
                                             targets/index.js:9-13 (baseDir)
        │
        ├── adaptador claude  → targets/claude.js  → linkOrCopy (index.js:20-33)  symlink
        ├── adaptador md      → targets/_md-block.js:23-25 → linkOrCopy            symlink
        │      (codex, opencode, deepseek, amp, jules, zed, gemini, antigravity,
        │       copilot, windsurf, cline, roo, continue, junie, kiro, aider)
        └── adaptador cursor  → targets/cursor.js:4-9  reescribe a .mdc
                                  :5  readFileSync(join(fromDir,'SKILL.md'))
                                  :7  writeFileSync(toPath, `---\ndescription: …`)

        y la superficie always-on:
        install-apply.js:294  wireHook(target, paths,
                                 join(ensureBase('suggest',cwd,baseVersions),'SKILL.md'), policy)
          → claude.js:138  (settings.json embebe la RUTA, no el cuerpo)
          → _md-block.js:27-42 (inyecta el cuerpo en AGENTS.md entre marcadores)
          → cursor.js:11-19   (inyecta el cuerpo en .cursor/rules/rsc-suggest.mdc)
```

| Función | `archivo:línea` | Lee | Escribe |
|---|---|---|---|
| `ensureBase` | `install-apply.js:60-69` | `skills/<id>/**` | `.rsc/skills/<id>/**` |
| `linkOrCopy` | `targets/index.js:20-33` | — | symlink (o `cpSync` en Windows / si falla el symlink) |
| `writeSkill` (dispatch) | `targets/index.js:172-174` | — | — |
| `cursor.writeSkill` | `targets/cursor.js:4-9` | `<base>/SKILL.md` | `.cursor/rules/<id>.mdc` |
| `wireHook` (dispatch) | `targets/index.js:176-178` | — | — |
| `_md-block.wireHook` | `targets/_md-block.js:27-42` | `<base>/suggest/SKILL.md` | `AGENTS.md` (y familia) |
| `cursor.wireHook` | `targets/cursor.js:11-19` | `<base>/suggest/SKILL.md` | `.cursor/rules/rsc-suggest.mdc` |
| `claude.wireHook` | `targets/claude.js:138` | — | `.claude/settings.json` (ruta relativa a `.rsc/skills/suggest/SKILL.md`) |
| `buildRegistry` | `scripts/lib/registry.js:48-58` | existencia + hash de metadatos | `.rsc/skill-registry.{json,md}` |
| `contextBudget` | `scripts/doctor.js:505,529` | `<base>/SKILL.md` | nada (lectura) |
| `installedUserSkills` | `scripts/doctor.js:183-190` | primeros 2048 B | nada (lectura) |

**Update:** `targets/auto-update.mjs:85-87` lanza `npx -y @ericrisco/rsc@<version> sync` (en segundo plano). `sync` reentra en `applyInstall` → `ensureBase`, cuyo marcador por skill (`baseVersionsFile`, `install-apply.js:45-52,62-64`) re-materializa la base cuando la versión grabada difiere de la del CLI. **El camino de actualización pasa por el mismo punto.**

**Lo que NO toca `skills/`:** `targets/knowledge-sync.mjs:47` fija `KNOWLEDGE = ['01-TOOLS/','02-DOCS/wiki/','02-DOCS/attachments/']`. Ni `skills/` ni `.rsc/skills/` están en su ámbito, así que B-R1 no alcanza a la salida del transformador.

### 3.2 El punto más estrecho: **existe, y es uno**

**`scripts/install-apply.js:66`, dentro de `ensureBase()` (`:60-69`).**

```js
function ensureBase(id, cwd, baseVersions) {
  const dest = baseDir(id, cwd);
  const stale = baseVersions[id] !== CLI_VERSION;
  if (stale && existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  if (!existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(ROOT, 'skills', id), dest, { recursive: true });   // ← :66
  }
  baseVersions[id] = CLI_VERSION;
  return dest;
}
```

Por qué es el cuello de botella, y no uno entre varios:

1. **Todo asistente consume `.rsc/skills/<id>/`, no `skills/<id>/`.** El comentario de `targets/index.js:9-10` lo declara textualmente: «*Real skill files live here exactly once*». 17 de 18 asistentes reciben un **symlink** a esa base (`index.js:27`), así que el archivo que leen **es** el archivo que escribió `ensureBase`. Cursor lo relee desde la misma base (`cursor.js:5`).
2. **La superficie always-on también sale de ahí**: `install-apply.js:294` le pasa a `wireHook` precisamente `join(ensureBase('suggest', …), 'SKILL.md')`.
3. **Install, sync y update entran por la misma función.** `applyInstall` (`:235`) es la única ruta que materializa una base, y `syncInstalled` (`:692`) y `auto-update` desembocan en ella.
4. **El marcador por skill ya da el punto de re-ejecución correcto.** `install-apply.js:58` declara: «*Skills are read-only catalog (user customization lives in 02-DOCS), so overwriting on a version change is safe*». Una transformación aplicada después del `cpSync` se re-aplica exactamente cuando la base se re-materializa, y el comentario ya asume la reescritura.

**[EJ] Comprobación de extremo a extremo.** Transformé el catálogo del worktree e instalé en proyectos desechables (`HOME` y `cwd` dentro de `.fork-tmp/`), para cinco asistentes que cubren los tres adaptadores:

```
##### claude #####
  .rsc/skills/clarify/SKILL.md : fmKey=true block=true
  clarify           symlink -> <proj>/.rsc/skills/clarify            fmKey=true  block=true
  variant-explorer  symlink -> <proj>/.rsc/skills/variant-explorer   fmKey=true  block=true
##### cursor #####
  .rsc/skills/clarify/SKILL.md : fmKey=true block=true
  clarify           file                                             fmKey=FALSE block=true
  variant-explorer  file                                             fmKey=FALSE block=true
  --- cursor .mdc primeras líneas ---
    ---
    description: rsc skill clarify
    alwaysApply: false
    ---
##### codex / deepseek / windsurf #####
  clarify           symlink -> <proj>/.rsc/skills/clarify            fmKey=true  block=true
  variant-explorer  symlink -> <proj>/.rsc/skills/variant-explorer   fmKey=true  block=true
```

**El bloque marcado del cuerpo llega a los cinco, Cursor incluido. La clave del frontmatter llega a cuatro de cinco y Cursor la destruye.** Ver §5.

**[EJ]** Y la superficie always-on, instalando `suggest` (transformado, a propósito, para medirlo):

```
codex  -> <proj>/AGENTS.md                        bloque=true  clave=false  7582 B
cursor -> <proj>/.cursor/rules/rsc-suggest.mdc    bloque=true  clave=false  7312 B
claude -> <proj>/.claude/settings.json            bloque=false clave=false  3670 B
```

El paso de gancho sólo se planifica si `suggest` está en el conjunto instalado (`scripts/install-plan.js:9`: `if (hooks && skillIds.includes('suggest'))`), y `DEFAULT_SKILL_FLOOR` lo instala incondicionalmente (A9), así que **en la práctica siempre se planifica**.

### 3.3 La alternativa en build, y por qué es peor

**[LE]** `package.json` no tiene `prepack` ni `prepare`; `files` incluye `"skills"` literalmente, y los únicos ganchos son `version` y `prepublishOnly` (puertas, no transformación). Un transformador en `prepack` operaría **sobre el árbol de trabajo**, que es exactamente donde vive la invariante «`skills/` byte-idéntico a upstream». **El punto de install no tiene ese conflicto:** `skills/` se queda intacto y lo transformado es la copia de `.rsc/skills/`, que ya es estado de máquina.

---

## 4. ¿Es reutilizable el idiom de marcadores?

### 4.1 Las tres referencias, confirmadas

**[EJ]** `grep -n` sobre los tres archivos:

```
targets/_md-block.js:11:const MARK_START = '<!-- rsc-suggest:start -->';
targets/_md-block.js:12:const MARK_END   = '<!-- rsc-suggest:end -->';
targets/agents-md-shadow.js:37:const SUGGEST_MARK = '<!-- rsc-suggest:start -->';
scripts/lib/onboarding.js:131:  .replace(/\n*<!-- rsc-suggest:start -->[\s\S]*?<!-- rsc-suggest:end -->\n*/g, '')
```

Una corrección menor al encargo: el reemplazo por regex está en **`scripts/lib/onboarding.js:131`**, no en `:129` (`:130` es el `readFileSync` que lo precede).
Un matiz sobre `agents-md-shadow.js:37`: esa constante **no** escribe nada; sólo detecta (`:97`) si un `AGENTS.md` raíz lleva el bloque gestionado, para decidir si hace falta la sombra `CLAUDE.md`. El marcador propio de ese archivo es `SHADOW_MARK` en **`:41`**.

**[EJ]** El idiom es **único en todo el repositorio**: el barrido de comentarios HTML con forma de marcador en `scripts/` y `targets/` devuelve exactamente dos familias, `rsc-suggest:{start,end}` y `rsc:claude-md-shadow`. No hay convención competidora que imitar ni con la que colisionar.

### 4.2 La mecánica de idempotencia

**[LE]** `targets/_md-block.js:32-40`:

```js
const block = `${MARK_START}\n${body}\n${UPDATE_NOTE}\n${MARK_END}`;
let doc = existsSync(paths.hookTarget) ? readFileSync(paths.hookTarget, 'utf8') : '';
if (doc.includes(MARK_START)) {
  doc = doc.replace(new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`), block);  // reemplaza
} else {
  doc += `${SEAM}${block}\n`;                                                  // o añade
}
```

Reemplazar-o-añadir, con cuantificador perezoso. El inverso (`:54-71`) retira el bloque **y la costura `SEAM` que lo introdujo**, «*nothing more*», con un comentario explícito (`:59-64`) de por qué no normaliza líneas en blanco del resto del documento.

### 4.3 Idempotencia comprobada por ejecución

**[EJ]** Reimplementé ese idiom en un transformador (reemplazar-o-añadir para el bloque del cuerpo, y lo mismo para la clave del frontmatter) y lo ejecuté **dos veces** sobre la copia desechable.

Muestra de cinco (`clarify`, `analyze`, `sdd`, `specify` el mayor, `variant-explorer` el menor):

```
=== PASA 1 ===                        === PASA 2 ===
clarify:          14304 → 14991 (+687)   14991 → 14991 (+0)
analyze:          11086 → 11772 (+686)   11772 → 11772 (+0)
sdd:              18984 → 19658 (+674)   19658 → 19658 (+0)
specify:          30307 → 30992 (+685)   30992 → 30992 (+0)
variant-explorer:  4602 →  5315 (+713)    5315 →  5315 (+0)

diff sha256(pasa 1) sha256(pasa 2)  →  BYTE-IDÉNTICO
recuento tras DOS pasadas: start=1 end=1 fmkey=1  en los cinco
```

Catálogo completo (273 skills, `suggest` excluido), dos pasadas:

```
274/274 BYTE-IDÉNTICO tras una segunda pasada
skills con el marcador: 273 · ninguna con 2 bloques
```

**La idempotencia es real: reejecutar deja un bloque, no dos, y el archivo resultante es byte a byte el mismo.** El idiom es reutilizable tal cual.

---

## 5. ¿Alguien reserializa el frontmatter?

**Sí hay un lado escritor, y es peor que una reserialización: es un reemplazo íntegro.**

### 5.1 Cursor reemplaza el frontmatter entero

**[LE]** `targets/cursor.js:4-9`:

```js
export function writeSkill(id, fromDir, toPath) {
  const body = readFileSync(join(fromDir, 'SKILL.md'), 'utf8');
  mkdirSync(dirname(toPath), { recursive: true });
  writeFileSync(toPath, `---\ndescription: rsc skill ${id}\nalwaysApply: false\n---\n${stripFrontmatter(body)}`);
  return [toPath];
}
```

con `stripFrontmatter` en `:28-30` (`md.replace(/^---\n[\s\S]*?\n---\n?/, '')`). **El frontmatter de origen se descarta por completo** y se sustituye por dos claves fijas, `description` y `alwaysApply`. Lo mismo en `:11-19` para la superficie always-on de Cursor.

**[EJ]** Medido sobre la instalación real: el `.mdc` que recibe Cursor **no contiene** `governance:` (`fmKey=false`) aunque la base de la que se generó sí la tiene (`fmKey=true`), y sus primeras cuatro líneas son literalmente `---` / `description: rsc skill clarify` / `alwaysApply: false` / `---`.

### 5.2 La familia AGENTS.md también descarta el frontmatter, en la superficie always-on

**[LE]** `targets/_md-block.js:28` (`const full = stripFrontmatter(readFileSync(sourceMd,'utf8'))`) con `:73-74`. **[EJ]** Confirmado: el `AGENTS.md` generado no contiene `governance:` (`clave=false`), aunque sí el bloque del cuerpo.

### 5.3 Reserializadores verdaderos: existen, pero no tocan `skills/`

**[LE]** Barrido de todo escritor que emita un bloque `---\n…\n---`:

| `archivo:línea` | Sujeto | ¿Reserializa? |
|---|---|---|
| `scripts/lib/onboarding-apply.js:140-159` | `02-DOCS/wiki/harness/user-profile.md` | Sí, pero **conserva las líneas** (`front` es un array de líneas; `set()` en `:144-148` reemplaza o hace `push`, nunca reescribe lo que no toca) |
| `targets/knowledge-sync.mjs:668-689` (`closeDoc`) | specs de `02-DOCS/wiki/sdd/` | Igual: array de líneas, `set()` reemplaza o `push` (`:671-677`) |
| `scripts/design-upstream.js:65` | `skills/design/engine/RUN.md` | Elimina el frontmatter, deliberadamente (`:64`), y no es un `SKILL.md` del catálogo |
| `targets/memory.js:200` | regla de Cursor generada | No lee nada |

**Ningún reserializador toca un `SKILL.md` del catálogo**, y los dos que existen son conservadores por línea: una clave plana añadida les sobreviviría. **El riesgo real no es la reserialización; es el reemplazo íntegro de Cursor.**

### 5.4 Consecuencia de diseño

**Una clave plana del frontmatter no es un canal universal: cubre 17 de 18 asistentes y Cursor la pierde.** Combinado con C5 del LEDGER («Cursor pierde todos los archivos auxiliares»), el **cuerpo es el único canal que llega a los 18**. Si se añade la clave, debe ser **redundante** respecto al bloque del cuerpo, no portadora del contrato. Alternativa: parchear `targets/cursor.js:7` para preservar la clave de gobernanza — pero eso ya es una divergencia de código del fork, no una transformación de contenido.

---

## 6. El experimento

### 6.1 Montaje

**[EJ]** `git worktree add --detach /Users/home/Development/rsc-harness-fork/.fork-tmp/wt-transformer HEAD` (base `4639e66`), `node_modules` del repositorio principal enlazado por symlink y usado **sólo en lectura** (`require.resolve('ajv')` resuelve a `…/node_modules/ajv/dist/ajv.js`). **No se instaló nada.** Entorno: `HOME`, `TMPDIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `npm_config_cache` dentro de `.fork-tmp/`. Worktree y proyectos de prueba eliminados al terminar.

### 6.2 La carga inyectada

Dos cosas, por skill:

**(a)** una clave plana añadida como **última línea** del frontmatter, después de `origin:`:

```
governance: 02-DOCS/wiki/skills/<id>/README.md
```

**(b)** un bloque marcado al final del cuerpo (~640 B; con la clave, **+697 B de media por skill**, algo más que los ~500 B del encargo, es decir una prueba más exigente):

```markdown
<!-- rsc-fork:governance:start -->
## Gobernanza del fork

Antes de actuar con esta skill, lee su documentación en este proyecto:
[`02-DOCS/wiki/skills/<id>/README.md`](02-DOCS/wiki/skills/<id>/README.md). Si no existe, créala …
<!-- rsc-fork:governance:end -->
```

Deliberadamente contiene **un enlace markdown de prosa** y **una ruta en código inline**, para ejercitar a `drift:check` por sus dos extractores.

Muestra: **`clarify`, `analyze`, `sdd`** + **`specify` (el mayor, 30 307 B)** + **`variant-explorer` (el menor, 4 602 B)**; después, el **catálogo entero** (273 skills, `suggest` excluido). Catálogo: 3 499 971 B → 3 690 388 B (**+190 417 B**, +5,4 %).

### 6.3 Resultados — muestra de cinco y catálogo completo

**[EJ]** Idénticos en ambos casos:

| Validador | Base | Tras transformar | Veredicto |
|---|---|---|---|
| `manifest:check` | `0` · `274 skills, 34 agents, 53 commands` | `0` · **mismo texto** | **PASA** |
| `validate` | `0` · `frontmatter OK` / `skill bodies OK` / `104.8 KB … 139 over` | `0` · **mismo texto** | **PASA** |
| `drift:check` | `0` · `886 claims, 4 non-claims` | `0` · `886 claims, **277** non-claims` | **PASA** (claims sin cambio; +273 exentos) |
| `drift:knowledge` | `0` · `skipped — no knowledge tree` | `0` · mismo texto | **PASA (vacuo)** |
| `knowledge:doctor` | `0` · `no hay 02-DOCS/wiki/` | `0` · mismo texto | **PASA (vacuo)** |
| `spec:gate` | `0` · `no specs found` | `0` · mismo texto | **PASA (vacuo)** |
| `originality:check` | `0` · `82 documents vs 93337` | `0` · **mismo texto, 82 documentos** | **PASA** |
| `routing:audit` | **`1`** · `FAIL: declared-route top-5 84.9% < 85%` | **`1`** · **mismo 84,9 %, mismo texto** | **FALLA antes y después** (deuda heredada, sin delta) |
| `eval-lint.sh` | — | — | **[NV]** escribe en `/tmp` literal (`:192`) |

Puertas replicadas a mano sobre el catálogo transformado:

```
[fences]        unbalanced: none
[orphan refs]   none
[doctor origin] misread as user-authored: none · origin más profundo: offset 878 de 2048
[fm] clarify: keys=name,description,tags,recommends,profiles,origin,governance
[descBytes] clarify: 347 B (= base)   variant-explorer: 268 B (= base)
```

### 6.4 El fallo que sí ocurre: `suggest`

**[EJ]** Aplicando la **misma** transformación a `skills/suggest/SKILL.md` (7 280 B → 7 966 B, +686 B):

```
[caps] suggest = 7966 B
  PASS  always-on-body.test.js:16   < 8000   (holgura 34 B)
  FAIL  clone-bootstrap.test.js:350 <= 7282  (holgura -684 B)
  FAIL  ftd-lane.test.js:57         <= 7282  (holgura -684 B)
```

Texto de los fallos, según las plantillas de los propios tests:

- `tests/clone-bootstrap.test.js:350` → `always-on body is 7966 B, over the 7282 B ceiling — it is paid every turn`
- `tests/ftd-lane.test.js:57-58` → `always-on body: 7966 > 7282 bytes (context-budget)`
- `tests/always-on-body.test.js:20` pasaría, con **34 bytes** de margen sobre 8 000.

**Y el daño no es sólo el test.** `[EJ]` Instalando `suggest` transformado, el bloque de gobernanza **aterriza en la superficie always-on**: `AGENTS.md` de codex (7 582 B) y `.cursor/rules/rsc-suggest.mdc` (7 312 B) **contienen el bloque**. Serían ~690 B pagados **en cada turno**, por 17 asistentes sin gancho, por un bloque que ya está en la skill concreta cuando se invoca. Dos razones independientes, y la segunda es la de fondo.

**Conclusión operativa: `suggest` debe quedar excluido explícitamente del conjunto a transformar**, igual que `skills/ux/upstream/**` y `skills/design/engine/**` (A8). Con `suggest` fuera, las 273 restantes pasan todo lo ejecutable.

### 6.5 Control negativo (ya citado en §2)

**[EJ]** Con un enlace no exento y no resoluble, `drift:check` sale **1** y nombra archivo y línea. **El PASS de §6.3 no es vacuo: la puerta está viva y la transformación la satisface por construcción**, porque la ruta estándar de §5 (`02-DOCS/…`) cae en la clase exenta `user-project` de `drift-check.js:126`.

---

## 7. Veredicto

**La Estrategia B es viable**, con cinco condiciones que salen de la medición y no del juicio:

1. **Insertar en `scripts/install-apply.js:66`**, inmediatamente después del `cpSync` de `ensureBase`. Es el único punto por el que pasan los 18 asistentes y los tres caminos (install, sync, update). No existe un segundo.
2. **Excluir `suggest`.** Rompe dos de sus tres topes y contamina el contexto de cada turno. *(Y los dos subárboles congelados de A8, que una transformación a profundidad 2 ya excluye por construcción.)*
3. **El contrato va en el cuerpo, no en el frontmatter.** `targets/cursor.js:7` reemplaza el frontmatter entero; una clave plana no llega a Cursor. Si se añade, que sea redundante.
4. **Todo enlace markdown de prosa dentro del bloque debe resolver desde `skills/<id>/`, o caer en una clase exenta de `drift-check.js:112-136`.** La ruta `02-DOCS/wiki/skills/<id>/README.md` de §5 es exenta: medido, no supuesto.
5. **Nada de delimitadores de código en columna 0 sin pareja** (`scripts/lib/skill-lint.js:15-28`), y **`origin:` debe seguir dentro de los primeros 2048 bytes** (`scripts/doctor.js:183-190`). Margen actual: 878 de 2048.

**Deuda heredada que no es del fork:** `routing:audit` sale 1 en el commit base por 84,9 % < 85 % y la transformación no lo mueve ni una décima. Es una decisión aparte (adoptarlo como puerta y arreglarlo, o registrarlo).

**Riesgo residual mayor, y es de alcance, no técnico:** `node --test` **no se ejecutó** (línea base en curso). Los tres topes de `suggest`, la prueba de huérfanos de `catalog-diet`, el equilibrio de delimitadores y la sonda de `origin` se **replicaron a mano** sobre el catálogo transformado y pasan; pero **1 537 tests** no se han visto contra un catálogo transformado. De los que leen el cuerpo de una skill, los identificados por lectura son `always-on-body`, `clone-bootstrap`, `ftd-lane`, `catalog-diet`, `ux-upstream`, `design-engine`, `skill-lint`, `frontmatter`, `manifest` y `context-budget`. **Esa suite completa contra el catálogo transformado es el siguiente paso obligatorio**, y sólo puede correr cuando la línea base termine.
