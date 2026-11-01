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
  - **`PREAMBLE-v1.txt`** — el preámbulo canónico, medido: **779 B de plantilla, 772–797 B renderizado** (nombre de skill más corto `go`, 2 caracteres; más largo `source-grounded-development`, 27), **~209 KB sobre las 274**, es decir ~+4 % sobre un tarball de 5,3 MB. Tres claves **planas** de frontmatter (`governance`, `governance-customization`, `governance-digest`), planas por F17. El digest existe para que una inyección **parcial o manipulada** sea detectable, que es lo que convierte el «0 parciales» del criterio 4 en algo comprobable.
  - **`EVALUATION.md`** — presupuesto de ~600 ejecuciones. **Hecho nuevo medido:** las 274 skills **ya** traen `evals/cases.yaml` (claves `skill`, `capability`, `should_trigger`, `should_not_trigger`) con **3 175 prompts** (~11,6 por skill), pero miden **enrutamiento, no gobernanza**; y correrlos una vez contra **un** asistente costaría **3 175 ejecuciones, 5,3 veces el presupuesto completo** (47 625 con cinco asistentes y N=3). Consecuencia: el corpus heredado se consume con un comprobador determinista y **cero** ejecuciones de agente, y el presupuesto compra un corpus nuevo y pequeño. Diseño: 6 conductas × 5 asistentes × 6 skills estratificadas = **180 celdas** × N=3 = 540 ejecuciones, **60 de reserva** para las celdas con veredicto 2-1 elevadas a N=5. Y la limitación dicha con números: con 90 observaciones y 0,95 observado, el IC al 95 % es de **±4,5 puntos**, así que un 95 % observado respalda «≥ 90 %», **no** «≥ 95 %».
  - **`ACCEPTANCE.md`** — los 16 criterios con instrumento, comando y condición de paso falsable, clasificados en determinista / evaluación / inspección. **Dos ya cumplidos** (1 y 2). **Criterio 6 con instrumento verificado y línea base:** `npm pack --dry-run --json` da **1 782 archivos, 5,3 MB**, y las **ocho** obligaciones de licencia viajan en el tarball — `LICENSE`, `skills/design/engine/{LICENSE,UPSTREAM.json}`, `skills/design/{THIRD_PARTY.md,IMPECCABLE-LICENSE.txt}`, `skills/ux/upstream/UPSTREAM.json` y los dos `LICENSE` de `ux-designer` y `ux-usability-foundations` — más 274 `SKILL.md` y 274 `cases.yaml`. (Corrección de un error del coordinador: buscó esos artefactos en la raíz del repo y concluyó que no existían; están anidados dentro de `skills/`, que sí entra en `package.json.files`.) **Criterio 13 con limitación real registrada:** la ida y vuelta por el registro de npm no se puede verificar sin publicar, y publicar para probar no es aceptable — se reporta como «verificado contra tarball local, no contra registro».
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
