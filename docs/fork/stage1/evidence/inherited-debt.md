# Deuda heredada de validadores — y dónde pueden correr las puertas

**Etapa 1 · evidencia medida · 2026-11-01**
Repositorio: `/Users/home/Development/rsc-harness-fork` · rama `fork/bootstrap` · HEAD `a3d287c` · versión upstream 3.7.4 · 274 skills.

Este documento responde seis preguntas con medición propia. Todo lo marcado **[EJECUTADO]** se midió en esta sesión; todo lo marcado **[LECTURA]** es inferencia de código sin ejecución; todo lo marcado **[NO VERIFICADO]** no se pudo comprobar sin romper una restricción, y se dice qué haría falta.

---

## 0. Método, aislamiento y lo que no se ejecutó

### Aislamiento aplicado a todo proceso del repositorio

```
HOME=.fork-tmp/home
XDG_CONFIG_HOME=.fork-tmp/home/.config
XDG_DATA_HOME=.fork-tmp/home/.local/share
npm_config_cache=.fork-tmp/npm-cache
TMPDIR=<scratchpad de sesión>/tmp
```

`TMPDIR` se dirigió al scratchpad de la sesión en lugar de a `.fork-tmp/tmp` **a propósito**: la línea base de la suite completa está escribiendo ahí ahora mismo (1 649 entradas en `.fork-tmp/tmp` durante esta sesión) y un segundo escritor habría contaminado exactamente la medición de concurrencia que esa corrida existe para aislar.

`git status --porcelain` vacío al inicio y al final. Ninguna configuración modificada: no se habilitó Actions, no se instaló ningún hook, no se editó ningún workflow, no se tocó ningún `settings.json`.

### Lo que NO se ejecutó, y por qué

| No ejecutado | Motivo |
|---|---|
| `npm test` / `node --test` | Prohibido explícitamente: línea base de 2 h en curso |
| `npm install` | Prohibido explícitamente |
| `npm run coverage` (`c8 … node --test`) | Envuelve `node --test` |
| `scripts/eval-lint.sh` por su **rama con python3** | Escribe `/tmp/eval-lint.$$.err` (`scripts/eval-lint.sh:192`, `:203`), es decir **fuera de la carpeta dedicada**. Se reprodujo la misma condición por la rama sin python3, que no escribe nada (ver §3) |
| `scripts/skill-behavior-eval.workflow.js`, `skill-harden.workflow.js`, `skill-scoreboard.workflow.js` | Consumen ejecuciones de agente de la sesión anfitriona (`agentType`), no son deterministas |
| Estado real de GitHub Actions en el remoto | Requiere credenciales/red. **[NO VERIFICADO]**: se toma como dado del usuario. Haría falta `gh api repos/lema017/rsc-harness/actions/permissions` con una sesión autenticada |

### Divulgación honesta — una ejecución que no debí hacer

Al barrer el inventario ejecuté `node scripts/design-upstream.js`. **Ese script hace tres GET a `api.github.com`** (`scripts/design-upstream.js:27-28`, `:37`, `:42`, `:47`) para comparar dos repos de terceros. Fue una llamada **sin autenticar**: el entorno no contenía ninguna variable de credencial (comprobado: la única variable que coincide con `^(GITHUB|GH|NPM|NODE_AUTH|TOKEN|API)[A-Z_]*=` es `API_TIMEOUT_MS`) y `HOME` estaba redirigido a `.fork-tmp/home`, así que ni `~/.gitconfig` ni credenciales de `gh` eran alcanzables. No se expuso nada. Aun así **viola la restricción de «servicios externos»** y lo registro como tal; su consecuencia de diseño está en §5: `design:upstream` queda descartado como puerta precisamente por esto.

---

## 1. Veredictos en una tabla

| Comprobación | Veredicto | Motivo de una línea |
|---|---|---|
| `validate` (`build-manifest.js --validate`) | **adoptar como puerta** | Determinista, 0 fallos, ya en dos workflows; lo único que verifica hoy el frontmatter de las 274 |
| `manifest:check` | **adoptar como puerta** | Determinista, detecta manifest rancio; es el único guardián de la entrada de `routing:audit` |
| `drift:check` (catálogo) | **adoptar como puerta** | Determinista, 886 enlaces, 0 fallos |
| `originality:check` | **adoptar como puerta** | Determinista y offline (huellas fijadas en `schema/ecc-originality.u64`); hoy sólo corre en `release` |
| `eval-lint.sh` | **arreglar primero** | Falla en abierto por diseño (`warned_skip` no toca el código de salida) y su dependencia es una instalación global prohibida por §1. Arreglado no crea deuda: **0 de 274 fallarían** |
| `routing:audit` | **arreglar primero** (y rebajar a informe mientras tanto) | Rojo por **2 casos de 1 339** y con `top-5` exactamente en el suelo (margen 0). Mide ruido con la misma sensibilidad que señal |
| `drift:knowledge` | **arreglar primero** | Vacuo por construcción: su sujeto está en `.gitignore:34`. Además depende de `HOME` |
| `knowledge:doctor` | **arreglar primero** | Vacuo por el mismo motivo; sale 0 en la línea 52 antes de comprobar nada |
| `spec:gate` | **arreglar primero** | Vacuo por el mismo motivo; «no specs found» y retorno sin fallo |
| Puerta de limpieza de `ci.yml` | **arreglar primero** | `! grep` convierte el error de escaneo (exit 2) en PASS. Comprobado por ejecución |
| `reviewer-guard.sh` | **descartar** | Apunta a `plugins/rsc-review/agents`, que no existe ni existió en este fork; su doctrina no vive en ningún archivo del repo |
| `design:upstream` | **descartar como puerta** | Red obligatoria contra dos repos de terceros; su veredicto cambia sin que cambie este repo |
| `audit.js` | **descartar como puerta** | Consultivo por diseño declarado (`scripts/audit.js:1-4`): «never a hard error» |
| `skills/*/scripts/verify.sh` (189) | **descartar como puerta del fork** | Artefacto distribuido al proyecto del consumidor, no comprobación de este repo; fail-open declarado |
| `npm test` (1 537 tests) | **adoptar, pero no como puerta de iteración** | 2 h 17 min: sirve de puerta de release, nunca de hook |

---

## 2. Pregunta 1 — `routing:audit`

### 2.1 Qué mide exactamente **[EJECUTADO + LECTURA]**

`scripts/routing-audit.js` no evalúa ningún modelo. Construye el **ranker determinista** de `scripts/consult.js:153-179` y le pasa cada prompt de los ficheros `skills/<id>/evals/cases.yaml` (`routing-audit.js:29`).

El ranker suma dos señales, ambas calculadas **sólo** sobre `id`, `tags` y `description` del manifest:

- un marcador exacto por término (`consult.js:190-204`): id idéntico +20, id contiene +8, tag +10/+3, descripción contiene +1;
- TF-IDF coseno sobre un corpus donde el `id` pesa ×3 y los `tags` ×2 (`scripts/lib/text-rank.js:69-80`), con `LEXICAL_WEIGHT = 100` (`consult.js:118`).

