# LEDGER — Fork de rsc-harness

Registro durable de progreso, decisiones, aprobaciones, evidencias y bloqueos.
Fuente de verdad de requisitos: [`docs/fork/REQUIREMENTS.md`](./REQUIREMENTS.md).

**Al reanudar o tras una compactación: leer REQUIREMENTS.md y este archivo antes de continuar.**

---

## Estado actual

*Sincronizado con la realidad el 2026-11-01. El registro cronológico (§9) es la narración completa; esta tabla es el corte transversal.*

| Campo | Valor |
|---|---|
| Etapa actual | **1 — Arquitectura, contrato versionado, presupuesto de evaluaciones y criterios de aceptación** |
| Sub-estado | **Arranque de la etapa hecho y verificado** (fork, Actions desactivado, remotos, B1, R6, base en 3.7.4). **Pendiente:** re-medición de la línea base de tests en curso, y el contenido sustantivo de la etapa — arquitectura y contrato — sin empezar. |
| Plan aprobado | **SÍ — 2026-11-01** (ver §5) |
| Alcance autorizado | El plan completo de [`PLAN.md`](./PLAN.md), **menos** el protocolo de preguntas, retirado por decisión del usuario |
| Commit **auditado** | `6f7edd31` — 3.7.1. La auditoría se hizo contra él y sigue valiendo |
| **Base de trabajo** | `481b1ec9` — 3.7.4, integrada en `d15b2d2`. `package.json` marca 3.7.4 |
| Fork remoto | **`lema017/rsc-harness`**, público, `isFork: true`. **GitHub Actions desactivado** |
| Rama de trabajo | `fork/bootstrap`, subida a `origin`. HEAD `c4aaeae` |
| Commits realizados | **3** — `43ca7d8` (bootstrap + B1 + R6), `d15b2d2` (merge de 3.7.4), `c4aaeae` (registro de la base) |
| Remotos | `origin` → fork; `upstream` → padre con **push inutilizado** (`NO_PUSH_UPSTREAM`) |
| Invariante Estrategia B | ✅ `skills/` **byte-idéntico** a `origin/main`, 274 directorios. Comprobado tras el merge |
| Publicación en npm | Nada publicado. El camino de release es **sólo manual** y no referencia al padre |

### Restricciones en vigor (§1, permanentes — no caducan con la aprobación)
- **Sin instalaciones globales.** Todo proceso del repositorio corre con `HOME`, `TMPDIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME` y `npm_config_cache` dentro de `.fork-tmp/`, más un `.gitconfig` aislado, para no tocar la configuración real de los asistentes del usuario (`~/.claude`).
- **Ninguna credencial, token ni sesión del usuario se expone** a procesos del repositorio.
- **Todo test o script que exija credenciales, servicios externos o escriba fuera de la carpeta dedicada no se ejecuta**: se registra en §7 como no verificado.
- **No se hace push a `main` del fork** mientras exista un camino de publicación; el trabajo vive en `fork/bootstrap`.
- Los accesos se verifican **sin revelar secretos** (ver §4b).

---

## 1. Entorno y commit base

| Campo | Valor |
|---|---|
| Carpeta de trabajo | `/Users/home/Development/rsc-harness-fork` |
| Origen clonado | `https://github.com/ericrisco/rsc-harness` |
| **Commit base de upstream** | `6f7edd31d109b7f0211d637e2d084724f6dd8e26` |
| Fecha del commit base | 2026-10-31 20:42:04 +0000 |
| Autor del commit base | Eric Risco |
| Asunto | `🔖 chore(release): 3.7.1 [skip ci]` |
| Rama | `main` |
| Versión del paquete | `@ericrisco/rsc@3.7.1` |
| Fecha de inicio de la sesión | 2026-10-31 |

Aislamiento para instalación/tests pre-aprobación: `./.fork-tmp/home` (dentro de la carpeta dedicada; ignorado, no commiteado).

---

## 2. Hechos comprobados por ejecución (Etapa 0)

Evidencia obtenida por inspección directa del clon en el commit base.

| # | Hecho | Evidencia | Hallazgo previo de §3 |
|---|---|---|---|
| F1 | El catálogo tiene **274** skills (directorios en `skills/`, sin archivos sueltos). | `ls -1 skills \| wc -l` → 274; `find skills -maxdepth 1 -not -type d` → vacío | ✅ **confirma** «274 skills» |
| F2 | Licencia del repositorio: **MIT**, `Copyright (c) 2026 Eric Risco`. | `LICENSE`; `package.json` → `"license": "MIT"` | — |
| F3 | Paquete publicado: **`@ericrisco/rsc`** v`3.7.1`, `publishConfig.access: public`, bins `rsc` y `rsc-install`. | `package.json` | ✅ **confirma** «el actualizador apuntaba a `@ericrisco/rsc`» (pendiente confirmar el punto exacto del actualizador) |
| F4 | Las skills reales viven una sola vez en **`.rsc/skills/<id>/`** y cada asistente recibe un puntero (symlink relativo en macOS/Linux; **copia real en Windows**). | `targets/index.js` → `baseDir()`, `linkOrCopy()` | ✅ **confirma** «el instalador copiaba a `.rsc/skills/<id>/`» y «enlaces, copias o instrucciones adaptadas» |
| F5 | ~~19~~ → **18 asistentes** soportados con 3 adaptadores: `claude` (hook JSON + dirs enlazados), `cursor` (conversión a `.mdc`, un archivo por skill), `md` (bloque always-on en un archivo markdown). IDs: `claude cursor codex opencode deepseek amp jules zed gemini antigravity copilot windsurf cline roo continue junie kiro aider`. **Corrección:** el coordinador publicó 19 por un recuento parcial; el valor correcto es 18 filas en `SPEC`, verificado. | `targets/index.js:39-63` → `SPEC`; `sed -n '39,64p' \| grep -cE "^\s+[a-z]+:\s*\{"` → 18 | — |
| F6 | `.rsc.json` es el manifiesto commiteado del proyecto (`MANIFEST = '.rsc.json'`): selección, versión, `optOuts`, `gitPermissions`, `floorPaths`. | `scripts/lib/manifest-file.js`, `scripts/rsc.js`, `scripts/install-apply.js` | ✅ **confirma** «`.rsc.json` registraba selección y versión» |
| F7 | `02-DOCS` aparece en **316 archivos** del repo. No existe ninguna clave de configuración `docsRoot` / `DOCS_ROOT` / `wikiRoot` / `knowledgeRoot`. | `grep -rl 02-DOCS` → 316; `grep -rnE "docsRoot\|DOCS_ROOT\|docs_root\|knowledgeRoot\|wikiRoot"` → sin resultados | ⚠️ **indicio de raíz NO configurable** — pendiente de confirmación por la pista de auditoría (Track C) |
| F8 | Validadores deterministas existentes: `manifest:check`, `validate`, `drift:check`, `drift:knowledge`, `knowledge:doctor`, `spec:gate`, `routing:audit`, `originality:check`. `prepublishOnly` encadena manifest + validate + drift + originality. | `package.json` → `scripts` | — |
| F9 | Runner de tests: `node --test` (nativo, sin framework externo). Dependencias de producción mínimas: `@iarna/toml`, `ajv`; dev: `c8`. | `package.json` | — |
| F10 | Existe infraestructura de evaluación semántica propia: `scripts/skill-behavior-eval.js`, `skill-behavior-eval.workflow.js`, `skill-behavior-rubric.md`, `skill-harden.workflow.js`, `skill-scoreboard.workflow.js`, `scripts/lib/behavior-score.js`, `eval-integrity.js`, y `.rsc/eval-sandbox`. | `ls scripts`, `ls scripts/lib` | — |

| F11 | **Todas las 274 skills traen `evals/cases.yaml`** (cobertura 100 %). Existe `scripts/eval-lint.sh` para validarlos. | `find skills -path '*/evals/cases.yaml' \| wc -l` → 274 | — |
| F12 | **Las 274 skills declaran `origin: risco`** en su frontmatter, incluidas las derivadas de terceros. El crédito de terceros no vive en el frontmatter, sino en el README, `skills/design/THIRD_PARTY.md` y los `LICENSE` incrustados. | `grep -h '^origin:' skills/*/SKILL.md \| sort \| uniq -c` → `274 origin: risco` | — |
| F13 | Upstream **admite abiertamente** en su README: «the hard guards run only in Claude Code; OpenCode 2 and Windows have had less real-world testing than macOS and Linux». | `README.md` §«Why you can trust it» | ✅ **corrobora** la inferencia I2/I3: la imposición por código se limita a Claude Code |
| F14 | Superficie CLI de 39 comandos, incluido **`consult`** (`scripts/consult.js`), que es la vía por la que el harness recomienda y aplica skills — punto de inserción natural para §5. | `grep -oE "case '[a-z:-]+'" scripts/rsc.js` | — |
| F15 | `manifest.json` es **generado, nunca editado a mano**, y CI falla si está obsoleto. El frontmatter de cada skill declara `name`, `description`, `tags`, `recommends`, `origin`. | `README.md` §Contributing | — |

---

## 2b. Licencias — verificación de §3

### Licencia del repositorio
**MIT**, `Copyright (c) 2026 Eric Risco` (`LICENSE`, `package.json`). Permite modificar, redistribuir, sublicenciar y publicar el fork con otro nombre, con la única condición de conservar el aviso de copyright y el de permiso en las copias o porciones sustanciales.

### Componentes y skills de terceros

Comprobado por inspección directa de los archivos de licencia incrustados, no sólo por el README.