El manifest se lee de `manifest.json` (`scripts/lib/manifest.js:7-9`), que `build-manifest.js:27-36` genera copiando **exclusivamente** `fm.description`, `fm.tags`, `fm.recommends` y `fm.profiles` del frontmatter. **El cuerpo del `SKILL.md` no entra en ninguna de las dos rutas.** Este hecho es el eje de la respuesta de §2.5.

Cinco suelos, en `routing-audit.js:11-17`:

| Suelo | Qué mide | Dónde se evalúa |
|---|---|---|
| `rank1: 44` | % de prompts `should_trigger` donde la skill dueña sale en posición 1 | `:144` |
| `top5: 70` | lo mismo, en las 5 primeras | `:145` |
| `routedTop5: 85` | **la cifra en rojo**: de los `should_not_trigger` cuyo `route_to` es **un único id real del catálogo**, % en que ese destino aparece en el top-5 | `:146-148` |
| `maxNegativeSelfRank1: 6` | % de negativos donde la propia skill dueña sale en posición 1 (máximo) | `:149-151` |
| `maxCollision: 0.80` | coseno máximo entre dos descripciones del catálogo | `:152-154` |

El filtro de `routedTop5` está en `singleCatalogRoute` (`:62-66`): descarta `none`, `external:*`, y todo valor con `,`, `|` o `" or "`. De 1 365 negativos, **1 339 califican**.

### 2.2 Cifra actual y margen real **[EJECUTADO]**

```
routing-audit: 274 skills · 3169 prompts
positive recall: rank-1 44.7% · top-3 63.9% · top-5 70.0%
negative owner-at-1: 4.3% · declared route top-5 84.9% · route beats owner 87.2%
FAIL: declared-route top-5 84.9% < 85%
exit 1 · 24 s (máquina cargada por la línea base; 11,7 s en reposo según el ledger)
```

Conteos exactos y márgenes, medidos llamando a `auditRouting()` directamente:

| Suelo | Necesita | Tiene | **Margen** |
|---|---|---|---|
| rank-1 ≥ 44 % | 794 / 1 804 | 806 | **+12 prompts** |
| top-5 ≥ 70 % | 1 263 / 1 804 | 1 263 | **0 prompts** |
| ruta declarada top-5 ≥ 85 % | 1 139 / 1 339 | 1 137 | **−2 casos** |
| dueño-en-1 negativo ≤ 6 % | ≤ 81 / 1 365 | 59 | +22 casos |
| colisión < 0,80 | — | 0,737 | +0,063 |

**Dos hechos de primer orden para tu decisión:**

1. La puerta está roja por **2 casos de 1 339** (0,15 pp).
2. `top-5` está **exactamente en el suelo**: una sola regresión en un prompt positivo pone en rojo un segundo criterio.

### 2.3 Qué entradas concretas fallan **[EJECUTADO]**

202 casos fallan `routedTop5`. Distribución de la posición del destino declarado entre los 1 339 casos enrutados:

| Posición del destino | Casos |
|---|---|
| 0 | 730 |
| 1 | 225 |
| 2 | 101 |
| 3 | 53 |
| **4 (último que aprueba)** | **28** |
| 5 | 27 |
| 6–19 | ~90 |
| ≥ 20 | ~44 |
| **no clasificado en absoluto** | **40** |

Los 28 casos en posición 4 son el colchón entero: cualquier cambio que meta **un** competidor por delante en esos 28 hunde la cifra sin que nada haya empeorado conceptualmente.

**Destinos declarados que más fallan** (nº de casos en que no llegan al top-5):

`secure-coding` 14 · `social-publisher` 13 · `automation-flows` 9 · `postgresdb` 8 · `analyze` 7 · `debug` 7 · `deployment` 7 · `analytics` 5 · `review` 5 · `content-engine` 4 · `design` 4 · `llm-pipeline` 4 · `seo-geo` 4.

**Skills dueñas que más rutas rotas declaran:** `ftd` 5 · `backups`, `continuous-learning`, `cost-tracking`, `forecasting`, `no-code-app`, `observability`, `security-scan`, `tidy`, `unslop`, `variant-explorer`, `viral-score` 3 cada una.

**Casos representativos** (`dueño → destino [posición] "prompt"` · top-5 realmente devuelto):

```
automation-strategy -> secure-coding   [107] "How do I rotate and store the API keys my flow uses securely in code?"
                                             got: fastapi, api-connector-builder, make, automation-flows, gamedev-shipping
calendar-scheduling -> automation-flows [82] "When a booking is created, also create a CRM record, post to Slack…"
                                             got: spreadsheet-ops, calendar-scheduling, google-workspace, decision-records, fundraising
backups             -> secure-coding    [59] "Rotate the KMS key we use for encryption at rest and manage key access."
backups             -> postgresdb       [36] "Set up cross-region read replicas to reduce read latency…"
api-connector-builder -> automation-flows [29] "Chain Gmail to Sheets to Slack into one automated if-this-then-that workflow."
accessibility       -> secure-coding  [n/c] "Sanitize this user input to prevent XSS."
                                             got: unity, kpi-framework, ux, prompt-engineering, connect-tool
clarify             -> debug          [n/c] "Checkout throws a 500 in production sometimes — figure out why."
                                             got: stripe, shopify, sales-funnel, youtube-thumbnails, cold-outreach
connect-tool -> automation-strategy   [n/c] "¿Merece la pena automatizar la conciliación bancaria…?"  got: (vacío)
```

Dos patrones de causa, legibles en el código:

- **El marcador exacto domina por léxico de superficie.** `secure-coding` falla 14 veces porque los prompts de seguridad dicen «API keys», «KMS», «sanitize», y el `+8` por id-contiene (`consult.js:198`) premia a `api-connector-builder` y `fastapi`. La palabra «secure» casi nunca aparece en el prompt.
- **El ranker devuelve lista vacía.** `consult.js:169` corta en seco si `maxExact < 2` y `maxLexical < 0.08`; con un prompt en español sin términos de catálogo (`connect-tool → automation-strategy`) el resultado es `[]`, y un destino que no está en una lista vacía cuenta como fallo igual que un destino en la posición 107. El medidor no distingue «mal clasificado» de «no clasificado»: son 40 casos de los 202.

### 2.4 ¿Está cableado en algún workflow? **No. [EJECUTADO]**

- No aparece en `ci.yml`, `pages.yml` ni `release.yml` (grep sobre los tres).
- **Tampoco lo cubre la suite.** `tests/routing-audit.test.js` tiene tres tests y ninguno evalúa los suelos: `:7-12` sólo exige `cases.length >= 2996` (hoy 3 169) y que exista alguna ruta a `scaling`; `:14-29` evalúa `auditRouting()` contra un manifest de juguete de dos skills; `:31-53` exige top-5 para los positivos de cinco skills nominadas. **El 84,9 % no lo asserta nada en todo el repositorio.**

### 2.5 Lo decisivo: ¿la gobernanza sube o baja esa cifra?

**Respuesta medida: ni la sube ni la baja. No la mueve en absoluto — ni un caso.**

#### La prueba, con los artefactos reales de Etapa 1 **[EJECUTADO]**

Apliqué a las 274 skills la transformación que define tu propio contrato: el preámbulo literal de `docs/fork/stage1/PREAMBLE-v1.txt` inyectado en el **cuerpo** (`docs/fork/stage1/CONTRACT.md:15`) más las tres claves planas de frontmatter de `CONTRACT.md:26-36` (`governance`, `governance-customization`, `governance-digest`), y comparé la entrada de manifest resultante con la actual:

```
skills transformadas: 274
entradas de manifest que CAMBIAN: 0
claves de frontmatter ilegibles para el parser del repo: 0
descripción más larga tras la transformación: 659 caracteres (sin cambio)
bytes añadidos por skill: ~884 · total 236,4 KB
```

**0 de 274.** La cifra de `routing:audit` queda bit a bit idéntica: 1 137/1 339 = 84,91 %, roja.

#### Por qué, razonado sobre lo que el script mide de verdad

1. El preámbulo va al **cuerpo**, y el cuerpo no entra en el manifest: `build-manifest.js:29-35` copia cinco campos y ninguno es el cuerpo.
2. Las tres claves nuevas **sí** entran en el frontmatter, pero `build-manifest.js` no las mapea, así que no llegan al manifest ni al corpus.
3. Las claves nuevas **no rompen** `validate`: `schema/frontmatter.schema.json:1-12` no declara `additionalProperties: false`. (Hallazgo colateral que tu contrato depende de él: si alguien «endurece» ese esquema, el preámbulo rompe `validate`.)
4. Los documentos de personalización por skill viven en `02-DOCS/wiki/skills/<nombre>/README.md` (`docs/fork/stage1/CUSTOMIZATION-SCHEMA.md:4`), que está en `.gitignore:34`. No son archivos del catálogo, no tienen `SKILL.md`, y `routing-audit.js:29` sólo abre `skills/<id>/evals/cases.yaml`.

Dicho sin rodeos: **`routing:audit` no mide enrutamiento de skills, mide el poder discriminante de 274 cadenas `description` contra 3 169 prompts fijos.** El nombre engaña. La gobernanza, tal como la diseñaste, es invisible para ese medidor.

#### Pero esto es lo que SÍ la movería — y es la advertencia que importa **[EJECUTADO]**

Medí seis contrafactuales sobre el mismo ranker y los mismos 3 169 prompts, variando sólo de dónde sale el texto de gobernanza:

| Variante | rank-1 (≥44) | top-5 (≥70) | ruta top-5 (≥85) | colisión máx (<0,80) | Veredicto |
|---|---|---|---|---|---|
| **A. línea base** | 44,7 % | 70,0 % | **84,91 %** | 0,737 | ROJO |
| B. frase de gobernanza de 84 car. **añadida a las 274 descripciones** | 44,7 % | 70,0 % | **85,14 %** | 0,731 | **VERDE** |
| C. preámbulo de 256 car. añadido a las 274 descripciones | 44,5 % | 70,1 % | **85,36 %** | 0,728 | **VERDE** |
| D. frase de gobernanza **que nombra el id de la skill** | **43,1 %** | **69,0 %** | **84,47 %** | 0,748 | ROJO (×3) |
| E. el mismo preámbulo de 256 car. **anteponiéndolo** | 44,5 % | 70,1 % | 85,36 % | 0,728 | VERDE |
| F. personalización como **+274 entradas de catálogo** | **30,7 %** | **61,0 %** | **76,33 %** | **0,998** | ROJO (×4) |
| G. personalización como **+27 entradas de catálogo** | **43,3 %** | **68,5 %** | **84,32 %** | **0,984** | ROJO (×4) |

Tres conclusiones de diseño:

- **La puerta es más sensible al ruido que a la señal.** Pegar la **misma** frase irrelevante a las 274 descripciones (B) sube la cifra 0,23 pp y pone la puerta en **verde**. No mejoró el enrutamiento de nada: cambió la norma de cada vector. El IDF de `text-rank.js:88` es `log(1 + 274/(1+274)) ≈ 0,69` para un término presente en las 274 — **nunca llega a cero**, así que el texto compartido sí entra en el coseno y penaliza más a las descripciones cortas que a las largas. Una puerta cuyo veredicto lo decide eso no es una puerta determinista útil: es determinista y *arbitraria*.
- **La única variante de gobernanza que empeora la cifra es la que nombra la skill.** D (`…see 02-DOCS/wiki/skills/<id>.md for the <id> rules…`) repite el id dentro de la propia descripción, refuerza el auto-emparejamiento de cada skill y por tanto hace que **el dueño le gane más veces a la ruta declarada** — y los negativos son exactamente los casos donde el dueño debe perder. Baja a 84,47 % **y además rompe `rank-1` y `top-5`**. Si en algún momento te planteas poner el puntero de personalización en la `description` en lugar del cuerpo: no lo hagas. Está medido.
- **Convertir la personalización en entradas del catálogo es catastrófico.** Con sólo 27 entradas extra (G) se rompen cuatro suelos, incluida la colisión a 0,984. Es la confirmación cuantitativa de que `02-DOCS/` (no `skills/`) es la raíz correcta para los documentos de personalización.

#### Consecuencia para la Etapa 1

`routing:audit` es una **puerta sobre el catálogo heredado**, no sobre la gobernanza. Adoptarla tal cual significa heredar un rojo de 2 casos que ningún cambio tuyo causó y que un cambio cosmético cualquiera puede volver verde o rojo. La forma honesta de adoptarla es cambiarle el contrato, no el umbral:

- separar «no clasificado» (40 casos) de «mal clasificado» (162): son defectos distintos y hoy se suman;
- fijar los suelos **contra la cifra medida del commit base** (una puerta de no-regresión: `≥ 1137` casos, no `≥ 85 %`), de modo que mida *tu* efecto y no la herencia;
- publicar las cinco cifras como informe en cada corrida, y hacer puerta sólo de la no-regresión.

---

## 3. Pregunta 2 — `reviewer-guard.sh`

### Qué hace **[LECTURA]**

`scripts/reviewer-guard.sh` recorre `$REPO_ROOT/plugins/rsc-review/agents/*.md` (`:13`, `:31`) y exige que cada archivo contenga seis encabezados literales (`:16-21`):

```
### Pre-report gate
### High and critical require proof
### Returning zero findings is acceptable
### Common false positives to skip
### No severity inflation
## Prompt defense
```

Es un guardián contra la erosión: si un agente revisor pierde su doctrina de filtrado de confianza, empieza a inventar hallazgos de baja confianza e inflar severidad.

### Si se invoca desde algún sitio: **no [EJECUTADO]**

- No es script de npm (`package.json:14-27`).
- No aparece en `ci.yml`, `pages.yml` ni `release.yml`.
- No hay ningún hook de git instalado (ver §7).
- El grep por `reviewer-guard` en todo el repo devuelve **sólo** el propio script y documentos del fork (`docs/fork/PLAN.md:106`, `docs/fork/LEDGER.md:331`, los informes de auditoría). **Cero invocadores ejecutables.**

### Estado medido **[EJECUTADO]**

```
$ bash scripts/reviewer-guard.sh
reviewer-guard: agents dir not found: /Users/home/Development/rsc-harness-fork/plugins/rsc-review/agents
exit 1   (0,1 s)
```