| Componente | Origen | Licencia | Artefacto en el repo | En la tabla del README |
|---|---|---|---|---|
| `skills/design/engine/` (motor de `design`: inspector, library, assets, references) | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | **MIT**, © 2026 Leonxlnx | `skills/design/engine/LICENSE`, `engine/UPSTREAM.json`, `THIRD_PARTY.md` | ✅ sí |
| `skills/design/references/{modes,finish-review,design-md}.md` (adaptados, texto reescrito) | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) por Paul Bakaus | **Apache-2.0**, © 2025 Paul Bakaus | `skills/design/IMPECCABLE-LICENSE.txt`, `THIRD_PARTY.md` | ✅ sí |
| 12 skills: `design-eng`, `animate`, `animate-expo`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary`, `apple-design`, `prototype`, `pick-ui-library`, `write-swift`, `ask-sonner` | [emilkowalski/skills](https://github.com/emilkowalski/skills) por Emil Kowalski, commit `d23d7f8` | **MIT** | atribución en README | ✅ sí |
| hábitos «answer-first» en `orient` | [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | **MIT** | atribución en README | ✅ sí |
| motor de `scroll-film` (prosa y motor reescritos) | [oso95/scroll-world](https://github.com/oso95/scroll-world) | **MIT** | atribución en README | ✅ sí |
| `skills/ux/upstream/ux-designer/` | autor: Szilárd Hajba | **MIT**, © 2026 Szilárd Hajba | `skills/ux/upstream/ux-designer/LICENSE`, `skills/ux/upstream/UPSTREAM.json` | ❌ **NO** |
| `skills/ux/upstream/ux-usability-foundations/` | autor: hueyexe | **MIT**, © 2026 hueyexe | `skills/ux/upstream/ux-usability-foundations/LICENSE` | ❌ **NO** |

Datos referenciados (no copiados): `skills/design/engine/library/photos.json` apunta a IDs de Lorem Picsum (fotografías de Unsplash bajo licencia Unsplash); `sites.json` describe sitios de One Page Love y Awwwards sin copiarlos; `type.json` enlaza Fontshare y Google Fonts.

### Veredicto de licencias

**No hay bloqueo.** Todo el contenido es MIT salvo los tres documentos de referencia derivados de *impeccable*, que son Apache-2.0. Ambas licencias permiten modificar, redistribuir y publicar el fork bajo otro nombre y otro paquete.

Obligaciones que el fork debe cumplir, y que se incorporan a los criterios de aceptación:

1. **Conservar íntegros** `LICENSE`, `skills/design/engine/LICENSE`, `skills/design/IMPECCABLE-LICENSE.txt`, `skills/design/THIRD_PARTY.md`, `skills/ux/upstream/*/LICENSE` y los `UPSTREAM.json`. Ningún paso de build, instalación o transformación puede eliminarlos ni dejarlos fuera del paquete publicado (verificar contra `package.json.files`).
2. **Conservar el copyright de Eric Risco** en `LICENSE` y añadir el del fork como copyright adicional, nunca sustitutivo.
3. **Apache-2.0 §4(b):** si el fork modifica archivos derivados de *impeccable*, esos archivos deben llevar un aviso prominente indicando que fueron modificados. → **Argumento material a favor de la Estrategia B:** manteniendo `skills/` idéntico byte a byte y generando la capa de gobernanza, el deber de aviso queda confinado al artefacto generado y es trivialmente preciso y auditable.
4. **Apache-2.0 §6 (marcas):** la licencia no concede derechos de marca. El renombrado a `@lema017/rsc-governed` / `rscg` (D3) es coherente con esto y evita apropiarse del nombre del padre.
5. **Corregir la tabla de terceros del README del fork:** omite `skills/ux/upstream/ux-designer` (© Szilárd Hajba) y `skills/ux/upstream/ux-usability-foundations` (© hueyexe), ambos MIT con `LICENSE` presente en el repo. El fork debe acreditarlos. *(Hallazgo propio de esta auditoría; mejora real sobre el padre.)*
6. Si la transformación llegara a tocar `skills/design/engine/`, dejaría de ser cierto que se envía «unmodified»; el `THIRD_PARTY.md` del fork tendría que decirlo. La Estrategia B evita este problema por construcción.

---

## 2c. Resultados de auditoría — Track A (catálogo y anatomía de skills)

Informe completo: [`docs/fork/audit/track-a-catalog.md`](./audit/track-a-catalog.md). Agente read-only; no ejecutó código del repositorio. Hallazgos revisados y, en el punto crítico de `.gitignore`, verificados de forma independiente por el coordinador.

### Inventario (comprobado por ejecución del agente)

| Métrica | Valor |
|---|---|
| Skills | **274** (tres recuentos independientes coincidentes, incl. `manifest.counts.skills`) |
| `name` == nombre de directorio | 274/274 |
| Fuente de distribución | `skills/<id>/` confirmado (`package.json.files`, `build-manifest.js:13-21`, `install-apply.js:19-29`) |
| Archivos / tamaño total | 1 679 archivos, 12 111 726 B (**11,55 MiB**) |
| Con `evals/` | 274 (**100 %**) |
| Con `references/` | 246 |
| Con `scripts/` | 190 (189 de ellos `verify.sh`) |
| Skill modal | 6 archivos |
| Concentración | `design` concentra el **20 %** de los bytes del catálogo |
| Bloque always-on | es `suggest/SKILL.md`: **6 620 B** de cuerpo / 7 280 B de archivo |

### Hallazgos decisivos

| # | Hallazgo | Consecuencia |
|---|---|---|
| A1 | **`manifest.json` NO contiene hashes de contenido.** Claves por skill: exactamente `{id, description, tags, recommends, profiles}`. Es generado, commiteado y CI exige igualdad byte a byte (`--check`). | No hay verificación de integridad del contenido de las skills: una transformación no invalida el manifiesto salvo que cambie esos cinco campos. Facilita la Estrategia B. |
| A2 | **La raíz de documentación NO es configurable.** 151 literales `02-DOCS` en 34 archivos fuente del harness; no existe `docsRoot`, `DOCS_ROOT` ni `RSC_DOCS`. | **Confirma I1 y cierra la pregunta abierta de §3.** El condicional de §5 («si la auditoría demuestra que esa raíz es configurable») **no se activa**: la ruta estándar será `02-DOCS/wiki/skills/<nombre>/README.md` fija. |
| A3 | **`02-DOCS/wiki/skills/<id>/README.md` aparece 0 veces en todo el repositorio.** | La ruta estándar de §5 es territorio virgen: no colisiona con nada existente. La transición de §5 es aditiva, no destructiva. |
| A4 | **El hallazgo previo de §3 sobre Flutter está confirmado pero muy subestimado.** Sólo **24/274 (8,8 %)** siguen el patrón, con ~35 variantes de encabezado distintas. **176 skills (64,2 %) no mencionan `02-DOCS` en absoluto**, y **45 de 45** skills de stack comparables (angular, svelte, django, supabase, vercel…) no lo referencian nunca. | La «convención no uniforme» es en realidad **ausencia de convención**. Refuerza el objetivo de §2: la gobernanza uniforme es precisamente lo que falta. Y reduce el riesgo de la transición: hay poquísimo que migrar. |
| A5 | **`originality-check.js` sólo toma huellas de agentes y comandos — ni un byte de ningún `SKILL.md`.** | **No impone ninguna restricción al fork.** Descarta un riesgo que parecía serio para la Estrategia B. |
| A6 | **El esquema de frontmatter no tiene `additionalProperties: false`.** `origin: risco` en las 274 demuestra que las claves extra viajan sin problema. | La Estrategia B puede añadir metadatos de gobernanza al frontmatter sin tocar el esquema. |
| A7 | **Las rutas son estructurales; el contenido no.** 1 905 referencias `../<id>/SKILL.md`, 1 423 `references/<f>`, 526 `scripts/<f>`. Las ediciones de texto *in situ* son neutras respecto a las referencias; **re-anidar o renombrar rompe** `drift-check` (bloqueante en CI), la puerta 5 de la rúbrica y el test de huérfanos de `catalog-diet`. | Define la forma permitida de la transformación: **modificar contenido en el sitio, nunca mover ni renombrar**. |
| A8 | **Dos subárboles vendorizados están congelados por hash (24 % de los bytes).** `tests/ux-upstream.test.js` comprueba el sha256 por archivo **y la igualdad exacta de la lista de archivos** en `skills/ux/upstream/**`, además de «sólo un `SKILL.md` en `skills/ux`». `skills/design/engine/**` no tiene puerta de hash pero sí una afirmación de atribución «unmodified» y un test de parseo. | **La transformación debe excluir explícitamente estos subárboles.** Coincide con la obligación de licencias nº 6 del apartado 2b: tocarlos rompería a la vez un test y una afirmación de atribución. |
| A9 | **`suggest` es el prompt permanente, no un documento**, y el `DEFAULT_SKILL_FLOOR` de 8 miembros se instala incondicionalmente. **El conjunto de skills internas de §11 son 22, no 3.** | §11 exige evaluar las skills internas: la cifra real es **22** (lista completa agrupada por mecanismo en el informe del Track A). Corrige al alza el presupuesto de evaluaciones. |
| A10 | Margen del campo `description`: límite 1 024, máximo actual 659 → 365 caracteres de holgura en el peor caso; pero **139/274 ya superan el techo blando de 350**. | Inyectar gobernanza en `description` es viable pero estrecho y chocaría con la rúbrica. Mejor vía: frontmatter propio (A6) y/o cuerpo. |

**Veredicto del Track A sobre la Estrategia B:** técnicamente viable. Ninguno de los cuatro mecanismos que se temían (validación de frontmatter, `manifest.json`, referencias relativas, comprobación de originalidad) la bloquea.

---

## 2d. Resultados de auditoría — Track B (instalador, distribución y actualización)

Informe completo: [`docs/fork/audit/track-b-installer.md`](./audit/track-b-installer.md) (1 304 líneas). Agente read-only; `git status --porcelain` limpio al terminar.

### B-R1 — RIESGO MÁXIMO: `knowledge-sync.mjs` destruye personalizaciones commiteadas

`targets/knowledge-sync.mjs:601-603` ejecuta `git checkout tip -- …` (sobrescribe) y `git rm --quiet -- …` (borra) sobre archivos bajo `02-DOCS/wiki/`, **auto-commiteado con `--no-verify`**, desde un hook **por turno** que está **activado por defecto**. La guarda de `:580` sólo protege archivos **modificados localmente**: una personalización commiteada y limpia es reemplazada o borrada sin aviso. Y `02-DOCS/wiki/skills/` cae dentro del prefijo `KNOWLEDGE` que se sincroniza.

**Esto contradice de frente el requisito duro de §5**: «Las personalizaciones […] se versionan en Git y no deben perderse durante instalación, `sync`, `repair`, actualización o reconstrucción de un clon». El mecanismo que las destruye es precisamente el que actúa sobre contenido commiteado.

Es el hallazgo de mayor valor de toda la auditoría y un criterio de aceptación no negociable del fork: la ruta estándar de §5 debe quedar **excluida por código** de cualquier `checkout`/`rm` de knowledge-sync, con test negativo que falle si la exclusión desaparece.

Hallazgos relacionados: `sync`, `repair` y `doctor` **no escriben nada** bajo `02-DOCS/` (`doctor` no tiene ni una llamada de escritura). Otras 15 rutas sí escriben ahí; además `onboarding-apply.js:192` sobrescribe `installation-plan.md` sin condición, y `:342` puede hacer `rmSync -r` de `wiki/harness/` en dos ramas estrechas.

### B-R2 — El bootstrap con el nombre del padre queda commiteado para siempre en los consumidores

`targets/clone-bootstrap.mjs:33` define `const PACKAGE = '@ericrisco/rsc'`. Ese archivo se materializa en `.claude/rsc-bootstrap.mjs` y es **rescatado del `.gitignore`** (`install-apply.js:459`), por lo que **se commitea en el repositorio del consumidor de forma permanente**. Es el vector más peligroso de reinstalación accidental del padre que exige evitar §10.

### B-R3 — La identidad del padre también vive dentro de `skills/`

**316 referencias de identidad en 73 archivos.** Por categoría: `site` 89 · `skills` **85** · recuperación y comandos sugeridos 53 (`rsc.js` 31, `doctor.js` 14) · metadatos raíz 34 · hooks 20 · actualizador 7 · workflows 3 · tests 25 · bootstrap 2.

Cuatro puntos ejecutables son los decisivos: `targets/auto-update.mjs:85` (argv de instalación), `:132` (URL del registro), `scripts/lib/upgrade.js:15` (`spawnSync npm i -g`) y `targets/clone-bootstrap.mjs:33` (B-R2).

**Consecuencia arquitectónica:** 85 de esas referencias están dentro de `skills/` —10 en `suggest/SKILL.md`, el cuerpo always-on, y 8 en `suggest/evals/cases.yaml`, que además controlan CI—, así que **la Estrategia B no puede mantener `skills/` byte a byte idéntico sin una transformación de renombrado**. No invalida la estrategia: la precisa. Ver la resolución B-R4.

### B-R4 — Resolución del conflicto aparente entre A8 y B-R3 (verificado por el coordinador)

A8 exige **congelar** `skills/ux/upstream/**` y `skills/design/engine/**` (hashes, licencias, atribución «unmodified»). B-R3 exige **renombrar** la identidad del padre dentro de `skills/`. Si los subárboles congelados contuvieran referencias al padre, las dos obligaciones serían incompatibles.

Comprobado por ejecución del coordinador:

```
grep -rn "ericrisco|@ericrisco/rsc|rsc-harness" skills/ux/upstream/   → 0
grep -rn "ericrisco|@ericrisco/rsc|rsc-harness" skills/design/engine/ → 0
```

**No hay conflicto.** Los subárboles congelados contienen **cero** referencias de identidad, así que excluirlos de la transformación no deja ninguna referencia del padre sin renombrar. Las referencias están concentradas en pocos archivos no congelados: `init/references/recommend-skills.md` (15), `suggest/SKILL.md` (10), `suggest/evals/cases.yaml` (8), `worktrees/SKILL.md` (5), `review/SKILL.md` (5), `tidy`/`ship`/`sdd-init` (4 cada uno).

### B-R5 — `origin: risco` NO debe migrarse

Cambiar el campo `origin` haría que toda skill instalada se lea como propia del usuario (`doctor.js:165-167` falla justo así), **congelando silenciosamente las actualizaciones de contenido**. Decisión: **conservar `origin: risco`** en las 274. Es además lo correcto para la atribución (§2b).

### B-R6 — Semántica de actualización: confirmada, pero «la siguiente sesión» no es un mecanismo

Confirmados los hallazgos previos de §3: `auto-update.mjs:137-151` → mismo major lanza en segundo plano `npx -y @ericrisco/rsc@<versión exacta> sync` y anuncia que «takes effect in the next session»; `:162` → un cambio de major pregunta. Opt-out vía `.rsc/.no-auto-update`, que viaja en `.rsc.json.optOuts` (`opt-outs.js:21`).

**Pero la activación «en la siguiente sesión» no está implementada como mecanismo:** no hay staging ni puerta de activación; `hook-once.mjs` sólo deduplica salida entre *scopes*. Además **no hay lock en `applyInstall`**, el estado se escribe con `writeFileSync` plano y `ensureBase` hace rm-then-copy → **carreras reales y estados parcialmente activados**.

§10 exige explícitamente «evita carreras y estados parcialmente activados». **Esto el fork lo tiene que construir, no heredar.**

### B-R7 — Publicación y CI

| Elemento | Estado actual | Qué exige §10 |
|---|---|---|
| Publicación | `release.yml:108` → `npm publish --provenance --access public` con `id-token: write` | ✅ provenance ya activo |
| Credencial | **`secrets.NPM_TOKEN` de larga vida** (no Trusted Publishing) | ⚠️ migrar a Trusted Publishing (OIDC) si es compatible; si no, documentar la limitación |
| Permisos de CI | **`ci.yml` no declara bloque `permissions:`** | ⚠️ añadir permisos mínimos explícitos |
| Registro público | 178 versiones, único dist-tag `latest`=3.7.1, atestación de provenance SLSA v1 presente, MIT, maintainer `ericrisco` | referencia |

### Otras confirmaciones del Track B

- La raíz de documentación **no es configurable** (90+ literales `'02-DOCS'`), corroborando A2 de forma independiente. La cláusula «respeta la configuración» de §5 no aplica.
- `02-DOCS/wiki/skills/` **no es leído ni escrito por nada en upstream** (coincide con A3), y **viola la regla «un solo nivel» de `skills/harness/references/wiki-protocol.md:81-82`**. El fork debe extender ese protocolo de forma explícita y documentada como divergencia intencionada.
- Sin bloqueos de licencia: MIT permite renombrar y republicar conservando `LICENSE:3` y los seis avisos de terceros.

---

## 2e. Resultados de auditoría — Track C (asistentes, hooks y raíz de documentación)

Informe completo: [`docs/fork/audit/track-c-assistants.md`](./audit/track-c-assistants.md). Agente read-only.

**Advertencia de método registrada por el propio agente:** la documentación de los proveedores fue leída por dos sub-agentes delegados que citan cada URL; el agente no re-descargó personalmente cada página. Dos elementos son explícitamente de segunda mano: los hooks heredados de Windsurf (sólo snapshot de Wayback) y los hooks de la CLI de Continue (issue de GitHub del proveedor, no documentación publicada). Se tratan como de confianza menor.

### C1 — Raíz de documentación: FIJA, zanjado con tres vías independientes

536 apariciones del literal `02-DOCS` en 81 archivos `.js`/`.mjs`; 316 archivos en todo el repo, **164 de ellos prosa markdown de skills**, que por naturaleza no puede parametrizarse con una constante. No existe identificador de la familia `docsRoot`; no hay variable de entorno (el barrido completo de `process.env` son 21 variables, ninguna sobre documentación); no hay clave en `.rsc.json` (`manifest-file.js:18` enumera las 12 y descarta silenciosamente las desconocidas); no hay flag de CLI; no hay detección de carpeta ni código genérico de prefijo numérico.

**Bloqueo estructural que lo hace irreparable a bajo coste:** los hooks se materializan archivo por archivo bajo `.rsc/` y «no importan nada que no sea Node» (`targets/knowledge-sync.mjs:34-36`), así que **un módulo de constantes compartido no puede alcanzar la capa de hooks**.

→ **El condicional de §5 es inerte.** Ruta estándar fija: `02-DOCS/wiki/skills/<nombre>/README.md`. Confirmado por A2, B y C de forma independiente.

### C2 — Imposición por código: 6 de 18, mediante 8 mecanismos incompatibles

| Nivel | Asistentes | Detalle |
|---|---|---|
| **Plena** (cableado + documentado por el proveedor + puede denegar) | `claude`, `codex`, `gemini` | `codex` depende de que el usuario confíe en `/hooks`; `gemini` sólo acepta stdout JSON |
| **Parcial** | `cursor`, `opencode`, `deepseek` | `cursor`: `beforeSubmitPrompt` bloquea pero **no puede inyectar**; `sessionStart` es fire-and-forget y no existe en agentes cloud. `opencode`: bloquea herramientas, sin API de rechazo de prompt. `deepseek`: sólo bloqueo PreToolUse, exige montar `$DSH_HOME/cordis.patch.yml` por máquina y pierde 2 de los 5 eventos que rsc cablea |
| **Sólo instrucción (12)** | `copilot`, `windsurf`, `cline`, `roo`, `continue`, `junie`, `kiro`, `antigravity`, `amp`, `zed`, `jules`, `aider` | sin evento utilizable hoy |
| **Sin mecanismo de hook del proveedor (4)** | `zed`, `jules` (sólo cloud, sin superficie local), `aider`, `roo` | **`roo`: producto cerrado el 2026-05-15** |

Techo teórico si se extendiera el cableado: **14 de 18**, pero a través de **8 mecanismos mutuamente incompatibles**, 3 de ellos JS en proceso y 2 que exigen opt-in del usuario. La advertencia de §4 («no supongas que un mecanismo cubre todos los proveedores») queda plenamente justificada.

### C3 — HALLAZGO DECISIVO: la selección automática está ausente en 16 de 18

**Las skills aterrizan en una ruta descubrible por el proveedor en sólo 2 de 18** (`claude` y `deepseek`). Las otras 16 van a `<dot-dir>/rsc/<id>/` y **nada en el repositorio le dice a esos asistentes dónde está**.

Esto cambia la naturaleza del problema: en 16 asistentes la selección automática **no es «dependiente del modelo», es inexistente**. Es un límite que el fork debe declarar con honestidad en la matriz de §14 y en el apartado «garantías y límites» del README (§13), no un defecto que pueda prometer resolver.

### C4 — El presupuesto para el preámbulo de gobernanza son 720 bytes (verificado por el coordinador)

Bloque inyectado: **6 620 B** (md/cursor, sin frontmatter) / **7 280 B** (Claude Code, archivo crudo con frontmatter). Los destinos `md` añaden 270 B de `UPDATE_NOTE`; Claude reinyecta **852 B de `SDD_GATE_TEXT` por turno**. Marcadores `<!-- rsc-suggest:start/end -->`, reemplazo idempotente, y `unwireHook` devuelve el archivo byte a byte idéntico.

`tests/always-on-body.test.js:16` fija `BODY_CEILING_BYTES = 8000` y el archivo actual mide 7 280 B → **720 B de holgura**. Verificado por el coordinador. Hay además tres invariantes de test: el decisor completo debe quedar reformulado, sin directivas en mayúsculas y sin duplicar el texto de la puerta literalmente.

→ **Consecuencia de diseño:** el contrato de gobernanza **no cabe** en el bloque always-on. Debe vivir en un artefacto propio referenciado desde él, con carga progresiva de contexto (que §6 ya exige), gastando en el bloque sólo el puntero.

### C5 — Cursor pierde todos los archivos auxiliares

`targets/cursor.js:4-9` copia **únicamente `SKILL.md`** y fija `description: rsc skill <id>`, **descartando la descripción real de activación**. Pero 246 skills traen `references/`, 190 traen `scripts/` y 80 usan enlaces `](../`.

→ En Cursor, el punto 3 de §5 («consultar sus referencias cuando sean pertinentes») es **estructuralmente imposible** y la selección automática queda degradada porque se pierde la descripción. Límite a declarar, no a prometer.

### C6 — Las personalizaciones se auto-commitean y auto-pushean

Amplía B-R1: los archivos bajo `02-DOCS/wiki/` no sólo se sobrescriben y borran, sino que se **auto-commitean y auto-pushean a una rama dedicada `rsc/knowledge`**, por defecto, en 6 asistentes. §5 dice que las personalizaciones «se versionan en Git»: es cierto, pero **no por iniciativa del desarrollador**. El fork debe hacer este comportamiento explícito y gobernable.

### C7 — Toda guarda impuesta por código es desarmable desde un `.rsc.json` commiteado

`targets/opt-outs.js:19-35`: cualquier guarda por código puede desactivarse con un opt-out que **viaja a todos los clones**.

→ Material para §6: refuerza «no equiparar la presencia de un preámbulo con cumplimiento garantizado», y lo extiende — **tampoco la presencia de una guarda por código garantiza cumplimiento** si es desarmable y el opt-out se propaga. El contrato debe documentar esto en la sección de garantías frente a reglas dependientes del modelo.

### C8 — Rutas de instrucción obsoletas o erróneas en `SPEC` (4) y productos muertos

Contra la documentación de los proveedores: `aider` → `CONVENTIONS.md` **no se lee automáticamente**; `.antigravity/AGENTS.md` **no está documentado**; `.junie/guidelines.md` es legacy; el `mode: agent` de copilot está obsoleto. Además `roo` está cerrado, `windsurf` se renombró a Devin Desktop y Gemini CLI arrastra un aviso de EOL.

→ El fork no puede heredar la matriz de soporte del padre tal cual: **hay que reconstruirla contra la documentación vigente** y retirar o marcar lo muerto.

### C9 — Interacción silenciosa entre destinos

El `AGENTS.md` de Zed es **el séptimo de una cadena de primera coincidencia**: cablear `copilot` (que escribe `.github/copilot-instructions.md`) en el mismo proyecto **desactiva silenciosamente el bloque de Zed**. Bug de interacción real que el fork debe detectar y avisar.

### C10 — Preservación de skills del usuario

`.rsc.json.ownSkills` **nunca se ha poblado en ningún proyecto** (`scripts/doctor.js:161-164`). La preservación descansa en el archivo de estado por destino más el frontmatter `origin: risco` (cobertura 274/274) → **refuerza B-R5: no migrar `origin`**. (Nota: el comentario de `doctor.js:160` dice «272 skills»; está obsoleto, son 274.)

---

## 2f. Resultados de auditoría — Track D (tests, validadores y evaluaciones)

Informe completo: [`docs/fork/audit/track-d-tests.md`](./audit/track-d-tests.md) (881 líneas). **Único track autorizado a ejecutar**, bajo el aislamiento de §1.

### Aislamiento: verificado

`~/.claude` tiene mtime `1793495013` **idéntico antes y después** (contenido nunca leído); `~/.rsc` igualmente intacto; `git status` vacío en todo momento. El aislamiento capturó escrituras reales que habrían ido al HOME real: `.fork-tmp/home/.rsc/{memslop-offer.json,automation-gaps.md}`.

**Brecha honesta registrada:** `TMPDIR` no se redirigió, así que 98 de 136 tests escribieron temporales en el directorio temporal del sistema. Corregido en las instrucciones del revisor independiente.

### D1 — Instalación (ejecutado)

`npm install --no-audit --no-fund` → **91 paquetes en 2,33 s**, una deprecación (`glob@10.5.0`). `node_modules/` ignorado (`.gitignore:2`). Recuento de vulnerabilidades **NO VERIFICADO** (`npm audit` requiere el registro).

### D2 — Suite de tests (ejecutado): 2 h 17 min y ningún fallo imputable a upstream

`node --test` → **1 537 tests: 1 497 pasan, 39 fallan, 1 omitido, 8 215 s (2 h 16 m 55 s), exit 1.** Nada se quedó colgado; **ningún test necesita red ni credenciales** (verificado por lectura: las cadenas URL son vectores de prueba de guardas y `auto-update` stubea `npx` por completo). El único omitido es condicional y autodocumentado (`.rsc/` ausente en un clon limpio).

Re-ejecución **en serie** de los 8 archivos que fallaban (`--test-concurrency=1`): 166 tests, 155 pasan, **11 fallan**, 27 min. → **28 de los 39 fallos eran artefactos de concurrencia.** De los 11 restantes, 3 son un artefacto de aislamiento demostrado (PyYAML vive en un *user site-packages* dependiente de HOME, así que `eval-lint.sh` degrada a SKIP y sale 0), y los 8 últimos reproducen pero con causa no aislada: las duraciones se mantuvieron en 35–62 s frente a un `LOCAL_TIMEOUT_MS = 4_000`, y el caso `design-engine A5` conduce un Chrome real bajo HOME redirigido.

**Conclusión: no hay ningún fallo confirmado de upstream.** La línea base se considera verde salvo prueba en contrario, y se re-medirá en una máquina sin carga.

**Dato operativo de primer orden:** la suite tarda **más de dos horas**. Condiciona el diseño de CI y del punto de entrada de mantenimiento de §9: el ciclo completo no puede ejecutarse en cada iteración.

### D3 — Validadores: 10 ejecutados, y dos están en rojo en el commit base

| Comando | Exit | Duración | Observación |
|---|---|---|---|
| `manifest:check` | 0 | 2,1 s | 274 skills / 34 agentes / 53 comandos |
| `validate` | 0 | 1,0 s | 139/274 descripciones sobre el techo blando |
| `drift:check` | 0 | 5,7 s | 886 enlaces de prosa |
| `drift:knowledge` | 0 | 2,9 s | ⚠️ **vacuo**: no hay `02-DOCS` en un clon limpio |
| `knowledge:doctor` | 0 | 5,9 s | ⚠️ **vacuo** por lo mismo |
| `spec:gate` | 0 | 1,0 s | ⚠️ **vacuo** por lo mismo |
| **`routing:audit`** | **1** | 11,7 s | 🔴 **ROJO en el commit base**: ruta declarada top-5 al 84,9 % < 85 %. **Y no se ejecuta en CI.** |
| `originality:check` | 0 | 1,6 s | — |
| `eval-lint.sh` | 0 | 20,7 s | 🔴 **falla en abierto**: 274 SKIPs y aun así `RESULT: PASS` |
| `reviewer-guard.sh` | **1** | 0,1 s | `plugins/` no existe; vestigial |

Tres hallazgos de calidad que el fork puede y debe corregir, y que contradicen el principio que el propio padre declara en su README («*a gate that checks nothing is worse than no gate*»):

1. **`routing:audit` está en rojo en el commit base y CI no lo ejecuta.** El fork debe decidir explícitamente si lo adopta como puerta (y lo arregla) o lo registra como deuda heredada.
2. **`eval-lint.sh` falla en abierto**: 274 SKIPs y resultado PASS. Es literalmente una puerta que no comprueba nada.
3. **Tres validadores son vacuos en clon limpio** (`drift:knowledge`, `knowledge:doctor`, `spec:gate`): pasan trivialmente porque no existe `02-DOCS`. Dan una falsa señal verde justo en el área que el fork va a tocar.

### D4 — Cobertura (parcial; la suite completa NO VERIFICADA por límite de tiempo)

`targets/index.js` **98,4 %** sentencias / 100 % funciones · `install-apply.js` 79,2 % / **57,5 % ramas** · `manifest-file.js` 98,5 % · `build-manifest.js` 60,5 %. La cobertura de knowledge-sync se canceló tras más de 50 min.

### D5 — Infraestructura de evaluación: no cuesta dinero, cuesta ejecuciones de agente

Leída, nunca ejecutada. Hallazgo que **cambia por completo la conversación de presupuesto de §11**: **no requiere API key, ni id de modelo, ni usa `process.env` en ningún punto**. Corre sobre **los propios agentes de la sesión anfitriona** (`agentType: 'Explore'` para los cargadores).

| Parámetro | Valor actual |
|---|---|
| Umbrales | `ABS_MIN 8.5` / `LIFT_MIN 1.0` |
| Repeticiones | **Ninguna (N=1)**; la rúbrica señala N=3 como vía de mejora |
| Muestra estratificada | **No existe en ningún punto** |
| Selección reproducible / semilla | **No existe en ningún punto** |
| Coste por skill | `1 + 3N` ejecuciones de agente |
| Catálogo completo | **≈1 210** ejecuciones de agente (≈1 834 con N=3) |
| Bucle de corrección | ≈28 ejecuciones por skill |

→ El presupuesto de §11 no se mide en dólares de API sino en **ejecuciones de agente, tiempo de reloj y tokens de sesión**. Y §11 exige precisamente lo que no existe: repeticiones, umbrales, selección reproducible de la muestra y tratamiento de resultados inconclusos. **Todo eso lo construye la Etapa 1.**

**Bug concreto encontrado:** 3 skills (`ux`, `variant-explorer`, `viral-score`) tienen entradas `capability` malformadas: son **inevaluables** por el motor y sin embargo `eval-lint` las aprueba. Corrobora D3.2.

### D6 — Brecha contra la lista de pruebas exigida por §11

**4 EXISTEN · 8 PARCIALES · 1 AUSENTE.** Las mayores:

- **Personalización presente/ausente: CERO tests.** `02-DOCS/wiki/skills` **no aparece en ningún archivo de test**. Es el corazón de §5 y no está cubierto en absoluto.
- Prevención de reinstalación del padre: ausente.
- Conflicto funcional (frente al textual): ausente.
- Concurrencia: **cero `Promise.all`** en los tests y el lock de knowledge-sync **sin probar** — concuerda con B-R6.

**No existe ninguna fixture brownfield.** El precedente extensible es `team()` en `tests/knowledge-sync.test.js:27`.

### D7 — Discrepancia abierta entre tracks

Track A fija el conjunto de skills internas de §11 en **22**; Track D lo fija en **29**. Afecta directamente al presupuesto de evaluaciones. **Derivada al revisor independiente para que la zanje con evidencia.**

---

## 2g. Revisión independiente de la Etapa 0 (protocolo §12, dos fases)

Informe completo: [`docs/fork/audit/review-stage0.md`](./audit/review-stage0.md) (1 689 líneas). Fase 1 redactada **antes** de abrir ningún informe de track ni este ledger; Fase 2 después. Read-only, `git status` vacío.

### R1 — CORRECCIÓN DE UN ERROR DEL COORDINADOR: el presupuesto del bloque always-on son 2 bytes, no 720

Existen **dos** topes sobre `skills/suggest/SKILL.md`, no uno:

| Test | Tope | Hallado por |
|---|---|---|
| `tests/always-on-body.test.js:16` | `BODY_CEILING_BYTES = 8000` | coordinador y los 4 tracks |
| **`tests/clone-bootstrap.test.js:350`** | **`bytes <= 7282`** | **sólo el revisor independiente** |

Tamaño actual: **7 280 B** → la holgura real es de **2 bytes**, no 720. (`tests/ftd-lane.test.js:24` fija además `SUGGEST_BYTES_BEFORE = 7282`.)

Verificado por el coordinador: `grep -rn "7282" tests/` → tres coincidencias; `wc -c skills/suggest/SKILL.md` → 7280.

**El coordinador afirmó 720 B «verificado» y comunicó esa cifra al usuario. Era un error de factor 360 sobre el presupuesto más importante del diseño.** Causa: se buscó *un* tope y se dio por completa la búsqueda al encontrarlo. Consecuencia de diseño: queda **descartado** inyectar el contrato —o incluso un puntero— en el cuerpo always-on sin elevar deliberadamente el tope. El comentario del propio test dice que ese número es «the one number to revisit deliberately», así que elevarlo es legítimo, pero debe ser una decisión argumentada, medida y documentada, no un efecto colateral.

### R2 — Discrepancia D7 zanjada: el conjunto de skills internas son **27**

Criterio declarado por el revisor: el código del harness depende de la skill vía cuerpo always-on, suelo de instalación incondicional, texto de puerta, hook, comando o agente (`domains.js` excluido).

- **Track A (22) es incorrecto** por dos motivos: `backups` es un falso positivo de coincidencia textual (las 29 apariciones son `scripts/lib/backups.js`, `.rsc/backups/` y el subcomando `rsc backups`; la skill es de *bases de datos*, `domains.js:23`), y la lista se contradice con su propio criterio de «unión de niveles 1–5» al incluir seis miembros del nivel 6 y excluir siete.
- **Track D (29) es incorrecto** por ser temático: omite cuatro miembros del suelo incondicional (`unslop`, `connect-tool`, `design`, `ux`) y añade once ids sin base estructural (siete tienen **cero** referencias en el código del harness; `parallel` es la primitiva de Workflow).

**Valor adoptado: 27 skills → 40 escenarios evaluables → 147 ejecuciones de agente.** Entra cómodamente en el presupuesto aprobado.

### R3 — B-R1 confirmado y acotado con precisión

El revisor confirma que `02-DOCS/wiki/skills/**` cae dentro de `KNOWLEDGE` (`knowledge-sync.mjs:48,79`), que el hook se cablea **incondicionalmente** (`install-apply.js:337`; `knowledge-wiring.js:137` «Wire it. Always») y que `applyIncoming:587-604` sobrescribe con `git checkout <tip> -- f` —o borra con `git rm`— un archivo **commiteado y limpio**, confirmando después con `--no-verify`. La guarda `mine === base && committed === base` protege el archivo **sucio**, no el limpio: **exactamente al revés de lo que pide §5**. `commitLocal` + `ship` además auto-commitean y **pushean** a `origin/rsc/knowledge`.

**Acotación importante que matiza el Track B:** los borrados son **recuperables desde el historial** y una rama por defecto protegida no se toca (`:567-579`). Por tanto la severidad correcta es **mutación no consentida de artefactos de gobernanza, no pérdida de datos**. La única vía irrecuperable es `purge --with-docs`, que por diseño no toma snapshot. **`install`, `sync`, `repair` y `clone` están limpios.**

### R4 — Imposición por código: cableada con capacidad de denegar hoy = **1**

Track C clasificó «3 plena» basándose en la **capacidad del proveedor**, no en el **cableado real** de este repositorio. El revisor comprueba que **no hay ningún `PreToolUse`/`BeforeTool` cableado para ningún destino salvo `claude`** (`memory.js:94-118` usa PostToolUse/AfterTool).

| Medida | Valor |
|---|---|
| Posible según el proveedor | **6** (Track C acierta) |
| **Cableado hoy con capacidad de denegar** | **1** (sólo `claude`) |

→ Corrige también la corrección que el coordinador transmitió al usuario. Formulación honesta y definitiva: **tal como se distribuye hoy, sólo Claude Code tiene un hook cableado capaz de denegar; otros 5 asistentes tienen mecanismos del proveedor que podrían cablearse, y hacerlo es trabajo del fork.**

### R5 — LA BRECHA QUE NADIE CUBRIÓ: `.rsc.json` borra silenciosamente las claves del fork

`readManifest` (`manifest-file.js:20-50`) devuelve una **proyección fija sobre 12 `KEYS`**: cualquier clave de identidad o gobernanza que el fork añada a `.rsc.json` es **borrada en silencio** por cualquier ejecución del CLI del padre.

Track A demostró lo contrario para el frontmatter de las skills (esquema abierto, sin `additionalProperties: false`) y **nadie trasladó la pregunta a `.rsc.json`**. Bloquea la prevención de reinstalación del padre de §10 en proyectos con ambos CLI instalados. El fork debe extender `KEYS` y tratar la pérdida de clave como condición detectable.

**Segunda brecha:** los tres validadores de conocimiento resuelven contra la raíz del repo **del harness**, así que **nada puede validar el `02-DOCS` de un proyecto consumidor** — la cláusula de §5 sobre documento ilegible o contradictorio no tiene maquinaria que extender; hay que construirla.

### R6 — ACTUAR ANTES DE LA ETAPA 1: el primer push a `main` publicaría

Verificado por el coordinador. `.github/workflows/release.yml` declara en su propia cabecera: «Publishes rsc-universal to npm and **forces a new version on every push to main**». Y contiene:

- `on: push: branches: [main]`
- `git config user.name "Eric Risco"` / `user.email "erisco@icloud.com"` (líneas 65-66)
- `npm version "$BUMP"` (línea 99)
- `npm publish --provenance --access public` con `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` (líneas 108-110)

**El primer commit de `docs/fork/` a `main` dispararía un bump de versión y un intento de publicación, commiteado con la identidad del autor original.** Mitigación parcial: GitHub desactiva Actions por defecto en los forks y el fork no tendrá el secreto `NPM_TOKEN`, así que la publicación fallaría — pero el bump y el commit con identidad ajena pueden ocurrir.

**Medida obligatoria:** cambiar el disparador y la identidad en el **mismo commit** que reconfigura los remotos, trabajar siempre en ramas y no empujar a `main` hasta que esté corregido. Se incorpora como primer paso de la Etapa 1.

### R7 — Recuentos de `02-DOCS`: cifra correcta

El total real es **~1 636 apariciones en ~314 archivos**, de las cuales **1 052 son prosa dirigida al modelo**. Track A (151/34) contaba sólo código y era correcto en su ámbito; Track C (536/81) contaba código **+ tests** y lo etiquetó como «código»; Track B («90+») se quedó corto; F7 (316) contaba archivos en todo el repo. Ninguna conclusión cambia: la raíz sigue siendo fija.

### R8 — Donde el revisor se excede: el corpus de `schema/` (corrección del coordinador)

El revisor reporta «`affaan-m/everything-claude-code` (corpus de 746 KB en `schema/`, **enviado en el tarball de npm**, sin campo de licencia, sin aviso, sin crédito)» y lo lista como asunto de licencias.

**Comprobado por el coordinador, la afirmación está sobredimensionada en dos puntos:**

1. **No es un corpus.** `schema/ecc-originality.u64` son huellas digitales irreversibles: `ecc-originality.json` declara `ngramSize: 8`, `fingerprintFormat: "first 64 bits of SHA-256, sorted"` y una normalización NFKC. Son hashes truncados de 8-gramas normalizados, de los que **no se puede reconstruir ninguna expresión**. El copyright protege la expresión; un índice de hashes truncados no la redistribuye.
2. **Sí está acreditado.** `schema/ecc-originality.json:3` registra `source: https://github.com/affaan-m/everything-claude-code` y la `revision` exacta `90430ab…`, y `scripts/originality-check.js:107` repite la fuente.

Además su **propósito es el opuesto al que sugiere el hallazgo**: `originality-check.js` usa esas huellas para detectar que los agentes y comandos de rsc **no** copien texto de ese proyecto (`targets/agent-catalog.js:215`, `targets/commands.js:144` rechazan «foreign project vocabulary»). Es un control defensivo de originalidad.

**Resolución:** no es un riesgo de licencia ni un bloqueo. Queda un elemento menor de claridad documental: el fork añadirá una nota breve explicando por qué ese artefacto no requiere licencia de terceros, para que la pregunta no se repita en cada auditoría. **El veredicto «sin bloqueo de licencias» se mantiene.**

### R9 — Correcciones menores aceptadas

- `skills/ux/upstream/**` está fijado por bytes **y** por lista de archivos (verificado verde). **`skills/design/engine/**` NO está fijado por hash** — asimetría no documentada en upstream; refina A8. Ninguno de los dos subárboles contiene referencia a `ericrisco`, `rsc-harness` ni a la palabra `rsc` (coincide con la verificación propia del coordinador en B-R4).
- `szilu/ux-designer-skill` y `hueyexe/frontend-agent-skills` sí están acreditados en `skills/ux/THIRD_PARTY.md`, aunque **no** en la tabla del README. La obligación nº 5 de §2b se mantiene: el README del fork debe acreditarlos.
- Escenarios evaluables: 312 (Track D) frente a 318 brutos menos 6 malformados. Coincidentes; se adopta 312.

### R10 — Ranking de riesgos del revisor (independiente)

1. **No hay dónde poner el contrato**: 2 B de holgura en el cuerpo, puerta sólo en Claude, 139/274 descripciones ya sobre el techo blando y `routing:audit` rojo al 84,9 %.
2. Sincronización de conocimiento activada por defecto mutando documentos de gobernanza.
3. `.claude/rsc-bootstrap.mjs` commiteado (`PACKAGE = '@ericrisco/rsc'`, rescatado del `.gitignore`) apuntando permanentemente a los consumidores existentes hacia el padre, sin clave de identidad que sobreviva.
4. «Impuesto por código» es **1** asistente, y 15 de 20 opt-outs están diseñados para propagarse vía `.rsc.json` commiteado.
5. El aparato de validación no puede certificar §11: `eval-lint` falla en abierto, `originality:check` cubre 82 documentos y **cero** skills, `reviewer-guard.sh` permanentemente rojo, 6 de 12 comprobaciones en ningún workflow, n=1 sin repeticiones, `ux` (skill del suelo) inevaluable y en verde, suite de 2 h 17 m — mientras la premisa transversal del fork escala cada cambio de mecanismo a ~1 210 ejecuciones (~1 834 con N=3).

### Crédito del revisor a los tracks

Mejor hallazgo individual de los cuatro informes: el del Track B de que `wiki/skills/<name>/README.md` **viola el protocolo wiki de un solo nivel del propio upstream** (`skills/harness/references/wiki-protocol.md:81-82`). Artefacto más valioso producido: la tabla de hooks por proveedor con URLs del Track C. Trabajo real reconocido: los tres bloques `capability` malformados y el experimento serie-vs-paralelo del Track D.

---

## 3. Inferencias por lectura (NO comprobadas por ejecución)

Se marcan explícitamente como inferencias hasta que una ejecución o una inspección más profunda las confirme.

| # | Inferencia | Base |
|---|---|---|
| ~~I1~~ | ~~La raíz de documentación `02-DOCS/` está fijada por convención y no por configuración.~~ → **PROMOVIDA A HECHO COMPROBADO** por el Track A (hallazgo A2): 151 literales en 34 archivos fuente, sin ninguna clave de configuración. El condicional de §5 no se activa. | F7 + A2 |
| ~~I2~~ | ~~Sólo el adaptador `claude` dispone de hooks ejecutables por código.~~ → **REFUTADA PARCIALMENTE** por el Track A/C. Los hooks de **codex, cursor, gemini, opencode y deepseek son reales y ya están cableados** en `targets/memory.js`, `knowledge-wiring.js` y `update-wiring.js`. Auditar sólo `claude.js` llevaba a la conclusión errónea. Ver 2e. | Track C |
| ~~I3~~ | ~~La conformidad sólo puede garantizarse por código en Claude Code.~~ → **MATIZADA**: la imposición por código es posible hoy en 6 de 18 (3 plena, 3 parcial), no en 1. Pero sigue siendo cierto que **no es uniforme** y que requiere 8 mecanismos mutuamente incompatibles. | Track C |

> Las inferencias I1–I3 eran determinantes para §4 y §14. Las tres quedaron resueltas por la auditoría: I1 promovida a hecho, I2 refutada parcialmente, I3 matizada. Ninguna conclusión del plan descansa ya en una inferencia sin verificar.

---

## 4. Decisiones

Decisiones D1–D4 tomadas por el usuario el 2026-10-31, antes del plan, sobre los puntos de §14 que no dependen de la auditoría.

| # | Fecha | Decisión | Estado |
|---|---|---|---|
| D1 | 2026-10-31 | **Carpeta de trabajo: `~/Development/rsc-harness-fork`** (ruta por defecto de §1). Se detectó un directorio vacío `~/Development/rsc-fork-vicente`; el usuario confirma que NO se usa. | ✅ Confirmada |
| D2 | 2026-10-31 | **Fork público de GitHub bajo la cuenta `lema017`.** Upstream es público, MIT y con `allow_forking: true`, por lo que el fork es legítimo y conserva la red de forks (comparación con el padre, compare-across-forks, PR hacia upstream). Visibilidad pública es obligatoria para un fork de un repo público; el usuario la acepta y descarta la alternativa de repositorio privado. | ✅ Confirmada |
| D3 | 2026-10-31 | **Paquete npm: `@lema017/rsc-governed`; comando CLI: `rscg`.** Scope e identidad propios según §10. Nombre y binario distintos del padre (`@ericrisco/rsc`, `rsc`) para evitar colisión de comando y reinstalación accidental del padre. Ambos scopes candidatos estaban libres (404 en el registro). | ✅ Confirmada |
| D5 | 2026-11-01 | **Asistentes objetivo del contrato de gobernanza: `claude`, `codex`, `cursor`, `antigravity`, `deepseek`** (5 de 18), elegidos por el usuario. Los 13 restantes siguen funcionando como en upstream, sin afirmaciones de gobernanza. **Nota que el coordinador deja registrada:** `antigravity` no tiene mecanismo de hook del proveedor y su ruta de instrucción `.antigravity/AGENTS.md` no está documentada (C8), así que es el destino con la garantía más débil de los cinco; `gemini` y `opencode`, excluidos por el usuario, tenían mejor potencial de imposición. Se respeta la elección y se declara el límite en la matriz. | ✅ Confirmada |
| D6 | 2026-11-01 | **Presupuesto máximo de evaluaciones: ~600 ejecuciones de agente con N=3.** Conjunto interno completo (27 skills, R2) más muestra estratificada reproducible de ~30 skills, ambas con 3 repeticiones. El coste no es monetario: son ejecuciones de agente, tiempo de reloj y tokens de sesión (D5). Ejecutable por lotes y reanudable. El detalle de la Etapa 1 debe permanecer dentro de este límite. | ✅ Confirmada |
| D7 | 2026-11-01 | **Idioma: todo en inglés** — README, documentación, contrato, instrucciones inyectadas y mensajes del producto. Coherente con upstream, con los 1 052 fragmentos de prosa dirigida al modelo en inglés y con el contexto de los asistentes. La interlocución con el usuario sigue en español. | ✅ Confirmada |
| D8 | 2026-11-01 | **Tratamiento de bloqueos fuera de alcance: continuar y reportar al cerrar etapa.** Conservar el trabajo, registrar el bloqueo en el ledger con evidencia e impacto, seguir con todas las tareas independientes, e interrumpir al usuario sólo si el bloqueo corta el camino crítico completo. | ✅ Confirmada |
| D9 | 2026-11-01 | **Política de datos** (no preguntada: determinada por la evidencia de D5/§11). Las evaluaciones no requieren API key, id de modelo ni `process.env`: corren sobre los agentes de la sesión anfitriona. Por tanto **ningún contenido de proyecto del usuario sale de la máquina** y **no se contrata ningún servicio externo**. Las fixtures brownfield serán **sintéticas**, no copias de proyectos reales. Si una etapa llegara a necesitar un servicio externo, se acordará acceso, coste y política de datos al inicio de esa ejecución, como pide §9. | ✅ Propuesta por el coordinador; sujeta a la aprobación del plan |
| D10 | 2026-11-01 | **La ceguera de selección de Cursor queda como límite declarado; no se arregla.** Preguntada expresamente al usuario tras el hallazgo BAJO 4 de la revisión independiente, que señalaba que `ARCHITECTURE.md` §7 proponía repararla pese a que `PLAN.md:193` la enumera entre los límites que se declaran y no se prometen resolver. **Respuesta: dejarlo como límite.** Técnicamente la reparación era barata y no tocaba la invariante, pero barato no es estar dentro del alcance (`PLAN.md` §12). Registrada como **L6** en §10 de la arquitectura, con su cifra medida (~95 % de pérdida de `description`), para que el informe final no la omita. **La gobernanza sí llega a Cursor** — viaja en el cuerpo; lo que no llega es la descripción que le permitiría elegir bien la skill | aplicada |
| D4 | 2026-10-31 | **Autorizaciones concedidas:** (1) crear el fork, ramas, commits y pushes, y reconfigurar `origin`→fork / `upstream`→original en el clon existente; (2) abrir y fusionar PR en el fork; (3) configurar workflows de GitHub Actions; (4) publicar en npm las releases del fork. | ✅ Confirmada — sujeta a los prerrequisitos A1 y A2 |

---

## 4b. Accesos verificados (sin revelar secretos)

Comprobado por ejecución el 2026-10-31 y **revalidado el 2026-11-01**. No se ha usado ni expuesto ningún token a procesos del repositorio.

| Acceso | Estado | Evidencia | Consecuencia |
|---|---|---|---|
| GitHub | ✅ Autenticado como **`lema017`** (keyring), protocolo https | `gh auth status` | Suficiente para fork, ramas, commits, pushes y PR |
| Scopes del token de GitHub | ✅ **`gist`, `read:org`, `repo`, `workflow`** — `workflow` añadido el 2026-11-01 | `gh auth status` | **A1 resuelto.** El push que toca `.github/workflows/` ya fue aceptado |
| Organización visible | `vicente-org` (no se usa; D2 elige la cuenta personal) | `gh api user/orgs` | — |
| Fork preexistente | Ninguno | `gh repo list --fork` sin coincidencias de `rsc` | Se creará limpio |
| Upstream | Público, **MIT**, `allow_forking: true`, 58 forks, 415 estrellas | `gh api repos/ericrisco/rsc-harness` | Fork permitido; ver §licencias de la auditoría |
| npm | ✅ Autenticado como **`lema017`** desde el 2026-11-01 | `npm whoami` | **A2 resuelto.** Publicar es posible; nada publicado todavía |
| Scope `@lema017` en npm | Libre (`404` para `@lema017/rsc`) | `curl registry.npmjs.org` | Nombre disponible |
| Paquete del padre | `@ericrisco/rsc@3.7.1`, dist-tag `latest` únicamente | `npm view` | Referencia para comparar identidad |

### Prerrequisitos que debía ejecutar el usuario — **ambos cumplidos**

| # | Prerrequisito | Comando | Bloqueaba | Estado |
|---|---|---|---|---|
| A1 | Añadir el scope `workflow` al token de GitHub | `gh auth refresh -h github.com -s workflow` | Configurar CI en el fork (parte de §9/§10) | ✅ **CUMPLIDO** 2026-11-01 |
| A2 | Iniciar sesión en npm en esta máquina | `npm login` | Publicar releases del fork (§10, §15) | ✅ **CUMPLIDO** 2026-11-01 |

Ningún prerrequisito del usuario queda pendiente. Si en el futuro apareciera trabajo que exija un acceso nuevo, se registra aquí y el trabajo dependiente se marca como no verificado en §7 hasta que exista.

---

## 4c. Límites del entorno (§12)

| Elemento | Valor comprobado |
|---|---|
| Claude Code | `2.1.303` |
| Node | `v22.22.3` (el paquete exige `>=18`) ✅ |
| npm | `10.9.8` |
| git | `2.41.0` |
| Plataforma | `Darwin x86_64` (macOS Intel) |
| Espacio libre en `/Users/home/Development` | ~36 GiB (93 % de uso del volumen) |

**Restricción de diseño asumida por §12:** los subagentes no son persistentes y no se asume que puedan crear otros subagentes. La sesión principal es el único coordinador: lanza cada agente y reconstruye su contexto desde los artefactos en disco (`REQUIREMENTS.md`, este ledger y los informes en `docs/fork/audit/`). Ningún mecanismo del diseño depende de que un subagente sobreviva entre etapas.

**Limitación de plataforma a registrar:** sólo se puede validar por ejecución en macOS/Intel. El comportamiento en Windows —donde `targets/index.js` copia archivos reales en lugar de crear symlinks— no es verificable en esta máquina y se registrará como limitación residual salvo que se disponga de un entorno Windows.

---

## 5. Aprobaciones

| Fecha | Qué se aprueba | Estado |
|---|---|---|
| 2026-11-01 | **Plan completo (`PLAN.md`)**, con Estrategia B, alcance, exclusiones, presupuesto y los 16 criterios de aceptación | **APROBADO por el usuario** |
| 2026-10-31 | Ruta `rsc-harness-fork`; fork **público** en `lema017`; paquete `@lema017/rsc-governed` + CLI `rscg`; autorización para fork, ramas, commits, pushes, PR, workflows y publicación en npm | APROBADO |
| 2026-10-31 | Asistentes: claude, codex, cursor, antigravity, deepseek. Presupuesto ~600 ejecuciones, N=3. Idioma: inglés. Bloqueos: continuar y reportar | APROBADO |
| 2026-11-01 | Protocolo de preguntas (`grilling`) y overlays por skill | **FUERA DE ALCANCE** por decisión del usuario; aplazado |

### Prerrequisitos

| # | Prerrequisito | Verificado | Estado |
|---|---|---|---|
| A2 | `npm login` | `npm whoami` → `lema017` | ✅ **CUMPLIDO** |
| A1 | `gh auth refresh -h github.com -s workflow` | `gh auth status` → scopes `gist, read:org, repo, workflow` | ✅ **CUMPLIDO.** Hizo falta un segundo intento: autorizar en el navegador no actualiza el token si el proceso del CLI no está esperando en el flujo de dispositivo. Con el comando corriendo en una pestaña de terminal y el código introducido, el scope entró y el push de `.github/workflows/release.yml` fue aceptado. |

## 6. Bloqueos

Ningún bloqueo abierto en este momento.

| # | Bloqueo | Impacto | Estado |
|---|---|---|---|
| **B1** | **`.gitignore:30` contiene `docs/`, que ignora todo el árbol de documentación del repo, incluido `docs/fork/`.** Verificado: `git check-ignore -v docs/fork/LEDGER.md` → `.gitignore:30:docs/`. | §1 exige que «el primer commit de la implementación incluye `docs/fork/`» y §12 exige que el estado durable resida en archivos **y Git**. Hoy `REQUIREMENTS.md`, `LEDGER.md` y los informes de auditoría quedarían fuera del control de versiones y se perderían en un clon limpio. ✅ **RESUELTO** el 2026-11-01 en el commit `43ca7d8` y revalidado tras el merge de 3.7.4. Verificado con `git check-ignore`, no leyendo el patrón. |

### B1 — resolución técnica

Una negación `!docs/fork/` **no basta**: Git no desciende dentro de un directorio ignorado, así que una regla `docs/` hace imposible reincluir nada de su interior. La corrección correcta es sustituir la regla de directorio por una de contenido:

```gitignore
docs/*
!docs/fork/
```

`docs/*` ignora las entradas directas de `docs/` (preservando la intención original del padre, que redirige `docs/` a `02-DOCS/raw/migrated/docs/` — ver comentario en `.gitignore:26`), y `!docs/fork/` reincluye únicamente el árbol del fork, permitiendo que Git descienda en él.

Aplicado como primer cambio del primer commit de implementación (`43ca7d8`), junto con `docs/fork/`. **Comprobado por ejecución:** los archivos de `docs/fork/` son versionables y `docs/otro/x.md` sigue ignorado. Revalidado después de integrar 3.7.4, porque un merge podría haber reintroducido la regla del padre — no lo hizo: `.gitignore` no cambió entre 3.7.1 y 3.7.4.

*(Hallazgo de la auditoría Track A, verificado de forma independiente por el coordinador.)*

---

## 7. No verificado / pendiente

| # | Elemento | Motivo |
|---|---|---|
| NV1 | Scripts o tests que requieran credenciales, servicios externos o escrituras fuera de la carpeta dedicada. | §1 prohíbe ejecutarlos. Se registran aquí al identificarlos; hasta hoy no ha aparecido ninguno en la suite. |
| NV2 | **Línea base de la suite sobre 3.7.4.** En curso al cerrar esta entrada. La cifra de 3.7.1 (1 537 tests, 2 h 17 min, 39 fallos atribuidos a concurrencia) **no es comparable**: la suite gana `tests/memory-hook-cost.test.js`. | Hasta que termine, la hipótesis de que esos 39 fallos eran artefactos de saturación de máquina **sigue siendo una hipótesis**. Si algo reproduce en una ejecución limpia y aislada, pasa a §6 como bloqueo. |
| NV3 | Comportamiento en Windows. | `targets/index.js` copia archivos reales en vez de crear symlinks; no hay entorno Windows en esta máquina. Limitación residual declarada en §4c. |

---

## 8. Handoffs de agentes

| Etapa | Rol | Agente | Entregable | Estado |
|---|---|---|---|---|
| 0 | Auditoría Track A — catálogo y anatomía de skills | agente read-only | `docs/fork/audit/track-a-catalog.md` | ✅ **entregado** 2026-11-01 — sin bloqueos de licencia; Estrategia B viable; detectó B1 |
| 0 | Auditoría Track B — instalador y distribución | agente read-only | `docs/fork/audit/track-b-installer.md` | ✅ **entregado** 2026-11-01 — detectó B-R1 (riesgo máximo), B-R2, B-R6 |
| 0 | Auditoría Track C — asistentes, hooks y raíz de documentación | agente read-only | `docs/fork/audit/track-c-assistants.md` | ✅ **entregado** 2026-11-01 — zanjó C1; corrigió F5 (18≠19) e I2/I3; detectó C3 y C4 |
| 0 | Auditoría Track D — tests, validadores y evaluaciones (ejecución aislada) | agente con ejecución autorizada | `docs/fork/audit/track-d-tests.md` | ✅ **entregado** 2026-11-01 — detectó D3 (2 validadores rojos), D5, D6; abrió D7 |
| 0 | Revisión independiente de la auditoría | agente read-only, protocolo §12 de dos fases | `docs/fork/audit/review-stage0.md` | 🔄 **en curso** — recibe código, requisitos y criterios **sin las conclusiones de los autores** en la Fase 1; zanja D7 en la Fase 2 |

### Verificación de cumplimiento de §1 por el coordinador (2026-11-01)

Comprobado de forma independiente al terminar los cuatro tracks, contra la línea base que el coordinador capturó **antes** de lanzar cualquier agente:

| Comprobación | Resultado |
|---|---|
| `~/.claude` mtime | `epoch 1793495013` = `Oct 31 19:03:33 2026` — **idéntico a la línea base previa a los agentes** ✅ |
| `~/.claude/settings.json` mtime | idéntico ✅ |
| `~/.rsc` mtime | `Oct 30 20:27:58 2026` — anterior a esta sesión, intacto ✅ |
| `git status --porcelain` | vacío ✅ |
| Remotos | `origin` sigue apuntando a `ericrisco/rsc-harness`; sin `upstream` añadido ✅ |
| Commits | ninguno: `HEAD` sigue en `6f7edd3` ✅ |
| Instalaciones globales | ninguna ✅ |
| Archivos fuera de la carpeta dedicada | ninguno modificado ✅ |

La configuración real de los asistentes del usuario no fue tocada en ningún momento.

---

## 9. Registro cronológico

- **2026-10-31** — Primera ejecución. Creado `~/Development/rsc-harness-fork`; clonado `ericrisco/rsc-harness` en commit base `6f7edd31`. Persistidos `docs/fork/REQUIREMENTS.md` (verbatim) y este ledger. Sin commits, sin cambios de remotos, sin pushes. Iniciada la auditoría obligatoria de §3.
- **2026-11-01** — Cerrada la Etapa 0: auditoría en cuatro tracks, revisión independiente de dos fases (R1–R10), decisiones D1–D9 y plan en `PLAN.md`. Presentado al usuario; **pendiente de aprobación**.
- **2026-11-01** — A petición del usuario, antes de aprobar: dibujados tres diagramas de flujo en `docs/fork/diagrams/` (`01-customize-existing-skill.svg`, `02-add-new-skill.svg`, `03-upstream-maintenance.svg`). SVG versionables, en inglés (D7), con `<title>`/`<desc>` como texto alternativo y paleta legible sobre fondo claro y oscuro. Validados como XML bien formado y verificados por renderizado real a 1280 px. Son la semilla de las dos imágenes que exige §13: el diagrama 1 cubre «skill → personalización opcional → ejecución» y el 3 cubre «mantenimiento manual → análisis/validación → publicación → actualización del proyecto»; el 2 es adicional. **Describen la Estrategia B propuesta, no un estado implementado.** Sin commit (§1).
- **2026-11-01** — Preguntas del usuario sobre el contrato, el transformador y el ciclo de sync. Dos hechos nuevos **comprobados por ejecución**, ambos cargantes para el diseño del transformador:
  - **F16 — no hay identificador estable de skill.** `origin:` está presente en las 274 pero vale `risco` en todas: es autoría, no identidad. Por tanto un renombrado en upstream **no es detectable por metadatos**; sólo por similitud de contenido (detección de renombrados de Git) y con confirmación humana. Consecuencia: un renombrado aplicado en silencio dejaría `02-DOCS/wiki/skills/<nombre-viejo>/README.md` sin consultarse nunca — pérdida silenciosa de gobernanza, justo lo que §5 prohíbe.
  - **F17 — el frontmatter no se parsea como YAML.** `scripts/lib/frontmatter.js` es un comparador de líneas hecho a mano: acepta `clave: valor` y listas `clave:` + `  - item`, e **ignora toda línea que no encaje** (`if (!kv) continue;`). No hay lista blanca de claves ni rechazo de claves desconocidas (confirma A6). Consecuencia: la clave de gobernanza debe ser **plana**; un objeto anidado se leería como claves de primer nivel. Claves con guion son válidas (`[A-Za-z_][\w-]*`).
  - Confirmado además el idiom de marcadores reutilizable para la inyección idempotente: `targets/_md-block.js:11`, `targets/agents-md-shadow.js:37` y el reemplazo por regex de `scripts/lib/onboarding.js:129`. Y que `profiles:` sólo aparece en 73 de 274, así que el frontmatter heterogéneo ya es la norma.
  - **Hueco corregido en `PLAN.md`:** el plan no decía qué pasa con alta/baja/modificación/renombrado de skills en upstream ni con una personalización huérfana. Añadido al alcance (§4) y como criterio de aceptación 12, con renumeración de los siguientes (ahora 16).
- **2026-11-01** — Más preguntas del usuario (bajas de skills, qué genera el update del padre, qué hace la instalación). Hechos comprobados añadidos:
  - **F18 — upstream ya declara el modelo de propiedad que §5 completa.** `scripts/install-apply.js:58`: «Skills are read-only catalog (user customization lives in 02-DOCS), so overwriting on a version change is safe». Es decir, el catálogo se sobrescribe sin miedo **porque** la personalización vive en `02-DOCS/`. Upstream declaró la intención y nunca la implementó: `wiki/skills` aparece **0 veces** en `scripts`, `targets` y `skills`.
  - **F19 — la inspección del proyecto que existe hoy es determinista, no analítica.** `scripts/detect-repo.js` (`detectRepo`, `detectRepoProfile`) detecta stacks, gestores de paquetes, scripts, test runners y monorepo **por presencia de archivos**. No analiza convenciones ni contradicciones: eso es trabajo nuevo de §7.
  - **F20 — el nombre oficial no es ambiguo.** En las 274 skills, el nombre del directorio coincide exactamente con la clave `name:` del frontmatter (0 discrepancias), así que `02-DOCS/wiki/skills/<nombre>/README.md` es una ruta predecible y única por skill.
  - **Aclaraciones añadidas a `PLAN.md`:** el fork sigue a upstream en las bajas (conservar una skill eliminada exige adoptarla explícitamente); mantenimiento del fork y análisis del proyecto son dos máquinas separadas; y la instalación **no** genera personalizaciones en masa — el análisis brownfield es aparte, limitado a las skills seleccionadas, y sólo escribe con evidencia y aprobación.
- **2026-11-01** — El usuario describe el flujo de instalación que espera (preguntas → constitución → adaptación de las skills seleccionadas). Verificado que **su modelo encaja con maquinaria que ya existe**:
  - **F21 — el onboarding ya decide con evidencia y procedencia.** `scripts/lib/onboarding.js`: `scanProject` recoge señales, stacks y complejidad; `buildOnboardingPlan` marca cada componente como `selected` / `deferred` / `excluded`, cada uno con `reason`, `provenance` (`declared-intent`, `proportionality-policy`, `separate-consent-boundary`), `reevaluateWhen` y `triggerRules`; el usuario acepta el plan explícitamente (`--accept-plan <id>`, con guarda `RSC_PLAN_CHANGED`). `recommendDeferredComponents` reevalúa lo diferido cuando cambia la evidencia. Este vocabulario es reutilizable casi tal cual para las categorías que exige §7.
  - **F22 — la constitución del onboarding es un borrador.** `CONSTITUTION_PATH = '02-DOCS/wiki/sdd/constitution.md'`; se escribe con `status: draft` y la descripción «Draft written by rsc onboard from the accepted plan; not ratified». Ratificar es de la fase `constitution`, con el usuario delante. Consecuencia de diseño: el paso de adaptación no puede presumir de una constitución ratificada en el momento de instalar.
  - **Añadido a `PLAN.md`:** precedencia constitución (general) sobre personalización por skill (específica), con las contradicciones tratadas como **excepción registrada** y no como anulación silenciosa; y carácter **incremental** de la adaptación, con la advertencia honesta de que en greenfield hay poca evidencia que analizar.
- **2026-11-01** — El usuario propone incorporar el skill «Grill Me». Analizado el original y comparado con el catálogo:
  - **F23 — el original es diminuto y su licencia es MIT.** `mattpocock/skills`: `skills/productivity/grill-me/SKILL.md` son **157 B** y sólo delegan (`disable-model-invocation: true` → llama a `grilling`); el contenido real es `skills/productivity/grilling/SKILL.md`, **2 077 B**; `grill-with-docs` son 247 B y encadenan `grilling` + `domain-modeling`. MIT © 2026 Matt Pocock. No hay «funcionalidad de más que traiga ruido»: no hay nada que recortar.
  - **La técnica:** árbol de decisiones; preguntar por rondas agotando la **frontera** (decisiones con prerrequisitos resueltos); preguntas numeradas, cada una con respuesta recomendada y redactada para que «sí» la acepte; lo que depende de una pregunta abierta va a una ronda posterior; **los hechos los busca el agente** (con subagente de contexto fresco), sin bloquear; fin cuando la frontera queda vacía.
  - **F24 — solapamiento parcial real con `clarify` (14 304 B).** `clarify` ya hace «resolver internamente antes de preguntar», «un lote enfocado», «lleva tu propia recomendación», taxonomía de ambigüedad, anti-patrones, puerta de salida y adaptación de registro técnico/analogías — esto último que `grilling` no tiene. Lo que `clarify` **no** tiene: el modelo de frontera **iterativa** multironda y su condición de terminación. Y, decisivo: **`clarify` exige un spec existente** y está atado a la cadena SDD, así que no cubre el paso de personalización.
  - **Decisión propuesta:** la técnica entra como **cláusula del contrato §6** («preguntas y resolución de conflictos», hoy vacía), no como un skill, para que alcance a las 274; más **un skill propio mínimo** del fork para la invocación manual. Se elimina el mandato de subagentes (§12). Se acredita a Pocock. Riesgo registrado: `routing:audit` ya está rojo al 84,9 %, así que delimitar contra `clarify` e `idea-refinement` es condición de aceptación.
- **2026-11-01** — El usuario rechaza el tercer skill y pide **adaptar el método dentro de `clarify` e `idea-refinement`**, conservando sus enlaces actuales. Aceptado; es mejor que la propuesta del coordinador por dos razones:
  - Una cláusula genérica del contrato habría **contradicho el cuerpo de `clarify`** («ask — one focused batch»), creando dentro del mismo archivo el conflicto que §7 obliga a detectar. Resuelto formulando la frontera como **generalización**: el lote único es su caso de una sola ronda.
  - **F25 — no hay punto central de inserción.** `skills/sdd/SKILL.md` (18 984 B) es un **despachador**: enumera las fases y enruta, pero no define cómo se pregunta; su única referencia compartida es `references/model-routing.md`. La fórmula «one focused batch» aparece duplicada en 6 skills (`clarify`, `clickhouse-analytics`, `community`, `course-storytelling`, `marketing`, `presentations`). Por tanto el cambio debe ser por skill nombrada, no en un archivo común.
  - **Mecanismo decidido: overlays por skill en el transformador** — suplementos declarativos y marcados sobre skills nombradas, definidos en el árbol propio del fork, de modo que `skills/` sigue siendo espejo intacto y el merge mensual sigue limpio. Alcance inicial: `clarify` e `idea-refinement`.
  - **Coste registrado:** un overlay acopla a la prosa de upstream; es el único punto donde la Estrategia B se acerca a la A. Se exige que el mantenimiento avise cuando una skill con overlay cambie en upstream, porque ahí un merge limpio **no** es prueba de compatibilidad.
  - Retirado del plan el tercer skill propio.
- **2026-11-01** — Pregunta del usuario: ¿usar un skill suelto tipo grill-me **en lugar de** `clarify` dentro de la cadena SDD daría un resultado incompatible? **Sí, y por razón estructural verificada:**
  - **F26 — el entregable de `clarify` no son las respuestas, es el spec editado.** Su propia tabla de anti-patrones: «Answering the questions in your head and leaving the spec as-is — The deliverable is the *edited spec* plus the Clarifications log, not a clean conscience.» La puerta de salida exige además que **cada punto tipado del handoff tenga desenlace declarado** (asked / validated / deferred / graduated), «nothing silently dropped», y que cada respuesta quede incrustada en el cuerpo del spec con criterios de aceptación observables, bajo `## Clarifications` y acotada bajo `## Out of scope`.
  - **F27 — existe un contrato de encadenado legible por máquina.** Cada fase SDD cierra con un bloque `result-envelope` JSON (`status`, `artifact`, `next_recommended`, `risk`, `skill_resolution`, `evidence`) «so the dispatcher can chain without interpreting prose». Un skill externo no lo emite, así que el despachador no puede encadenar.
  - **Consecuencia:** un grill-me suelto produce conversación, no artefacto. El spec quedaría sin editar, `plan` planificaría sobre un spec sin desriesgar, los puntos tipados quedarían silenciosamente caídos, y `analyze` —que compara constitución ↔ spec ↔ plan ↔ tareas y **no edita nada**— no vería esas decisiones porque no están en ningún artefacto. Las decisiones vivirían sólo en la conversación y se perderían con ella.
  - **Refuerza la decisión del usuario** de adoptar el método dentro de `clarify`: heredando la fase, hereda gratis el contrato de artefacto. Añadida a `PLAN.md` la restricción de que el overlay emite el sobre **una vez al final** y evalúa la puerta tras la última ronda, con comprobación en las evaluaciones.
  - **Delimitación posible para un futuro skill suelto**, si alguna vez se quiere: sólo **fuera** de la cadena, donde no hay spec ni sobre que honrar. Decisión aplazada hasta medir routing.
- **2026-11-01** — **Decisión del usuario: el protocolo de preguntas sale del alcance de este trabajo.** Lo abordará él más adelante. Retirado de `PLAN.md` el bullet de alcance, la fila de presupuesto y, con ellos, el **mecanismo de overlays por skill**: existía únicamente para ese uso y es el único punto donde la Estrategia B se acercaba a la A, así que sin consumidor no se construye. Los hechos F23–F27 y el diseño del mecanismo se conservan aquí íntegros para cuando se retome: el método de `grilling` (MIT © 2026 Matt Pocock), su formulación como generalización del lote único para no contradecir a `clarify`, los overlays declarativos y marcados sobre `skills/` intacto, el aviso de mantenimiento cuando una skill con overlay cambie en upstream, la eliminación del mandato de subagentes, y la restricción de emitir el `result-envelope` una sola vez al final. Alcance vuelve a ser el de la gobernanza de skills personalizadas.
- **2026-11-01 — ETAPA 1, arranque.** Plan aprobado. Acciones ejecutadas y verificadas:
  - **Fork creado:** `lema017/rsc-harness`, **público**, `isFork: true`, rama por defecto `main`. Creado desde fuera del clon (`gh repo fork --clone=false` con argumento de repo) para que no pudiera tocar los remotos locales; comprobado después que seguían intactos.
  - **R6 — riesgo encontrado peor de lo supuesto:** se asumió que GitHub deja Actions desactivado en los forks. **Falso para este fork:** `gh api repos/lema017/rsc-harness/actions/permissions` devolvía `{"enabled":true,"allowed_actions":"all"}`. Desactivado de inmediato → `{"enabled":false}`. Es la mitigación más fuerte de R6 y precede a cualquier push.
  - **Remotos reconfigurados sin reclonar** (§1): `origin` → `https://github.com/lema017/rsc-harness.git`; `upstream` → `https://github.com/ericrisco/rsc-harness.git`, con URL de push inutilizada (`NO_PUSH_UPSTREAM`) para que un push a upstream sea imposible por accidente. `HEAD` sigue en el commit base `6f7edd31`.
  - **B1 corregido:** `.gitignore` pasa de la regla de directorio `docs/` a la de contenido `docs/*` + `!docs/fork/`. **Verificado con `git check-ignore`**, no leyendo el patrón: los cuatro archivos de `docs/fork/` son versionables y `docs/otro/x.md` sigue ignorado.
  - **R6 corregido en el archivo:** eliminado el disparador `push: branches: [main]` — la publicación queda **sólo manual** (`workflow_dispatch`); identidad cambiada a `lema017` / `lema017@users.noreply.github.com` (noreply, para no publicar el correo real del usuario en un repositorio público); y las dos lecturas `npm view @ericrisco/rsc version` apuntadas a `@lema017/rsc-governed`, de modo que **el camino de publicación no referencia al padre en ningún punto**. Comprobado: cero coincidencias de `ericrisco|Eric Risco|erisco@` en `.github/workflows/`.
  - **Inconsistencia temporal declarada:** `release.yml` ya nombra `@lema017/rsc-governed` mientras `package.json` sigue siendo `@ericrisco/rsc`. Es deliberado y más seguro que la alternativa: el workflow no puede operar sobre el paquete del padre. El renombrado completo de identidad va en su propio commit.
- **2026-11-01 — Upstream avanzó entre el clon y la creación del fork.** El `main` del fork nació en `481b1ec9` (**3.7.4**), no en el commit base auditado `6f7edd31` (3.7.1). Son **6 commits y 9 archivos**. Medido, no supuesto:
  - **`skills/` es byte-idéntico** entre ambos commits (`git diff --quiet` limpio; 274 directorios en los dos). **Toda la auditoría del catálogo sigue válida sin reservas**, y con ella el fundamento de la Estrategia B.
  - **`.gitignore` sin cambios** → la corrección B1 aplica igual.
  - **R6 persiste idéntico en la versión nueva**, sólo movido de línea: `push: branches: [main]` (17-18), `git config user.name "Eric Risco"` (94-95), `npm view @ericrisco/rsc` (108) y `npm publish --provenance --access public` (149). El peligro es el mismo; el archivo creció 59 líneas por el commit #338, que endurece el encadenado de releases.
  - **F21 sigue en pie:** `scripts/lib/onboarding.js` cambió (+14 líneas, por no escanear `vendor/` y reconocer `composer.json`), pero conserva `scanProject`, `buildOnboardingPlan`, `provenance` y `declared-intent` (8 coincidencias).
  - Otros cambios: `targets/session-memory-{adapter,core}.mjs` (coste de los hooks de memoria), `package.json`/`manifest.json` (bump de versión) y dos archivos de test nuevos.
  - **Rama `fork/bootstrap` subida** a `origin` con el commit `43ca7d84`, basada en `6f7edd31`. Diverge de `origin/main`: no hay fast-forward posible.
  - **Decisión pendiente del usuario:** mantener la base en `6f7edd31` y tratar 3.7.2–3.7.4 como el primer ejercicio del mantenimiento de §9, o adelantar la base de trabajo a `481b1ec9` reaplicando la corrección R6 sobre el archivo nuevo. El commit auditado queda registrado como referencia de auditoría en cualquiera de los dos casos.
- **2026-11-01 — Base de trabajo adelantada a 3.7.4 por decisión del usuario.** `git merge origin/main` sobre `fork/bootstrap`. **Un solo conflicto**, el previsto: `.github/workflows/release.yml`. Resuelto tomando la versión de upstream íntegra (conserva su endurecimiento del encadenado de releases, +59 líneas) y **reaplicando R6 encima**. Verificado tras el merge, por ejecución: `on:` sólo `workflow_dispatch`; identidad `lema017` / `lema017@users.noreply.github.com`; `npm view @lema017/rsc-governed`; **cero** coincidencias de `ericrisco|Eric Risco|erisco@` en `.github/workflows/`; cero marcadores de conflicto; YAML válido. **Invariante de la Estrategia B comprobada: `skills/` byte-idéntico a `origin/main`** tras integrar. B1 revalidado con `git check-ignore`. `package.json` ahora 3.7.4. Commit de merge `d15b2d2`.
  - **Nota para §11:** la suite gana `tests/memory-hook-cost.test.js`, así que la cifra de 1 537 tests de la línea base de 3.7.1 ya no es comparable. La re-medición se hace sobre 3.7.4. La primera ejecución se abortó deliberadamente al decidirse el adelanto, porque medía el árbol antiguo.
- **2026-11-01 — Sincronización del ledger con la realidad.** La tabla de **Estado actual** —lo primero que se lee al reanudar o tras una compactación, por mandato de la cabecera de este archivo— seguía declarando «Etapa 0, plan pendiente, fork no creado, ningún commit, remotos sin modificar». El registro cronológico sí estaba al día, de modo que el archivo se contradecía a sí mismo y el corte transversal era el lado falso. Corregido por lectura del estado real, no de memoria: rama, commits, versión, remotos, scopes y la invariante de `skills/` comprobados por ejecución antes de escribir. Ajustados también: las subsecciones de fase pre-aprobación, sustituidas por las **restricciones de §1 que son permanentes** y no caducan con la aprobación; los accesos de §4b (scope `workflow` presente, npm autenticado); el prerrequisito **A1 → cumplido** con la nota de por qué falló el primer intento; el **bloqueo B1 → resuelto** y revalidado tras el merge; y §7, que pasa de un único marcador genérico a los tres pendientes reales (línea base en curso, Windows no verificable).
- **2026-11-01 — ETAPA 1, contenido sustantivo (primera entrega).** Escritos y commiteados cuatro artefactos en `docs/fork/stage1/`, todos con cifras medidas sobre 3.7.4, no supuestas:
  - **`CONTRACT.md`** — contrato de gobernanza v1. **Decisión forzada por evidencia:** `.rsc/` está en `.gitignore:6`, así que el documento completo **no existe en un clon limpio hasta que se instala**. Un puntero que puede colgar no puede ser el único sitio donde viven las reglas → el preámbulo es **normativo y autosuficiente** y el documento sólo lo expande. Cubre los nueve temas que exige §6 y mantiene en tablas separadas lo garantizado por código, lo dependiente del modelo y lo medido por evaluación, como §6 ordena.
  - **`PREAMBLE-v1.txt`** — el preámbulo canónico, medido: **779 B de plantilla, 772–797 B renderizado** (nombre de skill más corto `go`, 2 caracteres; más largo `source-grounded-development`, 27), **~209 KB sobre las 274**, es decir ~+4 % sobre un tarball de 5,3 **MiB** (la Etapa 4 lo mide en 5 602 330 B; «5,3 MB» era MiB mal nombrado). Tres claves **planas** de frontmatter (`governance`, `governance-customization`, `governance-digest`), planas por F17. El digest existe para que una inyección **parcial o manipulada** sea detectable, que es lo que convierte el «0 parciales» del criterio 4 en algo comprobable.
  - **`EVALUATION.md`** — presupuesto de ~600 ejecuciones. **Hecho nuevo medido:** las 274 skills **ya** traen `evals/cases.yaml` (claves `skill`, `capability`, `should_trigger`, `should_not_trigger`) con **3 175 prompts** (~11,6 por skill), pero miden **enrutamiento, no gobernanza**; y correrlos una vez contra **un** asistente costaría **3 175 ejecuciones, 5,3 veces el presupuesto completo** (47 625 con cinco asistentes y N=3). Consecuencia: el corpus heredado se consume con un comprobador determinista y **cero** ejecuciones de agente, y el presupuesto compra un corpus nuevo y pequeño. Diseño: 6 conductas × 5 asistentes × 6 skills estratificadas = **180 celdas** × N=3 = 540 ejecuciones, **60 de reserva** para las celdas con veredicto 2-1 elevadas a N=5. Y la limitación dicha con números: con 90 observaciones y 0,95 observado, el IC al 95 % es de **±4,5 puntos**, así que un 95 % observado respalda «≥ 90 %», **no** «≥ 95 %».
  - **`ACCEPTANCE.md`** — los 16 criterios con instrumento, comando y condición de paso falsable, clasificados en determinista / evaluación / inspección. **Dos ya cumplidos** (1 y 2). **Criterio 6 con instrumento verificado y línea base:** `npm pack --dry-run --json` da **1 782 archivos, 5,3 MiB** (5 602 330 B; la unidad estaba mal nombrada como MB), y las **ocho** obligaciones de licencia viajan en el tarball — `LICENSE`, `skills/design/engine/{LICENSE,UPSTREAM.json}`, `skills/design/{THIRD_PARTY.md,IMPECCABLE-LICENSE.txt}`, `skills/ux/upstream/UPSTREAM.json` y los dos `LICENSE` de `ux-designer` y `ux-usability-foundations` — más 274 `SKILL.md` y 274 `cases.yaml`. (Corrección de un error del coordinador: buscó esos artefactos en la raíz del repo y concluyó que no existían; están anidados dentro de `skills/`, que sí entra en `package.json.files`.) **Criterio 13 con limitación real registrada:** la ida y vuelta por el registro de npm no se puede verificar sin publicar, y publicar para probar no es aceptable — se reporta como «verificado contra tarball local, no contra registro».
  - **`CUSTOMIZATION-SCHEMA.md`** — esquema del archivo `02-DOCS/wiki/skills/<nombre>/README.md`: frontmatter plano con seis claves obligatorias, `scope` **sin valor por defecto** (en un monorepo un ámbito omitido esparce cada decisión local por todo el repositorio), `## Out of scope` como sección **obligatoria** (un archivo que sólo dice qué decide implica por silencio que decidió todo), las seis categorías del criterio 10 con lo que cada una autoriza, y ocho reglas de validación deterministas. Mantiene **«observed pattern» separado de «approved convention»** porque `scripts/detect-repo.js` reconoce stacks por presencia de archivos y no puede distinguir una decisión de un accidente (F19): fundirlas ascendería a ley cada accidente del código. Huérfanas y renombrados resueltos de forma determinista (criterio 12).
  - Commits `4639e66` y `dd6414e`, subidos.
- **2026-11-01 — Línea base de 3.7.4: aparecen fallos y la hipótesis de concurrencia se cae en parte.** Con la suite a medio camino hay fallos cuya atribución **ya no es «concurrencia»**:
  - **`tests/eval-lint.test.js` — FALLO REAL, y decisivo.** Tres aserciones en rojo (`:47`, y los casos de `external:` y de `route_to` multivalor). El mensaje de la propia aserción de upstream es literal: **«a stale route must fail, or the gate is decorative»**, esperaba código de salida **1** y obtuvo **0**. Es una comprobación de código de salida, determinista, sin git y sin sensibilidad a la carga de la máquina. **Corrobora D3 con el propio test de upstream como testigo:** `eval-lint` falla en abierto, y la suite de upstream lo sabe y está roja por ello en `main`.
  - **`tests/capabilities.test.js:344`** — `install: .rsc/ is gitignored, additively and idempotently` en rojo: esperaba `null` (no añadir, porque `.rsc` ya cubría la ruta) y obtuvo la ruta del `.gitignore` temporal, es decir **sí añadió**. Determinista. **No es nuestro:** el `.gitignore` de la aserción es uno que el test crea en un temporal, no el del repo, así que la corrección B1 no interviene.
  - **Atribución corregida sobre la marcha:** se sospechó que el worktree que un agente creó en `.fork-tmp/wt-transformer` pudiera estar colisionando con los tests que hacen `git merge` real (`ftd-close`, `fc0x`, `knowledge`). **Falso, comprobado:** `tests/ftd-close.test.js:35` usa `mkdtempSync(join(tmpdir(), ...))`, así que esos tests crean sus propios repositorios en temporales y no tocan el `.git` del fork. Esa atribución queda descartada en vez de quedar como sospecha cómoda.
  - **Pendiente de atribuir** cuando termine: el grupo de auto-actualización (6 fallos, posible dependencia de registro → si exige servicios externos, §1 prohíbe ejecutarlo y pasa a no verificado), `dsh04`/`dsh06` (puente a otra herramienta), `A5` (puerta de navegador), `userprompt-gate`, el CLI de `gap log` y el grupo `ftd`/`fc0x`/`knowledge`.
  - **Decisión metodológica:** no se aborta la ejecución. Los fallos deterministas (eval-lint, capabilities) son válidos tal cual; los sensibles al entorno se **re-miden después a solas**, ejecutando sólo esos archivos sin agentes activos, que cuesta minutos y no dos horas.
- **2026-11-01 — ETAPA 1: las tres verificaciones cerradas. Veredicto: la Estrategia B es viable.** Informes íntegros en `docs/fork/stage1/evidence/`. Los tres agentes instalaron o transformaron **de verdad**, con `HOME`/`TMPDIR`/`XDG_*`/`npm_config_cache` redirigidos; `~/.claude` y `~/.rsc` con mtime idéntico antes y después; `~/.dsh` nunca creado. Arquitectura resultante en `docs/fork/stage1/ARCHITECTURE.md`.
  - **F28 — el punto de transformación existe y es uno:** `scripts/install-apply.js:66`, el `cpSync` de `ensureBase()` (`:60-69`). Ningún asistente lee `skills/`; todos consumen `.rsc/skills/<id>/` (`targets/index.js:9-13`, *«real skill files live here exactly once»*). 17 reciben symlink, Cursor la relee, la superficie always-on sale de ahí, e **install, sync y auto-update desembocan en la misma función**. Verificado instalando para claude, cursor, codex, deepseek y windsurf. Un `prepack` sería peor: operaría sobre el árbol de trabajo, donde vive la invariante.
  - **F29 — el cuerpo es el único canal que llega a los 18.** `targets/cursor.js:7` **reemplaza el frontmatter entero** (`stripFrontmatter` `:28-30`); medido, el `.mdc` de Cursor **no** contiene la clave añadida aunque la base sí. `_md-block.js:28,73-74` también la descarta en la superficie always-on. **Invalida la mitad del diseño del contrato:** las claves de frontmatter pasan a ser redundantes respecto al bloque del cuerpo — frontmatter para máquinas, cuerpo para modelos.
  - **F30 — CORRECCIÓN A R1: `suggest` tiene TRES topes, no dos.** El tercero es **`tests/ftd-lane.test.js:24` + `:57-58` (`<= 7282`)**, que R1 no registró. Elevar el presupuesto always-on exigiría tocar tres archivos, no dos.
  - **F31 — los 2 bytes son exclusivos de `suggest`, no una propiedad del catálogo.** Distribución de los 274: mín 4 602 (`variant-explorer`), **mediana 12 506**, máx 30 307 (`specify`). `suggest` es la **13.ª más pequeña** y sólo 16 skills caben bajo 8 000 B. El encuadre anterior —mío y de R1— invitaba a leerlo como límite catalogal; no lo es.
  - **F32 — la aplicación de una skill NO es un evento observable en ningún destino.** Los únicos matchers del repositorio son `'Bash'` (×4) y `'Edit|Write|MultiEdit|NotebookEdit'` (×1); cero coincidencias de `'Skill'` como herramienta o matcher en `scripts/`, `targets/` ni `tests/`. **Ninguna cláusula del contrato se puede imponer en el momento de aplicarse, en ningún asistente.** Lo que el código deniega es una llamada a herramienta, que es otro evento.
  - **F33 — en un clon fresco, `claude` tampoco deniega.** `.claude/settings.json` y `.claude/rsc-bootstrap.mjs` viajan, pero `.rsc/` está ignorado, así que **ninguna guarda existe**; el bootstrap devuelve sólo `additionalContext`, deliberadamente: `clone-bootstrap.mjs:371-374`, *«no `permissionDecision`: informing someone is not denying them»*. Formulación honesta: **denegación sólo en `claude` y sólo tras `rsc sync` en esa máquina.** Acota R4 más de lo que estaba registrado.
  - **F34 — la guarda es borrable por el proyecto que guarda.** `.claude/settings.json` viaja en git y **no** lo cubre el `.gitignore` generado, así que la entrada del hook se puede eliminar en un commit.
  - **F35 — la ruta de §5 no hace tropezar al único validador que podría.** `drift:check` es el **único** de los nueve que lee el cuerpo de forma bloqueante, y **exime** `02-DOCS/wiki/skills/<id>/README.md` por clasificarla como `user-project` (`drift-check.js:126,134`). Medido. Un control negativo con enlace no exento devuelve EXIT=1 nombrando archivo:línea, así que el PASS no es vacuo.
  - **F36 — `.rsc.json` descarta las claves del fork, demostrado.** `manifest-file.js:18` (`KEYS`, doce cerradas), `:31-47` (proyección literal), `:60,64`. Una clave `forkGovernance` committeada **desapareció en la primera instalación, sin aviso**; agravante: `:28-30` sí trata el JSON corrupto como condición dura. **Decisión: archivo propio `.rsc.fork.json`, cero líneas de divergencia** (`manifestPath` sólo construye `.rsc.json`, `:15-16`); extender `KEYS` no resolvería nada porque el CLI del padre seguiría borrándolas. **Y la no-desarmabilidad sale gratis:** la desarmabilidad es **opt-in por guarda** (`opt-outs.js:19-35` las nombra una a una), así que una guarda del fork que no registre nombre no es desarmable, con cero divergencia.
  - **F37 — la selección automática de Cursor está ciega, no ausente.** `cursor.js:7` escribe `description: rsc skill <id>`: medido **355→21 B**, **350→19 B**, **479→17 B**, ~95 % de pérdida. Es la reparación más barata encontrada, porque `cursor.js:5` ya tiene el `SKILL.md` completo en mano, y es código del arnés, no del catálogo. Nativa en `claude` y `deepseek`; **inexistente** en `codex` y `antigravity`, donde además se verificó que nada les dice dónde están las skills y que el bloque always-on usa rutas relativas que desde la raíz del proyecto **apuntan fuera del proyecto**.
  - **F38 — la gobernanza NO mueve `routing:audit`. Ni un caso.** Aplicado el preámbulo literal más las tres claves a las 274: **0 de 274 entradas de manifest cambian**, cifra bit a bit en **84,91 %**. El corpus del ranker se construye sólo con `id`×3 + `tags`×2 + `description` (`text-rank.js:69-80`) leídos de `manifest.json`, que `build-manifest.js:29-35` llena con cinco campos del frontmatter: **el cuerpo no entra nunca**. Las claves pasan `validate` porque el esquema no fija `additionalProperties: false` (`frontmatter.schema.json:1-12`).
  - **F39 — `routing:audit` se puede poner verde sin mejorar nada.** Pegar la **misma frase irrelevante** a las 274 `description` sube la cifra a **85,14 % y abre la puerta**, porque el IDF de `text-rank.js:88` nunca llega a cero y el texto compartido entra en el coseno. **Una puerta verde así no es prueba de nada.** Y la única variante de gobernanza que la **baja** es nombrar el id de la skill en su `description` (84,47 %, rompiendo `rank-1` y `top-5`). Hoy está roja por **2 casos de 1 339**, con `top-5` exactamente en el suelo.
  - **F40 — las personalizaciones NO pueden ser entradas de catálogo.** Con **sólo 27** entradas extra se rompen cuatro suelos (colisión 0,984). Junto a F38 y F39 esto **confirma por medición** tres decisiones del diseño: `02-DOCS/` es la raíz correcta, el cuerpo es el sitio correcto y la `description` es intocable.
  - **F41 — arreglar `eval-lint` no crea deuda.** Reimplementadas sus cuatro aserciones actuales sobre las 274: **0 fallos**. Se puede poner estricto hoy y queda verde hoy. El defecto real es que `warned_skip` se calcula bien y está **desconectado del código de salida** (`:220-230`). Y hay un defecto de datos **invisible incluso a la validación profunda**: 3 skills (`ux`, `variant-explorer`, `viral-score`) con `capability` malformada, que `count()` no ve porque sólo mide longitud de lista — hace falta una aserción de **forma**.
  - **F42 — hallazgo nuevo: la puerta de limpieza de `ci.yml:24-31` convierte el exit 2 de error de escaneo en PASS** mediante `! grep`. Comprobado por ejecución. Es textualmente lo que prohibe `skills/verify/SKILL.md:90`.
  - **F43 — recuentos de puertas:** **23** comprobaciones con nombre, **8** en algún workflow, **0 en hooks de git** (`core.hooksPath` sin fijar, sólo `*.sample`). Las que no corren en ninguna parte son **6** — cifra de la auditoría previa confirmada. Paquete determinista completo: **130 s medidos**, frente a 2 h 17 min de la suite: el diseño tiene que separarlos por cadencia.
  - **F44 — `reviewer-guard.sh` se descarta con fundamento:** `exit 1` permanente, `plugins/` no existe y **los 6 encabezados que exige no están en ningún archivo del repositorio**; su doctrina ya vive en `skills/review/SKILL.md` con otra forma.
  - **Correcciones menores:** el regex de marcadores está en `onboarding.js:131`, no `:129`; `agents-md-shadow.js:37` no escribe, sólo detecta; y `track-c:385,387` mezclan capacidad del proveedor con cableado real (lo cableado para `codex` **no** incluye `PreToolUse`, lo de `cursor` **no** incluye `beforeShellExecution`). Además `02-DOCS/wiki/skills` **no aparece en ningún archivo de código, test ni prosa de skill**, sólo en `docs/fork/`: la ruta del fork es terreno nuevo, nada que extender.
- **2026-11-01 — INCUMPLIMIENTO DE §1 POR UN AGENTE, registrado.** Al barrer el inventario de comprobaciones, el agente de deuda heredada ejecutó `node scripts/design-upstream.js`, que hace **3 peticiones GET a `api.github.com`** (`scripts/design-upstream.js:37,42,47`). **Viola la restricción de «sin servicios externos»** del usuario. Atenuantes comprobados, no supuestos: fue **sin autenticar** (el entorno no tenía ninguna variable de credencial, sólo `API_TIMEOUT_MS`) y con `HOME` redirigido a `.fork-tmp/home`, así que **no se expuso ninguna credencial, token ni sesión del usuario**. El agente lo declaró por iniciativa propia en §0 de su informe. Consecuencia de diseño, que además lo zanja: **`design:upstream` queda descartado como puerta** precisamente por depender de la red contra repositorios de terceros. Instrucción reforzada para los próximos agentes: enumerar no es ejecutar, y un script desconocido se lee antes de invocarse.
  - Registrado también: **`scripts/eval-lint.sh:192,203` escribe `/tmp/eval-lint.$$.err`, fuera de la carpeta dedicada.** No se ejecutó esa rama. Un validador que escribe fuera del proyecto es en sí mismo un hallazgo.
  - **Anomalía del scratchpad, resuelta:** un agente reportó que su script auxiliar apareció reescrito en disco apuntando al repositorio principal. Causa: **colisión entre mis propios tres agentes compartiendo el mismo directorio de scratchpad** con el mismo nombre de archivo; los tres scripts que mencionaba (`design-upstream.js`, `audit.js`, `skill-behavior-eval.js`) son de upstream, del clon original. El agente **no lo ejecutó**. **Integridad del repositorio comprobada después:** 0 archivos modificados, HEAD igual a `origin/fork/bootstrap`, `skills/` byte-idéntico a upstream, ningún worktree huérfano.
- **2026-11-01 — La línea base se colgó, y el instrumento estaba mal.** El intento 1 se paró a las 13:49 con **706 pasan / 20 fallan** y seguiría ahí indefinidamente: tres archivos colgados (`knowledge-sync.test.js` 2 h 55 m, `team-safe-default.test.js` 59 m, `worktree-reaper.test.js` 53 m). Diagnosticado antes de actuar: **sin conexiones de red abiertas, sin procesos git vivos, sin hijos**; los tres usan `mkdtempSync` y **no tocan el repositorio real**. Dos hipótesis propias descartadas por comprobación: (a) **no** era el worktree del agente colisionando, y (b) **no** eran operaciones git de red bloqueadas en un prompt de credenciales — los `git push` de `team-safe-default.test.js:438-446` son **cadenas que se pasan a una función evaluadora**, no comandos ejecutados, y en `knowledge-sync` sólo aparecen en comentarios. Cuelgan dentro de JS.
  - **El hallazgo que importa: `npm test` es `node --test` a secas, sin timeout por test.** Un único test colgado paraliza las dos horas enteras y la suite nunca reporta. Eso convierte cualquier medición en rehén de un cuelgue.
  - **Acción:** log del intento colgado archivado como `.fork-tmp/logs/baseline-stalled-run1.log`; procesos terminados; **relanzado con `node --test --test-timeout=180000`**, que convierte un cuelgue en un fallo reportado (180 s son 34× la media de 5,3 s/test). Los tres archivos colgados se caracterizarán a solas después.
  - **Condición declarada de la medición:** la máquina está compartida con otra sesión de trabajo del usuario ajena a este fork. Se declara en vez de omitirse.
  - **Corrección de una afirmación mía, más fuerte de lo que la evidencia sostenía.** Dije que los fallos de `eval-lint` eran «un fallo real de upstream, no concurrencia». Lo correcto: **tres de los cinco tests de `tests/eval-lint.test.js` exigen `status === 1` y se ponen rojos en la rama degradada**, y esa rama se toma porque falta **PyYAML**, cuya instalación global §1 prohibe. Es decir, son atribuibles al entorno — coincide con los «tres artefactos de aislamiento» que ya registraba `LEDGER.md:312`. **Lo que sí es un defecto real e independiente del entorno** es que el código de salida esté desconectado del contador de omisiones (`:220-230`), más que el cuarto test (`:81-85`) falle en abierto él mismo. La conclusión sobre `eval-lint` se sostiene; mi atribución de esos tres rojos no se sostenía.
- **2026-11-01 — Actions reconsultado: sigue desactivado** (`{"enabled":false}`). Se mantiene como la mitigación más fuerte de R6. **Pero habilitarlo no sería neutro, y queda registrado por qué:** `ci.yml:3` dispara `on: [push, pull_request]`, **`pages.yml` despliega en push a `main` sin ejecutar ninguna comprobación**, y `ci.yml` **no tiene bloque `permissions:`**, así que hereda el permiso por defecto; mínimo privilegio exigiría `contents: read` explícito.
- **2026-11-01 — DECISIÓN PENDIENTE DEL USUARIO: el criterio de aceptación 4.** Dice *«toda skill distribuida porta el contrato … sobre las 274»*. La arquitectura entrega **273 con preámbulo en línea + `suggest` cubierta por un artefacto always-on dedicado**, porque inyectarle el preámbulo rompe dos de sus tres topes y, peor que el test, haría pagar ~690 B **en cada turno** a 17 asistentes sin gancho. Las dos opciones: (a) aceptar **273 + exclusión declarada y probada**, que rompe la letra del criterio aprobado; o (b) **elevar los tres topes**, contra la razón por la que existen. Recomendación: (a), con la exclusión escrita, probada y acreditada en el informe final, nunca silenciosa. **No se avanza sobre el criterio 4 hasta que el usuario decida**, porque forma parte del plan aprobado. Precedente que abarata (a): `targets/memory.js:198-201` ya escribe un `.mdc` separado de 324 B con `alwaysApply: true`, marcador gestionado y comprobación de colisión — exactamente la forma que hace falta.
- **2026-11-01 — LA HIPÓTESIS DE CONCURRENCIA QUEDA DEMOSTRADA, con mecanismo y no por descarte.** Arrastrábamos desde 3.7.1 el supuesto de que 28 de los 39 fallos eran artefactos de saturación de máquina. Ya no es un supuesto.
  - **Intento 2** (`--test-timeout=180000`, paralelo por defecto): 30 min de reloj, **551 tests reportados, 463 pasan, 5 fallan de verdad** (`testCodeFailure`) y **83 archivos muertos por timeout** (`testTimeoutFailure`, *«test timed out after 180000ms»*). Es decir, 83 de ~137 archivos no llegaron a reportar nada.
  - **El experimento que lo zanja.** Los mismos archivos ejecutados **en solitario**, con el mismo entorno aislado: `capabilities` **20 s**, `originality` **2 s**, `frontmatter` **1 s**. No son lentos. Entre 1 y 20 segundos en solitario frente a más de **180 segundos** bajo paralelismo: el tiempo de reloj por archivo se infla **dos órdenes de magnitud** por contención en esta máquina.
  - **Consecuencia sobre la cifra histórica:** los 2 h 17 min de 3.7.1 se midieron **mientras cuatro agentes de auditoría saturaban la máquina**. No era el coste de la suite; era el coste de la suite más la contención. La cifra no sirve como línea base de nada y queda retirada como referencia.
  - **Y un segundo efecto que no estaba registrado y es peor que los falsos positivos: la contención también ESCONDE fallos reales.** `tests/capabilities.test.js` **falla 2 veces en solitario**, de forma reproducible — uno de ellos el de `.rsc/ is gitignored, additively and idempotently`. En el intento 2 ese archivo no apareció entre los 5 fallos porque estaba entre los 83 **cancelados antes de llegar a ejecutarse**. Un régimen de medición que cancela archivos no produce «fallos de más»: produce un veredicto sin relación con el estado del código, en las dos direcciones.
  - **Corrección del instrumento, segunda vez.** El intento 1 (sin timeout) se colgó para siempre; el intento 2 (timeout de 180 s, paralelo) mató 83 archivos sanos. Ninguno de los dos es un instrumento. **Intento 3: `node --test --test-concurrency=1 --test-timeout=600000`** — serie, que da tiempo por archivo honesto y atribución limpia, con un techo de 10 min que separa holgadamente un archivo lento (20 s medidos) de un cuelgue real (2 h 55 m observadas).
  - **Conclusión de diseño, que afecta a los criterios 3, 7 y 14 y a la recomendación de puertas:** `npm test` tal como viene (`node --test` a secas, paralelo y sin timeout) **no es un instrumento de medición en esta máquina**. Si la suite se adopta como puerta de release, la puerta debe fijar **concurrencia y timeout explícitos**, o su veredicto es ruido. Un `npm test` verde obtenido por contención no dice nada, y uno rojo tampoco.
  - **Los 5 fallos reales del intento 2:** tres de `tests/eval-lint.test.js` (rama degradada por falta de PyYAML, ya atribuidos) y dos de `tests/deepseek-target.test.js` (`dsh04`, `dsh06`, el puente a otra herramienta). Pendiente de confirmar contra el intento 3 en serie.
- **2026-11-01 — DECISIÓN DEL USUARIO SOBRE EL CRITERIO 4: se llega a 274, sin exclusiones.** *«Llega a 274, esos son los skills actuales».* Queda cerrada la decisión pendiente: el criterio de aceptación 4 **se mantiene en su letra** y la arquitectura se ajusta a él en vez de al contrario. Actualizados `ARCHITECTURE.md` §4 (reescrito íntegro), `CONTRACT.md` §1 y §13, `ACCEPTANCE.md` criterio 4 y `EVALUATION.md` §5.
  - **Medición propia, que CORRIGE al agente del transformador.** El agente reportó 7 966 B (delta 686) y concluyó que rompía **dos** de los tres techos «dejando 34 B bajo el tercero». Medido con el `PREAMBLE-v1.txt` commiteado, que es el artefacto autoritativo: `suggest/SKILL.md` 7 280 B + bloque renderizado 777 B + dos saltos = **8 059 B, delta +779 B, y rompe LOS TRES**. El agente usó un bloque recortado o no contó los saltos de línea. Prevalece la medición propia porque los tres números a cambiar dependen de ella — y porque heredar una cifra ajena para fijar una puerta es exactamente lo que no se hace.
  - **Los tres techos y sus valores nuevos:** `tests/clone-bootstrap.test.js:350` 7 282 → **8 061**; `tests/ftd-lane.test.js:57-58` 7 282 → **8 061**; `tests/always-on-body.test.js:16` 8 000 → **8 192**. Los dos primeros eran `actual + 2`, un triñquete contra el recrecimiento, y se mueven **exactamente lo autorizado** (8 059 + 2) en vez de a una cifra redonda cómoda, así que **todo crecimiento posterior sigue discutiendo con un test que falla**. El tercero era el límite exterior laxo y su propio comentario lo llama *«the one number to revisit deliberately»*: 8 192 deja 133 B de holgura.
  - **Búsqueda propia: no hay un cuarto techo.** `always-on-explanation.test.js:27` menciona los 8 000 B sólo en un **comentario** — se actualiza en el mismo cambio para no dejar una cifra obsoleta afirmando lo contrario. Y todos los suelos relacionados son `> 5000` o `> 0` (`context-budget.test.js:38,68,81`; `doctor-hook-counts.test.js:125,133` comparan igualdad), así que **crecer no rompe ninguno**.
  - **El coste, con el número:** **779 B — unos 200 tokens — en cada turno, en los 17 asistentes sin gancho por turno.** Se registra como coste aceptado, no como detalle. Lo que los techos protegían no se pierde: eran un triñquete contra la deriva, no un límite técnico.
  - **El coste que no es opcional, y que es la consecuencia más duradera: tres puntos de divergencia permanentes.** `clone-bootstrap.test.js`, `ftd-lane.test.js` y `always-on-body.test.js` son archivos que upstream mantiene activamente — el primero ya creció 59 líneas entre 3.7.1 y 3.7.4 — así que cada cambio de upstream sobre ellos **va a conflictuar**. **No afecta a la invariante de la Estrategia B** (son `tests/`, no `skills/`), pero impone un requisito a la máquina de mantenimiento de §9: **avisar cuando upstream toque uno de esos cuatro archivos, porque ahí un merge limpio NO es prueba de compatibilidad** — upstream podría bajar un techo por una razón nueva y el merge lo reaplicaría sin que nadie lo mirara.
  - **Cuándo se aplica: en la Etapa 4, con el transformador. No ahora.** La tercera medición de la línea base está corriendo en serie contra el árbol actual (comprobado: 3 procesos vivos, log creciendo, 520 pasan / 7 fallan al momento de escribir esto), y editar archivos de test a mitad contaminaría los que aún no se han ejecutado. Es el mismo error de instrumento que ya costó dos intentos; no se repite.
  - **`suggest` queda fuera de la muestra de evaluación, declarado y no en silencio.** Es el cuerpo always-on: no se «aplica» como una skill normal, está siempre presente, así que la conducta «consultar la personalización antes de aplicar esta skill» no significa lo mismo para ella. La cubre el conjunto determinista — conformidad 274/274 y los tres techos — no la evaluación.

- **2026-11-01 — LA LÍNEA BASE EN SERIE TERMINA. Hay instrumento, y el instrumento destapa un tercer error mío.** `node --test --test-concurrency=1 --test-timeout=600000` sobre la suite completa, entorno aislado (`HOME`, `TMPDIR`, `XDG_*`, `npm_config_cache` dentro de `.fork-tmp/`). Log íntegro en `.fork-tmp/logs/baseline-serial.log`.
  - **Resultado:** **98 min 26 s** de reloj (5 905 566 ms), **1 491 tests — 1 479 pasan, 10 fallan, 1 cancelado, 1 omitido**. El intento 3 **sí es un instrumento**: termina, y no mata nada sano (el intento 2 mató 83 archivos sanos).
  - **Los dos archivos «colgados» quedan exculpados, y el mecanismo de contención confirmado por tercera vía.** `tests/team-safe-default.test.js` y `tests/worktree-reaper.test.js` **completan con normalidad en serie** — los tests de `worktree-reaper` (`52e`, `53`, `53b`, `53c`, `50f`) pasan al final del log. Sus cuelgues de 53 min y 2 h 55 m eran contención, no defecto.
  - **Un archivo SÍ se cuelga de verdad:** `tests/knowledge-sync.test.js`, `testTimeoutFailure` a los **600 002 ms con concurrencia 1**. Sin otros procesos compitiendo. Eso no es contención: es un cuelgue real, y es el «1 cancelado» del recuento. Sonda en curso con `--test-timeout=120000` para que node nombre el **subtest** que cuelga en vez de agotar el archivo entero en anónimo.
  - **Atribución limpia de los 10 fallos** (nombre → archivo, verificado por `grep -rl` del nombre literal en `tests/`):

| # | Test | Archivo | Error |
|---|---|---|---|
| 1 | `gap log CLI: the subcommand is found wherever it sits in the argv` | `capabilities.test.js` | exit esperado 1, real 0 |
| 2 | `install: .rsc/ is gitignored, additively and idempotently` | `capabilities.test.js` | esperado `undefined`, real la ruta del `.gitignore` temporal |
| 3 | `dsh06 · end to end: dsh's SessionStart reaches the installed memory hook` | `deepseek-target.test.js` | la sesión no se capturó en el journal bajo el id de dsh |
| 4 | `A5 · the browser gate fails a known-bad page by name` | `design-engine.test.js` | `ENOENT` sobre `bad/report.json` |
| 5-7 | tres tests de `route_to` | `eval-lint.test.js` | exit esperado 1, real 0 — **ya atribuido**: rama degradada por falta de PyYAML |
| 8 | `accepting fewer targets removes the deselected RSC installation before READY` | `onboarding-apply.test.js:181` | el `.gitignore` conserva `!.claude/` y `.claude/*` tras deseleccionar |
| 9 | `without git the record is useful but explicitly has no branch or commits` | `session-memory.test.js` | esperado `undefined`, real **`'fork/bootstrap'`** |
| 10 | `5 · nobody can answer → UNVERIFIABLE` | `spec-gate-subject.test.js:173` | la puerta **sí** pudo responder |

  - **Cambio respecto al intento 2:** allí fallaban `dsh04` **y** `dsh06`; en serie **sólo `dsh06`**. `dsh04` pasa. Un fallo más que la contención fabricaba.
  - **EL TERCER ERROR DE INSTRUMENTO, Y ES MÍO.** Dos de esos fallos los causé yo, y lo dicen sus propios mensajes de error:
    - `spec-gate-subject` falla con *«…no v9.9.9 tag in this repository* **`[asked /Users/home/Development/rsc-harness-fork]`** *»*. El test exige que **nadie pueda responder** → `UNVERIFIABLE`. La puerta respondió porque encontró **este** repositorio.
    - `session-memory` esperaba «sin rama» y obtuvo **`'fork/bootstrap'`**: lee el nombre de **mi propia rama**.
    - **Causa raíz:** redirigí `TMPDIR` a `.fork-tmp/tmp` para cumplir la restricción §1 de no escribir fuera de la carpeta dedicada. La restricción es correcta y se mantiene. Pero **la carpeta dedicada ES un repositorio git**, y varios tests afirman sobre *«qué pasa cuando no hay repositorio por encima de nosotros»*. El entorno que upstream presupone tiene el temporal en `/var/folders/…`, fuera de todo repo. **Cumplir la restricción de forma ingenua hizo mentir al instrumento.**
    - **Arreglo que conserva la restricción y no escribe en ningún sitio nuevo:** `GIT_CEILING_DIRECTORIES=<carpeta dedicada>/.fork-tmp`, que detiene la búsqueda ascendente de git. **Primer brazo medido: con el techo puesto, `session-memory` + `spec-gate-subject` pasan 34/34** (268 s, mismos dos archivos, mismo aislamiento). Brazo de control sin el techo, en curso, para que la atribución sea un experimento controlado y no una coincidencia; hasta que vuelva, la causa queda **plausible y no confirmada**.
  - **Consecuencia sobre el diseño de la puerta de release — corrige la conclusión anterior.** Ayer registré que la puerta debe fijar **concurrencia y timeout**. Son **tres** parámetros, no dos: **concurrencia, timeout y un temporal que git no considere parte de un repositorio**. Afecta a los criterios 3, 7 y 14. Un `npm test` ejecutado con el temporal dentro del checkout produce fallos que no existen, y los produce **en silencio y con mensajes verosímiles**, que es la peor clase.
  - **Pendiente de atribuir** (ni entorno confirmado ni defecto confirmado): fallos 1, 2, 3, 4 y 8. El 8 (`onboarding-apply:181`) es el más sospechoso de ser real: la aserción es `doesNotMatch(/^\.claude\//m)` y el `.gitignore` conserva `.claude/*` tras deseleccionar el objetivo, lo que sería un fallo de limpieza del desinstalador, no del entorno.
- **2026-11-01 — EL EXPERIMENTO CONTROLADO CIERRA LA ATRIBUCIÓN: cuatro de los diez fallos son mi instrumento, confirmado, no plausible.** Cuatro brazos, una sola variable (`GIT_CEILING_DIRECTORIES`), mismos archivos y mismo aislamiento en cada par. Logs en `.fork-tmp/logs/probe-*.log`.

| Brazo | Archivos | Techo git | Resultado |
|---|---|---|---|
| A | `session-memory` + `spec-gate-subject` | **ON** | **34/34 pasan** |
| B | `session-memory` + `spec-gate-subject` | OFF | 32/34 — **los dos mismos fallos** de la línea base |
| C | `capabilities` | OFF | 27/29 — **los dos mismos fallos** de la línea base |
| D | `capabilities` | **ON** | **29/29 pasan** |

  - La variable se movió **en las dos direcciones** y los fallos aparecieron y desaparecieron con ella, reproduciendo exactamente los nombres de la línea base. Queda **confirmado**: `capabilities` ×2, `session-memory` y `spec-gate-subject` **no son defectos de upstream; son el temporal dentro del repositorio**, es decir, mi instrumento.
  - **Línea base corregida de los 1 491 tests:** **4 fallos míos** (instrumento) + **3 fallos de entorno** (`eval-lint`, rama degradada por falta de PyYAML, cuya instalación global §1 prohíbe) + **3 sin atribuir** (`deepseek-target` `dsh06`, `design-engine` `A5`, `onboarding-apply:181`) + **1 cuelgue real** (`knowledge-sync`). Es decir: **7 de 10 son entorno, y como máximo 3 pueden ser defectos reales.**
  - **CORRECCIÓN DE DOS CIFRAS HEREDADAS, las dos a favor del fork.** Los **39 fallos** registrados en la auditoría de 3.7.1 quedan **retirados como medida de deuda heredada**, igual que ya se retiraron las 2 h 17 min: el instrumento que los produjo tenía **los dos defectos a la vez** — contención *y* temporal dentro del checkout. La deuda heredada real es **mucho menor de lo que la auditoría sugería**: a lo sumo 3 fallos y 1 cuelgue sobre 1 491 tests. Esto afecta al criterio 6 y a `evidence/inherited-debt.md`, cuyas conclusiones hay que releer con esta medición delante.
  - **CORRECCIÓN DE UNA AFIRMACIÓN MÍA DE HOY MISMO.** Escribí que *«la contención también ESCONDE fallos reales»* y lo ilustré con que `tests/capabilities.test.js` *«falla 2 veces en solitario, de forma reproducible»*. **Ese ejemplo era un artefacto de mi propio instrumento**, no un fallo real, así que no probaba lo que le hice probar. **El mecanismo sí se sostiene** — un archivo cancelado no reporta nada de lo que habría reportado — pero ahora la sostienen otros dos casos y no ese: `onboarding-apply` y `design-engine` fallan en serie y el intento 2 **no los reportó** porque los canceló, y son los dos candidatos a defecto real que quedan vivos. La conclusión se mantiene con un ejemplo distinto y más débil; la que no se mantiene es la que escribí.
  - **`knowledge-sync`: el cuelgue se acota.** Con `--test-timeout=120000`, node reporta `tests 1 / pass 0 / fail 0 / cancelled 1` y **ni un solo subtest**. No hay un test lento entre muchos: **nada dentro del archivo llega a completarse**, así que el bloqueo está en el nivel superior del módulo o en el primer test que corre. Sonda en curso que separa ambas cosas: (A) cronometrar el `import` de `targets/knowledge-sync.mjs` a solas, (B) ejecutar el archivo en proceso para que el TAP salga en streaming y la última línea nombre el test anterior al que cuelga.
  - **Obligación pendiente sobre `ACCEPTANCE.md`:** los criterios 3, 7 y 14 deben fijar los **tres** parámetros del instrumento (concurrencia, timeout y techo de git). **No se edita todavía** porque el revisor independiente de la Etapa 1 está leyendo ese archivo ahora mismo; se aplica junto con sus correcciones, para no hacerle revisar una versión que ya cambió.
- **2026-11-01 — EL QUINTO FALLO TAMBIÉN ES MÍO, y se demuestra LEYENDO, sin ejecutar un solo test. Corrige lo que escribí hace una hora.** Dije que `onboarding-apply:181` era *«el más sospechoso de ser real»*. No lo es. La cadena causal está completa y cada eslabón verificado:
  1. **`scripts/install-apply.js:459-471`**: las cuatro líneas `!.claude/`, `.claude/*`, `!.claude/rsc-bootstrap.mjs`, `!.claude/settings.json` se añaden al `.gitignore` **si y sólo si** `spawnSync('git', ['check-ignore','-q','--',f], { cwd })` devuelve 0. La decisión **se le pregunta a git**, no al patrón — y el comentario del propio código lo subraya como lección aprendida a golpes.
  2. **El `.gitignore` de este repositorio, línea 11, es `.claude/`** — excluye el directorio del asistente al por mayor. Verificado: `git check-ignore -v .claude/settings.json` → `.gitignore:11:.claude/`. **El comentario de upstream predice literalmente este caso**: *«a project that excluded the assistant's directory wholesale (rsc's own repo does exactly that…)»*.
  3. El test crea su `cwd` con un **`.git` vacío** (`onboarding-apply.test.js:183`), que no es un repositorio válido, así que git **sigue subiendo**. Medido desde un temporal dentro de `.fork-tmp` con un `.git` vacío: **sin techo → `status=0`** (ignorado, usando el `.gitignore:11` del fork); **con techo → `status=128`** (*not a git repository*).
  4. Por tanto: en el entorno que upstream presupone (temporal en `/var/folders/…`, sin repo encima) `swallowed` sale vacío, las cuatro líneas **nunca se escriben** y `assert.doesNotMatch(/^\.claude\//m)` pasa. En el mío se escriben y falla.
  - **Recuento actualizado: 5 de los 10 fallos son mi instrumento** (`capabilities` ×2, `session-memory`, `spec-gate-subject`, `onboarding-apply`), 3 son entorno (`eval-lint`/PyYAML), **2 quedan sin atribuir** (`deepseek-target` `dsh06`, `design-engine` `A5`) y 1 es un cuelgue real (`knowledge-sync`). A lo sumo **2 defectos reales sobre 1 491 tests**, más el cuelgue.
  - **Lección de método, que es la que vale:** este fallo se cerró **leyendo el código y haciendo dos preguntas a git**, no ejecutando la suite otra vez. Más barato, más concluyente y sin contaminar la sonda en curso. Los dos que faltan se probarán con el mismo par de brazos cuando la sonda de `knowledge-sync` libere la máquina.

---

## 2h. Revisión independiente de la Etapa 1 (protocolo §12)

**Veredicto del revisor: BLOQUEADA.** 2 críticos, 3 altos, 7 medios, 4 bajos. Revisor independiente, sin haber producido ninguno de los seis artefactos, con el estándar (`REQUIREMENTS.md`, `PLAN.md`) y sin conocer el veredicto esperado del coordinador. Sólo lectura: no ejecutó tests (había una medición en curso) ni nada de red. **Cumplió §1 sin incidentes**, al contrario que un agente de la Etapa 0.

### E1-R1 — CRÍTICO. LOS TRES TECHOS NO SE ROMPÍAN: mi decisión de ayer era innecesaria. **Verificado por mí y retractado**

El revisor sostiene que los tres techos miden el **archivo fuente del repositorio**, no la copia transformada. **Lo comprobé yo mismo y es correcto:**

| Techo | Qué lee realmente |
|---|---|
| `tests/clone-bootstrap.test.js:340` | `readFileSync(new URL('../skills/suggest/SKILL.md', import.meta.url))` |
| `tests/ftd-lane.test.js:20` | `read('skills','suggest','SKILL.md')`, resuelto contra la raíz del repo |
| `tests/always-on-body.test.js:12` | `readFileSync(join(ROOT,'skills/suggest/SKILL.md'))` |

Bajo la invariante de la Estrategia B ese archivo vale **7 280 B para siempre**, así que **los tres tests siguen verdes sin tocar una cifra**. Los valores 8 061 / 8 061 / 8 192 que anuncié eran innecesarios, y habrían costado **tres divergencias permanentes** en archivos que upstream edita, a cambio de nada. Peor: habrían dejado el techo midiendo una magnitud equivocada por exactamente el tamaño del preámbulo (fuente de 8 059 B pasaría el techo de 8 061 mientras su entrega pesaría 8 836 B, 644 B sobre el límite exterior).

**Lo que sí era real** y el revisor también sitúa: el preámbulo llegaba al cuerpo always-on porque `scripts/install-apply.js:294` lo renderiza desde la copia **transformada** (`wireHook(…, join(ensureBase('suggest', …), 'SKILL.md'))`). De ahí los 779 B por turno. Es decir: **el coste caía en la superficie más cara del producto y los tres techos no lo medían.**

**Y el argumento que remata, que el revisor extrae de mis propios documentos:** el preámbulo dice *«read this before applying the skill below»* y en el cuerpo always-on **no hay ninguna skill que se esté aplicando**. `EVALUATION.md` ya lo declaraba al excluir `suggest` de la muestra, y `evidence/transformer-feasibility.md:522` lo había dicho antes. Se pagaban 779 B por turno, en 17 asistentes, por inyectar una regla que los documentos del propio fork declaraban sin significado ahí.

**Diseño adoptado**, verificado por mí en el código: despojar el bloque **sólo en `wireHook`** — tres implementaciones (`_md-block.js:27`, `cursor.js:11`, `claude.js:112`), las tres ya hacen `stripFrontmatter(readFileSync(sourceMd))` — y **no tocar `writeSkill`**, que es el renderizado por skill (`_md-block.js:23` enlaza/copia, `cursor.js:4` despoja frontmatter y conserva el cuerpo). Así **las 274 conservan el bloque en los 18 destinos**, `suggest` incluida cuando se la invoca como skill.

| | Diseño retirado | Diseño adoptado |
|---|---|---|
| Conformidad | 274/274 | **274/274** |
| Coste por turno (17 asistentes) | 779 B | **0 B** |
| Techos que cambian | 3 | **0** |
| Divergencias con upstream | 3 | **0** |

**La decisión del usuario del 2026-11-01 se cumple en su letra**: 274 sin exclusiones sobre la base distribuida, que es donde corre el validador del criterio 4. Lo que se retira no es su decisión, sino mi forma de pagarla. Aplicados ya: `ARCHITECTURE.md` §4 reescrito íntegro, `CONTRACT.md:50`, `ACCEPTANCE.md` criterio 4 y fila §2.

### E1-R2 — CRÍTICO. `EVALUATION.md` sustituyó en silencio la asignación aprobada y abandonó cobertura obligatoria. **Verificado contra el estándar**

Comprobado por mí leyendo `REQUIREMENTS.md` §11 y `PLAN.md` §7:
- **§11 exige tres clases** de cobertura semántica: skills nuevas o modificadas en cada integración; **skills internas del harness — `suggest`, `ftd`, `sdd` y las identificadas por la auditoría**; y **una muestra estratificada del resto**. Mi `EVALUATION.md` no cubre ninguna de las dos últimas, y **excluía explícitamente `suggest`, que §11 nombra primero.**
- **D6 / `PLAN.md` §7 asignaban**: conjunto interno **27 skills (R2) → 147 ejecuciones** y muestra estratificada **~30 skills con selección reproducible y con semilla → ~300 ejecuciones**. Mi documento gasta las 600 en **6 skills elegidas a mano × 5 asistentes**. El total cuadra; la cobertura comprada es otra, y **no declaré el cambio** — contra `REQUIREMENTS.md:25` (*«No sobrescribas requisitos anteriores silenciosamente»*).
- **El motivo que escribí para la laguna — «Presupuesto» — es falso.** El presupuesto aprobado financiaba 27 + ~30 skills. Lo que lo consumió fue mi multiplicación no declarada por los 5 asistentes. Registrar una laguna con la causa equivocada impide corregirla.
- **Faltan 6 de las 9 definiciones que §11 ordena fijar EN LA ETAPA 1**: casos y rúbricas; selección reproducible con semilla; modelos y configuración; límites de duración y reintentos; fallos críticos que bloquean promoción; y «qué constituye un cambio relevante» (que `PLAN.md:207`, riesgo 7, asigna nominalmente a esta etapa).

**§11 ya decide cómo se resuelve y no hace falta preguntar:** *«deben mantenerse dentro del presupuesto máximo aprobado… Si no alcanza, registra la cobertura pendiente sin reducir los umbrales ni exceder el límite. No marques como aprobado lo que quedó sin verificar.»* Es decir: se mantienen las ~600, se recupera la cobertura de D6, y lo que no quepa se registra como pendiente.

### E1-R3 — ALTO. La estadística de `EVALUATION.md` §8 está mal calculada, y los umbrales ≥95 % no son afirmables con este presupuesto

El revisor calculó el intervalo exacto y lo doy por bueno porque es aritmética verificable: para 86/90 = 95,6 %, **Clopper–Pearson [89,0 %; 98,8 %]**, Wilson [89,1 %; 98,3 %]. Mi documento usaba **Wald**, que **no es válido aquí** (`n·p·(1−p) = 90 × 0,95 × 0,05 = 4,28 < 5`), y concluía que un 95 % observado respalda «≥ 90 %». **No lo respalda: respalda «≥ 89 %».**
Y el corolario que importa más: **ningún reparto dentro de las ~600 ejecuciones puede respaldar una afirmación «≥ 95 %»** (n=600 con 95 % observado → límite inferior CP 92,9 %). Los umbrales de ≥95 % siguen siendo útiles como **proporción observada**, pero no son afirmables, y el informe final debe decirlo así.
**La reserva está infradimensionada por construcción:** con N=3 y tasa real igual al umbral, las celdas ambiguas esperadas son `3p²(1−p)·180` → **≈44 a p=0,90** y **≈59 a p=0,85**, contra una reserva de 30. Y al elevar celdas a N=5 el denominador por conducta deja de ser 90 sin que el documento diga cuál es ni qué veredicto corresponde a 4/5: **un umbral sin denominador definido no es falsable.**

### E1-R4 — ALTO. El criterio 8 tiene una mitad determinista que nadie ejecuta

`ACCEPTANCE.md` clasifica el criterio 8 como **D + E** y describe la parte D («un archivo ilegible produce un error declarado, no el camino de "no existe"»), pero **ningún componente del diseño lee `02-DOCS/wiki/skills/<id>/README.md`**: el validador de `CUSTOMIZATION-SCHEMA.md` está especificado **sin punto de invocación** — ni `install`, ni `sync`, ni hook, ni `prepublishOnly`, ni la puerta determinista. Y como la aplicación de una skill no es un evento observable (F32), tampoco puede engancharse ahí. La garantía «ilegible ≠ ausente» queda **íntegramente dependiente del modelo** mientras el criterio la presenta medio determinista. No es equiparar conformidad con cumplimiento, pero es el vecino de al lado. **Pendiente: fijar el punto de invocación en la Etapa 1 o reclasificar el criterio 8 como E puro con el límite escrito.**

### E1-R5 — ALTO. Huérfana de la reescritura de ayer, exactamente donde la buscaba

`ACCEPTANCE.md:53` seguía diciendo *«aparece una exclusión obligatoria (`suggest`) que cambia la cifra del criterio»* mientras `:20` decía 274 sin exclusiones. El commit `1890615` tocó una línea y dejó la otra contradiciéndola. **Corregida.** Es la razón por la que el encargo al revisor incluía cruzar los seis documentos entre sí.

### Medios y bajos aceptados y aplicados

- **Mío, y lo escribí mal dos veces:** decir *«elevar los tres techos exactamente los 779 B»* era falso para el tercero (8 000 → 8 192 son **+192 B**). Moot tras E1-R1, pero queda registrado como error de redacción propio en `CONTRACT.md:50` y `ACCEPTANCE.md:20`, que yo mismo contradecía al escribir «133 B de holgura».
- **`ARCHITECTURE.md:204` corregido:** eran **15 de 23** las comprobaciones que no corren en ningún workflow, no 6. El 6 sale de restringirse a las 12 de la auditoría previa; mezclar denominadores subestimaba el hueco por un factor **2,5** en la tabla que decide las puertas. Su propia evidencia (`inherited-debt.md:442-443`) ya decía 15. Y «no corren en ninguna parte» es inexacto: corren cuando alguien las invoca a mano.
- **`ARCHITECTURE.md:254` anotado:** el estado de Actions lo verifiqué **yo** con `gh api`, como parte de la verificación de accesos que el usuario pidió, no un proceso de build aislado. El revisor no podía dirimirlo sin red y lo marcó bien como inconsistente con su evidencia, que lo da por no verificado.
- **Pendientes, aceptados:** el preámbulo ordena *«stop»* donde el contrato ordena *«report»* y el preámbulo es normativo, así que un README con YAML roto convierte en parada dura cualquier skill del proyecto (alinear). El `governance-digest` se pierde justo en las dos superficies que el modelo lee, porque el frontmatter se despoja: es la única de las tres claves **no** redundante y hay que decidir si viaja en el bloque o se declara que sólo protege la base. `.rsc.fork.json` revoca `PLAN.md:93` sin registrar la revisión, pierde la mitad «detectar la pérdida de clave» y queda fuera del inventario de recuperación de `install-apply.js:71-74`. El criterio 3 no puede fallar mientras su lista de rutas exentas se defina después de ver las diferencias. Las cuatro citas de `targets/claude.js` apuntan al bloque pero no a la línea del hecho. «Margen 878/2048» es un desplazamiento, no un margen (el margen es 1 170 B; la conclusión se sostiene).

### Lo que el revisor acredita, y que no hace falta volver a mirar

**No encontró una sola equiparación de conformidad con cumplimiento** en los seis artefactos — lo que `REQUIREMENTS.md` §6 prohíbe y lo que más me preocupaba. Verificó además por su cuenta, con comando y resultado: la invariante de la Estrategia B (diff vacío contra `origin/main` **y** contra `481b1ec`), 274/274 skills y ninguna a profundidad 3, `suggest` 7 280 B, el preámbulo 779 B plantilla / 772–797 renderizado / 208,9 KiB en total, los tamaños exactos de las seis skills de la muestra, 274 `cases.yaml` con 3 175 prompts, `origin: risco` en 274/274, `name:` == directorio en 274/274, 79 skills con enlaces relativos, 12 claves en `KEYS`, el matcher de `Skill` inexistente, y que `eval-lint` falla en abierto. **Su medición del cálculo de §4 coincide con la mía (8 059 B, delta 779) y confirma que la corrección al agente del transformador era correcta.**

### Correcciones aplicadas tras la revisión (2026-11-01)

| Hallazgo | Qué se hizo |
|---|---|
| **E1-R1** crítico | `ARCHITECTURE.md` §4 reescrito: retractación de los tres techos, con las tres líneas que prueban que miden el fuente. Diseño nuevo: despojar el bloque **sólo en `wireHook`**. `CONTRACT.md:50`, `ACCEPTANCE.md` criterio 4 y fila §2 alineados |
| **E1-R2** crítico | `EVALUATION.md` rehecho sobre D6: clases A (27 internas, 147), B (30 estratificadas con semilla, 300), C (por integración); paridad de asistentes 96; reserva 57. `suggest` **vuelve a la muestra** |
| **E1-R3** alto | Estadística corregida con **cálculo propio** (implementación propia de la CDF binomial exacta, no heredada): Wald inválido con `n·p·(1−p)=4,28`; CP para 86/90 = **[89,0 %; 98,8 %]**; **570/600 → [92,9 %; 96,6 %]**, luego «≥95 %» no es afirmable con este presupuesto. Denominador de N=5 definido, inconclusas excluidas y nombradas, desbordamiento de la reserva declarado con su orden de prioridad |
| **E1-R4** alto | El validador de personalizaciones **tiene punto de invocación**: `npm run gate` y `install`/`sync` cuando existe `02-DOCS/wiki/skills/`, con test negativo que exige un error **que nombre el archivo y la regla**. Y el límite escrito: la mitad E no es enganchable porque la aplicación de una skill no es observable (F32) |
| **E1-R5** alto | `ACCEPTANCE.md` fila §2: la huérfana que contradecía al criterio 4, corregida |
| **MEDIO 3** | **Cambio de comportamiento de producto.** El preámbulo ordenaba *«say so and stop»* y el contrato *«must be reported»*: la primera convierte un YAML roto en un ladrillo para todo el proyecto; la segunda **es** el paso silencioso a «ausente», disfrazado de diligencia. Ninguna de las dos. Regla nueva en los dos sitios: **nombrarlo y preguntar, nunca tratarlo como ausente.** Preámbulo re-medido: **787 B** plantilla, **780–805** renderizado, **211,1 KiB** en las 274; cifras propagadas a `CONTRACT.md:15` y `:175` |
| **MEDIO 4** | El `governance-digest` **no era redundante** y se decía que sí. Alcance declarado en vez de exagerado: protege la **base distribuida**, donde corre el validador; las superficies entregadas se regeneran desde ella en cada instalación y `sync`, así que su integridad se deriva y no se afirma aparte. No se mueve al cuerpo: costaría bytes en las 274 por proteger artefactos que se reescriben solos |
| **MEDIO 5** | Las dos deudas de `.rsc.fork.json` pagadas: sustituto de «detectar la pérdida de clave» (guarda la huella del `.rsc.json` contra el que se escribió; `doctor` y `gate` reportan divergencia) y entrada en el **inventario de recuperación** de `install-apply.js:71-74`, sin la cual `rsc restore` no lo recupera. **Y queda registrada como revisión explícita de `PLAN.md:93`**, que §25 de REQUIREMENTS exige y que yo no había hecho |
| **MEDIO 6** | Criterio 3 cerrado: la lista de rutas con marca de tiempo **se congela en el script**, y añadirle una ruta tras ver una diferencia es un **fallo del criterio**, no una excepción nueva. Y el instrumento fija los tres parámetros medidos hoy |
| **MEDIO 2, 7 / BAJO 2, 3** | 15 de 23 comprobaciones fuera de todo workflow (no 6, que era otro denominador); procedencia del dato de Actions; las cuatro citas de `targets/claude.js` corregidas a **195, 209, 225, 311** — las líneas que **crean** las entradas, verificado por mí, no a los `||= []`; y «878/2048» era un **desplazamiento**: el margen son **1 170 B** |

**Pendiente de la revisión:** BAJO 4 — `ARCHITECTURE.md` §7 propone arreglar la ceguera de selección de Cursor, que `PLAN.md:193` declaró límite que no se prometía resolver. **Es una ampliación de alcance y por tanto decisión del usuario**, preguntada y sin respuesta al cerrar esta entrada. No se toca hasta que responda.

### Y una cuarta lección de instrumento, en la misma investigación

Dije que en `knowledge-sync.test.js` *«nada dentro del archivo llega a completarse»*. **Era falso, y la premisa también.** Lo deduje de que la sonda a 120 s reportaba cero subtests; pero `ks01` ejecutado solo **pasa en 12 s**. Lo que ocurre es que **node omite los resultados de los subtests cuando el test de archivo agota su timeout**, así que «cero subtests» nunca fue evidencia de dónde cuelga. Y las sondas de streaming a 180 s y 400 s dieron logs vacíos por **buffering del reporter**, no por bloqueo: matar el proceso descarta la salida. Dos instrumentos inútiles seguidos.
**La hipótesis que queda, y es mucho más mundana:** el archivo tiene **52 tests** a ~12 s cada uno = **≥624 s**, por encima del tope de 600 s que yo puse. Probablemente **no cuelga: es el archivo más lento de la suite**. En comprobación con tope de 1 800 s.

### `knowledge-sync` no cuelga: el cuelgue era mi tope. Quinta lección de instrumento, también mía

**`tests/knowledge-sync.test.js` pasa 52 de 52 en 1 146 s (19 min 6 s)**, con concurrencia 1 y tope de 1 800 s. No hay ningún test colgado. Lo que había era **un tope de 600 s por debajo del tiempo honesto del archivo más lento de la suite**.

- **Consecuencia sobre la deuda heredada:** **upstream no tiene ni un solo test que cuelgue.** Cero. La suite completa son **1 543 tests** (los 1 491 que reportó la línea base más los 52 que `knowledge-sync` no llegó a reportar al agotar el tope).
- **Consecuencia sobre el instrumento, que ahora tiene sus tres parámetros con valor medido:** concurrencia **1**, timeout **≥ 1 200 s** (peor archivo medido: 1 146 s; 600 s era insuficiente) y un temporal con **techo de git**. Con los tres, el veredicto es interpretable; sin cualquiera de ellos, no.
- **Duración honesta de la suite en serie: ≈ 107,5 min** (los 98,4 medidos, menos los 10 del tope, más los 19,1 reales de `knowledge-sync`). **Revisión explícita de la restricción operativa de `PLAN.md` §7**, que declara «la suite tarda 2 h 17 m» como restricción operativa: esa cifra se midió bajo contención en 3.7.1 y queda sustituida por **≈ 1 h 48 m medidos**. Registrada como revisión, no cambiada en silencio.
- **Cómo me equivoqué, por quinta vez y de la misma familia.** Afirmé que el archivo colgaba y que «nada dentro completa». Lo primero era mi tope; lo segundo venía de que **node omite los subtests cuando el test de archivo agota el timeout**, de modo que «cero subtests» nunca fue evidencia de nada. Y dos sondas de streaming dieron logs vacíos por **buffering del reporter**, no por bloqueo. El patrón de los cinco errores es idéntico: **tomé una propiedad de mi instrumento por una propiedad del objeto medido.** Contención, temporal dentro del repo, techos sobre el fuente, timeout corto, reporter que bufferiza.

**Línea base limpia en curso** (`baseline-clean.log`): suite completa con los tres parámetros fijados, para obtener la cifra autoritativa de deuda heredada y cerrar de paso la atribución de los dos fallos que quedan (`design-engine` `A5`, `deepseek-target` `dsh06`).

---

## 2i. Re-revisión independiente de las correcciones (protocolo §12, segundo revisor)

**Veredicto: BLOQUEADAS.** 2 críticos, 5 altos, 6 medios, 4 bajos. Segundo revisor, distinto del primero, que no vio aquella revisión ni mis conclusiones. Sólo lectura; **cumplió §1** (no ejecutó tests con la medición en curso, ni red). Acredita que la retractación de los techos es correcta y que **la estadística de `EVALUATION.md` §8 le sale idéntica con su propia implementación** — Clopper–Pearson, inaplicabilidad de Wald, el corolario del «≥95 %» y el dimensionado de la reserva.

### E2-R1 — CRÍTICO. El despojado que adopté **no existe en `claude`**. Verificado por mí

Afirmé que las tres implementaciones de `wireHook` *«ya hacen `stripFrontmatter(readFileSync(sourceMd,'utf8'))»*. **Falso para `claude`, que es el único destino que puede denegar y el asistente de referencia de la evaluación.** Mis propias comprobaciones:

| Hecho | Comando / línea |
|---|---|
| `claude.js` **nunca lee** `sourceMd` | `grep -c sourceMd targets/claude.js` → **1**, y es la firma (`:112`) |
| No renderiza ningún cuerpo: guarda una **ruta** | `claude.js:137` `suggestRel` → `.claude/skills/suggest/SKILL.md` |
| El cuerpo lo lee el hook **en ejecución**, entero | `targets/session-start.mjs:52` `process.stdout.write(readFileSync(suggestMd,'utf8'))` |
| Y ese archivo **es** la skill transformada | `claude.js:9-15` → `linkOrCopy` (`index.js:20-32`): symlink de `.claude/skills/suggest` a `.rsc/skills/suggest` |

**El daño no es de bytes, es de medición.** `EVALUATION.md` elige `claude` para las 447 ejecuciones de amplitud. Con el bloque inyectado en cada SessionStart, **toda** sesión arranca con las cinco reglas en contexto, porte o no la skill bajo prueba el bloque: **G3 (fallback sin personalización) quedaría inmedible**, y es una de las dos conductas de seguridad. Un diseño que invalida su propio instrumento de medida.

**Diseño nuevo, que no es el mío ni exactamente el del revisor.** El mecanismo ya existe: `claude.js:139-148` materializa `.rsc/suggest-always-on.md` y reapunta `suggestRel` en una rama concreta. Se generaliza: el transformador emite `.rsc/governance/always-on.md` sin el bloque, `install-apply.js:294` pasa esa ruta a `wireHook`, y `claude.js` reapunta `suggestRel` en todos los casos. **`_md-block.js` y `cursor.js` no se tocan** — leen el `sourceMd` que se les da, así que cambiar el argumento basta. El revisor proponía editar los adaptadores; esto es más barato y además arregla `claude`, que su versión no arreglaba.

### E2-R2 — CRÍTICO. `npm run gate` NO EXISTE, y yo lo escribí en presente

Mi corrección del criterio 8 sustituyó *«un instrumento que nadie ejecutaba»* por **un instrumento que no se puede ejecutar**. Verificado: `package.json` define 14 scripts y **ninguno es `gate`**. La propia evidencia del fork lo escribía como **propuesta** (`inherited-debt.md:474`), y los «130 s» medían la suma manual de seis scripts, no una puerta. Corregido: el criterio 8 tiene **un** punto de invocación real hoy (`install`/`sync`), y la puerta queda en futuro como entregable de la Etapa 6.

### E2-R3 — ALTO. «0 divergencias» era falso y medido con dos varas

La tabla ponía **0**, y tres secciones antes este mismo documento ya clasificaba parchear un adaptador como *«divergencia de código, no transformación de contenido»*. Cifra honesta: **1 añadida** (`targets/claude.js`, una línea), porque `scripts/install-apply.js` ya diverge por necesidad — es el punto de transformación y la razón de ser del fork. Se paga esa línea porque sin ella `claude` paga el bloque por sesión y G3 no se puede medir; y una reasignación de variable es el conflicto más barato de resolver. **La máquina de mantenimiento debe avisar cuando upstream toque `targets/claude.js`.**

### E2-R4 — ALTO. El criterio 3, como lo redacté, **no podía pasar nunca**

Congelé la lista de exenciones a «campos de marca de tiempo». Pero la instalación escribe **rutas absolutas** en el estado: `install-apply.js:292` guarda `files`/`base` que vienen de `skillDir`/`baseDir` (`targets/index.js:11-13,166`), y `lib/state.js:10` las serializa tal cual. Dos instalaciones en dos directorios difieren ahí, y no son marcas de tiempo. Corregido: la normalización incluye explícitamente esa segunda clase. Y quité «concurrencia y timeout» de esa celda: son parámetros del **corredor de tests**, injertados de otra medición.

### E2-R5 — ALTO. La justificación del `governance-digest` era falsa en 17 de 18

Escribí que *«el frontmatter se despoja en las superficies entregadas»*. **No:** `writeSkill` es `linkOrCopy` en el adaptador `md` y en `claude` (`_md-block.js:23`, `claude.js:9` → `index.js:20-32`), un symlink al directorio base, así que el `SKILL.md` entregado **es** el archivo base, con frontmatter y digest. Sólo `cursor.js:7` lo sustituye. Reescrito por superficies: cubre la base y la entrega por skill en 17 de 18; **no** cubre el `.mdc` de Cursor ni la superficie always-on (que es base *menos* el bloque, y una derivación que resta no distingue «despojado» de «corrompido»). Para esas dos **no se afirma integridad**.

### Altos y medios restantes, aplicados

- **ALTO:** `ACCEPTANCE.md` criterio 14 citaba «180 celdas, 540 ejecuciones, 60 de reserva» — cifras que `EVALUATION.md` ya no tenía → **181, 543, 57**. El commit que rehizo el documento no propagó.
- **ALTO:** el criterio 16 decía «cinco límites residuales L1–L5» y L6 se añadió el mismo día. Ese criterio existe para que ningún límite se omita, y habría pasado omitiendo justo el que el usuario decidió no arreglar → **L1–L6**.
- **MEDIO:** `ARCHITECTURE.md` conservaba las 2 h 17 m que `PLAN.md` acababa de revisar → propagado a **≈1 h 48 m** con su marca.
- **MEDIO:** la revisión de D6 (40→49 escenarios) estaba declarada en el artefacto pero no en el plan aprobado → `PLAN.md` §7 anotado con el mismo patrón, ~~40~~ → 49.
- **MEDIO:** cifras del preámbulo no propagadas pese a que el commit decía *«propagated»*: el cálculo de `:91` usaba el incremento viejo (777) → **8 844 B y 652 B**; y los «779 B por turno» vivos → **785 renderizados**.
- **MEDIO:** la cita *«`claude.js:9` ídem [despoja frontmatter]»* afirmaba lo contrario del código — desaparecida al reescribir la sección; era además la premisa falsa de E2-R5.
- **MEDIO:** `ARCHITECTURE.md` se apoyaba en `transformer-feasibility.md:522`, que es una conclusión **retractada**, y en `EVALUATION.md` *«al excluir `suggest`»*, exclusión que `EVALUATION.md` §5 retiró por errónea. **Cita retirada**: el argumento se sostiene solo.
- **MEDIO:** el criterio 4 afirmaba «las 274 en los 18 destinos» con instrumentos que sólo miraban la base y la superficie always-on → **tercer test** sobre la entrega por skill, y el alcance acotado en `ACCEPTANCE.md`.
- **BAJOS:** frase rota en `CONTRACT.md` por una edición; la reserva de 57 eleva 28 celdas y consume 56, **1 ejecución sobra** (dicho, no redondeado); el encabezado §3 del esquema decía «criterion 10» y ahora cubre 8 y 10; el timeout del instrumento es **≥1 200 s** (1 800 fue el tope usado) y el puntero a `PLAN.md:195` estaba obsoleto.

### El patrón, que es lo que hay que corregir y no cada hallazgo

El revisor lo resume mejor de lo que yo lo habría dicho: **«las correcciones se escribieron más rápido de lo que se verificaron».** Dos describían código que no leí (`claude.js:9` y `:112`) y tres cifras cambiaron en un documento sin cambiar en el otro. Es la **sexta** vez en esta etapa que afirmo algo sobre un mecanismo sin haberlo abierto, y la lección operativa es concreta: **antes de escribir que tres implementaciones hacen lo mismo, leer las tres.** Un `grep` que encuentra el nombre de la función no dice qué hace dentro.

---

## 2j. Etapa 3 — Análisis brownfield y registro de decisiones (entregada, pendiente de revisión independiente)

Cinco documentos en `docs/fork/stage3/` (932 líneas): `BROWNFIELD.md` (los ocho pasos de §7 como B1–B8, **con criterio de parada cada uno**), `CONFLICT-RECORD.md` (los siete campos obligatorios + categoría **por posición**, máquina de estados, 14 reglas, dos ejemplos trabajados), `DECISIONS.md` (enrutado sobre las casas que ya existen), `QUESTIONS.md` (materialidad con cuatro tests) y `DESIGN.md` (en español: 20 decisiones, 10 alternativas descartadas, y una tabla de **32 propiedades** separando determinista / modelo / evaluación).

### Lo mejor de la etapa: reutiliza en vez de reinventar

Con `archivo:línea` en cada caso: `detectRepoProfile()` (`scripts/detect-repo.js:46-86`) como mitad determinista del paso 2, **entrando como hecho y nunca como categoría**; `scanProject()` (`lib/onboarding.js:78`) como discriminador greenfield/brownfield; `recommendDeferredComponents()` y los estados `selected/deferred/excluded` + `reevaluateWhen` (`:194-200,391-424`) como disparador y vocabulario de revalidación; `rsc reassess` (`rsc.js:789`); **`descriptionCollisions()` con el umbral 0.80 de `routing-audit.js:16` para calcular el conjunto de skills competidoras** en vez de enumerarlo a mano; y la regla de *«casas, primera coincidencia»* de `decision-records/SKILL.md:40-43`. Y la decisión de distribuirse como `.rsc/governance/brownfield-v1.md` **y no como una skill 275**, que habría movido la invariante y el conteo 274/274.

### TRES HUECOS EN MI PROPIO ARTEFACTO DE LA ETAPA 1, verificados por mí y aceptados

`CUSTOMIZATION-SCHEMA.md` exigía seis claves. Faltaban tres, y dos de ellas las pide el estándar literalmente:

| Clave | Por qué faltaba y qué la exige |
|---|---|
| **`type`** | `02-DOCS/wiki/` es un bundle **OKF v0.1** y su regla 1 exige `type` no vacío en todo `.md` no reservado (`skills/harness/references/wiki-protocol.md:839-840`); sólo `index.md` y `log.md` están exentos (`:856-858`) y **`README.md` no lo está**. Verificado por mí leyendo el protocolo. Sin esta clave, **cada personalización que el fork prescribe es un archivo no conforme dentro de un bundle conforme** — y nada lo detectaría: `grep -rln "okf" scripts/` sale **vacío**, así que la conformidad OKF es prosa, no código |
| **`catalog-version`** | `REQUIREMENTS.md` §8 pide literalmente *«Skill y versión o commit revisado»*. Las seis claves no lo satisfacían. Sin ella el disparador «la skill cambió» no tiene con qué comparar. Y `governance-digest` **no sirve** aquí: resume el preámbulo, no la skill |
| **`reevaluate-when`** | §8 pide *«Fecha y condiciones de revisión»*. `updated` daba la fecha; **nada daba la condición**. El nombre reutiliza `reevaluateWhen` de `lib/onboarding.js:194-200`, que ya tiene evaluador, en vez de inventar vocabulario |

Las tres son planas y aditivas, no mueven `governance: v1`. Aplicadas, con las reglas de validación ampliadas de seis a nueve claves.

### MATIZ QUE CORRIGE F35, verificado por mí

F35 decía que `drift:check` exime `02-DOCS/wiki/skills/<id>/README.md` como clase `user-project`. **Incompleto.** `scripts/drift-check.js:133-135`: `if (mode === 'catalog' && CLASSES['user-project'](target)) return 'user-project';` — y el comentario lo dice: *«In knowledge mode this repo IS the project, so `02-DOCS/…` is a real claim about real files»*. **La exención es sólo del modo `catalog`.** Consecuencia práctica: si se corre `drift:knowledge` sobre la wiki del fork, las rutas de ejemplo de estos documentos entran como enlaces reales a comprobar. **F35 queda corregido con el matiz.**

### Decisiones del coordinador sobre las preguntas abiertas de la etapa

1. **El comando que invoca el análisis: Etapa 6.** No tenía dueño en `PLAN.md` §5, y sin él el procedimiento es un documento que nadie ejecuta — exactamente el defecto que la primera revisión encontró en el validador de personalizaciones. Va a la Etapa 6, que es donde se regenera `.rsc/governance/` y a la que la Etapa 1 ya asignó el otro punto de invocación. Es coordinación dentro del plan aprobado, no ampliación de alcance.
2. **Las tres claves del esquema: aceptadas** (arriba).
3. **El hueco de detección del criterio 10, y una mitad que SÍ se puede cerrar gratis.** El agente declara, con honradez, el mayor hueco de su diseño: el criterio 10 se cierra con G5, que mide **preguntar**, no **detectar**, así que **una corrida que no encuentra nada produce cero registros y pasa las 14 reglas de validación**. El agente recomienda añadir un gate y declarar cobertura pendiente. Se acepta a medias y se mejora: **la parte determinista no cuesta ni una ejecución de agente** — el conjunto candidato de skills competidoras lo calcula `descriptionCollisions()` con umbral 0.80, luego un test con **colisiones plantadas y clave de respuesta** comprueba el *recall* del detector determinista con cero coste de evaluación. Lo que queda dependiente del modelo (¿reconoce un conflicto genuino?, ¿lo categoriza bien?) **se declara como cobertura pendiente** según exige §11, sin bajar umbrales ni exceder el techo de ~600.
4. **Dónde se registran las decisiones brownfield: queda `pending-decision`, y es lo correcto.** Hay tres casas vivas en skills instaladas, cada una correcta dentro de la suya (`decision-records/SKILL.md:43`, `continuous-learning/references/lesson-routing.md:64`, y la cadena SDD). Se resuelve **por proyecto leyendo lo que ya existe**, que es la regla de upstream. Lo que no se hace es inventar una cuarta casa.

### Lo que la etapa deja sin verificar, declarado

Que los validadores especificados pasen sobre un archivo real (es especificación; el código es de las Etapas 2 y 4); nada de la suite (prohibido con la medición en curso); que los **189 `verify.sh` sean de sólo lectura y sin red** — **sólo 21 de 189 lo declaran en el encabezado**, es convención documentada y no impuesta; `02-DOCS/wiki/skills/` en un proyecto real; el comportamiento por asistente (§1 lo prohíbe, mismo límite que L3); y el lado «proyecto» de un ejemplo trabajado, que es fixture sintética **marcada como tal**.

Dato de contexto útil que midió: `grep -rn "wiki/skills" skills/ scripts/ targets/ tests/` sale **vacío** — `02-DOCS/wiki/skills/` es un namespace **nuevo del fork**, no una ruta que upstream ya use.

### Aviso operativo que conviene no repetir

La Etapa 1 reescribió `docs/fork/stage1/` **mientras la Etapa 3 corría**, y commiteé sus archivos a mitad de ejecución. El agente remapeó y reverificó sus 34 citas contra el disco al cerrar, y lo avisó. **Lección de coordinación: no reescribir los artefactos de una etapa mientras otro agente los está citando, y no commitear el trabajo de un agente antes de que termine.** Las citas por sección aguantan un movimiento; las de línea, no.

### La línea base «limpia» no es limpia, y la contención la estropeó YO. Sexta lección, misma familia

**Detenida al 53 %** (801 de ~1 543 tests reportados) y **descartada como línea base autoritativa**, con el motivo medido:

- `tests/knowledge-sync.test.js` → `testTimeoutFailure` a los **1 800 007 ms**. Medido **en solitario** ese archivo tarda **1 146 s**. Es decir, la contención lo infló **un 57 %** por encima de su tiempo honesto, lo justo para reventar un tope que yo había puesto con un 57 % de holgura.
- **La causa fui yo:** la corrí a la vez que la re-revisión de la Etapa 1 y la Etapa 3. Declaré el riesgo un turno antes de que se materializara, y aun así la lancé.
- **Lo nuevo, y es lo que vale:** hasta ahora la contención documentada venía de **ejecutar tests en paralelo**. Aquí los dos agentes eran de **sólo lectura** — greps, lecturas de archivo, cero tests — y **fue suficiente**. El umbral de contaminación de esta máquina es mucho más bajo de lo que daba por supuesto.
- **Consecuencia para el instrumento:** a los tres parámetros (concurrencia 1, timeout ≥1 200 s, techo de git) hay que añadir una **condición de entorno**: *la máquina ociosa*. No es un parámetro de la línea de comandos, y por eso se me escapó dos veces. La línea base autoritativa se corre cuando nada más la necesita, como parte de la puerta de release, no en paralelo con trabajo.

**Lo que sí es utilizable de esta corrida**, porque un «pasa» bajo contención sigue siendo un «pasa» y el mecanismo de estos fallos era descubrimiento de repositorio git, no tiempo:

| Resultado | Lectura |
|---|---|
| `ok 206` y `ok 210` — los dos de `capabilities.test.js` | **Pasan con el techo de git puesto.** Confirma la atribución dentro de la suite completa, no sólo en la sonda de dos archivos |
| `not ok 361` — `A5 · the browser gate…` (`design-engine`) | **Sigue fallando con el techo puesto: candidato REAL a defecto de upstream** |
| `not ok 493`, `495`, `496` — `eval-lint` | La rama degradada por falta de PyYAML, ya atribuida |
| `not ok 60` — `knowledge-sync` | **NO se atribuye a upstream:** es mi contención, demostrada arriba |

Quedan sin corroborar en suite completa `session-memory`, `spec-gate-subject` y `onboarding-apply`, que no llegaron a ejecutarse. **No se pierde nada:** los dos primeros están atribuidos por el experimento controlado de cuatro brazos y el tercero por lectura del código (`install-apply.js:459-471` + `.gitignore:11`).

---

## 2k. Etapa 2 — Integración de la gobernanza en los 5 asistentes (entregada, pendiente de revisión independiente)

**La invariante, comprobada por mí al cerrar:** `git diff --stat origin/main -- skills/` → **vacío**; `ls skills | wc -l` → **274**; `git worktree list` → **una** entrada, sin huérfanos. Y la etapa no se fía de que alguien se acuerde de mirar: hay un test que **instala de verdad** y compara las 274 antes y después (`tests/governance-base.test.js`). Estructuralmente, el único escritor de gobernanza se invoca **después** del `cpSync` que materializa la base en el proyecto consumidor, así que el catálogo del repositorio nunca es argumento de una escritura.

**Código nuevo:** `scripts/lib/governance.js` (transformación, digest, `stripGovernance`, emisión de `.rsc/governance/{v1,always-on}.md`), `scripts/lib/customization-validator.js` (nueve claves, ocho reglas; **devuelve hallazgos, nunca lanza**), `scripts/governance-sync.js` (mantiene las copias distribuidas byte-idénticas, `--check` sale 1 con deriva), `scripts/validate-customizations.js`, `schema/governance/{preamble-v1.txt,contract-v1.md}` y cuatro archivos de test. **Modificados:** `scripts/install-apply.js`, `targets/claude.js`, `scripts/doctor.js`, `tests/apply.test.js`, `package.json`.

**Por qué hay copias en `schema/`:** `package.json` → `files` distribuye `scripts/ targets/ schema/ skills/ manifest.json` y **no `docs/`**, luego el transformador no puede leer el artefacto autoritativo en la máquina de un consumidor. La copia la genera un script y un test afirma identidad por sha256: editarla a mano **falla un binario** en vez de derivar en silencio.

### Medición sobre las 274 y sobre instalaciones reales

Idempotencia **274/274**; bloques dobles **0**; digest incorrecto **0**; delimitadores de código desequilibrados **0**; `origin:` más profundo **880 B** de 2048; crecimiento máximo **+936 B**. Y lo que cierra el criterio 4 por el lado de la entrega, verificado por mí en los cinco proyectos instalados: **la superficie always-on mide 7 280 B en los cinco, exactamente el `skills/suggest/SKILL.md` de upstream.** La gobernanza cuesta **0 B** ahí.

### L1 CERRADO

`node --test --test-concurrency=1 --test-timeout=1800000` sobre los diez archivos que leen el cuerpo más los cuatro nuevos: **147 tests, 147 pasan, 0 fallan**, 448 s. **Los tres techos de `suggest` verdes sin tocar una cifra**, como predecía la retractación. Y 21 archivos de los cinco destinos y la superficie de instalación: **267 tests, 266 pasan, 1 falla** — y ese uno es preexistente.

**Los tests no son vacuos, y lo demostró con cuatro mutaciones** aplicadas, ejecutadas y revertidas. La decisiva: desactivar el reapuntado de `claude` tumba **exactamente un test y ninguno más**. Un test que mirase el valor de retorno de `wireHook` habría seguido verde en las cuatro — que es el defecto que la Etapa 1 había especificado sin darse cuenta.

### CUATRO CORRECCIONES A MIS INSTRUCCIONES, verificadas por mí

1. **«Que `claude.js` reapunte en todos los casos» habría roto upstream.** La rama `codeHooks === false && !laneGate` escribe un **stub de tres líneas**; reapuntar sin condición habría hecho que un proyecto de operaciones pequeño pasara de ese stub al cuerpo completo de `suggest`. Regresión disfrazada de cumplimiento del diseño. Lo implementado cambia el **valor por defecto** y el stub sigue sobrescribiéndolo. Y la solución es mejor que mi instrucción: **`suggestRel` se deriva de `sourceMd`**, así el adaptador deja de ignorar el único parámetro que aceptaba e ignoraba.
2. **«1 divergencia añadida» era falso: son 3 archivos y 4 puntos.** `targets/claude.js`, `tests/apply.test.js` (×2) y **`scripts/doctor.js`**, cuya aguja exigía `suggest` en el nombre del archivo: `.rsc/governance/always-on.md` no casaba, caía al fallback y contaba la base **gobernada**, de modo que **`doctor` sobre-reportaba el coste por sesión en exactamente el preámbulo**. Verificado en el diff. Lo cazó un test de upstream (`fresh-install-coherence` 7a) que existe para esta clase de defecto. `ARCHITECTURE.md` §4 corregido con la cuenta real.
3. **`CONTRACT.md` §1 decía «base menos el bloque», y así el test de la Etapa 1 no podía pasar**, porque la base lleva también las tres claves planas y en `claude` el gancho escribe el archivo **entero, frontmatter incluido** (`session-start.mjs:52`): serían ~111 B por sesión y el tamaño **no** sería el de upstream. **Decisión aceptada: el always-on es el `SKILL.md` prístino de upstream, byte-idéntico.** Mejor en las dos direcciones — coste exactamente 0 B, y el test exige **igualdad byte a byte** en vez de un techo. `CONTRACT.md` corregido.
4. **`PREAMBLE-v1.txt` ya trae sus propios marcadores.** Un primer intento los añadió otra vez y produjo bloques dobles. Queda escrito.

### ATRIBUCIÓN COMPLETA de los 10 fallos de la línea base. Se cierra

| Fallos | Causa | Cómo se estableció |
|---|---|---|
| **5** | **Míos**: temporal dentro del repositorio | Experimento controlado de cuatro brazos + lectura de código para `onboarding-apply` |
| **3** | Entorno: rama degradada de `eval-lint` por falta de PyYAML, que §1 prohíbe instalar | Ya atribuidos |
| **1** | **`design-engine` A5: FLAKY preexistente de upstream** | Corregido abajo |
| **1** | **`deepseek-target` dsh06: fallo preexistente de upstream** | Falla idéntico en un worktree prístino de `origin/main`, y ya aparecía en mi primera línea base en serie, antes de que existiera una línea de este fork |
| **0** | Cuelgues | `knowledge-sync` pasa 52/52 en 19 min: es el archivo más lento, no un cuelgue. **Corregido por la Etapa 4:** ese 52/52 es **una observación**, no una propiedad — la Etapa 4 midió 48/52 en una corrida un 15 % **más corta** (969 s frente a 1 146 s), así que el tiempo de reloj no explica la diferencia y el archivo es no determinista. Lo que se mantiene es lo único que se afirmó: **no es un cuelgue** |

**Cero defectos introducidos por el fork.**

**Corrección a mi propio ledger:** llamé a A5 *«candidato REAL a defecto de upstream»*, lo que daba a entender determinista. **Lo medí yo tres veces: pasa, falla, falla.** Con las tres observaciones del agente (2 fallos, uno en worktree prístino) son **2 pases y 4 fallos en 6 observaciones**: es un **flake preexistente de upstream**, no un fallo determinista. La distinción importa porque un test intermitente **no puede ser puerta de release**, y porque «pasó» no significa «arreglado». Dato adicional medido: **A5 no usa red** — inyecta un `fetchImpl` falso (`design-engine.test.js:111,114,116`); la prohibición de §1 es del script `design-upstream.js`, no del test.

**Y una corrección al informe del agente:** dice que `dsh06` *«NO estaba en la lista»*. **Sí estaba** — es el fallo nº 3 de la tabla de `LEDGER.md:761`, entre los dos sin atribuir. Lo que el agente aporta no es el hallazgo sino la **atribución**, que es justo lo que faltaba. No se copia un error por venir en un informe que acierta en todo lo demás.

### Lo que la etapa declara sin verificar

`eval-lint.sh` (L2, escribe en `/tmp` literal); `design-upstream.js` (red); **que el modelo obedezca** el contrato en cualquiera de los cinco (exigiría los clientes reales con la sesión del usuario — §1 lo prohíbe; es G1–G6 y los límites L3/L4); Windows (L5); la suite entera y la conformidad sobre las **274 instaladas**, que son de la Etapa 4 por reparto. Y lo dice con la distinción correcta: **conformidad ≠ cumplimiento.** Lo entregado es que el artefacto porte el contrato en las cinco superficies, que es determinista y comprobable.

### Nota de método, para el acta

El agente intentó escribir un tercer documento con sus hallazgos y **el harness lo rechazó** por parecer un archivo de informe de subagente. Reaccionó bien: incorporó la parte factual a `stage2/VERIFICATION.md` §5 y §6.4, *«que es donde el revisor independiente la encontrará sin depender de este mensaje»*. Es el criterio correcto — un hallazgo que sólo vive en un mensaje de agente no es un hallazgo del proyecto.

### B-R1 CERRADO — decisión del usuario: excluir la personalización **sólo del borrado**

Preguntado tras la investigación de la Etapa 2, el usuario elige la regla estrecha. **Implementado en `targets/knowledge-sync.mjs`:** las altas y los cambios de un compañero siguen llegando como cualquier conocimiento —propagarlos es media razón de que las personalizaciones existan: son las decisiones del equipo sobre una skill—, y su **borrado** se separa del `git rm`, no se aplica, y se reporta con nombre: *«Ana borró …, que es personalización de este proyecto. No lo aplico: tu copia sigue intacta.»* El predicado es un **prefijo** (`GOVERNED`), no una ruta exacta, porque la lista existente (`PERSONAL`) se compara con `includes` y no puede expresar un subárbol.

**El test negativo que exige `PLAN.md` §4, en archivo propio del fork** (`tests/governance-knowledge-sync.test.js`, sin tocar el de upstream): tres tests, y **probados contra dos mutaciones distintas** — quitar la exclusión del borrado y quitar el aviso. **Cada una tumba `gks01` y sólo `gks01`**, y el **control `gks02` sigue verde en las dos**: un archivo de conocimiento normal borrado igual **sí** se elimina. Eso es lo que demuestra que la regla es estrecha, que era el riesgo de la opción amplia del plan.

**Un defecto propio que la mutación destapó, y que vale más que el test.** La primera mutación no tumbó nada y mi reacción fue sospechar del test; el error era mío, había mutado la línea del **mensaje** en vez de la del **borrado**. Pero al repetirla bien salió a la luz algo real: mi aserción decía *«alguna línea menciona `flutter` y `Ana`»* y **se cumplía por el motivo equivocado**, porque `byAuthor` (`:210-223`) renderiza *«de Ana: flutter/README.md»* dentro del mensaje ordinario de «📥 Traídos». Reescrita para exigir **la frase de rechazo en la misma línea** que el archivo y el autor, más una comprobación de coherencia: la línea de «traídos» **no puede** listar lo que se acaba de rechazar. Una aserción satisfacible por la razón equivocada no es una aserción.

### Regresión de `knowledge-sync`: dos rojos que NO son míos, demostrado

La corrida de los 55 tests (52 de upstream + 3 míos) dio **53 pasan / 2 fallan**: `ks63` y `ks64`. Ninguno es mi cambio:

- **Sus modos de fallo no son de lógica:** `ks64` muere con `git commit: spawnSync git ETIMEDOUT` —el **subproceso git** agotó su tiempo— y `ks63` con una salida **vacía** donde esperaba contenido. Ni un desajuste de autor ni un archivo mal borrado.
- **Pasan los dos en solitario con mi cambio puesto**, en **71 s** frente a los **359 s** (144 + 215) que tardaron dentro de la corrida completa: **5× de inflación**, y el proceso al **14 % de CPU**, es decir esperando. El archivo entero tardó **1 635 s** frente a los **1 146 s** medidos antes: **42 % más lento**.
- La condición ya estaba declarada desde el principio: **la máquina está compartida con trabajo del usuario ajeno a este fork**. Esta corrida la pilló ocupada.
- **`ks64` es, además, el test que mi cambio podría romper de verdad** —toca el crédito por autor, y yo cambié el argumento de `byAuthor` de `take` a `brought`—, así que su verde en solitario es la observación que más vale aquí.
- **No gasto una ventana de 27 minutos en confirmarlo ahora:** la Etapa 4 corre la suite completa con la máquina ociosa y vuelve a ejecutar este archivo en contexto. Queda anotado como **lo primero que hay que mirar en ese log**.

---

## 2l. Revisión independiente de la Etapa 2 — BLOQUEADA, dos ALTA, las dos arregladas

Revisor independiente, sólo lectura. Acredita la invariante **siguiendo las llamadas y no el diff** (*«no hay ruta que pueda escribir dentro de `skills/`»*), **recalcula las ocho cifras** de `VERIFICATION.md` §2 una por una y le salen exactas, y confirma que los tests nuevos **no son vacuos**. Y encuentra dos cegueras localizadas.

### E2b-A1 — ALTA. **Culpa mía directa:** edité `CONTRACT.md` después de que la Etapa 2 hiciera la copia distribuida

`schema/governance/contract-v1.md` describía la superficie always-on como *«base minus the block»* mientras `docs/fork/stage1/CONTRACT.md` ya decía lo contrario (el prístino). Verificado por mí: `cmp` difiere en **la línea 40**, 20 275 B contra 19 774 B, y `npm run governance:check` salía **exit 1 con `DRIFT`**.

**Lo grave no es el byte.** `.rsc/governance/v1.md` es el archivo al que el preámbulo remite al modelo, y se regenera **desde esa copia** en cada instalación. Cada consumidor habría recibido un contrato que describe un mecanismo **que el código no implementa** — `writeAlwaysOn` es un `copyFileSync` del archivo prístino, no una resta — y dos contenidos distintos bajo la misma etiqueta `v1`, contra la exigencia de §6 de un contrato *«versionado y uniforme»*.

**Arreglado:** `npm run governance:sync` → `governance:check` **exit 0** y copia byte-idéntica, comprobado con `cmp`. **Y la lección, que es de método:** la deriva sólo la vigilaba un test, y el test no se reejecutó tras editar el documento. **Requisito para la Etapa 6: `governance:check` entra en la puerta determinista.**

### E2b-A2 — ALTA. Una actualización sobre una base de upstream entregaba las 274 **sin contrato**

`governBase(id, dest)` vivía **dentro** de `if (!existsSync(dest))`, así que sólo alcanzaba una base que esa misma llamada acababa de crear. Verificado leyendo `scripts/install-apply.js:64-79`. Y es alcanzable **hoy, no en teoría**: el fork **sigue publicándose como `@ericrisco/rsc` en la versión de upstream**, luego un proyecto instalado con upstream tiene `.rsc/.base-versions.json` marcando esa versión —lo escribe código de upstream que el fork no toca— y la base materializada sin gobernar. Con `stale === false` y el directorio existiendo, **no corría nada**: base sin bloque y los 17 destinos que entregan por symlink leyendo una skill sin contrato. Incumple el criterio 4 en la ruta de actualización, que es justo la de §7 y §10.

**Y ningún test lo cubría**, porque todos instalan en un directorio vacío y el de idempotencia **blanquea** `.base-versions.json` para forzar la ruta stale — probando el refresco y dejando ciego el caso real.

**Arreglado:** `governBase` sale del `if` y corre siempre, que es seguro porque la transformación despoja y reinyecta entre sus propios marcadores (no-op real, no esperanzado). **Más el test que faltaba**, con su mutación escrita en el propio test: rebobinar la base al archivo prístino dejando la marca de versión, reinstalar, exigir el bloque.

### E2b-M2 — La categoría se resolvía por orden de lista, **ascendiendo «patrón observado» a «convención aprobada»**

`CATEGORIES.find((c) => line.includes(c))` sobre una lista cuyo primer elemento es `approved convention`: una línea que diga *«observed pattern, not an approved convention»* resolvía a **`approved convention`**, sin hallazgo alguno. Es exactamente la promoción silenciosa que `CUSTOMIZATION-SCHEMA.md` §2 declara como la razón de ser del esquema — *«turn every accident in the codebase into law»* — y arrastraba la regla 7, porque el despacho de migraciones compara contra esa categoría mal resuelta.

**Arreglado:** la categoría es el **primer token** de la línea (`Category: <una> · Scope: …`), comparado **exactamente**; cero o más de una coincidencia es un hallazgo R6 que **cita lo que el archivo dijo**, porque la ambigüedad es el hallazgo y no algo que resolver por orden de declaración. **Con su test**, y con la mutación que lo tumba escrita dentro.

**Los cuatro archivos de gobernanza tras los tres arreglos: 44 tests, 44 pasan.**

### Y un hueco que es mío y que la Etapa 3 heredó: los ejemplos del esquema fallaban su propia regla 1

Añadí `type`, `catalog-version` y `reevaluate-when` al esquema y **dejé sus dos ejemplos normativos sin ellas**, así que el ejemplo que todo el mundo copia incumplía la regla que el mismo documento acababa de imponer. Arreglado, y **verificado pasándolo por el validador de verdad en vez de contando claves**: el ejemplo trabajado extraído a una fixture da *«1 customization checked · 0 errors · 0 orphaned»*.

---

## 2m. Revisión independiente de la Etapa 3 — APROBADA CON CORRECCIONES (3 ALTA, 7 MEDIO, 9 BAJO)

Acredita que los ocho pasos cubren §7 **1:1 sin huecos de cobertura**, que las seis categorías se reutilizan y **no** se duplican, que los siete campos están, y que **las ocho afirmaciones de reutilización y ~120 citas a código eran correctas al cerrar la etapa**. Lo que falla es instrumentación y coordinación.

### E3-A2 — el hallazgo que más lejos llega, y lo MEDÍ porque el revisor lo marcó como inferido

Los ejemplos trabajados anclan la evidencia por **número de línea** a `skills/<id>/SKILL.md`. Dos problemas: en un proyecto consumidor **`skills/` no existe** (la única copia real es `.rsc/skills/<id>/`), y **la transformación inserta el bloque antes del cuerpo**, así que las líneas se desplazan.

**Medido por mí, que el revisor no pudo:** la transformación añade **13 líneas**. En `flutter`, la línea **243 pasa a 256** y la **396 a 409**. Y la regla 4 sólo comprueba que la línea **exista**, no que diga lo que se afirma, así que **una cita desplazada pasa la validación en silencio**.

Esto excede la Etapa 3: **el fork desplaza el cuerpo de las 274 en 13 líneas**, luego cualquier cita por línea a una skill es falsa en el artefacto entregado. La corrección correcta es la del revisor: anclar en `.rsc/skills/`, y cambiar la regla 4 a *«la línea citada contiene el fragmento entrecomillado»* o citar por sección.

### E3-M5 — el umbral del conjunto de competidores es el equivocado, y verificado

`BROWNFIELD.md` menciona el `0.80` de `routing-audit.js:16`, pero ese es el **techo de fallo** (`FLOORS.maxCollision`, comprobado en `:152` como `>= 0.80` → falla). El llamador real usa **`0.45`** (`:119`) y el valor por defecto de la función es `0.5` (`text-rank.js:102`). Con 0.80, un catálogo que **pasa** su propia auditoría produce ~cero candidatos: el conjunto queda inoperante, no sólo mal declarado.

### Las otras dos ALTA y el resto, aceptadas

**A1:** `BROWNFIELD.md` afirma que los artefactos *«are validated at that point»* por `npm run gate`, que **no existe**; y nada lee el informe brownfield (`grep -rn brownfield scripts/ package.json` → vacío). Es el defecto E1-R4 reproducido para el criterio 10. **A3:** en greenfield la única categoría disponible para una decisión conversacional **no puede satisfacer la regla de evidencia**, porque no tiene ruta — así que lo único que §7 asigna al greenfield queda imposible de registrar. **M1:** 36 citas al esquema desplazadas **+3/+5** porque la Etapa 1 insertó líneas **después** de cerrar la etapa — la deuda de coordinación que ya registré. **M2:** tres «huecos del esquema» que la etapa deja abiertos **ya están cerrados**. **M3:** el ejemplo «totalmente medido» falla el test de conflicto de la propia etapa, y dice «cuatro skills» donde nombra ocho. **M4:** falta la casa `docs/adr/`, que es la rama que gobierna el caso central. **M6/M7:** el bloqueo «computable» y tres criterios de parada acotan la forma y no la cobertura.

### Lo que el revisor aporta y nadie había visto

**El criterio 10 sí se puede falsear**: una corrida que emite cero conflictos cumple las 14 reglas, las 17 propiedades deterministas y el único gate que lo toca. Pero añade la salida que yo no vi: **el eje skill↔skill es parcialmente computable con las piezas que ya se usan** — colisiones de descripción, el grafo `recommends:` y las cláusulas `NOT` — así que se puede exigir que el inventario contenga **toda pareja por encima del umbral** y obtener **un suelo de recall sin gastar ni una ejecución de agente**. Eso es mejor que mi propuesta de colisiones plantadas, y mejor que pedir un gate cuyo presupuesto no existe.

### Correcciones de la Etapa 3 aplicadas — y el revisor también tenía datos obsoletos

Los cinco documentos de `docs/fork/stage3/`, +496 / −278. Comprobado por mí: `git status` muestra **sólo esos cinco archivos**. Los 19 hallazgos son reales en sustancia; tres traían datos equivocados.

**El mejor hallazgo del corrector es contra el revisor, y lo verifiqué.** El remapeo «+3/+5» que proponía la revisión estaba **él mismo desactualizado**, porque **yo moví el esquema entre la revisión y la corrección** al añadirle las tres claves a sus ejemplos. Consecuencia concreta: el revisor afirmaba que `CUSTOMIZATION-SCHEMA.md:34` es `catalog-version` y que por tanto `BROWNFIELD.md:160` citaba mal; **hoy `:34` es la fila `scope`** (comprobado con `sed -n '34p'`), así que esa cita es **correcta** y aplicar el remapeo la habría roto. El corrector contó en vez de confiar en el desplazamiento: **35 de 36 citas mal, 1 bien y por casualidad.** Y acotó el alcance: las 31 citas a `CONTRACT.md`, 4 a `EVALUATION.md`, 2 a `ARCHITECTURE.md` y 1 a `ACCEPTANCE.md` estaban **todas correctas**; la deriva estaba confinada a dos archivos.

Es el argumento más fuerte posible a favor de la regla que adoptó: **citar por sección + fragmento entrecomillado, no por número de línea.** Tres cadenas de revisión seguidas se tropezaron con el mismo problema; las líneas se mueven y el texto no.

**No reescribió dos ejemplos: cambió el instrumento.** La regla 4 pasa de «la línea existe» a cuatro formas admisibles de evidencia — cita anclada por fragmento (con la línea como pista **subordinada**, y si discrepan **falla y nombra la línea real**), ancla de sección, población contada, y `user-decision, <fecha>` para greenfield —, más **4d: la evidencia de skill se ancla en `.rsc/skills/<id>/`**, porque en un consumidor `skills/` no existe y el cuerpo está 13 líneas más abajo. La prueba de que ahora sirve está dentro del documento: el ejemplo que citaba `:14-15` entrecomillando una frase que sólo está en `:243` **pasaba** la regla antigua y **falla** la nueva. Mismo archivo, veredicto opuesto.

**M5 es peor de lo que decía el hallazgo, y lo corroboré por otra vía.** Medido por el corrector: a **0,80 salen 0 parejas** sobre las 274 — el conjunto no es «casi inoperante», es **vacío** — y el máximo real es **0,737**, luego la fila de ejemplo `0.83` no era una fixture sin marcar sino un valor **imposible**. Mi corroboración independiente: `routing:audit` falla **sólo** por `declared-route top-5 84.9% < 85%` y **no** por colisión, y su suelo de colisión es exactamente `>= 0.80` — si existiera una pareja por encima, fallaría. B1 declara ahora **0,45**, el del llamador.

**Dos hallazgos que el revisor no vio:** `BROWNFIELD.md` afirmaba «274 of 274 carry both `recommends:` y `tags:`» cuando las 274 llevan la **clave** pero sólo **267** un valor no vacío — y esa afirmación sostenía el cálculo de competidores; y una **37ª** cita mal que el remapeo no listaba.

**El suelo de recall de la revisión, medido e incorporado** (0,80 → 0 parejas · 0,60 → 9 · 0,50 → 34 · **0,45 → 46 parejas, 65 skills** · 0,40 → 71; más 1 353 aristas `recommends:` y 273/274 cláusulas `NOT`): es regla 16 —la única que comprueba *recall* y no forma—, criterio de parada de B1 y propiedad determinista. **Cero ejecuciones de agente.**

**Y la honestidad subió al producto en vez de bajar del documento interno**, que era la corrección correcta de M6: donde `DESIGN.md` reconocía que el bloqueo es «D parcial» y el artefacto de producto afirmaba que era computable, ahora lo dice el producto. Más una distinción que faltaba y que vale para todo el fork: **decidible ≠ instrumentado** — las propiedades «D» dicen que un validador daría el mismo veredicto, no que exista.

**Lo que sigue abierto, dividido para que el suelo nuevo no se lea como cobertura:** recall skill↔skill por colisión + aristas + `NOT` → **determinista y completo**; skill↔skill que chocan en el cuerpo describiéndose distinto → **ninguna**; **recall project↔skill → ninguna, y sigue siendo el hueco más grande del diseño.** Con mecanismo y coste nombrados: dos conductas × ~8 celdas × N=3 ≈ **48 ejecuciones** contra un techo ya repartido (599 de 600). Queda como **cobertura pendiente declarada**, que es lo que exige §11, sin bajar umbrales.

### Decisiones del coordinador sobre sus cinco preguntas

Ninguna necesita al usuario; las cinco caen dentro del plan aprobado o las decide el estándar.
1. **El nombre del comando:** `rscg brownfield`, coherente con el CLI del fork. Lo implementa la **Etapa 6**.
2. **Extender `customization-validator.js` a `02-DOCS/wiki/brownfield/`: sí.** Sin eso, 16 reglas y 22 propiedades son decidibles y no instrumentadas — literalmente el defecto que la revisión de la Etapa 1 encontró en el criterio 8. Entregable de la **Etapa 6**, con los dos puntos de invocación que ya existen.
3. **El gate (d) y sus ~48 ejecuciones:** se **especifica** y se declara **cobertura pendiente**. §11 es explícito: no exceder el techo, no bajar umbrales, registrar lo pendiente, no marcar como aprobado lo no verificado.
4. **La casa de las decisiones brownfield:** por proyecto, primera coincidencia, **recordando que la rama 2 es `docs/adr/`** — la que gobierna el caso central del brownfield y que el borrador se había saltado.
5. **Citar por sección + fragmento: sí**, en los cuatro artefactos de producto. El coste es real y vale la pena: si upstream reescribe una frase, la regla **falla en voz alta**; el modelo anterior fallaba **invisible**, y esta sesión lleva tres cadenas de revisión demostrándolo.

---

## 2n. Etapa 4 — Conformidad del catálogo completo (entregada, pendiente de revisión independiente)

Entregables: `docs/fork/stage4/{VERIFICATION.md,INSTRUMENT.md,PROPUESTAS.md}` (858 líneas), `scripts/verify-catalog-conformance.js` (252) y `tests/governance-upstream-change.test.js` (226). El agente no commiteó; commiteo yo.

### Lo que verifiqué YO, no lo que me reportaron

| Comprobación | Mi resultado | Coincide con el informe |
|---|---|---|
| Invariante `skills/` = upstream | `git diff --numstat origin/main -- skills/` → **0 líneas**, 274 directorios | sí |
| Mutaciones revertidas | `git diff --stat scripts/ targets/ tests/ package.json` → **vacío**; sólo 3 rutas sin seguimiento | sí |
| **Criterio 4, corrida propia** | `verify-catalog-conformance.js` → **EXIT 0, failures: 0**. Base **274/274** en las 3 pasadas; entrega **274/274 en los 18 destinos** en las 3 pasadas; `installedBaseDirs` 274 (ninguna base fuera del catálogo) | sí, cifra por cifra |
| **Criterio 5, corrida propia** | `reinstall` 274/274 byte-idénticas, `forcedRefresh` 274/274, **0 derivas** | sí |
| Superficie always-on | `claude` 7 280 B · **16** de familia `AGENTS.md`/`GEMINI.md`/… 6 946 B · `cursor` 6 676 B, **ninguna con bloque** | sí (escribí «13»; son **16**, y 1+13+1 no suma 18 — mi propia corrida los había impreso bien) |
| `npm run governance:check` | **EXIT 0** — la deriva que yo causé en la Etapa 3 sigue cerrada | sí |
| Suite de gobernanza del fork + criterio 12 | 6 archivos, **51/51, 0 fallos, 0 cancelados**, 87 s | sí |
| `ks64`: ningún test toca `02-DOCS/wiki/skills/` | `grep -c "wiki/skills" tests/knowledge-sync.test.js` → **0** | sí |

Y leí el instrumento antes de creerle el 274/274, porque un validador que no puede fallar informa lo mismo que uno que pasa: **no es vacuo**. Define parcial/duplicado/digest-incorrecto/fuera-de-sitio **antes** de medir; deriva los 18 destinos de `TARGET_IDS` en vez de cablearlos; compara el `.mdc` de Cursor **byte a byte contra el bloque renderizado** (la única entrega transformada de verdad, donde ni el validador de la base ni el digest verían un fallo); y para `claude` **sigue la ruta guardada en `settings.json`** en vez del retorno de `wireHook` — exactamente la vacuidad que yo introduje en el diseño de la Etapa 1 y que la CORRECCIÓN 2 tuvo que retirar.

### La suite completa — la medición autoritativa que el proyecto no tenía

```
142 archivos (los 143 menos tests/eval-lint.test.js, por L2)
# tests 1588 · # pass 1581 · # fail 6 · # cancelled 0 · # skipped 1
# duration_ms 5617237 → 1 h 33 m 37 s     EXIT=1
```

**0 cancelados**, que es el defecto que invalidaba todas las mediciones anteriores. Los 6 fallos, **todos atribuidos y ninguno nuevo**: `dsh06` (upstream preexistente), `design-engine A5` (flake preexistente) y `ks30/ks48/ks61/ks63` de `knowledge-sync`. Cifras corregidas: **1 h 33 m 37 s** y **1 588 tests**, no las ≈1 h 48 m / 1 537 que yo venía arrastrando de una reconstrucción.

### `ks64` refutado, y por lectura en vez de por estadística

Yo dije que `ks64` era «el único test de upstream que ese cambio podría romper de verdad». Pasa en **3 de 3** observaciones, pero el argumento decisivo no es el conteo: **ningún test del archivo toca `02-DOCS/wiki/skills/`**, luego `isGoverned()` es falso siempre, `kept` es `[]`, `brought === take`, y la guarda `if (brought.length)` se entra exactamente cuando se entraba `if (take.length)`. El cambio de `byAuthor` de `take` a `brought` es un **no-op demostrable para los 52 tests**. Los 4 fallos son sensibilidad a la carga **en upstream**: en **una** observación de cada árbol, el conjunto que falla en el worktree prístino `481b1ec` contuvo a los cuatro del fork (9, los mismos 4 más ks08/ks15/ks44/ks50/ks54). **Corregido tras la revisión:** «superconjunto estricto» afirmaba una relación de conjuntos con n=1 por brazo, en un archivo que este mismo ledger declara no determinista — el error exacto que acababa de corregir para el 52/52 dos párrafos más arriba, cometido en la dirección contraria y en la misma sección. Y el confundidor va **en contra** de lo que hay que concluir: la corrida de upstream iba a 49,75 de carga, y ver fallar esos 4 bajo mucha más carga es evidencia *débil* de que fallarían con la máquina tranquila. **La atribución la sostiene el brazo lógico, no el conteo:** el no-op es demostrable.

### Las mutaciones: los tests muerden, y se ve exactamente cuánto

**(a) `governBase` borrada:** conformidad **base 0/274** y **cursor 0/274** en las tres pasadas; 11 fallos sobre 134 tests. **(b) `CATEGORIES[0]`:** 2 fallos, el predicho (categoría *hedged*) **y uno que no predije** — la categoría **ausente**, porque `CATEGORIES[0]` también enmascara la ausencia.

**El dato incómodo de (a), que el agente reporta contra su propia comodidad:** de los tests heredados de upstream, **cero** notan que la gobernanza desaparezca. `base-install`, `apply`, `fresh-install-coherence`, `always-on-body` y `md-block-fidelity` dan 0 fallos. Es lo esperado bajo Estrategia B —upstream no sabe que existe el contrato— pero conviene tenerlo escrito: **la red que protege el criterio 4 son los archivos de test del fork y nada más** — y, corregido por la revisión, son **tres de los seis** que el fork añade (`governance-always-on`, `governance-base`, `governance-delivery`); los otros tres no tocan esa superficie.

### HALLAZGO NUEVO, reproducido por mí y MÁS ANCHO de lo reportado: `rsc restore` deja la base sin gobernar

Hay un **segundo escritor** dentro de `.rsc/skills/`: `restoreEntry` (`backups.js:98-114`, `cpSync` crudo), y `install-apply.js:215` mete `baseDir(…)` en los `managedPaths`. Como `createBackup` corre **antes** de escribir (`install-apply.js:347`), la instantánea de un proyecto cuya base venía de upstream captura esa base **sin gobernar**, y la instalación la gobierna después. Reproducido literalmente por mí:

```
1. fork install            → governed = true
2. upstream-shaped base    → governed = false
3. fork install again      → governed = true   (el punto ciego de la Etapa 2, ya cerrado)
4. rsc restore latest      → governed = false
   .claude delivery exists: true | governed = false
```

Lo que añado a lo reportado: el mismo `restoreBackup` se invoca **automáticamente** en el rollback de onboarding (`onboarding-apply.js:342`), no sólo desde `rsc restore`. Con el matiz honesto: en el rollback devuelve el proyecto a un estado **anterior**, así que no inventa una falta de gobernanza que no estuviera ya ahí; lo que hace es que el consumidor acabe leyendo skills sin contrato **y nada se lo diga**. No es defecto del transformador —`restore` es una máquina del tiempo y debe serlo— pero sí **un hueco en el alcance del criterio 4**. El fondo lo dice el agente mejor que mi briefing: **el validador del criterio 4 corre en el repositorio del fork, no en la máquina del consumidor.** Ningún comando del producto responde hoy «¿están gobernadas mis 274?».

### Afirmaciones mías que la Etapa 4 tumbó

1. **«La máquina es tuya y nadie más la está usando» — FALSO, y es la más grave**, porque es una condición del instrumento que yo declaré cumplida sin medirla. Medido durante la etapa: una VM del usuario del 1,1 % al **94,4 %** de CPU, una suite de `vitest` de otro proyecto con 13 procesos, `docker-scout` al 62 %. **La condición 4 no es alcanzable en esta máquina** y esperar a «carga < 3,0» era esperar a algo que no llega.
2. **`ks64`** (arriba): no sólo no es el único que podría romperse, es que **ninguno** del archivo puede.
3. **«El ledger los atribuye a contención»**: el tiempo de reloj no sostiene el caso — la corrida que falló 4 fue **más corta** que la que pasó 52/52.
4. **Mutación (a), predicción parcialmente errónea**: los tests «de base de install» heredados cayeron **cero**.
5. **L2 mal atribuido**: `tests/design-engine.test.js` **no** toca la red (`fetchImpl` falso en `:111,114,116`); el límite recae sobre `scripts/design-upstream.js`. Ya estaba corregido en este ledger (línea 1055); la Etapa 4 lo confirma y además **barre** `scripts/`, `targets/` y `tests/`: el único escritor de `/tmp` literal es `eval-lint.sh`, y 105 archivos de test usan `os.tmpdir()`, que sí honra `TMPDIR`.

El patrón sigue siendo el mismo que esta sesión ya tiene registrado como lección operativa, y esta vez cayó sobre una **condición del instrumento**: tomé una propiedad de mi entorno por una propiedad medida.

### Decisiones del coordinador sobre las tres preguntas de la etapa

**D11 — La corrida completa se acepta como autoritativa, con sus condiciones registradas, y la condición 4 pasa a ser el límite L7.** Razones: **0 cancelados** (el defecto que invalidaba las anteriores), **78 de sus 93 minutos** entre carga 1,88 y 3,52, los 6 fallos atribuidos por experimento y **ninguno nuevo**. Y la razón de fondo: las mediciones de **conformidad comparan bytes, no tiempos**, así que son indiferentes a la carga; lo único expuesto son las duraciones y los fallos con forma de timeout, y ésos se atribuyeron re-ejecutando en solitario y contra un worktree prístino de upstream. **L7: «máquina ociosa en sentido estricto» no es alcanzable en esta máquina**; lo que se puede afirmar y se afirma es que **ningún trabajo del proyecto corrió en paralelo**.

**D12 — `knowledge-sync` es deuda heredada, se declara, y NO es puerta binaria.** Es no determinista en **upstream prístino**, que falla un superconjunto estricto; y el único cambio del fork sobre ese archivo es un **no-op demostrable** para sus 52 tests. Consecuencia para los criterios 3, 7 y 14: la suite completa **no sirve como puerta binaria** mientras ese archivo sea no determinista, y eso se escribe en `PLAN.md` §7 en vez de maquillarse con un reintento. **No se sube el tope a ciegas**: la hipótesis del mecanismo (`LOCAL_TIMEOUT_MS = 4_000` con `run()` convirtiendo el timeout en un `{ok:false}` indistinguible de «no había nada») queda **como hipótesis con su experimento escrito**, y la recomendación que adopto es **hacer el fallo ruidoso**, no más permisivo. Arreglar deuda de upstream no es objetivo de este fork (§2); declararla sí.

**D13 — `rsc restore` se NOMBRA, no se cambia la semántica.** Re-gobernar al restaurar convertiría la máquina del tiempo en una mentira: el usuario pide el estado de ayer y recibe otro. Lo que gana el producto, y es la parte que importa, es **un comando que responda «¿están gobernadas mis 274?» en la máquina del consumidor** — porque hoy el criterio 4 sólo se puede comprobar dentro del repositorio del fork. Entregable de la **Etapa 6**, junto con el aviso explícito tras un `restore` que devuelva bases sin gobernar.

**Correcciones al ledger aplicadas** (propuestas por la etapa, verificadas por mí): el 52/52 de `knowledge-sync` pasa a ser **una observación** y no una propiedad; «5,3 MB» era **MiB**; la atribución de L2 ya estaba corregida en la línea 1055.

---

## 2o. Revisión independiente de la Etapa 4 — APROBADA CON CORRECCIONES (2 ALTA, 5 MEDIO, 7 BAJO)

Revisor distinto del implementador, en un worktree desechable de `687eaf6`, sin ejecutar la suite completa (L7) ni `eval-lint` (L2), sin commits y con las mutaciones revertidas y comprobadas al cerrar.

### Lo que resistió, que también es resultado

Reprodujo el **274/274** por su cuenta (`failures: 0`), y los criterios **6** y **7** por su cuenta. Atacó `auditBase` con **once** entradas construidas a mano, una por clase declarada: **todas fallan y por la razón correcta**, incluido el caso que un validador perezoso dejaría pasar — un digest **coherente pero de otra skill**. Forzó en `targets/claude.js` la vacuidad exacta que la Etapa 1 shipeó (`usable = false`, que hace al gancho apuntar a la skill gobernada): el instrumento **la pilló en las tres pasadas** y el cuerpo medía 8 176 B = los 7 280 prístinos más el bloque. Las dos mutaciones del criterio 12 caen **exactamente** donde se afirma. Auditó el log de la suite línea por línea: **nada fabricado**, 1 588 / 1 581 / 6 / 0 cancelados / 5 617 237 ms, los seis `not ok` son los seis de la tabla y las 19 muestras de carga están donde se dice. Y reprodujo el hallazgo de `restore` **desde cero con su propio script**: las dos vías de alcanzabilidad se sostienen y **no está sobrevendido** — con un encuadre más filoso que el mío: *es la propia instalación del fork la que fabrica la instantánea restaurable sin gobernar*.

También cerró `ks64` mejor de lo que yo lo tenía: buscó el camino indirecto y no existe — ninguna construcción dinámica de rutas, `isGoverned` usa prefijo **con barra final** (así que `02-DOCS/wiki/skills.md` no coincidiría), `brought = take.filter(…)` **preserva el orden** (así que el pathspec del commit es idéntico), y ningún test afirma sobre los exports del módulo.

### A1 y A2 — dos clases declaradas que el instrumento NO mide, demostradas por mutación

**A1.** En `auditDelivery`, la resolución del symlink está **dentro de una guarda de symlink**: `if (lstatSync(dir).isSymbolicLink() && realpathSync(dir) !== realpathSync(basePath))`. Si el directorio no es symlink, la rama no se entra y no hay hallazgo; la comparación de bytes que queda es byte-idéntica justo después de instalar **por construcción**. Mutación: forzar el camino de Windows en `linkOrCopy` (`cpSync`) → **las 18 entregas pasan a ser copias reales y el instrumento informa 274/274, `failures: 0`**. Consecuencia: el «17 de 18» de `CONTRACT.md` §1, que `INSTRUMENT.md` §3 declara convertido en «evidencia y no inferencia», **sigue siendo inferencia** — el informe no registra en ningún campo cuántos destinos entregaron un symlink. Y el único entorno donde la clase importa de verdad es **Windows (L5)**, que es exactamente donde `linkOrCopy` copia.

**A2.** La rama `cursor` extrae el bloque con `(text.match(/…/) || [])[0]` — **la primera coincidencia** — y el conteo `opens`/`closes` vive sólo en `auditBase`, que nunca corre sobre el `.mdc`; tampoco se exige que el bloque **abra el cuerpo** ahí, ni el `.mdc` entra en la comparación de idempotencia entre pasadas. Mutación: duplicar el cuerpo en `targets/cursor.js` → el `.mdc` acaba con **2** marcadores de apertura y **2** de cierre, **35 712 B frente a 17 885**, y el instrumento informa **274/274, `failures: 0`**. Es el peor sitio posible para este hueco: `INSTRUMENT.md` §3 justifica auditar Cursor precisamente porque *«es la única entrega realmente transformada, y la única donde un fallo de renderizado no lo verían ni el validador de la base ni el digest»*.

**Lo que esto le hace a mi firma.** Yo **leí** ese instrumento antes de aceptar el 274/274 y lo declaré no vacuo. Es no vacuo para todo lo que comprueba; lo que no vi es que **dos clases que declara no las comprueba**. Leer el código fue mejor que no leerlo y no fue suficiente: lo que distingue al revisor es que **mutó**. La lección operativa de esta sesión se extiende, entonces, al propio instrumento: *decidible ≠ instrumentado* aplica también a lo que mide, no sólo a lo que se mide. En consecuencia he retirado el ✅ de los criterios **4** y **5** en `ACCEPTANCE.md` y los he dejado en **medido, no cerrado**, con lo que falta nombrado. Ninguno de los dos huecos indica que la gobernanza esté hoy mal entregada: indican que el validador no lo notaría.

**Nota de coordinación:** mientras la revisión corría, la Etapa 6 **extrajo** la auditoría a `scripts/lib/conformance.js` (lo que yo le pedí: reutilizar, no duplicar) y **los dos huecos viajaron verbatim**. Verificado por mí en el árbol actual: la guarda sigue en `conformance.js` y la primera-coincidencia de Cursor también. Las correcciones van a esa copia, que es la que sobrevive, y el instrumento se re-ejecuta después. Ya se lo he pasado a la Etapa 6 con las dos mutaciones que lo prueban.

### Y una regresión de las Etapas 5/6 que la revisión pilló de paso

El renombrado `rsc`→`rscg` en la cadena `ANNOUNCE` de `targets/knowledge-sync.mjs` **tumba `ks20` y `ks30` de forma determinista**: los dos afirman sobre `/rsc knowledge-sync off/`. El revisor estuvo a punto de reportarlo como hallazgo de la Etapa 4 y lo descartó bien, comprobando con `git diff origin/main 687eaf6 -- targets/knowledge-sync.mjs` que en ese commit el único cambio es el bloque de gobernanza. Avisada la Etapa 6.

### MEDIO y BAJO, aceptados

**M1 — mi derivación del 9/9 era falsa, y el 9 corrige un error mío más antiguo.** Escribí «ocho obligaciones, una cubre dos archivos». `PLAN.md` §2 obligación 1 lista **siete** entradas, **dos** multi-archivo (el glob `skills/ux/upstream/*/LICENSE` → 2 y los `UPSTREAM.json` → 2) → **nueve** rutas. El «ocho» venía de la línea base que yo registré en §9 de este ledger, y esa lista **omitía `skills/ux/THIRD_PARTY.md`**: comprobado en disco, las nueve rutas existen y la octava faltaba. Nadie contó dos veces; **yo conté de menos**, y la Etapa 4 lo arregló sin saber que lo arreglaba. Corregida además la condición de paso del criterio 6, que seguía diciendo «ocho» contra un resultado de nueve — con la nota que faltaba: en el árbol instalado son **8** porque el `LICENSE` de la raíz no cuelga de `skills/`.

**M2** — la fila de condiciones de la suite en `VERIFICATION.md` §10 dice que se esperó a carga < 3,0 y a cero procesos ajenos; la cabecera del propio log registra `load1=7.17` y la misma §10 explica en prosa que esa espera **se abandonó** y que la puerta declarada fue < 9,0. Es la única fila del documento que sobrevende. **M3** — ver arriba, corregido en esta sección. **M4** — el hallazgo estrella no tiene test ni repro commiteado, y el motivo dado (no alterar los 142 archivos congelados) no cierra: una aserción dentro de `tests/governance-base.test.js` ya estaba dentro de los 142. **M5** — `PROPUESTAS.md` reparte a la Etapa 6 algo que es de la 4: el script **sí viaja** al consumidor (`package.json.files` incluye `scripts`, verificado); lo que falta es un **modo de auditoría sobre un árbol existente**, ~15 líneas, que es lo que `CONTRACT.md` §13 ordena.

**BAJO:** B1 (16, no 13 — corregido), B2 (tres de seis archivos — corregido), **B3** (ninguna mutación demuestra que el test **ADDED** muerda: la no-vacuidad del criterio 12 cubre 3 de 4), **B4** (mi celda del criterio 4 inventaba una «mitad E» que `PLAN.md` §11 no pide: la fila es clase **D**, y G1/G2 son del criterio 8 y G5 del 10 — corregido), B5 (`orphaned = false` tumba además 2 tests fuera del criterio 12), B6 (el instrumento de 252 líneas se publica a los consumidores: o se excluye de `files`, o se le da el modo de auditoría de M5 — y preferimos lo segundo), **B7** (el instrumento no tiene suelo sobre el tamaño del catálogo: el denominador es `ids.length`, así que un `skills/` truncado informaría «273/273, failures: 0»; una línea lo cierra), **B8** (marqué ✅ en celdas que en la misma frase declaraban pendiente la revisión que las valida — corregido al retirar los dos ✅).

---

## 2p. Etapa 5 — Mantenimiento manual de upstream (entregada, pendiente de revisión independiente)

`scripts/upstream-maintain.js` (788, diez fases), `scripts/lib/upstream-survey.js` (439), `scripts/lib/upstream-gate.js` (641, la puerta G1–G12), `scripts/lib/upstream-state.js` (346, el diario), `tests/governance-upstream-maintenance.test.js` (680, **22/22** según el agente), más `docs/fork/stage5/{DESIGN.md,MAINTENANCE.md}`. **Pendiente de re-ejecución por mí**, y el motivo es de higiene, no de confianza: la Etapa 6 está en vuelo tocando ~50 archivos, `package.json` y la identidad del CLI, así que cualquier corrida ahora mezclaría dos árboles y un fallo sería inatribuible — exactamente el error que esta sesión lleva cinco veces cometiendo. Se re-ejecuta cuando el árbol vuelva a ser coherente. Sin commits del agente; commiteo yo. Worktrees desechables y sus ramas borrados; `git worktree list` sólo el principal; invariante **0 líneas**.

### UPSTREAM SE MOVIÓ, y la etapa corrió contra el cambio real en vez de contra un fixture

Verificado por mí: `git rev-list --count 481b1ec9..cb9e051d` → **2**. Upstream publicó **3.7.5**. Trae **20 archivos nuevos** y **seis modificados** — `manifest.json`, `package-lock.json`, `package.json`, `skills/connect-tool/SKILL.md`, `skills/connect-tool/evals/cases.yaml` y `tests/connect-tool.test.js`. Escribí «una modificación»: una **skill** modificada, seis **archivos**. La distinción importa porque `package.json` es una de las ocho divergencias, y por eso la corrida reporta `collisions: **high** — package.json`. Y entre los nuevos, lo que importa:

```
A  skills/connect-tool/THIRD_PARTY.md
A  skills/connect-tool/bridge-kit/LICENSE        (MIT, © 2026 Executive Lab)
A  skills/connect-tool/bridge-kit/UPSTREAM.json
→ Executive-Lab/conectores-pymes, MIT
```

**El fork pasaría a tener TRES subárboles vendorizados, no los dos que el plan congela** — y `PLAN.md` §2 enumeraba las obligaciones **por nombre de archivo**, así que no conoce ninguno de los tres. El merge no da ni un conflicto textual: las pruebas impactadas pasan (**18 archivos**, 165 casos — escribí «165 pruebas impactadas», que es leer mal mi propio instrumento: el `detail` de la puerta dice literalmente `18 file(s): 165 passed`), el manifiesto valida, la deriva no se mueve. **Un merge limpio que, aplicado a ciegas, habría hecho al fork incumplir tres atribuciones sin que nada lo dijera.** Es la demostración más fuerte posible de la frase del plan que yo venía citando como consigna: *«un merge sin conflictos textuales no se acepta como prueba de compatibilidad funcional»*.

La puerta lo paró. Veredicto sobre el merge real: **PASS** G1 (espejo intacto), G2 (274 skills, mismo conjunto de ids), G3, G4, G5 (los **tres** subárboles idénticos en repo y en copia entregada), G7 (divergencias intactas), G8 (165 pass / 1 fallo declarado / **0** inesperados / 0 cancelados), G9, G10 — y **FAIL G6** («3 notice change(s) NOT acknowledged»), **FAIL G11** (una skill necesita evaluación semántica, no instrumentada), **FAIL G12** (identidad, porque el worktree se construyó desde `HEAD`, donde el renombrado aún no está commiteado; sobre el árbol vivo la misma comprobación da `@lema017/rsc-governed`, así que **la puerta distingue los dos árboles y no es vacua**).

### Decisiones del coordinador

**D14 — 3.7.5 NO se integra en la entrega.** La base de medición del proyecto entero está congelada en `481b1ec9`: integrar ahora invalidaría la corrida autoritativa de la suite, la conformidad sobre las 274, la línea base de licencias y la lista de divergencias, y obligaría a repetirlas. Además **la propia puerta bloquea** la promoción (G6 y G11). Se registra como **el primer ejercicio real de la máquina de mantenimiento, con veredicto bloqueado**, y la integración queda como la primera ejecución de mantenimiento posterior a la entrega. Dato que acota el riesgo de aplazarlo: 3.7.5 **no añade skills** — el conjunto sigue siendo **274**, verificado —, así que ninguna cifra del proyecto cambia.

**D15 — qué viaja en el tarball y qué no, y la respuesta es distinta por archivo.** El **validador de conformidad sí viaja**, porque es lo que necesita el comando de D13(b) para responder «¿están gobernadas mis 274?» en la máquina del consumidor, y porque `CONTRACT.md` §13 lo ordena. La **maquinaria de mantenimiento no**: `"scripts"` entra entera en `files`, así que hoy viaja sin que ningún `bin` la alcance; se excluye con `"!scripts/upstream-*.js"`. Y **nada de mantenimiento en `bin`**: `REQUIREMENTS.md` §10 dice «Los consumidores no integran upstream directamente», así que exponer `rscg upstream:maintain` crearía la superficie que §10 prohíbe.

### Afirmaciones mías que la Etapa 5 tumbó

**1. «3 archivos / 4 puntos de divergencia» — incompleto, y de la peor forma.** Medido por mí sobre el árbol commiteado: **ocho**. Los tres que faltaban no aparecen en ninguna parte de `ARCHITECTURE.md` §4 — `targets/knowledge-sync.mjs`, `.github/workflows/release.yml` y `.gitignore` —, así que una máquina de mantenimiento que usara mi lista habría dejado **tres divergencias sin vigilar**, y la sección cerraba ordenando «avisar de los tres». Corregido en §4 como CORRECCIÓN 5: la lista **se mide de git en cada ejecución**; la tabla conserva sólo el **porqué** de cada divergencia, que es lo único que ninguna medición da.

**2. Mandé al agente a la sección equivocada:** «LEDGER §4 (decisiones D1–D13)». §4 tiene **D1–D10**; D11–D13 los escribí yo en §2n. Lo encontró por `grep`.

**3. El punto 1 de `stage4/PROPUESTAS.md` no es implementable como está escrito.** Pide registrar el id retirado «con su sucesor o con `null`», pero `replaceRetired` mapea **toda** lista declarada de skills por esa tabla, así que un `null` aterrizaría en los ids que recorren `.rsc.json`, el estado por destino y el recibo de onboarding. Hoy todos los valores son cadenas y ésa es la invariante. Expresar «desapareció sin sucesor» exige tocar `replaceRetired` **y** su copia en línea en `targets/clone-bootstrap.mjs`, que un test mantiene equivalentes. El agente **propuso en vez de escribir** en archivos que no eran suyos, que es lo correcto. Queda como tarea mía.

**4. Detalle del ledger:** la «Verificación de cumplimiento de §1» imprime `epoch 1793495013 = Oct 31 19:03:33`, que en **UTC** es **Nov 1 01:03:33**. Rendering local contra UTC; el epoch es el dato. Importa porque esa tabla es la que se cita para afirmar que nada del usuario se tocó.

### Defectos que sus propios tests le encontraron a su propio código

Los registro porque son la prueba de que la puerta muerde, y porque el primero es **la misma clase de vacuidad** que la revisión de la Etapa 4 encontró en el instrumento del criterio 4, descubierta de forma independiente el mismo día: **`gateVerdict([])` devolvía `pass`** — «ninguna obligatoria falló» es verdad de una puerta que no corrió. Ahora comprueba **cobertura antes que resultado**. Además: `--check` **no hacía fetch** por parecer de sólo lectura, así que habría informado «no hay cambios» con la referencia rancia — respuesta equivocada con forma de correcta, y **la primera corrida real acertó por casualidad**; el merge se pasaba como objeto de opciones y la evidencia desaparecía del veredicto; y un `isAncestor(base, upstreamHead)` **que no podía fallar nunca**, sustituido por la mecánica honesta (un rebase de upstream sólo es visible contra una base registrada).

### Acceso verificado sin revelar secretos, y un hallazgo de aislamiento

```
git -c credential.helper= -c credential.interactive=false -c core.askPass= \
  ls-remote --heads https://github.com/ericrisco/rsc-harness.git refs/heads/main → EXIT 0