`plugins/` **no existe** en el repositorio. El script sale por `:23-26`, antes de leer ni un archivo. Está permanentemente rojo y permanentemente desconectado: las dos únicas condiciones bajo las que un guardián es inofensivo y useless a la vez.

### Qué haría falta para que significara algo

Lo primero no es cablearlo: es que **exista su sujeto**. Comprobé los seis encabezados contra todo el repositorio (excluyendo `docs/`): **ninguno** aparece en ningún archivo salvo el propio script, con dos coincidencias parciales — `"Common false positives to skip"` en `skills/review/SKILL.md` y `"No severity inflation"` en `skills/code-review/SKILL.md` y `skills/review/SKILL.md`. Es decir: la doctrina que el guardián protege se migró al catálogo de skills con otra forma, y el guardián se quedó apuntando a un modelo de distribución (plugins de marketplace) que `ci.yml:24-31` se dedica precisamente a **prohibir que reaparezca**.

Para que significara algo harían falta, en este orden:

1. **Decidir cuál es el sujeto real.** Hoy los agentes revisores se definen en `targets/agents.js` y su doctrina vive en `skills/review/SKILL.md` y `skills/code-review/SKILL.md`. No hay directorio de agentes en markdown que recorrer.
2. **Reescribir las aserciones contra ese sujeto**, con los encabezados que realmente existen, no con los seis de 2025.
3. **Añadirle control negativo**, como exige la doctrina del propio repo (`skills/verify/SKILL.md:85-91`): un test que mutile un encabezado y verifique que el guardián se pone rojo. Sin eso, un guardián de *spellings* puede fallar en abierto por un cambio de redacción y nadie lo nota.
4. **Cablearlo** donde corresponda (§7).

**Recomendación: descartar.** Reconstruirlo cuesta lo mismo que escribir un guardián nuevo contra el sujeto real, y mantener en el árbol un script que sale 1 siempre enseña al equipo a ignorar salidas 1. Si se quiere la garantía, el camino es un test en `tests/` que asserte la doctrina presente en `skills/review/SKILL.md` y `skills/code-review/SKILL.md` — el mismo patrón que ya usan `tests/gate-honesty.test.js` y `tests/gate-honesty-debt.test.js`, que son exactamente este tipo de guardián hecho bien, con su limitación declarada en cabecera.

---

## 4. Pregunta 3 — `eval-lint.sh` falla en abierto

### Verificación por ejecución de que pasa saltándose los 274 casos **[EJECUTADO]**

Para no escribir fuera de la carpeta dedicada (la rama con python3 escribe `/tmp/eval-lint.$$.err`, `:192`/`:203`) reproduje la condición por la rama equivalente: mismo script, mismas 274 skills, con `python3` ausente del `PATH`.

```
$ env -i HOME=.fork-tmp/home TMPDIR=<scratchpad>/tmp … PATH=<shim-sin-python3> bash scripts/eval-lint.sh
eval-lint: scanning /Users/home/Development/rsc-harness-fork/skills
minimums: should_trigger>=5 should_not_trigger>=4 capability>=1
route_to must resolve: a catalog skill id, "none", or "external:<name>"

ab-testing             SKIP: python3/yaml unavailable — structural keys present, deep validation skipped
accessibility          SKIP: python3/yaml unavailable — structural keys present, deep validation skipped
… (274 líneas idénticas) …

scanned 274 skill(s); 0 failure(s)
WARNING: deep YAML validation was skipped for one or more skills (python3 or PyYAML unavailable).
RESULT: PASS
exit 0
```

**274 SKIP · 0 failures · RESULT: PASS · exit 0.** Confirmado. (Ninguna escritura en `/tmp`: el único `eval-lint.*.err` ahí es de las 11:01, de una sesión anterior.)

### El mecanismo exacto del fallo en abierto **[LECTURA, con las líneas]**

Cuatro eslabones, todos en `scripts/eval-lint.sh`:

1. **`:143-153` — el camino degradado devuelve éxito.** `validate_grep()` imprime `SKIP: …` y hace `return 0`. Comprueba sólo que existan las tres claves de nivel superior; no cuenta nada y no resuelve ninguna ruta.
2. **`:189-202` — se entra ahí también con python3 presente.** Si `import yaml` falla, el heredoc sale con 3 y escribe `NOYAML` (`:51-55`); el llamador lo detecta en `:195` y cae a `validate_grep`, poniendo `warned_skip=1` (`:201`). El mismo `warned_skip=1` se pone en `:209` cuando no hay python3.
3. **`:213-215` — el contador sólo mira `rc`.** `validate_grep` devolvió 0, así que `fail_count` no se incrementa. Nunca.
4. **`:220-230` — el aviso no toca el veredicto.** Se imprime `WARNING: deep YAML validation was skipped…` y acto seguido el veredicto se decide **sólo** con `fail_count`. `warned_skip` no aparece en ninguna condición de salida. Fin: `RESULT: PASS`, `exit 0`.

En una frase: **la variable que sabe que no se comprobó nada existe, se calcula correctamente, y está desconectada del código de salida.**

Y hay un segundo mecanismo, más grave para este fork: **la dependencia profunda es una instalación global**. Medido:

```
$ python3 -c "import yaml; print(yaml.__file__)"       # HOME real
/Users/home/Library/Python/3.13/lib/python/site-packages/yaml/__init__.py
$ HOME=.fork-tmp/home python3 -I -c "import yaml"      # aislamiento obligatorio de §1
ModuleNotFoundError: No module named 'yaml'
```

PyYAML vive en un *user site-packages* dependiente de `HOME`. Bajo la restricción «sin instalaciones globales» del propio fork, **la validación profunda de `eval-lint.sh` es inalcanzable por construcción**, y el script responde a eso pasando. Es la peor combinación posible: una puerta cuya ruta de comprobación real está prohibida por la política del repositorio y cuyo camino degradado dice PASS.

Esto contradice de frente la doctrina que el propio repositorio declara vinculante:

- `README.md:616`: «*A gate that checks nothing is worse than no gate.*»
- `skills/verify/SKILL.md:87`: «*The dangerous way a checker breaks is not a crash — it is **fail-open**…*»
- `skills/verify/SKILL.md:92` declara **un** fail-open conocido: el `SKIP` de los `verify.sh` de stack. El `SKIP` de `eval-lint.sh` es el mismo mecanismo y **no está declarado en ninguna parte**.
- `tests/gate-honesty.test.js:180` incluso **testea** que ese fail-open esté declarado… para los `verify.sh`, no para `eval-lint.sh`.

### Un detalle que cambia el coste del arreglo **[LECTURA]**

La suite **sí** detecta esta degradación, por accidente. `tests/eval-lint.test.js` ejecuta el script real contra catálogos de fixture y **tres** de sus cinco tests exigen `status === 1`: `:50` (ruta fantasma), `:66` (`external:` sin nombre) y `:74`/`:77` (rutas multivalor). En el camino degradado el script sale 0, así que esos tres tests se ponen **rojos**. Son exactamente los «3 fallos que son artefacto de aislamiento demostrado» que registra `docs/fork/LEDGER.md:312`. Traducción: bajo la propia política del fork, esos tres tests son **permanentemente rojos**, y lo son por una razón correcta.

Y el cuarto test, `:81-85` («the real catalog resolves every route_to»), exige `status === 0` — que es lo que el camino degradado devuelve. **Ese test también falla en abierto.**

### Qué tendría que asertar una comprobación que no fallara en abierto

En orden de valor:

1. **Que la comprobación profunda se ejecutó.** El veredicto debe depender de `warned_skip`: si hubo un solo SKIP, el resultado es FAIL (o, si se prefiere, un `--allow-skip` explícito que haya que escribir a mano y que quede en el log del workflow). Esto es una línea.
2. **No depender de ninguna instalación global.** Reimplementar el linter en Node, con el intérprete que el repositorio ya usa para todo lo demás. No hace falta un parser YAML completo: `routing-audit.js:25-56` ya lee estos mismos ficheros con expresiones regulares, y el formato de los 274 es uniforme.
3. **Las cuatro aserciones actuales**, de verdad: `should_trigger ≥ 5`, `should_not_trigger ≥ 4`, `capability ≥ 1`, y que cada `route_to` resuelva a un id real, `none` o `external:<nombre>`.
4. **La forma, no sólo el recuento** — esto es lo que falta hoy incluso en la ruta profunda. `count("capability")` (`:73-83`) sólo mide longitud de lista, así que una entrada `capability` con las claves equivocadas aprueba.
5. **Un control negativo versionado**, como exige `skills/verify/SKILL.md:85`: un fixture conocido-malo que debe poner la puerta en rojo, y un conocido-bueno que debe ponerla en verde. `tests/eval-lint.test.js` ya tiene la mitad buena de ese par; lo que falta es que el par corra sin PyYAML.

### El dato que hace el arreglo barato **[EJECUTADO]**

Reimplementé en Node las cuatro aserciones que `eval-lint.sh` **ya tiene**, y las corrí sobre las 274 skills:

```
=== A. aserciones que eval-lint.sh ya tiene (si PyYAML estuviera) ===
skills que fallarían: 0

=== B. aserciones que eval-lint.sh NO tiene (forma) ===
skills con defecto de forma: 3
  ux:                2/2 entradas capability sin scenario+must_include (inevaluables por el motor)
  variant-explorer:  2/2 idem
  viral-score:       2/2 idem

totales: should_trigger=1804  should_not_trigger=1365  capability=318
```

Dos consecuencias:

- **Arreglar el fallo en abierto no crea deuda.** Con las aserciones actuales, 0 de 274 skills fallan. La puerta se puede poner estricta hoy y queda verde hoy.
- **El único defecto real que hay es invisible para las aserciones actuales.** Las tres skills con `capability` malformada (`prompt:`/`why:` en lugar de `scenario:`/`must_include:`) pasan incluso la validación profunda, porque sólo se cuenta la longitud de la lista. Corrobora `docs/fork/LEDGER.md:359` y cuantifica el alcance exacto: 3 skills, 2 de 2 entradas cada una. Y `ux` es una skill del suelo por defecto.

Los recuentos `should_trigger=1804` y `should_not_trigger=1365` coinciden exactamente con los positivos y negativos que midió `routing:audit` por una vía independiente, lo que valida de forma cruzada ambas mediciones.

---

## 5. Pregunta 4 — Validadores vacuos

Tres pasan en un clon limpio porque su sujeto no existe. Pero la formulación «en un clon limpio» se queda corta: **`.gitignore:34` ignora `02-DOCS/`**, así que el sujeto de los tres **no puede estar commiteado nunca**. No son vacuos por casualidad de este commit: son vacuos en cualquier clon, de cualquier rama, para siempre, salvo que el fork cambie la política de ignorados o la raíz de documentación.

| Validador | `archivo:línea` del cortocircuito | Qué imprime y con qué salida **[EJECUTADO]** |
|---|---|---|
| `drift:knowledge` (`drift-check.js --knowledge`) | `scripts/drift-check.js:269` construye la lista de árboles; `:272` lanza `MissingRoot('no knowledge tree found (02-DOCS/wiki and auto-memory are both absent)')`; `:331-332` lo captura y lo degrada a un `console.log`; `:336` sale con 0 | `drift-check knowledge: skipped — no knowledge tree found (02-DOCS/wiki and auto-memory are both absent)` · **exit 0** |
| `knowledge:doctor` | `scripts/knowledge-doctor.js:20` fija `WIKI = 02-DOCS/wiki`; `:49-52` sale con `process.exit(0)` si no existe | `knowledge-doctor: no hay 02-DOCS/wiki/ — nada que auditar.` · **exit 0** |
| `spec:gate` | `scripts/spec-gate.js:14` fija `DEFAULT_DIR = 02-DOCS/wiki/sdd/specs`; `:172-175` imprime y hace `return` sin tocar el contador `failed` de `:240` | `no specs found — pass a path, or write one to 02-DOCS/wiki/sdd/specs/` · **exit 0** |

### Agravantes medidos

- **`drift:knowledge` además no es hermético.** `drift-check.js:210` y `:267` toman `home = homedir()` por defecto: el segundo árbol que busca es la auto-memoria de Claude Code bajo `HOME`. Su veredicto depende de la máquina. Bajo el aislamiento obligatorio lee `.fork-tmp/home`, que está vacío — que es *también* por qué sale vacuo aquí. En la máquina de otra persona con auto-memoria poblada, el mismo comando sobre el mismo commit puede dar otro resultado. **No es determinista en el sentido que necesitas.**
- **`spec:gate` declara su propia desconexión.** `scripts/spec-gate.js:2-4`: «*Report-only: it never edits a spec. Not wired into `prepublishOnly`, and that is deliberate: specs live under 02-DOCS, which is never…*». El autor sabía que el sujeto no es distribuible.
- **Es el área que el fork va a tocar.** La personalización por skill vive en `02-DOCS/wiki/skills/<nombre>/README.md` (`docs/fork/stage1/CUSTOMIZATION-SCHEMA.md:4`), dentro del árbol ignorado. Los tres validadores que podrían vigilar la salud de ese árbol son precisamente los tres que dan verde sin mirar.

### Un cuarto caso que la auditoría previa no clasificó como vacuo, y lo es

La **puerta de limpieza** de `ci.yml:24-31` también falla en abierto, y lo verifiqué:

```yaml
run: |
  ! grep -rIn -E "sync-bundles|\.claude-plugin/marketplace|/plugin install [^\"' ]*@rsc-skills" . \
    --exclude-dir=node_modules --exclude-dir=.git …
```

`grep` devuelve 0 (coincide), 1 (no coincide) y **2 (error de escaneo)**. El `!` invierte 0→1 y 1→0, pero **también 2→0**. Comprobado:

```
$ grep -q "x" /ruta-inexistente ; echo $?      → 2
$ if ! grep -q "x" /ruta-inexistente; then echo PASS; fi  → PASS
```