```

**Redirigir `HOME` no quita el helper de credenciales:** `git config --show-origin --get-all credential.helper` → `file:/usr/local/etc/gitconfig osxkeychain`, es decir el gitconfig **del sistema**, fuera del alcance de `.fork-tmp/env.sh`. Por eso cada invocación lleva el helper vacío en la línea de comandos y `GIT_ASKPASS`/`SSH_ASKPASS`/`GIT_CREDENTIAL_HELPER` eliminados del entorno, y el aislamiento se afirma **sobre la orden y el entorno calculados**, no sobre el éxito de un fetch. Es un refinamiento real de la restricción §1 del usuario, que hasta hoy se creía cubierta sólo con `HOME`.

**Comprobado por mí:** `~/.claude` tiene mtime **Nov 1 18:16** y `settings.json` **Oct 31 19:03**, ambos anteriores a estas corridas (07:24–08:05 UTC del 2 de noviembre). La configuración real del usuario no se tocó.

### No verificado, registrado (§7)

**NV-E5-1** el `fetch` del flujo contra `github.com` (habría movido `refs/remotes/upstream/main` con otra etapa trabajando en paralelo; el **acceso** sí está verificado y el fetch contra fixture ejercita el mismo código) · **NV-E5-2** la suite completa (L7) · **NV-E5-3** `eval-lint` (L2, y está en `NEVER_RUN` con su motivo) · **NV-E5-4** la fase `publish` con `--promote` (habría fusionado en `main`; sí se verificó **la puerta**) · **NV-E5-5** la release de npm · **NV-E5-6** G7 sobre la superficie **viva** tras el commit de la Etapa 6.

### Tareas que me quedan de esta etapa

Cablear la puerta permanente (`scripts/gate.js`, de la Etapa 6) dentro de `GATE_CHECKS` como comprobación obligatoria **sólo** bajo autorización `publish` — el agente no la cableó porque no era su archivo y no conocía su cobertura real, que es la decisión correcta; hacer expresable «retirada sin sucesor» en `scripts/lib/retired-skills.js` y su copia en línea; y acreditar `Executive-Lab/conectores-pymes` en el README **si y cuando** se integre 3.7.5.

---

## 2q. Revisión independiente de la Etapa 5 — APROBADA CON CORRECCIONES (3 ALTA, 6 MEDIO, 10 BAJO)

Revisor distinto, worktree desechable de `0ddd309`, sin red, sin suite completa, mutaciones revertidas y cierre comprobado.

### Lo que verificó y resultó cierto, que es mucho

**Reprodujo el 22/22 por su cuenta** (§2p sólo decía «según el agente»). **La cuenta de ocho divergencias es exacta** y la lista coincide carácter por carácter con la CORRECCIÓN 5. **3.7.5 es exactamente lo descrito:** dos commits, los tres archivos de atribución presentes, subárboles 2 → 3, y **el catálogo sigue en 274 en ambas revisiones, así que la premisa de D14 se sostiene**. **G6 bloquea** esa integración con un mensaje que nombra los tres avisos. **La reanudabilidad aguanta en las cuatro propiedades**, incluida la que más importa: probó **cuatro formas distintas de corromper el diario** —truncado, JSON válido sin una fase, vacío y borrado— y las cuatro dan error en vez de «no hay ejecución»; *«no encontré forma de que un resume se salte una fase inacabada ni de que reutilice una medición rancia»*. **No hay camino por el que un merge limpio incline el veredicto.** **El aislamiento de credenciales es cierto**, verificado sin leer ninguna credencial. Y **`~/.claude` intacto**, corroborado por tercera vez.

### A2 — la violación más grave de la sesión, porque es la restricción §1 del usuario incumplida por código que se entrega

`scopedConformance`, en el motor de la puerta, usa `mkdtempSync(join(tmpdir(), 'rsc-gate-proj-'))`. **Sin `TMPDIR` definido eso es `/tmp` literal**, y corre en `phaseGovern` y en G3/G4/G5, es decir en **toda** ejecución de la puerta. El colmo es que el propio archivo excluye `eval-lint` de su lista `NEVER_RUN` con el motivo *«writes to a literal /tmp outside the dedicated folder (limit L2, REQUIREMENTS §1)»*: la etapa conocía la regla, la escribió, y su motor la incumple. Y **`MAINTENANCE.md` no menciona `TMPDIR`, `HOME` ni `env.sh` en ninguna parte**, así que quien ejecute `npm run upstream:maintain` como el documento enseña escribe fuera de la carpeta dedicada **creyendo lo contrario**. Mitigante medido que no exime: `applyInstall` recibe `home` explícito y `install-apply.js` no llama a `homedir()` ni una vez, así que `~/.claude` era inalcanzable. **Corrección en marcha.**

### A1 y A3 — la vacuidad otra vez, y en el mismo sitio conceptual

**A1:** `divergenceSurface` devuelve `{ok:false, …, modified:[]}` ante un fallo de git, y **ni `phaseClassify` ni G7 leen `.ok`** nunca. El `||` no salva porque **`[]` es truthy**. Resultado medido: `G7 → PASS "0 divergence(s) intact"` sobre una medición que falló — y el informe imprime entonces *«collisions: none — upstream did not touch the fork's divergence surface»*: **una tranquilidad falsa, impresa**.

**A3:** no existe ningún test que afirme que cada una de G1–G12 **falla sobre un árbol donde su propiedad es falsa**. El que parecía serlo es de **forma** (que cada check tenga `run()`, un título largo y un `kind` válido). Con un contexto vacío, **seis pasan**, porque **una entrada ausente es indistinguible de una entrada que midió cero**. Y hay una mitad **vacua por construcción**: en el fallback de G7, `unprobed = files.filter(f => !DIVERGENCE_PROBES[f])` sobre `files = Object.keys(DIVERGENCE_PROBES)` es **necesariamente `[]`**.

**Es el mismo hallazgo que la revisión de la Etapa 4 hizo sobre el otro instrumento, en una etapa que lo tenía escrito en su propio informe.** Tres instrumentos de este proyecto —el del criterio 4, la puerta de mantenimiento y, dentro de ella, `gateVerdict`— han tenido la misma clase de defecto: **una comprobación que no puede fallar informa lo mismo que una que pasa**. La lección operativa ya no es «lee el código»: es **muta el instrumento antes de creerle un verde**.

### M2 — las dos obligaciones que ningún código puede decidir se levantan con una cadena libre

El comentario de `runGate` afirma que los *acknowledgements* vienen del diario *«never from a flag typed at the moment of being blocked»*. **Es falso:** vienen de `--ack` en argv, **nada lee `state.decisions`** (`decisionFor` está exportada y nadie la llama), el bucle que los registra está **dentro del `if (resumeId)`** así que una corrida fresca no deja rastro, y no se valida nada: `--ack G6="anything at all"` → **PASS G6**. Las dos cosas que la puerta reserva al juicio humano —un deber de atribución de licencia y la evaluación semántica obligatoria— se despachan con cualquier texto que ni tiene que aparecer en la evidencia.

### M1 — el diario commiteable lleva el entorno del usuario dentro

Rutas absolutas en `state.json` y `report.md`, y en `evidence/impacted-tests.json`, escrito verbatim desde `G8.measured`, **el valor de `GIT_CEILING_DIRECTORIES`**. Sin credenciales (`redactUrl` cubre remotos y stderr), pero en un directorio pensado para commitearse en un repositorio destinado a publicarse. Es la respuesta a la pregunta que puse en el encargo del revisor —*«¿qué escribe `evidence/` ahí dentro?»*— y salió rentable.

### El resto, aceptado

**M3** las correcciones acotadas nunca se commitean y `publish` promueve una rama que no las contiene, con la fuerza de un veredicto anterior a esa escritura. **M4** fallar a medias deja el repo en la rama de mantenimiento, sin restaurar, y `.rsc-upstream/` no está gitignorado. **M5** la superficie se mide por **rango de commits**, así que una divergencia del árbol de trabajo es invisible (8 contra 9 medidos); la lógica de G7 es sana, el fallo está en la entrada. **M6** G8 pasa sin correr nada si la enumeración falla. **B7** `ATTRIBUTION_RE` es ciego a `NOTICE`, `COPYING`, `LICENCE` — y **Apache-2.0 §4(d) obliga a propagar `NOTICE`**, con material Apache-2.0 ya dentro del fork: latente hoy, pero es una obligación legal y se cierra. **B1** la mitad «rename» de G9 es una tautología sobre una constante escrita a mano: sólo detecta que alguien edite el literal. Y confirmó por grep lo que importaba de esa clase: **no existe ninguna rama de código que re-aloje una personalización** — la propiedad se cumple, es decidible y no está instrumentada.

**Dos correcciones mías, aplicadas arriba en §2p:** «165 pruebas impactadas» son **18 archivos** y 165 casos (el `detail` de la puerta dice `18 file(s): 165 passed`, así que leí mal mi propio instrumento); y «una modificación» son **seis archivos** modificados y **una** skill.

---

## 2r. Etapa 6 — Identidad, distribución y recuperación (entregada, pendiente de revisión independiente)

`docs/fork/stage6/{DISTRIBUTION.md,DESIGN.md,VERIFICATION.md}` (1 111 líneas), `scripts/gate.js`, `scripts/lib/conformance.js` y `tests/governance-{identity,recovery,gate,doctor}.test.js` (61 tests). 56 archivos modificados, 8 nuevos, invariante en **0**.

### Verificado por mí
Identidad: `@lema017/rsc-governed`, `bin: {rscg, rscg-install}`. D15 aplicada (`files` excluye `scripts/upstream-*`). **61/61, 0 fallos, 0 cancelados.** El instrumento del criterio 4 re-ejecutado: **`failures: 0`**, y ahora con el campo que faltaba — **17 destinos × 274 `symlink`** y cursor × 274 `cursor-mdc`. **La frase de `CONTRACT.md` §1 sobre «17 de 18» era inferencia desde la Etapa 1 y ya es una medición.** Y las rutas de licencia: **nueve**, y aquí me equivoqué en el motivo, no en el número. Escribí que el agente «dijo diez barriendo un árbol de pruebas»; **inventé esa causa**. La revisión de la Etapa 6 la corrigió: su diez salió de un **predicado distinto** — nueve bajo `skills/` más el `LICENSE` de la raíz. Pero su predicado es el equivocado, y el revisor fue demasiado generoso al declarar los dos conteos buenos: tres de sus nueve son `ip-trademark/references/ownership-and-licensing.md`, `open-weights/references/licenses.md` y `terms-conditions/references/notices-and-aup.md`, que abrí uno por uno — son **contenido de skill que enseña sobre licencias**, no artefactos de atribución de código de terceros. El conjunto de obligaciones es **nueve**.

### El hallazgo que más vale de la etapa
**El paquete padre vivía DOS veces en `targets/auto-update.mjs`, y ningún test heredado toca ninguna de las dos** porque todos cortocircuitan con `RSC_LATEST`/`RSC_AUTO_UPDATE_CMD`. Un fork que las hubiera dejado **habría pasado la suite entera e instalado el padre encima del fork en segundo plano**. Por eso sus tests afirman uno sobre la **fuente** y otro sobre la **copia instalada**. Es §10 literal: *«evitar reinstalar accidentalmente el padre»*.

Y dos defectos heredados que encontró de paso: `release.yml` daba `contents: write` + `id-token: write` a un job de sólo lectura, y el `! grep` de `ci.yml` **convertía el exit 2 de grep en PASS**.

### D16 — los comandos sugeridos dejan de nombrar al padre. Decisión mía; implementación en marcha

La etapa **paró y me escaló** el defecto, en vez de romper la invariante medida de otra etapa en una ronda paralela. Fue la decisión correcta y lo fijó con un test para que no derivara. El defecto, verificado por mí: `skills/` nombra al padre **81** veces, **10 en `skills/suggest/SKILL.md`** —el cuerpo **always-on**, reemitido en cada SessionStart— y una de ellas es `npx @ericrisco/rsc add <id>`, **ejecutable**. Un consumidor del fork que la obedezca instala el CLI **del padre**, cuyo instalador escribe una base **sin contrato**: no es cosmético, **de-gobierna el proyecto en silencio**.

Lo decide la especificación, no yo. §10, palabras del usuario: *«Revisa actualizador, hooks, bootstrap, recuperación, **comandos sugeridos**, documentación y workflows **para evitar reinstalar accidentalmente el padre**»*. Y `PLAN.md` §3 ya había asignado la respuesta: *«el renombrado de identidad forma parte de la misma transformación»*.

**El mecanismo que decido:** una **segunda transformación declarada, acotada a tokens** —`@ericrisco/rsc` → `@lema017/rsc-governed`, nunca a `rscg`, porque `npx <especificador>` funciona en cualquier proyecto y `rscg` exige el binario en PATH—, aplicada en la instalación a la base gobernada y al cuerpo always-on, **sin tocar `skills/`**. No se reescriben `rsc` como palabra, `.rsc/`, `.rsc.json`, `RSC_*`, los marcadores `rsc-governance:` ni `ericrisco/mem-slop`, que es otro proyecto.

**Las dos invariantes que cruza se REFORMULAN, no se tiran**, y ésta es la parte que me toca justificar. (a) `stripGovernance(transform(x)) === x` se parte en dos: el **bloque** sigue siendo aditivo y reversible, y la **reescritura de identidad** es idempotente y **exactamente enumerable** — invertir el mapa recupera los bytes de upstream carácter por carácter, lo que es una afirmación **más fuerte** que la vieja, no más débil. (b) «el cuerpo always-on es byte-idéntico al prístino» pasa a «igual al prístino **tras el mapa de identidad**, sin bloque, con el delta de bytes medido y acotado». **El motivo por el que esa invariante existía sobrevive intacto:** era el **coste** —no pagar 785 B de preámbulo en cada SessionStart, que es lo que haría inmedible G3— y aquí el delta son diez sustituciones de un token por otro. Si saliera del orden de cientos de bytes, la decisión se revisa.

**Criterio 13 queda registrado como «dos tercios verificados, un tercio abierto»** y no como ✅: el mecanismo de actualización está verificado limpio, la activación también, y «nada instruye a reinstalar el padre» **no se cumple hasta que D16 aterrice**.

### Lo que sólo puede hacer el usuario
**Las Actions del fork están desactivadas** (`{"enabled":false}`, 0 workflows registrados, comprobado y no supuesto). Sin eso **no hay provenance de npm** —exige *«a supported cloud CI/CD provider and a cloud-hosted runner»*— y **no hay Trusted Publishing**, que es OIDC desde dentro de un workflow. `release.yml` está **listo y no puede correr**. Dato que decide la recomendación: **Trusted Publishing genera provenance automáticamente** desde GitHub Actions, así que habilitarlas entrega las dos cosas y permite **retirar el `NPM_TOKEN`**; la vía CircleCI excluye provenance y sería media respuesta. §10 pide las dos *«cuando sean compatibles»* y *«documenta cualquier limitación»*, así que ambas salidas son conformes: habilitarlas, o dejarlas desactivadas y declarar la limitación. **Pendiente de decisión del usuario.** El 2FA es ajuste de cuenta y queda **no verificado** (NV-6a): `npm profile get` con el `HOME` del sandbox da `E401`, que es el aislamiento funcionando y no un hallazgo sobre la cuenta.

**Nada publicado:** ni `publish` ni dry-run autenticado. `@lema017/rsc-governed` → **404**, el nombre está libre.

### Un dato para la Etapa 5
**La superficie de divergencia pasa de 8 a 51 archivos** con esta etapa dentro. Su diseño se auto-corrige porque la mide en vez de escribirla, pero el coste del merge mensual sube. `skills/` sigue byte-idéntico, que es donde está el volumen.

### No verificado (§7), nueve con su motivo
**NV-6a** 2FA · **NV-6b** provenance real · **NV-6c** Trusted Publishing · **NV-6d** que el artefacto publicado instale limpio (`npm pack --dry-run` probó el **tarball**: `@lema017/rsc-governed@3.7.4`, 1 792 archivos, `docs/` ausente — **no es la misma afirmación**) · **NV-6e** los tres workflows corriendo · **NV-6f** la rama Windows del audit de entregas, escrita y **nunca ejecutada** · **NV-6g** la regla 14 · **NV-6h** recall project↔skill · **NV-6i** la suite completa sobre este árbol, que **no incluye** los cuatro archivos nuevos de esta etapa.

---

## 2s. Revisión independiente de la Etapa 6 — APROBADA CON CORRECCIONES (1 ALTA, 7 MEDIO, 6 BAJO)

Worktree desechable de `0b74176`, mutaciones restauradas desde copias byte a byte, árbol principal intacto, cierre comprobado. Dos correcciones (A1, M1) tienen que aterrizar **antes de cualquier `npm publish`**; ninguna bloquea la etapa como trabajo.

### A1 — la superficie de §10 era más ancha que el barrido, y el README viaja en el tarball

El barrido de la etapa estaba acotado por construcción a `scripts/ targets/ tests/ schema/ .github/ package.json`, y su test `gi03` recorre esas mismas rutas. **Fuera quedaron `README.md`, `site/`, `SECURITY.md` y `package-lock.json`** — y no están congelados por nada: la invariante de la Estrategia B es `skills/` y sólo `skills/`. Medido: **142 referencias al padre** en rutas rastreadas y libremente editables (`site/index.html` 45, `site/es/index.html` 45, **`README.md` 26**, `site/llms.txt` 10, `site/sitemap.xml` 8, `package-lock.json` 2, `SECURITY.md` 1).

Y lo demostró **empaquetando e instalando** el paquete en un proyecto desechable, que es la única forma de que esto no sea una inferencia: el `README.md` está en la raíz del tarball, con **diez líneas `npx @ericrisco/rsc…` ejecutables**, un `npm i -g @ericrisco/rsc`, y la frase «`package.json` is named `@ericrisco/rsc`», que hoy es **falsa**. Ese README es además **la página de npm** del paquete y el archivo que un consumidor lee en `node_modules`. `site/` agrava en especie, no en grado: lo despliega `pages.yml`, **`site/llms.txt` es el archivo de instrucciones para agentes** («Run: `npx @ericrisco/rsc@latest onboard`»), y `site/assets/rsc.js` hace `fetch` a la API de GitHub **del repositorio padre**, así que el sitio del fork mostraría las estrellas del padre.

**Atenuante justo, y lo acepto:** `PLAN.md` asigna «README, imágenes y documentación» a la **Etapa 7**, así que el *trabajo* no era de la Etapa 6. La *declaración* sí: su `DISTRIBUTION.md` afirma que L-D5 es «the one open item that bears directly on §10», y eso es **falso** — es uno de dos. Queda para la Etapa 7, ampliado: el README y `site/` entran en el alcance de D16 por extensión, y el barrido tiene que cubrir **toda** ruta rastreada fuera de `skills/` para que no pueda volver a perderse.

### M1 — `npm run gate` salía con 0 cuando una comprobación no podía correr. Corregido por mí.

Incluida **la que es la invariante de la Estrategia B**. Medido por el revisor: en una copia sin `.git`, `SKIP skills-invariant` → `6/7 passed, 1 skipped` → **`GATE_EXIT=0`**. Y peor: `runChild` devolvía `skip` cuando el script no existe, así que **borrar un validador lo convertía en SKIP y el gate pasaba**. Con `prepublishOnly` siendo `manifest && gate`, una publicación desde un clon shallow, desde un árbol derivado del tarball o desde cualquier clon sin `origin/main` **se salta la invariante del espejo y publica**. La afirmación del documento («A check that cannot run prints `SKIP`, never `PASS`») era cierta sobre la **etiqueta** y falsa sobre el **contrato**, que es el código de salida.

**Arreglado y verificado por mí, con el experimento del propio revisor:** un validador ausente es ahora `fail` («a check that cannot be found is a failed check, not a skipped one»), y un `skip` llega al código de salida salvo `--allow-skip` explícito. Medido: la misma copia sin `.git` que daba 0 ahora da **1**, y el gate sobre este árbol sigue en **0** porque aquí no hay skips.

### M2 — el suelo del catálogo no es un suelo, y el test que lo guarda no puede fallar

El suelo compara `manifestCount !== ids.length`, y **los dos lados salen del mismo `skills/`** porque `manifest.json` se genera de él; `--expect` es opcional. Medido: borradas 5 skills y re-ejecutado `build-manifest.js` —que es lo primero que hace `prepublishOnly`— sale `ids.length = 269 | manifestCount = 269 | floor failures = []`. Y `gg24` afirma **cadenas del código fuente**, así que con el suelo mutado a `manifestCount < 0` sigue verde.

**Es la cuarta aparición de esta clase de defecto en la sesión, y esta vez está dentro de una corrección de la Etapa 4.** El literal `274` no desapareció: **se mudó a la línea de comandos del operador** (`--expect 274`, escrito a mano en el documento), donde un número equivocado u omitido es silencio. Dato valioso del revisor: lo que sí atrapó todas las truncaciones que intentó fue `drift:check`/`validate`/`manifest:check`, porque **no hay ninguna skill huérfana** (0 de 274 sin referencias entrantes), así que quitar un directorio completo rompe algún enlace de prosa. Pasado al agente que posee hoy ese archivo.

### M3–M7, aceptados

**M3** `restore --dry-run` calla precisamente la consecuencia por la que existe el aviso de D13: todo el bloque está dentro de `if (!dry)`, medido con la misma instantánea (0 líneas en dry-run, el aviso en el restore real). Y el dry-run es justamente la herramienta para decidir si restaurar. **M4** `gr11` —el único test con las palabras «leaves no partial state»— **no puede fallar**: borrando el rollback entero sigue verde, porque inyecta el fallo en el primer `apply` y entonces no hay nada escrito. Pero el revisor **ejecutó el caso duro** (fallo tras instalar el primer target completo) y **la propiedad se sostiene**: residuo 6, y los seis son **directorios vacíos**, 0 cambiados, 0 eliminados, sin recibo aceptado. **M5** la regla 12 de brownfield dispara con frases que **niegan** («this project does not disable any guard, ever») y calla con tres paráfrasis llanas que sí piden desactivar una guarda: dos regex independientes sin tratamiento de la negación, y con severidad `error`, así que un informe correcto tumba la puerta. **M6** «el paquete padre vivía **dos** veces en `auto-update.mjs`» es **falso**: vivía **cuatro**. La afirmación sustantiva sobrevive —dos son de la clase peligrosa y ningún test heredado las toca— pero quien haga el grep obtiene 4. **M7** «evita carreras» de §10 no se aborda en ningún documento (`grep` → 0); el mecanismo existe heredado (`AUTO_RUNNING_MS`, `auto-update.json`), así que es hueco de verificación y de declaración, no defecto.

### BAJO, y dos que son regalos

**B1** `package-lock.json` sigue declarando `"name": "@ericrisco/rsc"`; comprobó que `npm ci` no se rompe. **B6** el `manifest:check` de `prepublishOnly` es **vacuo por composición**: regenera `manifest.json` y luego comprueba el archivo que acaba de escribir — con el efecto colateral de que una publicación puede enviar un manifest distinto del commiteado sin dejar registro. **B3** la tabla de limitaciones del documento de producto está **roto en Markdown** (una tabla anidada entre dos filas rompe el resto).

**B4 — dos cosas declaradas NO VERIFICADAS sí eran verificables sin tocar la cuenta del usuario, y las verificó.** La corrección del `! grep` de `ci.yml`: la corrió en sus tres estados —árbol limpio, residuo plantado, y el `grep` apuntado a una ruta inexistente— y **funciona**, incluido el caso que la motivaba (exit 2 de grep → fallo, no PASS). Y la **identidad, versión e integridad del artefacto**, que §10 pide literalmente y que nadie había ejecutado: `npm pack` → `npm install ./lema017-rsc-governed-3.7.4.tgz` → `added 7 packages`, `node_modules/.bin/{rscg,rscg-install}` presentes, `rscg --version` → **`rscg 3.7.4`**, exit 0. **Pasa**, y es además cómo demostró A1. Eso saca a NV-6d de «no verificado» en su mitad local.

### Lo que intentó romper y no se rompió
Re-ejecutó **A1 y A2 por su cuenta** sobre un catálogo de 5 skills: las dos fallan y **por la razón correcta** (255 hallazgos nombrando «the delivery is a COPY, not a symlink», `kindsPass1` → `{"copy":5}`; y «DUPLICATE: 2 opening markers in the .mdc» con `cursor deliveredPass1: 0` mientras `claude` sigue en 5), y el conteo **puede** salir distinto, así que se computa. **D13 en las dos direcciones por el CLI real:** dispara con su motivo cuando la base vuelve sin gobernar, y con dos syncs seguidos **no dice nada** y `conformance` sale 0 — **ni ruido ni silencio donde importa**, que es la pregunta que decide si D13 sirve. **Ningún camino mecánico instala el padre encima del fork**: `auto-update`, `clone-bootstrap` (el archivo que se commitea en cada repo consumidor), `upgrade.js` y 79 cadenas `npx` nombran todas al fork. **Los únicos caminos que quedan son instruccionales**: el cuerpo always-on (D16) y el README (A1). Y recorrió una instalación real de 32 skills: de 400 ocurrencias del padre, **todas son contenido congelado del catálogo** salvo el always-on y la excepción declarada de terceros.

---

## 2t. D16 — los comandos sugeridos dejan de nombrar al padre (implementada)

### Las cinco mediciones, reproducidas por mí

| Medida | Resultado | Mi comprobación |
|---|---|---|
| Referencias al padre **en la entrega** | **0** — las 81, no sólo las 10 | sí |
| Delta del cuerpo always-on | **7 280 → 7 350 B, +70 B** (10 sustituciones × 7 B) | sí, byte a byte |
| La inversión del mapa recupera upstream | **byte a byte**, sobre el **árbol** del catálogo (1 679 archivos): 26 archivos, 81 sustituciones, **0 no recuperados** | sí |
| Idempotencia (criterio 5) | byte-idéntica, 0 derivas | vía el instrumento |
| Instrumento del criterio 4 | `failures: 0`, always-on 7 350 B, `carriesGovernance: false`, `namesParent: 0` | sí |

El delta de **+70 B** es lo que decide que la decisión era correcta: la invariante de byte-identidad del always-on existía por **coste** —no pagar 785 B de preámbulo en cada SessionStart, que es lo que haría inmedible G3— y 70 B no se parece a eso. Si hubiera salido del orden de cientos, la decisión se revisaba; lo puse por escrito en el encargo y el agente lo afirmó con una guarda que cita la regla de revisión.

### Las dos invariantes, reformuladas y más fuertes que antes

La transformación ahora **quita la gobernanza primero y aplica el mapa después**, así que los bytes del bloque nunca pasan por el reescritor y el digest sigue siendo demostrablemente función de `renderBlock(id)` y de nada más. Las dos propiedades quedan separadas porque son de distinta naturaleza: el bloque es **aditivo**, el mapa es **sustitutivo**, y «aditivo y reversible» no puede describir a un sustitutivo. Compuestas: **`invertIdentity(stripGovernance(transform(x))) === x`**, que fija a la vez que nada más cambió y **cuánto** cambió.

### Lo que el agente hizo mejor que mi encargo

**`governBase` cubre ahora la base materializada entera, no sólo `SKILL.md`.** Lo deduje mal yo: `ensureBase` copia el **directorio** de la skill, así que `references/` y `evals/` también se entregan, y ahí viven **32 de las 81** — con `init/references/recommend-skills.md` solo en **15**. Una entrega cuyo `SKILL.md` está limpio mientras el archivo que le dice al agente que abra no lo está **cumpliría la letra de §10 y perdería su sentido**. Los archivos que no son `SKILL.md` reciben sólo el mapa, y lo que no round-trippea por UTF-8 se salta en vez de decodificarse.

**Y la historia de la mutación es la mejor lección de la sesión sobre su propia lección.** Su primera mutación del instrumento era **inválida**: plantar el cuerpo prístino en `.rsc/governance/always-on.md` hacía fallar a `claude` —cuyo gancho lee esa ruta— y **pasar a `cursor`**, porque el `.mdc` de Cursor se escribe en la instalación, así que sobrescribir la **fuente** no toca la **superficie**. En sus palabras: *«a mutation that does not change what the instrument looks at proves nothing about the instrument»*. Re-ejecutada contra el archivo que `alwaysOnSurface()` lee de verdad en cada destino: **5 de 5 pasan a no conformes**, cada uno con archivo y línea, y cada uno con `carriesGovernance: false` para que sólo la clase bajo prueba pueda ser lo que disparó. Esa mutación es ahora un test, con una aserción de que el fixture cambió **para que la trampa no se pueda volver a tender**.

### La excepción de `gi03`, concedida por mí como propiedad comprobada

El agente **se paró** donde le dije y me escaló lo único que no podía resolver: `gi03` falla nombrando `scripts/lib/governance.js`, porque `PARENT_PACKAGE = '@ericrisco/rsc'` **es el token de origen del mapa**. La regla ya excepciona `scripts/lib/upstream-*.js` porque *«su trabajo es BUSCAR el nombre del padre»*; este módulo es el que lo **reescribe**. Rechazó las dos alternativas con razón: construir el token por fragmentos **esconde la única cadena que un mantenedor necesita grepear**, y renombrar el módulo para caer bajo la excepción existente sería activamente falso, porque `gi14` afirma que esos archivos **no** se envían y un mapa que se necesita en la instalación sí tiene que enviarse. Antes de escalármelo **redujo el radio**: `conformance.js` también lo disparaba desde un comentario, así que reformuló el comentario y me dejó **una** excepción que conceder en vez de varias.

**La concedí como propiedad comprobada, no como hueco:** en ese módulo el padre puede aparecer **sólo** en su declaración y en comentarios, nunca en código. Y mi primera versión de esa comprobación **falló sobre un comentario** que cita `npx @ericrisco/rsc add <id>` para explicar el defecto. Un comentario no se ejecuta: el impreciso era mi predicado, así que lo **acoté** en vez de relajarlo. **15/15.**

### Tres afirmaciones mías que resultaron falsas

**1. `tests/md-block-fidelity.test.js` NO afirma `stripGovernance(transform(x)) === x`.** Prueba `wireHook`/`unwireHook` de `targets/_md-block.js` contra el marcador `rsc-suggest:start` — otro bloque, otro módulo, y no menciona `stripGovernance`. La invariante vive en **`tests/governance-base.test.js`**. Y el origen importa: **el error es heredado de `docs/fork/stage6/DESIGN.md` §2, y yo lo repetí en el encargo sin abrir el archivo.** Es exactamente el patrón que esta sesión lleva registrado desde el principio — afirmar lo que hace un archivo sin abrirlo —, esta vez propagado de un documento a un encargo.

**2. El defecto del suelo del catálogo está en `scripts/verify-catalog-conformance.js`, no en `scripts/lib/conformance.js`**, que no tiene suelo, ni `manifestCount`, ni `--expect`. Le dije el archivo equivocado; lo arregló donde estaba. El suelo nuevo lee `manifest.json` del **object store de git en `origin/main`** —un blob commiteado, no un archivo del árbol— así que truncar `skills/` y regenerar no lo mueve: con 269 encontradas contra 274 commiteadas lo **nombra**. Un catálogo que **crece** no es truncación, así que integrar upstream no lo dispara. Y `gg24` pasa a ser **conductual**, probado por mutación.

**3. El «142» de `README.md`/`site/` cuenta el token desnudo `ericrisco`, no el especificador.** Como especificadores son **51**: `README.md` 18, `site/index.html` 13, `site/es/index.html` 13, `site/llms.txt` 4, `package-lock.json` 2, y **`sitemap.xml` 0** y **`SECURITY.md` 0**. Mi total tampoco cuadraba con mi propio desglose, que suma **137**. Y la consecuencia es de fondo para la Etapa 7: **los aciertos que sólo existen en el token desnudo son otra clase de renombrado** — `ericrisco.github.io/rsc-harness/` y `github.com/ericrisco/rsc-harness`, el host de Pages y la URL del repositorio de upstream. Un mapa sobre la palabra desnuda los convertiría en **404**, que es la trampa de mem-slop otra vez. **Especificador y URL son dos decisiones distintas.** Dato que además acota: `README.md` viaja en el tarball, **`site/` envía 0 archivos**.

### Lo que sigue abierto, y es de la Etapa 7
`README.md` (18 especificadores, **10 líneas `npx` ejecutables**, un `npm i -g` y la frase «`package.json` is named `@ericrisco/rsc`», hoy falsa) y `site/llms.txt`, que instruye a **agentes** a ejecutar al padre. El test negativo de D16 barre el **proyecto consumidor instalado**, así que no los ve — y el agente lo declara en vez de dejar entender que su cambio deja la superficie limpia.

### No verificado
La suite completa (L7; corrió ~310 tests en los archivos que tocan las superficies cambiadas), `eval-lint` (L2), el barrido 274×18×3 del instrumento (corrió la **misma biblioteca de auditoría** sobre instalaciones completas de 274 para `claude` y `cursor`, o sea las dos familias de entrega incluida la única re-renderizada; **los 16 destinos restantes y las pasadas 2–3 quedan sin verificar**), la rama Windows (L5), y un flake preexistente de `tests/auto-update.test.js` bajo paralelismo que pasa 17/17 en aislamiento y con `--test-concurrency=1`.

---

## 2u. Correcciones de la Etapa 5 — aplicadas (código verificado, commit diferido)

**El commit va detrás a propósito:** la ronda de sondas de intención está editando ahora mismo `scripts/lib/upstream-gate.js`, `tests/governance-upstream-maintenance.test.js` y `docs/fork/stage5/DESIGN.md`, y commitear un archivo a medio escribir es la clase de error que esta sesión lleva castigando. Se commitea cuando esa ronda cierre.

### La disciplina que quiero que quede registrada como ejemplo
Verificó **cada** corrección contra el código anterior **antes** de tocarlo: copió `HEAD:` de los cuatro módulos a un directorio aparte y ejecutó las aserciones nuevas contra ellos. **19 de 19 fallan pre-fix**, con la salida literal `PRE-FIX FAILS ✓` en las diecinueve. Eso es lo que convierte «añadí un test» en «añadí un test que detecta el defecto», y es la respuesta correcta a la lección que la sesión aprendió cuatro veces.

### A2 — la violación de §1, cerrada. Comprobado por mí
`SCRATCH_DIR = .rsc-upstream/tmp`, derivado del árbol auditado. Mis comprobaciones: **ninguna llamada real a `tmpdir()`** en el módulo (sólo aparece en el comentario que explica por qué **no** se usa), **`node:os` ya no se importa** (`grep -c "from 'node:os'"` → 0), y `.gitignore` lleva `.rsc-upstream/`. La segunda mitad también está hecha, que era la que más me preocupaba: `MAINTENANCE.md` abre ahora con **«The environment the run must have»** —`. ./.fork-tmp/env.sh`, tabla variable por variable con su motivo— y dice las dos cosas que no son obvias: que la puerta **ya no depende de `TMPDIR`**, y que **redirigir `HOME` no desactiva el helper de credenciales del gitconfig del sistema**.

### Dos cosas que arregló y la revisión no vio

**1. El defecto de A1 existía en seis comprobaciones más.** La frase del revisor —*«una entrada ausente es indistinguible de una entrada que midió cero»*— no afectaba sólo a G7: sin `classification`, G3/G4/G9/G10/G11 calculaban alcance vacío y decían «no skill was added or modified by this change»; sin `attribution`, G6 caía a un literal y decía «no notice changed». Medido: **antes pasaban 12 de 12** con un contexto vacío; **ahora 4 de 12**, y las cuatro que pasan (G1, G2, G5, G12) pasan porque **no reciben ninguna medición** — leen el árbol ellas mismas. Un test fija ese conjunto exacto.

**2. `runTests` no era parseable desde dentro de un proceso de test.** Node elige reporter por `NODE_TEST_CONTEXT`, así que un hijo lanzado desde `node --test` emite el protocolo interno y `parseTap` devolvía `null` en **todos** los contadores: **la puerta medía «`null` pasados de `null` pruebas»**. No se había visto nunca porque G8 jamás se había llamado desde un test. Arreglado con `--test-reporter=tap` explícito y borrando `NODE_TEST_CONTEXT` del entorno del hijo. Es el mismo género que el resto de la sesión —un instrumento que informaba sin medir— y lo encontró solo.

Y **un bug que se introdujo él y cazó**: `renderReport` hacía `v.verdict.verdict` sin guarda y `validate` ahora puede fallar **antes** de calcular veredicto. Guarda, sección «**NOT RUN** — the phase stopped before any check ran», y test propio.

### G7 falla hoy sobre la superficie viva, y eso es lo correcto
`DIVERGENCE_PROBES` sigue con 8 entradas y la superficie son **51 modificados / 25 añadidos**, con **43 sin sonda** (verificado por mí: 51 y 25). G7 lo denuncia, que es su trabajo. **Se negó a ampliar la tabla**, y con razón: *«ampliarla habría sido inventar intenciones»*. Una sonda equivocada da falsa tranquilidad, que es exactamente el defecto A1 que acababa de corregir. Lanzada una ronda dedicada a escribir las 43 sondas leyendo el diff real de cada archivo, con la instrucción de **declarar los que no sepa interpretar** en vez de inventarlos.

### Dos imprecisiones de la revisión, las dos de cifra
**«seis pasan» en A3, seguido de una lista de ocho ids: ni seis ni ocho — pasaban las doce.** Medido sobre el código pre-fix. La conclusión del hallazgo era **más fuerte** que su número. Y el «8 contra 9» de M5 era cierto cuando se midió; hoy son 51/52. La lógica era exacta, la aritmética era de aquel momento.

### Lo que NO corrigió, y por qué está bien
La lista de acciones manuales que `remediate` deriva de la puerta es **inalcanzable**: el bucle de fases hace `if (out.status !== 'done') break`, así que si `validate` bloquea, `remediate` nunca corre, y su recorrido de los fallos sólo se alcanza con veredicto `pass`, que no tiene ninguno. La información no se pierde —la tabla de la puerta imprime cada FAIL con su detalle— pero esas pistas no se emiten. **Arreglarlo exige cambiar el control de flujo de las fases, o sea arquitectura**, así que no lo tocó y lo registró. Correcto: una ronda de correcciones no rediseña.

### Cifras
Su archivo: **49/49** (eran 22), dos corridas consecutivas, 0 cancelados. Los doce `tests/governance-*.test.js`: 172 tests, **170 pasan, 2 fallan**, y **los dos fallos son de otras rondas en vuelo**, atribuidos por mtime y por el contenido del fallo (`gi03` por los comentarios nuevos de `governance.js`, y `gg25` quejándose **de sí mismo** porque el archivo se editó durante la corrida). Lecturas desgarradas de ediciones concurrentes, no regresiones — y `gi03` ya está verde tras conceder su excepción. `~/.claude` intacto por cuarta comprobación independiente.

---

## 2v. Correcciones de la Etapa 6 — aplicadas, con 13 mutaciones que muerden

**Y una corrección mía primero, de proceso:** el commit `09854e5`, cuyo mensaje describe D16 entero, **llevó sólo el ledger y `governance-identity.test.js`**. El código de D16 —`governance.js`, `install-apply.js`, `conformance.js`, `verify-catalog-conformance.js`, los tres tests de gobernanza, los documentos de la Etapa 1 y el contrato regenerado— se quedó sin commitear en el árbol de trabajo, y yo le dije al usuario que estaba commiteado. Va en el commit de esta sección. El mensaje de un commit no es evidencia de su contenido: `git show --stat` sí.

### Verificado por mí
`prepublishOnly` es ahora **`npm run gate`** a secas · `package-lock.json` con **0** apariciones del padre y renombrado en la raíz **y** en `packages[""]` · mi corrección de `gate.js` **intacta** · `npm run gate` → **7/7, EXIT 0**.

### Lo que arregló, y cómo lo demostró
**13 mutaciones ejecutadas, las 13 muerden**, cada una restaurada y comprobada `cmp` byte a byte. La que mejor resume la etapa es la de **A1**: un barrido sobre **toda** ruta rastreada fuera de `skills/` (341 rutas), con lista de excepciones **fechada** y dos conteos por ruta, y una aserción que **obliga a vaciarla** —una entrada a cero pone el test rojo—, más la mutación de `git ls-files` roto que exige *«a FAILED check, not a passed one»*. **Encontró su propio archivo de test en la primera corrida.**

**M3:** el aviso de D13 sale de `if (!dry)`, y en dry-run audita **los bytes que guarda la instantánea** (`snapshotSkillBases()` nuevo, con el mismo `auditBase`). La mutación es la buena: auditar el proyecto en vez de la instantánea **no pasa**, porque la base instalada sí está gobernada — así que el arreglo débil queda descartado por medición.

**M4:** `gr11` reescrito a dos destinos, el primero instalado **de verdad** (32 skills, 138 rutas gobernadas), el fallo inyectado en el **segundo**, y comparación del árbol posterior al rollback contra el anterior a la transacción. Con `restoreBackup` neutralizado, **384 de 384 rutas residuales son estado real**; sin mutación, residuo **6** y los seis son directorios vacíos **nombrados**. Matiz que añadió y la revisión no: `.rsc` sólo está vacío **si se excluye `.rsc/backups/`**, y la exclusión es correcta —la instantánea es el artefacto de recuperación— pero ahora está **escrita en el test** en vez de escondida en un filtro.

**M5:** eligió **tratar la negación y declarar el recall** en vez de bajar la severidad, y el argumento es el correcto: el nivel 1 de precedencia **no es negociable desde un artefacto de proyecto**, así que un intento declarado debe seguir parando la puerta y lo que se va son los falsos positivos. Una sola definición exportada compartida por las dos reglas, con escaneo de negación hacia atrás. Medido: 4 negaciones que disparaban ya callan, 4 intentos siguen disparando, y **3 paráfrasis siguen siendo hueco declarado y fijado** (`L-D11`, y `NV-6j`: el recall no está medido **ni es medible**).

**M7:** los tres guardas contra carreras, qué los implementa y **lo que no cubren**, con un test que cuenta **lanzamientos** (1→1→1→2) y una mutación que quita el guarda en vuelo. Con su límite declarado (`NV-6k`): las sesiones corren **en secuencia**, no concurrentes de verdad.

**B6:** `prepublishOnly` deja de ser `manifest && gate`, así que el manifiesto **se comprueba antes de que nada lo regenere** — el defecto era vacuidad por composición. Y `gg26` **expande la cadena desde `package.json`** y la ejecuta sobre un catálogo truncado, en vez de afirmar sobre el texto del script.

### Los dos regalos del revisor, reproducidos y convertidos en tests
El `! grep` de `ci.yml` **sale de no verificado**: `gg27` **extrae el bloque de shell del propio `ci.yml`** y lo ejecuta en tres estados — limpio → 0, residuo → 1, y `chmod 000` → grep exit 2 → **1**, con el mensaje «a check that cannot run is not a pass» —, con mutación que lo pone rojo y con el `PATH` fijado porque el `grep` de esta máquina es ugrep. Y la **identidad, versión e integridad del artefacto**, que §10 pide literalmente: `npm pack` (1 792 archivos, shasum registrado) → `npm install --offline` → `added 7 packages`, `rscg` y `rscg-install` enlazados, **`rscg --version` → `rscg 3.7.4`**. **NV-6d queda reducida a su mitad de registro.**

### Lo que corrigió de la revisión, y de mí
El **142 es correcto** como total del token desnudo (11 rutas, medidas), pero **su desglose publicado listaba 7 de 11 y sumaba 137** — así que mi observación de que no cuadraba era buena y la causa es un desglose truncado, no un error de medición. Mi propio desglose omitía además `site/diagram.svg`, de ahí el 50 contra 51. Y el dato nuevo que importa para la Etapa 7: de las 89 URLs, **dos por página en el JSON-LD son `https://github.com/ericrisco`, el perfil del autor**, que es **atribución MIT** y no se toca. El marco que yo corregí sí era el problema: mezclar especificadores con URLs y pasar un mapa sobre la palabra desnuda habría hecho 404s **y borrado atribución**.

Y **B2 era peor de lo que decía la revisión**: el archivo tenía 15 tests **ya en `0b74176`**, así que la corrida publicada estaba caducada **el día de la entrega**, no derivó después. La re-ejecutó: 15/15.

### Lo que NO corrigió, y está bien
El contenido de `README.md`, `site/`, `SECURITY.md` y `site/assets/rsc.js` es de la **Etapa 7**; hizo sólo la declaración y el barrido que lo fija por ruta y por clase, con la lista que la Etapa 7 vaciará. Y **qué URLs pasan a ser del fork**: es una decisión, no un renombrado, y queda enumerada para tomarla una por una.

### Cifras
`governance-{recovery,gate,doctor}` → **54/54, 0 fallos, EXIT 0** (8 tests nuevos, `gr11` reescrito) · `governance-identity` → **15/15** sin tocarlo · red de la etapa **69 tests, 0 fallos** · vecinos de lo tocado (`backups`, `apply`, `governance-customization`, `governance-upstream-change`, `rsc-cli`, `public-surface`) → **127/127, 0 fallos**.