Un patrón mal escrito, un fichero ilegible o un `--exclude-dir` inválido ponen la puerta en verde sin haber escaneado nada. Es textualmente el caso que la doctrina del propio repo prohíbe en `skills/verify/SKILL.md:90`: «*A must-find-nothing grep has three outcomes, not two… The scan itself breaking = fail too.*» Arreglo: capturar el código de salida y tratar 2 como fallo.

Y hay un quinto, consultivo por diseño: `scripts/audit.js:1-4` dice de sí mismo «*Advisory only: every finding is a "review this", never a hard error*». Ejecutado, **no imprime nada y sale 0**. No es una puerta y no debe presentarse como tal.

---

## 6. Pregunta 5 — Inventario completo

### 6.1 Tabla

Determinismo: **D** = misma entrada, mismo veredicto, sin red ni modelo · **D\*** = determinista salvo una dependencia ambiental que se señala · **R** = depende de la red · **M** = depende de un modelo o de ejecuciones de agente.

| # | Comprobación | Definida en | ¿Workflow? | ¿Hook de git? | ¿Sólo a mano? | Det. | Estado medido |
|---|---|---|---|---|---|---|---|
| 1 | `npm run validate` | `package.json:16` → `build-manifest.js:78-119` | **sí** `ci.yml:14-15`, `release.yml:79-80` | no | — | **D** | exit 0 · 5 s · 139/274 sobre el techo blando de 350 car. |
| 2 | `npm run manifest:check` | `package.json:15` → `build-manifest.js:141-146` | **sí** `ci.yml:16-17`, `release.yml:81-82` | no | — | **D** | exit 0 · 5 s · 274 skills / 34 agentes / 53 comandos |
| 3 | `npm test` (`node --test`) | `package.json:24` | **sí** `ci.yml:18-19`, `release.yml:83-84` | no | — | **D\*** (TMPDIR, HOME, Chrome en 1 test) | **[NO EJECUTADO]** 1 537 tests · 2 h 17 min según `LEDGER.md:308` |
| 4 | `bash scripts/eval-lint.sh` | `scripts/eval-lint.sh` (no es script de npm) | **sí** `ci.yml:20-21`, `release.yml:85-86` | no | — | **D\*** (PyYAML global bajo `HOME`) | **274 SKIP · PASS · exit 0** — falla en abierto (§4) |
| 5 | `npm run drift:check` | `package.json:17` | **sí** `ci.yml:22-23` | no | — | **D** | exit 0 · 5 s · 886 enlaces, 4 no-claims |
| 6 | puerta de limpieza (grep inline) | `ci.yml:24-31` | **sí** (sólo ahí) | no | — | **D\*** (`! grep` tapa exit 2) | verde; fail-open comprobado (§5) |
| 7 | `npm run originality:check` | `package.json:23` | **sí** `release.yml:87-88` | no | — | **D** (huellas fijadas en `schema/ecc-originality.u64`) | exit 0 · 6 s · 82 documentos vs 93 337 huellas |
| 8 | `npm run prepublishOnly` | `package.json:27` | **sí, indirecto**: `release.yml:146-148` corre `npm publish` | no | también a mano | **D** | compuesto de 1+2+5+7 — **no** incluye 3, 4 ni `routing:audit` |
| 9 | **`npm run routing:audit`** | `package.json:21` | **NO** | no | **sí** | **D** | **exit 1 · 84,91 % < 85 %** (§2) |
| 10 | `npm run drift:knowledge` | `package.json:18` | **NO** | no | **sí** | **D\*** (lee auto-memoria bajo `HOME`) | exit 0 **vacuo** (§5) |
| 11 | `npm run knowledge:doctor` | `package.json:19` | **NO** | no | **sí** | **D** | exit 0 **vacuo** (§5) |
| 12 | `npm run spec:gate` | `package.json:20` | **NO** | no | **sí** | **D\*** (invoca `git` local, `spec-gate.js:28-33`) | exit 0 **vacuo** (§5) |
| 13 | `bash scripts/reviewer-guard.sh` | `scripts/reviewer-guard.sh` | **NO** | no | **sí** | **D** | **exit 1 permanente**, sujeto inexistente (§3) |
| 14 | `npm run design:upstream` | `package.json:22` | **NO** | no | **sí** | **R** — `api.github.com` ×3 (`design-upstream.js:37,42,47`) | exit 1 (dos repos de terceros se movieron) |
| 15 | `npm run coverage` | `package.json:25` | **NO** | no | **sí** | **D\*** | **[NO EJECUTADO]** envuelve `node --test` |
| 16 | `node scripts/audit.js` | `scripts/audit.js` | **NO** | no | **sí** | **D\*** (lee `~/.claude/skills`) | sin salida, exit 0 · **consultivo por diseño** (`:1-4`) |
| 17 | `node scripts/doctor.js` (`rsc doctor`) | `scripts/doctor.js`, bin `rsc` | **NO** | no | **sí** | **D\*** (depende de `HOME` y del clon) | **[NO EJECUTADO]** sale ≠0 desde 2.0.19 (`package.json` → `rscFixes`) |
| 18 | `node scripts/skill-behavior-eval.js` | `scripts/skill-behavior-eval.js` | **NO** | no | **sí** | **D** (puntuador puro; sin red ni `process.env`) | exit 2 sin argumentos: es un puntuador, no una puerta |
| 19 | `skill-behavior-eval.workflow.js` | `scripts/` | **NO** | no | **sí** | **M** — `agentType` (`LEDGER.md:343-351`) | **[NO EJECUTADO]** ≈1 210 ejecuciones de agente para el catálogo |
| 20 | `skill-harden.workflow.js` | `scripts/` | **NO** | no | **sí** | **M** | **[NO EJECUTADO]** |
| 21 | `skill-scoreboard.workflow.js` | `scripts/` | **NO** | no | **sí** | **M** | **[NO EJECUTADO]** |
| 22 | `skills/*/scripts/verify.sh` ×189 | p. ej. `skills/react/scripts/verify.sh` | **NO** | no | sí, en el proyecto del consumidor | **D\*** fail-open **declarado** (`skills/verify/SKILL.md:92`) | **[NO EJECUTADO]** artefacto distribuido, no puerta de este repo |
| 23 | `pages.yml` | `.github/workflows/pages.yml` | es un workflow, **sin ninguna comprobación** | no | — | — | despliega `site/` sin validar nada |

### 6.2 Recuentos

- **Comprobaciones con nombre propio: 23** (sin contar las 189 `verify.sh` una a una).
- **Corren en algún workflow: 8** (#1–#8, contando `prepublishOnly` indirecto).
- **No corren en ningún workflow: 15.**
- Restringido al conjunto de 12 que contó la auditoría previa (los 10 scripts de npm que son comprobación + los 2 de shell), los que **no** están en ningún workflow son exactamente **6**: `routing:audit`, `drift:knowledge`, `knowledge:doctor`, `spec:gate`, `design:upstream`, `reviewer-guard.sh`. **La cifra de la auditoría previa se confirma.**
- **Hooks de git: 0.** `/.git/hooks/` contiene únicamente los 14 `*.sample` de git; `git config --get core.hooksPath` sale con 1 (no fijado). **Ninguna comprobación de este repositorio corre hoy en ningún hook.**
- **Deterministas y hoy verdes y útiles: 4** (#1, #2, #5, #7). **Deterministas pero rotas o vacuas: 5** (#6, #9, #10, #11, #13 — más #12 y #4 con asterisco). **Dependientes de red: 1** (#14). **Dependientes de modelo o de agente: 3** (#19–#21).
- **Coste del paquete determinista completo, medido [EJECUTADO]:** `validate` + `manifest:check` + `drift:check` + `originality:check` + `routing:audit` + `eval-lint` = **130 s** con la máquina cargada por la línea base; ~48 s sumando las duraciones del ledger en reposo. Frente a **2 h 17 min** de `npm test`. Esta es la cifra que decide la respuesta a la pregunta 6.

---

## 7. Pregunta 6 — Dónde pueden correr las puertas con Actions desactivado

**Previo [NO VERIFICADO]:** no puedo confirmar el estado de Actions en `github.com/lema017/rsc-harness` sin credenciales ni red. Localmente se observa lo contrario de «desactivado»: los tres workflows están en el árbol y `ci.yml:3` dispara `on: [push, pull_request]`, así que **si Actions se habilitase, `ci.yml` correría solo en el siguiente push**. Lo tomo como dado del usuario. Para verificarlo haría falta `gh api repos/lema017/rsc-harness/actions/permissions` con una sesión autenticada — una comprobación que vale la pena hacer antes de decidir, porque de ella depende si la opción C ya está medio abierta.

Hay **cinco** lugares disponibles, no tres. Los ordeno por autoridad decreciente.

### Opción A — Hook de git local (`pre-commit` o `pre-push`)

**Precedente en el repo:** no es terreno nuevo. `rsc` **ya instala un hook de git**: `scripts/install-apply.js:987-996` escribe `post-merge`, y si encuentra uno ajeno lo encadena como `post-merge.rsc-local` (`:996`). La maquinaria para resolver el directorio correcto ya existe y respeta `core.hooksPath`: `hooksDir()` y `hooksDirIsOurs()` en `targets/worktree-reaper.mjs`, usados desde `scripts/doctor.js:113-114`.

**Qué puede garantizar.** Que en *esta* copia de trabajo, con el hook armado y no omitido, el paquete determinista completo (130 s medidos, ~48 s en reposo) corre antes de que el commit o el push existan. Es el único lugar que puede atrapar un defecto **antes** de que entre en la historia. Para `pre-push` puede además correr el paquete contra el rango que se empuja.

**Qué NO puede garantizar — y aquí está el punto débil, con la cita del propio repo.** `tests/worktree-reaper.test.js:948` lo dice en una línea: «*R1: a hook lives in `.git/hooks`, which is not cloned*». Concretamente:

- **No se clona.** Nadie más lo tiene. Un colaborador, un worktree nuevo, un clon de CI: ninguno lo hereda.
- **Es desinstalable y omitible.** `rm .git/hooks/pre-commit`, o `git commit --no-verify`, o `git push --no-verify`. Un solo flag lo anula, sin dejar rastro en el commit.
- **Se pierde con `core.hooksPath`.** Si el desarrollador usa husky o lefthook, git deja de leer `.git/hooks` y el hook queda inerte ahí dentro. Upstream ya se quemó con esto: `tests/hooks-path.test.js:22-23` documenta el defecto de haber escrito en la ruta fija y leído la fija.
- **No puede ser la puerta de la rama.** No impide un merge por la interfaz web, un commit desde la UI de GitHub, ni un push desde otra máquina.
- **No es auditable.** No hay registro de que corriera; el que lo omitió es el único que lo sabe.

**Mitigación disponible, y es buena.** `scripts/doctor.js:102-135` ya modela exactamente este problema para `post-merge`: audita **tres** estados — `absent` (`:129`), `foreign` (`:135`) y `not-in-plan` (`:127`) — y cuando el directorio de hooks no es suyo (`:113-117`) te da la línea literal que debes añadir a tu propio hook. Un hook propio del fork debería replicar ese patrón: el hook aplica, y `doctor` **detecta que el hook no está armado**. Eso convierte «desinstalable en silencio» en «desinstalable y visible».

### Opción B — Un script local invocable a mano

Un único punto de entrada (`npm run gate`, o `scripts/gate.sh`) que corra el paquete determinista y salga ≠0 al primer fallo.

**Qué puede garantizar.** Que existe **una** respuesta canónica a «¿está esto verde?», idéntica en toda máquina y reproducible: 130 s, offline, sin instalaciones globales, con el aislamiento de §1 incorporado al propio script. Es lo único de esta lista que se puede adoptar **hoy, sin tocar configuración y sin depender de Actions**, y es el prerrequisito de las otras cuatro opciones: A, C y D no hacen más que invocarlo en momentos distintos.

**Qué NO puede garantizar.** **Nada en absoluto sobre ningún commit.** Es un comando; un comando que nadie escribe no se ejecuta. No hay ejecución obligada, no hay registro, no hay bloqueo. Su veredicto vale lo que valga la disciplina de quien lo escribe, y eso no es una propiedad del artefacto. Punto débil: **es documentación con código dentro.**

### Opción C — Un workflow habilitado con el mínimo privilegio

**Qué puede garantizar.** Lo que ninguna de las otras cuatro puede: ejecución **no omitible, en un clon limpio, en una máquina que no es de nadie, con registro público, y como condición de merge** si se cablea a una regla de protección de rama. Es el único lugar que puede impedir que algo entre en `main`. Y es el único que demuestra que el repositorio funciona **recién clonado** — justo la clase de defecto que los hooks locales no ven nunca, porque la máquina del desarrollador ya tiene todo.

**Qué NO puede garantizar.** No impide que el defecto se escriba ni que se empuje: sólo que se integre. Llega después del hecho. Y no puede correr lo caro: `npm test` son 2 h 17 min, lo que descarta la suite completa por iteración en cualquier venue, incluido este.

**El punto débil, que es el de la decisión de seguridad que ya tomaste.** Habilitar Actions reabre **superficie de publicación**, y esa fue la razón de desactivarlo. Lo medido al respecto:

- `release.yml` **ya está endurecido por el fork**: `:3-4` y `:17-18` dejan sólo `workflow_dispatch` («*the push-to-main trigger was removed in the fork, so merging never publishes by itself*») y `:30-32` declara permisos explícitos (`contents: write`, `id-token: write`). Pero `:11-12` requiere el secreto `NPM_TOKEN` y empuja a `main`. Habilitar Actions a secas rehabilita **también** este workflow.
- `pages.yml:14-17` pide `pages: write` e `id-token: write` y despliega en cada push a `main` que toque `site/`, **sin ejecutar ninguna comprobación**.
- **`ci.yml` no tiene bloque `permissions:` en absoluto.** Hereda el permiso por defecto del repositorio para el `GITHUB_TOKEN`, que en muchos casos es de escritura. Para un workflow que sólo lee y valida, lo correcto es `permissions: contents: read` — y es una omisión heredada, no una decisión del fork.

Habilitar con mínimo privilegio significa, por tanto, tres cosas y no una: `permissions: contents: read` explícito en `ci.yml`; mantener `release.yml` en `workflow_dispatch` (ya está); y decidir qué pasa con `pages.yml`, que es el único que despliega sin puerta. **No lo implemento: esto es evaluación.**

### Opción D — Hooks del propio arnés (`SessionStart` / `Stop` / `PreCompact`)

Existen y son reales: `rsc` instala hooks de asistente que pueden invocar scripts del repositorio en eventos de sesión.

**Qué puede garantizar.** Que el desarrollador **ve** el veredicto en el momento en que trabaja, sin tener que recordar nada. Como aviso continuo es el único que no depende de disciplina en el momento del commit.

**Qué NO puede garantizar.** Todo lo importante. Vive en `.claude/` (hoy **inexistente** en este repo) y `.rsc/` (hoy sólo con `automation-gaps.md`), y **ambos están ignorados**: `.gitignore:11` y `.gitignore:6`. No se clona, es por máquina y por asistente. Peor: `docs/fork/LEDGER.md:272` (hallazgo C7) establece que **toda guarda impuesta por código es desarmable desde un `.rsc.json` commiteado**, y `LEDGER.md:423` (R5) que `.rsc.json` **borra en silencio las claves del fork**. Punto débil: es un venue cuya configuración un commit puede desactivar sin que se note, y sólo cubre a los asistentes que lo imponen — 1 de 18 con capacidad real de denegar hoy (`LEDGER.md:412`, R4).

### Opción E — Ciclo de vida de npm (`prepublishOnly`)

Ya existe y ya funciona: `package.json:27` corre `manifest`, `validate`, `drift:check` y `originality:check` en todo `npm publish`, venga de un workflow o de una máquina.

**Qué puede garantizar.** Que **nada se publica** sin esas cuatro. Es la única puerta de este inventario que hoy es imposible de omitir por accidente en el camino que importa (la distribución), porque npm la invoca él.

**Qué NO puede garantizar.** Sólo actúa en `publish`: cero efecto sobre commits, ramas o PRs. Y **no incluye** `npm test`, `eval-lint.sh` ni `routing:audit`. Punto débil: `npm publish --ignore-scripts` la salta por completo, y su cobertura es la que menos cubre de las cinco.

### 7.1 Tabla comparativa

| Venue | Disponible hoy sin cambiar configuración | No omitible | Corre en el clon de otro | Puerta de `main` | Auditable | Coste máximo viable | Punto débil en una frase |
|---|---|---|---|---|---|---|---|
| **A** hook de git | sí (hay que instalarlo) | **no** (`--no-verify`, `rm`, `core.hooksPath`) | **no** | no | no | ~130 s | No se clona y un flag lo anula |
| **B** script a mano | **sí** | **no** | sí, si lo escriben | no | no | ~130 s | Nadie está obligado a escribirlo |
| **C** workflow | **no** (requiere habilitar Actions) | **sí** | **sí** | **sí** | **sí** | minutos; no 2 h | Reabre la superficie de publicación que desactivaste |
| **D** hooks del arnés | sí (requiere instalar) | no | no (ignorado) | no | no | segundos (avisa, no bloquea) | Desarmable desde un `.rsc.json` commiteado |
| **E** `prepublishOnly` | **sí, ya activo** | sí en `publish` | sí | no | parcial | segundos | Sólo en `publish`, y `--ignore-scripts` lo salta |

### 7.2 Lo que esto implica para el diseño de la Etapa 1

Ninguna opción individual da garantía. Pero **B + A + doctor** da la combinación más fuerte que es alcanzable sin habilitar Actions, y lo hace sin inventar maquinaria:

1. **B es el cimiento y es gratis**: un punto de entrada determinista único, 130 s, offline, con el aislamiento de §1 dentro. Todas las demás opciones lo invocan.
2. **A le añade la única imposición disponible localmente**, reutilizando `hooksDir()`/`hooksDirIsOurs()` que ya existen y respetan `core.hooksPath`.
3. **`doctor` convierte la debilidad de A en algo visible**, con el patrón de tres estados que `scripts/doctor.js:102-135` ya implementa para `post-merge`. Un hook desinstalado deja de ser invisible.
4. **E ya cubre la publicación** y conviene ampliarla al paquete determinista completo: hoy le faltan `eval-lint` y `routing:audit`, que son exactamente los dos que esta evaluación recomienda arreglar.
5. **C sigue siendo la única autoridad real**, y la decisión de habilitarlo no es técnica sino de riesgo. Si se habilita, habilitarlo con `permissions: contents: read` explícito en `ci.yml`, manteniendo `release.yml` en `workflow_dispatch`, y resolviendo antes qué se hace con `pages.yml`.

Y una restricción que atraviesa los cinco: **ningún venue puede correr `npm test`**. 2 h 17 min no caben en un hook, no caben en una iteración y apenas caben en un release. Cualquier diseño de puertas de la Etapa 1 tiene que separar el paquete determinista de 130 s (que puede correr siempre, en cualquier venue) de la suite (que corre en una cadencia, nunca por cambio).

---

## 8. Apéndice — Comandos ejecutados en esta sesión

Todos con el aislamiento de §0. Los scripts de análisis se escribieron en el scratchpad de sesión, nunca en el repositorio.

| Comando | Resultado |
|---|---|
| `node scripts/routing-audit.js` | exit 1 · 24 s · 84,9 % |
| `node` sobre `auditRouting()` + `loadRoutingCases()` (detalle por caso) | 202 fallos, distribución de posiciones, agrupaciones |
| `node` sobre `createRanker()` con 7 manifests sintéticos | tabla de contrafactuales de §2.5 |
| `node` sobre `parseFrontmatter()` + `PREAMBLE-v1.txt` + 3 claves, ×274 | 0 entradas de manifest cambian |
| `bash scripts/reviewer-guard.sh` | exit 1 · `agents dir not found` |
| `bash scripts/eval-lint.sh` con `python3` fuera del `PATH` | 274 SKIP · PASS · exit 0 |
| `python3 -c "import yaml"` con `HOME` real y con `HOME` aislado | user site-packages / `ModuleNotFoundError` |
| `node` con las 4 aserciones de `eval-lint` reimplementadas + forma | 0 fallos / 3 defectos de forma |
| `node scripts/build-manifest.js --check` · `--validate` | exit 0 · exit 0 |
| `node scripts/drift-check.js` · `--knowledge` | exit 0 (886 enlaces) · exit 0 (vacuo) |
| `node scripts/knowledge-doctor.js` · `scripts/spec-gate.js` | exit 0 (vacuo) · exit 0 (vacuo) |
| `node scripts/originality-check.js` | exit 0 · 82 documentos |
| `node scripts/design-upstream.js` | exit 1 · **hizo 3 GET sin autenticar a `api.github.com`** (ver §0) |
| `node scripts/audit.js` · `scripts/skill-behavior-eval.js` | exit 0 sin salida · exit 2 (uso) |
| paquete determinista completo, cronometrado | **130 s** con la máquina cargada |
| `grep` con exit 2 bajo `!` | PASS — fail-open de la puerta de limpieza |
| `git config --get core.hooksPath` · `ls .git/hooks` | exit 1 (no fijado) · sólo `*.sample` |
