# Imposición por código en los asistentes — verificación de la Etapa 1

**Alcance:** los cinco asistentes objetivo (`claude`, `codex`, `cursor`, `antigravity`, `deepseek`).
**Base:** `/Users/home/Development/rsc-harness-fork`, rama `fork/bootstrap`, upstream 3.7.4 (`package.json:3`).
**Fecha:** 2026-11-01.

Toda cita `archivo:línea` es relativa a la raíz del repositorio salvo que se indique otra cosa.

---

## 0. Método y aislamiento

### 0.1 Qué se ejecutó y dónde

Se instaló el harness **de verdad**, cinco veces, una por asistente, sobre proyectos git vacíos
desechables, invocando `applyInstall()` (`scripts/install-apply.js:235`) directamente desde Node.
No se usó `npm test`, `node --test` ni `npm install` (hay una línea base de la suite corriendo).

Directorio desechable: `.fork-tmp/probe-assist/` (**ya eliminado**, ver §0.3).

Entorno de **todos** los procesos, sin excepción:

```
HOME             = .fork-tmp/probe-assist/home
TMPDIR           = .fork-tmp/probe-assist/tmp
XDG_CONFIG_HOME  = .fork-tmp/probe-assist/xdgcfg
XDG_DATA_HOME    = .fork-tmp/probe-assist/xdgdata
npm_config_cache = .fork-tmp/probe-assist/npmcache
```

Esto era **crítico** en esta verificación: `targets/deepseek-bridge.js:19-21` resuelve
`dshHome()` a `homedir()/.dsh` cuando `DSH_HOME` no está definido, y `wireDeepseekBridge()`
(`:65-79`) **escribe en el HOME del usuario**: `$DSH_HOME/rsc/bridge.mjs`,
`$DSH_HOME/rsc/hooks.json` y un bloque dentro de `$DSH_HOME/cordis.patch.yml`. Sin la
redirección, instalar el destino `deepseek` habría modificado la configuración real de la
máquina del usuario.

### 0.2 Prueba de que no se tocó nada del usuario

| Ruta real | mtime antes | mtime después | Resultado |
|---|---|---|---|
| `~/.claude` | `1793549705` | `1793549705` | **idéntico** |
| `~/.rsc` | `1793413678` | `1793413678` | **idéntico** |
| `~/.dsh` | no existía | no existe | **nunca creado** |

El puente de DeepSeek aterrizó dentro del sandbox, con el `configPath` apuntando también
dentro del sandbox:

```
.fork-tmp/probe-assist/home/.dsh/cordis.patch.yml
.fork-tmp/probe-assist/home/.dsh/rsc/{bridge.mjs,hooks.json}
```

No se usaron credenciales, tokens ni sesiones del usuario. Ningún proceso hizo red
(`npm install` no se ejecutó; no se consultó ninguna documentación de proveedor en vivo —
ver §0.4). `git status` del repositorio permaneció limpio salvo por este archivo.

### 0.3 Limpieza

`.fork-tmp/probe-assist/` eliminado al terminar. Este documento es el **único** archivo
escrito fuera de él.

### 0.4 Límite de método declarado

**No re-descargué la documentación de ningún proveedor.** Todo lo que afirmo sobre la
*capacidad del proveedor* (frente a lo que este repositorio *cablea*) está marcado como
**inferido/heredado** y proviene de `docs/fork/audit/track-c-assistants.md`, que a su vez
declara su propio límite: dos sub-agentes delegados leyeron las URL y dos elementos son
explícitamente de segunda mano. Lo que sí demuestro por ejecución es **qué se cablea hoy**,
que es la pregunta que condiciona el diseño.

---

## 1. Qué recibe cada asistente

### 1.1 La fila de especificación

Todos los destinos salen de una sola tabla, `SPEC` en `targets/index.js:39-63`:

| Asistente | Fila `SPEC` | `root` (skills) | `hook` (bloque always-on) | adaptador |
|---|---|---|---|---|
| `claude` | `targets/index.js:41` | `.claude/skills` | `.claude/settings.json` | `claude` |
| `cursor` | `targets/index.js:43` | `.cursor/rules` | `.cursor/rules/rsc-suggest.mdc` | `cursor` (+`skillExt: '.mdc'`) |
| `codex` | `targets/index.js:45` | `.codex/rsc` | `AGENTS.md` (raíz) | `md` |
| `deepseek` | `targets/index.js:48` | `.dsh/skills` | `AGENTS.md` (raíz) | `md` |
| `antigravity` | `targets/index.js:54` | `.antigravity/rsc` | `.antigravity/AGENTS.md` | `md` |

El despacho de adaptadores está en `targets/index.js:65` y se usa en
`writeSkill` (`:172-174`) y `wireHook` (`:176-178`).

### 1.2 Qué recibe exactamente cada uno — **comprobado por ejecución**

Instalé `suggest`, `orient` y `harness` en cada destino y listé el árbol resultante.

#### `claude` — directorio de skills descubrible + hooks JSON

- **Skills:** `.claude/skills/<id>` → **symlink relativo** a `.rsc/skills/<id>`
  (`targets/claude.js:15` → `linkOrCopy`, `targets/index.js:20-33`). Verificado: los tres
  son enlaces simbólicos. El directorio completo viaja: `SKILL.md`, `references/`,
  `scripts/`, `evals/`, `assets/`, `examples/`.
- **Hook:** `.claude/settings.json` con **7 eventos** y 4 entradas `PreToolUse` (ver §2.1).
- **Además:** `.claude/settings.local.json` (memoria + knowledge-sync),
  `.claude/agents/*.md` (5), `.claude/commands/*.md` (4),
  `.claude/rsc-bootstrap.mjs` (committeado) y 20 archivos bajo `.rsc/`.
- `targets/claude.js:11` deja constancia de por qué esa ruta y no otra: *«it only reads
  `.claude/skills/<name>/SKILL.md`»*.

#### `codex` — directorio no descubrible + bloque en el `AGENTS.md` de la raíz

- **Skills:** `.codex/rsc/<id>` → symlink relativo a `.rsc/skills/<id>`
  (`targets/_md-block.js:23-25`). Directorio completo, auxiliares incluidos.
- **Hook:** bloque entre marcadores `<!-- rsc-suggest:start/end -->` inyectado en el
  `AGENTS.md` de la **raíz del proyecto** (`targets/_md-block.js:11-12,32-40`).
- **Además:** `.codex/hooks.json` (6 eventos), `.codex/agents/*.toml` (5),
  `.codex/rules/rsc-git.rules`. **Sin comandos** (verificado: `targetHasCommands('codex')` → `false`).

#### `cursor` — un archivo por skill, convertido; **sin directorio**

- **Skills:** `.cursor/rules/<id>.mdc`, un **archivo plano único** por skill
  (`targets/index.js:166`, rama `s.skillExt`; `targets/cursor.js:4-9`). Verificado: **cero
  symlinks** en el proyecto cursor. Detalle completo en §4.
- **Hook:** `.cursor/rules/rsc-suggest.mdc` con `alwaysApply: true`
  (`targets/cursor.js:17`).
- **Además:** `.cursor/hooks.json` (7 eventos), `.cursor/rules/rsc-memory.mdc`
  (`alwaysApply: true`, escrito en `targets/memory.js:198-201`), `.cursor/agents/*.md` (5),
  `.cursor/commands/*.md` (5).

#### `antigravity` — directorio no descubrible + un `AGENTS.md` propio, y **nada más**

- **Skills:** `.antigravity/rsc/<id>` → symlink relativo a `.rsc/skills/<id>`. Directorio
  completo.
- **Hook:** bloque entre marcadores en `.antigravity/AGENTS.md` (6 946 B medidos;
  marcadores en las líneas 3 y 126 del archivo generado).
- **Además: nada.** Verificado programáticamente:

  ```
  memoria: unsupported · knowledge-sync: NO · comandos: NO · agentes: NO
  ```

  (`targets/memory.js:13-22` no lo lista; `targets/knowledge-wiring.js:18-25` tampoco.)
  Una búsqueda de `hooks.json`/`settings*.json` en todo el proyecto antigravity devolvió
  **NONE**. Es el más pobre de los cinco por un margen amplio.

#### `deepseek` — directorio **nativo** + hooks vía puente de máquina

- **Skills:** `.dsh/skills/<id>` → symlink relativo a `.rsc/skills/<id>`. Directorio
  completo. `targets/index.js:47` declara por qué importa: *«DeepSeek Harness discovers
  `<root>/.dsh/skills/<name>/SKILL.md` natively»*.
- **Hook:** bloque entre marcadores en el `AGENTS.md` de la **raíz**.
- **Además:** `.dsh/hooks.json` (4 eventos) **más un paso a nivel de máquina**:
  `$DSH_HOME/rsc/bridge.mjs`, `$DSH_HOME/rsc/hooks.json` y un bloque en
  `$DSH_HOME/cordis.patch.yml` (`targets/deepseek-bridge.js:65-79`). **Sin comandos, sin
  agentes.**

### 1.3 La capa compartida, y qué viaja en git

El contenido real de las skills existe **una sola vez** por proyecto, en
`.rsc/skills/<id>/` (`targets/index.js:11-13`), y cada asistente recibe un puntero.
**Comprobado por ejecución:** `.rsc/` está en `.gitignore:2` del proyecto generado
(`# rsc local state (hooks, seals, logs) and managed skill links — machine-local`),
así que **nada del contenido de las skills viaja en git**.

Qué sí viaja, medido en un clon real (§2.4): `.claude/settings.json`,
`.claude/rsc-bootstrap.mjs`, `.rsc.json`, el `AGENTS.md` de la raíz y
`.antigravity/AGENTS.md`. Los `.mdc` de cursor y los agentes/comandos de cada destino
están **excluidos** por el `.gitignore` que escribe el instalador.

---

## 2. Capacidad de denegar

**Esta es la respuesta que más condiciona el diseño, así que está demostrada por ejecución,
no inferida.**

### 2.1 Lo que se cablea hoy — medido en los cinco `hooks.json`/`settings.json` generados

| Asistente | Archivo generado | Eventos cableados (medidos) | ¿Algún evento *pre-herramienta*? |
|---|---|---|---|
| `claude` | `.claude/settings.json` | `SessionStart`, `PreCompact`, `SessionEnd`, **`PreToolUse` ×4**, `UserPromptSubmit`, `PostToolUse`, `Stop` | **SÍ** |
| `codex` | `.codex/hooks.json` | `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PreCompact`, `SessionEnd`, `Stop` | **NO** |
| `cursor` | `.cursor/hooks.json` | `sessionStart`, `beforeSubmitPrompt`, `afterFileEdit`, `afterShellExecution`, `afterAgentResponse`, `preCompact`, `sessionEnd` | **NO** (`beforeSubmitPrompt` es pre-*turno*, no pre-herramienta) |
| `antigravity` | — | **ninguno** (no existe archivo de hooks) | **NO** |
| `deepseek` | `.dsh/hooks.json` | `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop` | **NO** |

Origen en el código: `targets/claude.js:191,206,222,300` (las cuatro `PreToolUse`);
`targets/memory.js:94-118` (tabla `nestedEvents` + `cursorEvents`);
`targets/knowledge-wiring.js:27-33` (tabla `EVENTS`);
`targets/deepseek-bridge.js:17` (los 4 eventos del puente de máquina).

### 2.2 Prueba positiva: `claude` deniega de verdad

Ejecuté las guardas cableadas con una carga `PreToolUse` real:

```
$ echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /tmp/whatever"}}' \
    | node .rsc/danger-guard.mjs <root>
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
 "permissionDecisionReason":"BLOCKED for a non-technical user — …"}}

$ echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"fix: algo\""}}' \
    | node .rsc/gitmoji-guard.mjs <root>
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny", …}}
```

Emisores: `targets/danger-guard.mjs:28,38`, `targets/gitmoji-guard.mjs:285-287`,
`targets/ship-guard.mjs:29-30`, `targets/branch-guard.mjs:29`.

### 2.3 Prueba negativa, y un hallazgo nuevo: el puente de DeepSeek **ya sabe** denegar

`targets/deepseek-bridge.mjs:48,59,67-69,77` contiene un camino de denegación completo:
traduce `permissionDecision:"deny"` / `decision:"block"` / `exit 2` al formato que dsh lee.
Lo **ejecuté** cableando a mano un `PreToolUse` que el instalador no escribe:

```
$ echo '{"cwd":"<root>","tool_name":"Bash","tool_input":{"command":"ls"}}' \
    | node $DSH_HOME/rsc/bridge.mjs PreToolUse
{"decision":"block","reason":"no hay personalizacion consultada"}
```

**La maquinaria funciona de punta a punta; lo que falta es el cableado.**
`targets/deepseek-bridge.js:15-16` lo dice con todas las letras:

> *«The points rsc uses. `PreToolUse` is left out: nothing of rsc's runs there yet, and every
> tool call would pay a process spawn for nothing.»*

Consecuencia de diseño: **`deepseek` es el segundo asistente más barato de convertir en
imponible.** El coste es añadir `'PreToolUse'` a `targets/deepseek-bridge.js:17` y una fila
a `targets/knowledge-wiring.js:30`. No hay que escribir ni un traductor ni un protocolo.

### 2.4 Hallazgo nuevo y decisivo: **en un clon, `claude` no deniega nada**

No está registrado en el LEDGER. Comprobado por ejecución: cloné el proyecto `claude` ya
instalado y ejecuté el **comando exacto que `settings.json` cablea**.

Lo que el clon tiene y lo que no:

```
.claude/settings.json       PRESENTE   (las 4 entradas PreToolUse)
.claude/rsc-bootstrap.mjs   PRESENTE   (committeado a propósito)
.rsc/                       AUSENTE  → ninguna guarda existe
```

Resultado de ejecutar la guarda cableada en el clon:

```
$ echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /tmp/whatever"}}' \
    | node .claude/rsc-bootstrap.mjs "guard" <root> <root>/.rsc/danger-guard.mjs <root>
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":
 "rsc: you are about to delete files irreversibly, and this project's checks for that are
  not built on this machine. Nothing is blocked, and this is the last time it will be
  mentioned. To build them: npx @ericrisco/rsc@3.7.4 sync"}}

$ … 'git push --force origin main' …  →  (sin salida)
```

Dos cosas, ambas verificadas:

1. **No hay `permissionDecision`.** Es deliberado y está documentado en
   `targets/clone-bootstrap.mjs:371-374`: *«no `permissionDecision`: informing someone is not
   denying them, and nothing here may ever cost a person their tool call»*.
2. **El aviso es una sola vez por proyecto, para siempre** (`alreadyReminded`,
   `targets/clone-bootstrap.mjs:368`). La segunda invocación no dijo nada.

→ **La imposición por código de `claude` no sobrevive a `git clone`.** Es advisory hasta que
alguien ejecuta `rsc sync` en esa máquina. Un contrato que prometa denegación debe declarar
esta ventana, o cerrarla (lo que exige que la guarda viaje en el árbol committeado, no bajo
`.rsc/`).

### 2.5 Respuesta sin rodeos

| Asistente | ¿Puede denegar **hoy**? | Evidencia |
|---|---|---|
| **claude** | **SÍ** (y sólo en una máquina con `rsc sync` hecho) | 4× `PreToolUse` en `targets/claude.js:191,206,222,300`; `permissionDecision:"deny"` **ejecutado** (§2.2); pero en un clon sólo `additionalContext` (§2.4) |
| **codex** | **NO** | `.codex/hooks.json` medido: sin `PreToolUse` (`targets/memory.js:99-103`, `targets/knowledge-wiring.js:29`) |
| **cursor** | **NO** | `.cursor/hooks.json` medido: sólo `beforeSubmitPrompt` (pre-turno). Sin `beforeShellExecution` ni `preToolUse` (`targets/memory.js:115-118`, `targets/knowledge-wiring.js:32`) |
| **antigravity** | **NO** | **no existe ningún archivo de hooks**; `memoryModeFor` → `unsupported`; ausente de `targets/knowledge-wiring.js:18-25` |
| **deepseek** | **NO**, pero la maquinaria de denegar **ya existe y la ejecuté** | `.dsh/hooks.json` medido: sin `PreToolUse` (`targets/deepseek-bridge.js:15-17`); relevo de `deny` funcionando en `targets/deepseek-bridge.mjs:67-69,77` (§2.3) |

**1 de 5 impone por código hoy.** Confirma R4 y lo acota más: ese 1 sólo impone en una
máquina construida, nunca en un clon fresco.

### 2.6 Confirmación del recuento de 18 — **comprobado por ejecución**

Enumerando `TARGET_IDS` contra `MEMORY_TARGETS` y `KNOWLEDGE_TARGETS`:

```
Destinos con ALGÚN hook por código: 6 de 18
  → claude, cursor, codex, opencode, deepseek, gemini
Destinos con PreToolUse cableado (deny): 1 → claude
```

**C2 (6 de 18) y R4 (1 con denegación) quedan confirmados por ejecución.**

### 2.7 Capacidad del proveedor — **inferido, heredado de track-c, no re-verificado**

Marcado explícitamente como de confianza menor. Según
`docs/fork/audit/track-c-assistants.md:384-394,1049-1059`:

- `codex`: tiene `PreToolUse` con `permissionDecision:"deny"`, **condicionado a que el
  usuario confíe la configuración vía `/hooks`** (`:385`).
- `cursor`: tiene `beforeShellExecution` / `preToolUse` con `permission:"deny"` y
  `exit 2` (`:387`); `beforeSubmitPrompt` puede bloquear pero **no puede inyectar**, y los
  agentes cloud no reciben `sessionStart`.
- `antigravity`: tiene hooks propios en `.agents/hooks.json`, 6 eventos, con decisiones
  `PreToolUse` ricas (`:394,1059`) — **pero** `track-c:175-179` afirma que
  `.antigravity/AGENTS.md`, la ruta que `targets/index.js:54` usa, **no es una ruta
  documentada por el proveedor**. Es decir: para antigravity no sólo falta la guarda, puede
  faltar incluso el canal de instrucción.
- `deepseek`: 5 puntos vía el puente Codex; coincide con lo que medí.

**Techo si el fork extendiera el cableado: 4 de los 5** (`claude`, `codex`, `cursor`,
`deepseek`), con `antigravity` fuera hasta que se resuelva su ruta.

---

## 3. Punto de inserción por asistente

Pregunta: ¿dónde vive, concretamente, la comprobación «consulta
`02-DOCS/wiki/skills/<nombre>/README.md` antes de aplicar esta skill»?

### 3.0 Dos restricciones que acotan la respuesta antes de empezar

1. **No existe interceptación de la aplicación de una skill, en ningún destino.**
   Comprobado: los **únicos** matchers en todo el repositorio son `'Bash'` (×4) y
   `'Edit|Write|MultiEdit|NotebookEdit'` (×1). Una búsqueda de `'Skill'` como nombre de
   herramienta o matcher en `scripts/`, `targets/` y `tests/` devolvió **cero**
   coincidencias. El momento «se está aplicando esta skill» **no es observable hoy** por
   ninguna guarda de este repositorio.
2. **El cuerpo always-on está lleno.** `skills/suggest/SKILL.md` mide **7 280 B** y
   `tests/clone-bootstrap.test.js:350` fija `bytes <= 7282`: **2 bytes de holgura**
   (R1 reconfirmado por ejecución; el segundo tope, `BODY_CEILING_BYTES = 8000`, está en
   `tests/always-on-body.test.js:16`, y `tests/ftd-lane.test.js:24` fija
   `SUGGEST_BYTES_BEFORE = 7282`). **Nada puede inyectarse ahí sin elevar un tope a
   propósito.**

→ El punto de inserción debe ser un **artefacto propio**, no una línea más en `suggest`.

### 3.1 `claude` — dos puntos, uno impositivo y uno advisory

**Impositivo (el único de los cinco):** una guarda nueva materializada y registrada en
`PreToolUse`, siguiendo exactamente el patrón de las cuatro existentes. El sitio concreto es
el bloque `if (policy.codeHooks !== false)` de `targets/claude.js:179-243`, junto a
`gitmoji-guard` (`:219-225`): `copyFileSync` del script a `.rsc/`, `viaBootstrap('guard', …)`,
filtro idempotente por aguja, y `settings.hooks.PreToolUse.push({ matcher: …, hooks: […] })`.

El matcher es la decisión abierta, y es consecuencia de §3.0.1: al no existir un evento de
«aplicación de skill», hay que elegir el momento determinista más cercano.
`'Edit|Write|MultiEdit|NotebookEdit'` (el momento en que el producto de la skill aterriza)
tiene ya precedente en el repo (`targets/claude.js:277`, el `ftd-nudge`). `'Read'` (el
momento en que el modelo abre `SKILL.md`) no tiene precedente aquí.

**Advisory, por turno:** `targets/userprompt-gate.mjs:38` ya escribe
`SDD_GATE_TEXT + rule` en cada `UserPromptSubmit`. Es el lugar natural de un recordatorio
breve, y su coste ya está pagado (852 B/turno, C4). No impone: el propio archivo se declara
*fail-open* (`:13`).

**Aviso:** cualquier cosa que viva bajo `.rsc/` **no sobrevive al clon** (§2.4). Una guarda
que deba imponer en un clon tiene que vivir donde vive `.claude/rsc-bootstrap.mjs`
(`targets/claude.js:134-136`), que es el único archivo del harness deliberadamente
committeado.

### 3.2 `codex` — `.codex/hooks.json`, añadiendo el evento que falta

Punto concreto: la tabla `EVENTS` de `targets/knowledge-wiring.js:29`
(`codex: [['UserPromptSubmit','request'], ['Stop','turn']]`) y/o `nestedEvents.codex` en
`targets/memory.js:99-103`. El escritor es `writeJsonWiring` (`targets/memory.js:130-150`),
que ya sabe emitir la forma anidada con `matcher`. Añadir una fila `['PreToolUse', …]`
produce la entrada; el guion se materializa como los demás.

Condición heredada (no verificada por mí): el usuario debe confiar la configuración vía
`/hooks` (`track-c:385`). Mientras no lo haga, `codex` queda en advisory: el bloque
`<!-- rsc-suggest:start/end -->` del `AGENTS.md` de la raíz
(`targets/_md-block.js:32-40`).

### 3.3 `cursor` — un `.mdc` `alwaysApply` propio, con precedente exacto en el repo

**Éste es el hallazgo más útil para el diseño de cursor.** No hay que tocar el cuerpo
always-on ni pelearse con los 2 bytes: `targets/memory.js:198-201` ya escribe un archivo
separado y pequeño con exactamente la forma que el contrato por puntero necesita.

El archivo generado mide **324 B** y dice:

```
---
description: Read rsc local continuation before the first action in a new desktop session.
alwaysApply: true
---
<!-- rsc-memory:managed -->
On the first turn of a local desktop session, run `node .rsc/session-memory.mjs resume` …
```

→ El punto de inserción es **un `rsc-governance.mdc` hermano**, escrito en el mismo lugar
del flujo, con su propio marcador gestionado, su propia comprobación de colisión
(`targets/memory.js:183-185`) y su propia ruta gestionada (`:163`). Presupuesto: libre,
porque no pasa por `skills/suggest/SKILL.md`.

**Impositivo:** requeriría añadir `beforeShellExecution` (y/o el `preToolUse` del proveedor)
a `targets/knowledge-wiring.js:32`. Hoy esa fila sólo tiene `beforeSubmitPrompt` y
`afterAgentResponse`. El escritor (`targets/knowledge-wiring.js:162`) ya tiene la rama
especial de cursor (`delete h.type; delete h.timeout`).

### 3.4 `antigravity` — sólo un punto, y está sobre terreno dudoso

Único punto existente: el bloque entre marcadores en `.antigravity/AGENTS.md`, escrito por
`targets/_md-block.js:32-40` con la ruta de `targets/index.js:54`.

No hay nada más: sin hooks, sin comandos, sin agentes, sin memoria, sin knowledge-sync
(verificado, §1.2). Y la ruta misma está en duda (`track-c:175-179`, inferido).

→ Para antigravity, **lo primero no es el punto de inserción, es verificar que el canal de
instrucción existe.** Hasta entonces, cualquier promesa sobre antigravity es una promesa
sobre un archivo que puede que nadie lea.

### 3.5 `deepseek` — el más barato de convertir en impositivo

Dos ediciones, ambas de una línea conceptual, y el relevo de `deny` ya probado (§2.3):

1. `targets/deepseek-bridge.js:17` — añadir `'PreToolUse'` al array `EVENTS` (esto escribe
   el `$DSH_HOME/rsc/hooks.json` de máquina).
2. `targets/knowledge-wiring.js:30` — añadir la fila `['PreToolUse', …]` para que el
   `.dsh/hooks.json` **del proyecto** declare el guion.

El comentario de `:15-16` es un «todavía no», no un «no se puede».

**Coste propio de deepseek:** el paso de máquina (`$DSH_HOME/cordis.patch.yml`). No es
por proyecto y no se deshace al desinstalar (`targets/deepseek-bridge.js:5-6`). Es decir:
la imposición de deepseek **no viaja con el repositorio**; cada máquina la monta una vez.

### 3.6 Resumen de puntos de inserción

| Asistente | Punto impositivo (denegar) | Punto advisory (inyectar texto) |
|---|---|---|
| `claude` | nueva entrada `PreToolUse` en `targets/claude.js:179-243`; para sobrevivir al clon, junto a `.claude/rsc-bootstrap.mjs` (`:134-136`) | `targets/userprompt-gate.mjs:38` (por turno) |
| `codex` | fila `PreToolUse` en `targets/knowledge-wiring.js:29` / `targets/memory.js:99-103` — **requiere `/hooks` del usuario** | bloque en `AGENTS.md` raíz (`targets/_md-block.js:32-40`) |
| `cursor` | fila `beforeShellExecution` en `targets/knowledge-wiring.js:32` | **`rsc-governance.mdc` propio**, patrón de `targets/memory.js:198-201` |
| `antigravity` | **ninguno** | bloque en `.antigravity/AGENTS.md` (`targets/index.js:54`) — **ruta no confirmada** |
| `deepseek` | `targets/deepseek-bridge.js:17` + `targets/knowledge-wiring.js:30`; relevo listo en `targets/deepseek-bridge.mjs:67-69,77` | bloque en `AGENTS.md` raíz |

---

## 4. `cursor` y los archivos auxiliares

### 4.1 Confirmado: no sobreviven en el directorio de cursor

`targets/cursor.js:4-9` es el adaptador completo:

```js
export function writeSkill(id, fromDir, toPath) {
  const body = readFileSync(join(fromDir, 'SKILL.md'), 'utf8');
  mkdirSync(dirname(toPath), { recursive: true });
  writeFileSync(toPath, `---\ndescription: rsc skill ${id}\nalwaysApply: false\n---\n${stripFrontmatter(body)}`);
  return [toPath];
}
```

Lee **sólo `SKILL.md`** y escribe **un solo archivo**. **C5 confirmado por ejecución.**

Caso concreto: instalé `brand-voice` (que trae `references/`, `scripts/` y `evals/`) en cursor.

```
origen   skills/brand-voice/ → SKILL.md  evals  references  scripts
cursor   .cursor/rules/brand-voice.mdc   (12 216 B, y nada más)
```

Y los enlaces internos quedan roto:

```
BROKEN   .cursor/rules/references/word-bank.md
   …pero EXISTE en .rsc/skills/brand-voice/references/word-bank.md
BROKEN   .cursor/rules/references/voice-guide-template.md
   …pero EXISTE en .rsc/skills/brand-voice/references/voice-guide-template.md
BROKEN   .cursor/rules/../design/SKILL.md
BROKEN   .cursor/rules/../marketing/SKILL.md
BROKEN   .cursor/rules/../pitch-deck/SKILL.md
```

Magnitud sobre el catálogo completo (recuento propio, 274 skills):

| | skills |
|---|---|
| total con `SKILL.md` | **274** |
| con `references/` | **246** |
| con `scripts/` | **190** |
| con `evals/` | **274** |
| con `assets/` | 2 |
| con `examples/` | 1 |
| con **algún** auxiliar | **274** (todas) |
| cuyo `SKILL.md` enlaza `](../…)` | **80** |
| cuyo `SKILL.md` enlaza `](references/…)` | **79** |

Coincide con C5 (246 / 190 / 80). Añade dos cifras que C5 no tenía: **las 274 tienen
`evals/`**, y **79 enlazan sus propias referencias**, que es el número de skills cuyo texto
en cursor contiene enlaces roto.

Este recuento se hizo **dos veces por métodos independientes** (un recorrido en Node sobre
`fs` y un bucle de shell con `grep`), y las ocho cifras coincidieron exactamente. Se
registra porque R1 corrigió un error del coordinador cuya causa fue dar por completa una
búsqueda al encontrar la primera respuesta.

### 4.2 Matiz importante que C5 no registra: los auxiliares **sí están en el proyecto**

**Comprobado por ejecución:** aunque cursor no los recibe en `.cursor/rules/`, el contenido
completo **sí se materializa** en la base compartida:

```
.rsc/skills/brand-voice/ → SKILL.md  evals  references  scripts
```

Y el archivo de estado de cursor lo **sabe**: `.cursor/rules/.rsc-state.json` registra, por
skill, `"base": "<proyecto>/.rsc/skills/<id>"`.

→ Corrección de encuadre: cursor no «pierde» los auxiliares del proyecto; **pierde la
capacidad de alcanzarlos por ruta relativa desde su propia regla.** La diferencia es
decisiva para el punto siguiente.

**Pero** `.rsc/` está en `.gitignore:2` del proyecto generado — verificado: `git status`
tras `git add -A` mostró **0 archivos** bajo `.rsc/skills/`. Es decir: los auxiliares son
**locales de máquina**, existen sólo después de una instalación y se re-materializan al
cambiar de versión (`scripts/install-apply.js:54-59`: *«Skills are read-only catalog […]
overwriting on a version change is safe»*).

### 4.3 ¿Rompe esto un diseño de contrato por puntero? **No.**

La pregunta es qué sobrevive a lo que un puntero pudiera apuntar. Tres destinos posibles,
con tres respuestas distintas:

| Destino del puntero | ¿Sobrevive en cursor? | ¿Viaja en git? | Veredicto |
|---|---|---|---|
| `02-DOCS/wiki/skills/<id>/README.md` | **SÍ** | **SÍ** | **El puntero funciona.** Es contenido del proyecto, no de la skill: el adaptador de cursor nunca lo toca. `02-DOCS/wiki/` está dentro de `KNOWLEDGE` (`targets/knowledge-sync.mjs:47`) |
| `.rsc/skills/<id>/references/…` | sí, en disco | **NO** (`.gitignore:2`) | Frágil: ausente en un clon, se sobrescribe al cambiar de versión |
| `references/…` relativo al `.mdc` | **NO** | n/a | **Roto.** 79 skills lo hacen hoy |

→ **El contrato por puntero del fork no se rompe por C5**, porque su destino
(`02-DOCS/wiki/skills/<nombre>/README.md`) es un artefacto del proyecto y es exactamente el
tipo de ruta que sobrevive en los cinco asistentes. Lo que C5 sí rompe es el punto 3 de §5
del contrato original («consultar **sus referencias** cuando sean pertinentes»): en cursor,
las referencias **de la skill** son inalcanzables por el camino que el propio texto de la
skill indica.

Dos consecuencias concretas para el contrato:

1. El puntero debe usar una ruta **anclada en la raíz del proyecto**
   (`02-DOCS/wiki/skills/<id>/README.md`), nunca relativa al archivo que lo contiene. En
   cursor, `../` sale del directorio de reglas; en los demás, sale del directorio de skills.
2. La cláusula sobre referencias de la skill debe declararse como **límite en cursor**, o
   el puntero debe reexponerlas (p. ej. que el README personalizado cite las referencias por
   ruta de proyecto). Declarar, no prometer.

### 4.4 Daño adicional: la descripción de activación

`targets/cursor.js:7` fija `description: rsc skill ${id}`, descartando la descripción real.
Medido contra `manifest.json`:

| skill | descripción real | lo que cursor escribe |
|---|---|---|
| `brand-voice` | **355 B** | `rsc skill brand-voice` (**21 B**) |
| `reporting` | **350 B** | `rsc skill reporting` (**19 B**) |
| `harness` | **479 B** | `rsc skill harness` (**17 B**) |

Pérdida de ~94-96 % del texto por el que un agente decide si la regla aplica. Ver §6.

---

## 5. `.rsc.json`

### 5.1 Mecanismo exacto de desarme de una guarda — **comprobado por ejecución**

Cadena completa, tres eslabones:

1. **`targets/opt-outs.js:19-35`** — `PROJECT_OPT_OUTS` declara qué interruptores «viajan».
   Incluye por nombre `'danger-guard'` (`:25`), `'gitmoji'` (`:28`), `'ship-guard'` (`:30`),
   `'copy-guard'` (`:23`), `'feature-gate'` (`:26`), `'trunk-guard'` (`:31`),
   `'ftd-nudge'` (`:27`) — **las guardas por código, nombradas una a una**.
2. **`scripts/install-apply.js:193-199`** (`hydrateLocalDecisions`) — por cada nombre de
   `manifest.optOuts`, escribe el marcador `.rsc/.no-<name>`. Se invoca en
   `scripts/install-apply.js:268`, condicionado a `fromScratch` (`:240`), es decir
   **exactamente el caso del clon**.
3. Cada guarda decide con un `existsSync` sobre su marcador (p. ej.
   `targets/userprompt-gate.mjs:21`; `targets/claude.js:183` lo documenta: *«opt-out via
   `.rsc/.no-ship-guard`»*). La razón está en `scripts/install-apply.js:180-183`: las guardas
   *no pueden* leer el manifiesto, así que éste se «hidrata» a estado local.

**Demostración.** Proyecto nuevo, `.rsc/` inexistente, con este `.rsc.json` committeado:

```json
{ "version": 1, "targets": ["claude"], "skills": ["suggest","orient"],
  "optOuts": ["danger-guard","gitmoji","ship-guard"],
  "forkGovernance": { "requireSkillReadme": true, "denyOnMissing": true } }
```

Tras la instalación:

```
.rsc/.no-danger-guard
.rsc/.no-gitmoji
.rsc/.no-ship-guard

$ … 'rm -rf /tmp/whatever'      | node .rsc/danger-guard.mjs  → (vacío, exit 0) = PERMITIR
$ … 'git commit -m "fix: algo"' | node .rsc/gitmoji-guard.mjs → (vacío, exit 0) = PERMITIR
```

**C7 confirmado: tres guardas desarmadas desde un archivo committeado, sin que nadie en esa
máquina decida nada.** Hay una segunda vía, independiente del CLI: el bootstrap committeado
lee los mismos `optOuts` (`targets/clone-bootstrap.mjs:115,155`).

### 5.2 Mecanismo exacto de descarte de claves desconocidas — **comprobado por ejecución**

Dos funciones, ambas en `scripts/lib/manifest-file.js`:

- **`:18`** — `const KEYS = ['version','targets','skills','agents','ownSkills','catalogVersion','tier','optOuts','memory','gitPermissions','agentModels','onboarding']` — doce, cerradas.
- **`:20-48`** (`readManifest`) — devuelve una **proyección literal**: construye un objeto
  nuevo campo por campo (`:31-47`). Una clave que no esté ahí **nunca entra en memoria**.
- **`:58-67`** (`writeManifest`) — `for (const k of KEYS) if (manifest[k] !== undefined) out[k] = …`
  (`:60`), repetido para el orden (`:64`), y `writeFileSync` (`:66`). Lo que no está en
  `KEYS` **no se vuelve a escribir**.

**Demostración.** La clave `forkGovernance` del `.rsc.json` de §5.1, tras una sola
instalación:

```json
{ "version": 1, "targets": ["claude"], "skills": ["harness","orient","suggest"],
  "agents": [], "ownSkills": [], "catalogVersion": "3.7.4", "tier": null,
  "optOuts": ["danger-guard","gitmoji","ship-guard"] }
```

**`forkGovernance` desapareció sin aviso, sin error y sin registro.** R5 confirmado por
ejecución.

Agravante: `scripts/lib/manifest-file.js:28-30` sí trata el JSON corrupto como condición
dura (*«rsc will not overwrite it»*). Un JSON **válido** con claves del fork recibe el trato
opuesto: se sobrescribe en silencio. El fallo es asimétrico y silencioso justo donde el fork
necesita confianza.

### 5.3 Cambio mínimo, y qué cuesta en divergencia

#### (a) Que las claves del fork sobrevivan

**Opción A — extender `KEYS` (lo que propone R5).** Dos hunks en un archivo:
`scripts/lib/manifest-file.js:18` (añadir los nombres) y `:31-47` (añadir el *passthrough*,
con saneamiento como el de `agentModels` en `:50-54`, que es el precedente exacto).

- Divergencia: **1 archivo, 2 hunks.** El menor coste de mantenimiento imaginable.
- **Pero no resuelve el problema que R5 plantea.** El riesgo de R5 es un proyecto con
  **ambos CLI instalados**: el CLI del padre, instalado desde npm, sigue teniendo las 12
  claves y **seguirá borrando** las del fork en su siguiente ejecución. Extender `KEYS` en el
  fork protege sólo frente al fork.

**Opción B — archivo propio.** Poner la gobernanza del fork en `.rsc.fork.json`, un archivo
que el padre nunca lee ni escribe (`manifestPath` apunta a `.rsc.json` y sólo a ése,
`scripts/lib/manifest-file.js:15-16`).

- Divergencia frente a upstream: **cero líneas** en archivos del padre; un módulo nuevo.
- Resuelve el caso de los dos CLI: el padre no puede borrar un archivo que no conoce.
- Coste: dos archivos de declaración en vez de uno, y el `doctor` del fork debe mirar ambos.

**Recomendación: B, con A como complemento opcional** si se quiere que `.rsc.json` siga
siendo el único punto de entrada visible. B es lo único que cumple el requisito de §10
(prevención de reinstalación del padre) en un proyecto con ambos CLI, que es precisamente el
escenario que R5 identificó como bloqueado.

En cualquiera de los dos casos, **la pérdida de clave debe ser detectable**, como pide R5:
el camino existente es `scripts/doctor.js:27-30` (`optOutsNotApplied`), que es el precedente
de «declarado pero no aplicado» y donde encaja un «declarado pero desaparecido».

#### (b) Que las guardas no sean desarmables

**Hallazgo que abarata esto mucho: la desarmabilidad es opt-in por guarda, no un marco
global.** Verificado: no existe ningún punto que obligue a una guarda a honrar un marcador.
`hydrateLocalDecisions` (`scripts/install-apply.js:193`) sólo escribe marcadores para nombres
que estén en `PROJECT_OPT_OUTS`, y cada guarda consulta el suyo porque **su propio código lo
consulta**. `scripts/doctor.js:27-30` sólo informa.

→ **Cambio mínimo: la guarda de gobernanza del fork simplemente no registra un nombre en
`targets/opt-outs.js:19-35` y no consulta ningún `existsSync` de marcador.** Entonces:

- No es desarmable por `.rsc.json`, ni por el CLI del padre, ni por el bootstrap committeado.
- **Divergencia frente a upstream: cero líneas modificadas.** Es código nuevo que omite un
  patrón, no código que lo contradiga.

Queda **una vía de desarme que no se puede cerrar y hay que declarar**: `.claude/settings.json`
**viaja en git** (verificado: `git check-ignore` → no ignorado; el `.gitignore` que escribe el
instalador excluye `.rsc/`, `.claude/skills/*`, agentes y comandos, **pero no
`settings.json`**). Cualquiera puede borrar la entrada del hook en un commit. Más barato aún:
`.rsc/` no viaja, así que un clon ya no tiene la guarda (§2.4).

→ Formulación honesta para la sección de garantías: **una guarda del fork puede hacerse no
desarmable por `.rsc.json`, pero no puede hacerse no desarmable por una edición del
`settings.json` committeado, ni puede imponer en una máquina donde no se haya ejecutado
`rsc sync`.**

---

## 6. Selección automática

### 6.1 ¿Dónde aterrizan las skills, y alguien lo sabe?

| Asistente | Ruta de las skills | ¿Es ruta nativa de descubrimiento del proveedor? | Evidencia |
|---|---|---|---|
| `claude` | `.claude/skills/<id>/SKILL.md` | **SÍ** | `targets/index.js:41`; `targets/claude.js:11`: *«it only reads `.claude/skills/<name>/SKILL.md`»* |
| `deepseek` | `.dsh/skills/<id>/SKILL.md` | **SÍ** | `targets/index.js:47`: *«DeepSeek Harness discovers `<root>/.dsh/skills/<name>/SKILL.md` natively»* |
| `cursor` | `.cursor/rules/<id>.mdc` | **SÍ, pero degradada** | `targets/index.js:43`; `targets/cursor.js:7` pone `alwaysApply: false` + descripción inútil |
| `codex` | `.codex/rsc/<id>/` | **NO** | `targets/index.js:45` |
| `antigravity` | `.antigravity/rsc/<id>/` | **NO** | `targets/index.js:54` |

### 6.2 Y nada les dice dónde están — **comprobado por ejecución**

Busqué, en los proyectos generados, si el texto always-on nombra la raíz de skills:

- `.antigravity/AGENTS.md`: ni una mención de `.antigravity` ni de `antigravity/rsc`.
- `AGENTS.md` de la raíz (codex): ni una mención de `.codex/rsc`.

Lo que el bloque sí contiene son rutas **relativas** que sólo resuelven si quien lee está
dentro de la raíz de skills — p. ej. `` `../ftd/SKILL.md` ``, `` `../sdd/SKILL.md` `` y
`` skills/orient/references/orientation-contract.md `` (líneas 29 y 122 del archivo
generado). Desde un `AGENTS.md` en la raíz del proyecto, esas rutas **apuntan fuera del
proyecto**.

Tampoco se genera ningún índice: una búsqueda de `skillsIndex`, `skill-index`, `INDEX.md` y
`catalog.md` en `scripts/` y `targets/` devolvió **cero** coincidencias.

**C3 confirmado.** Para `codex` y `antigravity`, la selección automática **no es
«dependiente del modelo»: es inexistente**. No hay a qué apelar.

### 6.3 El caso de cursor: mecanismo presente, insumo destruido

Cursor sí lee `.cursor/rules/*.mdc`, así que el mecanismo de «regla pedida por el agente»
existe. Pero `targets/cursor.js:7` escribe `description: rsc skill <id>` —
17-21 B frente a 350-479 B reales (§4.4). El agente elige con el nombre de la skill y nada
más.

→ En cursor la selección automática no está ausente, está **ciega**. Y aquí sí hay un arreglo
local y pequeño: `targets/cursor.js:7` tiene acceso al `SKILL.md` completo
(`:5`), de cuyo frontmatter sale la descripción real. Es la reparación más barata de todo
este informe.

### 6.4 Respuesta

- **Hoy la soportan 2 de los 5 sin reservas:** `claude` y `deepseek` (ruta nativa + directorio
  completo + descripción intacta en el frontmatter de `SKILL.md`).
- **1 de forma degradada:** `cursor` (ruta nativa, descripción destruida, auxiliares ausentes).
- **2 no la soportan en absoluto:** `codex` y `antigravity`. Para éstos, **la selección tiene
  que ser dirigida por el usuario** — o el fork tiene que construir el descubrimiento que no
  existe (un índice generado, o mover la raíz a la ruta nativa del proveedor, que para
  antigravity `track-c:858` sitúa en `.agents/skills/<n>/SKILL.md`; inferido, no verificado).

---

## 7. Separación explícita: comprobado vs. inferido

### 7.1 Comprobado por ejecución en esta sesión

1. Las cinco instalaciones completas y el inventario exacto de archivos de cada destino (§1.2).
2. Los eventos cableados en los cinco `hooks.json`/`settings.json` generados (§2.1).
3. `claude` emite `permissionDecision:"deny"` — ejecutado (§2.2).
4. `codex`, `cursor`, `antigravity` y `deepseek` **no** tienen ningún evento pre-herramienta
   cableado (§2.1).
5. El puente de `deepseek` **sí** relega un `deny` si se le cablea `PreToolUse` — ejecutado (§2.3).
6. **En un clon, la guarda de `claude` no deniega: sólo avisa, y una sola vez** (§2.4). Nuevo.
7. 6 de 18 destinos tienen algún hook por código; 1 de 18 puede denegar (§2.6).
8. Cursor recibe un único `.mdc`, con 0 symlinks, y sus enlaces `](references/…)` y
   `](../…)` quedan roto (§4.1).
9. Los auxiliares **sí** existen en `.rsc/skills/<id>/`, que está en `.gitignore:2` (§4.2). Matiz nuevo.
10. Recuento del catálogo: 274 skills, 246 `references/`, 190 `scripts/`, 274 `evals/`,
    80 con `](../`, 79 con `](references/` (§4.1).
11. La descripción de activación de cursor cae de 350-479 B a 17-21 B (§4.4).
12. Un `.rsc.json` committeado con `optOuts` **desarma tres guardas** en una máquina
    nueva (§5.1).
13. Una clave del fork en `.rsc.json` **se borra en silencio** en la primera ejecución (§5.2).
14. `skills/suggest/SKILL.md` = 7 280 B contra el tope 7 282 → **2 bytes** (§3.0.2).
15. Ningún matcher distinto de `Bash` y `Edit|Write|MultiEdit|NotebookEdit` existe en el
    repositorio; **no hay interceptación de aplicación de skill** (§3.0.1).
16. `02-DOCS/wiki/skills` **no aparece en ningún archivo de código, test o prosa de skill**;
    sólo en `docs/fork/` (§6.2 / R5-segunda-brecha).
17. `02-DOCS/wiki/` está dentro de `KNOWLEDGE` (`targets/knowledge-sync.mjs:47`), con
    `02-DOCS/wiki/harness/user-profile.md` excluido como `PERSONAL` (`:49`).
18. `.claude/settings.json` y `.claude/rsc-bootstrap.mjs` **viajan en git**; `.rsc/` no (§5.3b).
19. El aislamiento se mantuvo: `~/.claude` y `~/.rsc` con mtime idéntico, `~/.dsh` nunca
    creado (§0.2).

### 7.2 Inferido por lectura del código de este repositorio

- La intención de `targets/deepseek-bridge.js:15-16` («`PreToolUse` is left out […] nothing
  of rsc's runs there **yet**») como «decisión de coste, no imposibilidad».
- Que añadir una fila a las tablas `EVENTS`/`nestedEvents` basta para cablear un evento
  nuevo: se infiere de la forma de `writeJsonWiring` (`targets/memory.js:130-150`) y del
  bucle de `wireKnowledge` (`targets/knowledge-wiring.js:159-164`). **No lo ejecuté.**
- Que el matcher adecuado para «antes de aplicar una skill» sería `Read`, `Edit|Write…` o un
  hipotético `Skill`: es una elección de diseño, no un hecho medido.
- Que `.rsc.json` es la única declaración que el padre lee: se infiere de que `manifestPath`
  (`scripts/lib/manifest-file.js:15-16`) es el único constructor de ruta de manifiesto.

### 7.3 Inferido / heredado, **no verificado por mí** (confianza menor)

Todo lo relativo a la **capacidad de los proveedores** más allá de lo que este repositorio
cablea, tomado de `docs/fork/audit/track-c-assistants.md` con sus URL:

- `codex` tiene `PreToolUse` con deny, condicionado a `/hooks` (`track-c:385`).
- `cursor` tiene `beforeShellExecution`/`preToolUse` con `permission:"deny"` (`track-c:387`).
- `antigravity` tiene hooks propios en `.agents/hooks.json` (`track-c:394,1059`) y su ruta
  de skills nativa sería `.agents/skills/<n>/SKILL.md` (`track-c:858`).
- **`.antigravity/AGENTS.md` no es una ruta documentada** (`track-c:175-179`). Si esto es
  cierto, antigravity no tiene hoy ni canal impositivo ni canal de instrucción fiable.

### 7.4 No verificable sin violar una restricción

| Pregunta | Por qué no | Qué haría falta |
|---|---|---|
| ¿Claude Code expone un nombre de herramienta para la **aplicación de una skill** a `PreToolUse`? | Exigiría ejecutar el cliente real con hooks cargados y observar su carga `PreToolUse`. Eso toca la configuración real del asistente del usuario (`~/.claude`), prohibido por §1. | Un proyecto de prueba con `CLAUDE_CONFIG_DIR` dentro de `.fork-tmp/`, una sesión no interactiva y un hook que volcara su stdin. Pendiente de autorización explícita. |
| ¿Codex / Cursor / Antigravity aceptan de verdad un `deny` en sus eventos pre-herramienta? | Exigiría instalar y ejecutar esos clientes. Sin instalaciones globales, y ninguno está disponible aislado aquí. | Los binarios de cada proveedor dentro de `.fork-tmp/`, con su `HOME` redirigido. **No ejecutado.** |
| Recuento de vulnerabilidades de dependencias | `npm audit` requiere el registro. | Red, fuera de alcance (ya registrado como no verificado en D1). |
| ¿Se rompe algún test al añadir un `PreToolUse` nuevo? | `node --test` / `npm test` prohibidos (línea base en curso). | Ejecutar los archivos de test afectados en serie cuando la línea base termine. |

---

## 8. Consecuencias para el diseño

1. **Un solo asistente impone por código, y sólo en una máquina construida.** El contrato no
   puede prometer denegación como propiedad general. La formulación honesta es: *denegación
   en `claude` tras `rsc sync`; instrucción verificable en los otros cuatro.*
2. **`deepseek` es la segunda imposición más barata**, y la maquinaria está probada (§2.3).
   Si el fork quiere más de un asistente impositivo, es por ahí.
3. **El contrato por puntero sobrevive**, con una condición: ruta anclada en la raíz del
   proyecto (`02-DOCS/wiki/skills/<id>/README.md`), nunca relativa al archivo que la cita (§4.3).
4. **El puntero no cabe en el cuerpo always-on** (2 B). Debe ser un artefacto propio. Para
   cursor hay un precedente exacto y gratuito: `targets/memory.js:198-201` (§3.3).
5. **La no-desarmabilidad cuesta cero divergencia** si la guarda del fork no registra nombre
   en `PROJECT_OPT_OUTS` ni consulta marcador (§5.3b). Pero `.claude/settings.json` viaja en
   git y eso no se puede cerrar: hay que declararlo.
6. **Las claves del fork están mejor en un archivo propio** que extendiendo `KEYS`: es la
   única opción que sobrevive a un proyecto con los dos CLI instalados (§5.3a).
7. **Para `codex` y `antigravity` la selección automática hay que construirla o declararla
   ausente**; no se puede heredar (§6.4). Y para `antigravity` la pregunta previa es si su
   canal de instrucción existe (§3.4).

---

## Apéndice — reproducibilidad

Todas las comprobaciones de §7.1 se reproducen así (el directorio de sondeo fue eliminado):

```sh
FORK=/Users/home/Development/rsc-harness-fork
SB=$FORK/.fork-tmp/probe-assist
mkdir -p "$SB"/{home,tmp,xdgcfg,xdgdata,npmcache}
export HOME="$SB/home" TMPDIR="$SB/tmp" XDG_CONFIG_HOME="$SB/xdgcfg" \
       XDG_DATA_HOME="$SB/xdgdata" npm_config_cache="$SB/npmcache"

cat > "$SB/run.mjs" <<'EOF'
import { applyInstall } from '/Users/home/Development/rsc-harness-fork/scripts/install-apply.js';
await applyInstall({ skillIds: ['suggest','orient','harness'], agentIds: [],
  target: process.argv[2], home: process.env.HOME, cwd: process.argv[3], operation: 'install' });
EOF

for t in claude codex cursor antigravity deepseek; do
  mkdir -p "$SB/proj-$t" && (cd "$SB/proj-$t" && git init -q . \
    && git config user.email probe@local && git config user.name probe)
  node "$SB/run.mjs" "$t" "$SB/proj-$t"
done
```

**Obligatorio:** exportar las cinco variables de entorno **antes** de cualquier invocación.
Sin ellas, el destino `deepseek` escribe en `~/.dsh` del usuario
(`targets/deepseek-bridge.js:19-21,65-79`).

**Prohibido** mientras corra la línea base: `npm test`, `node --test`, `npm install`.

Al terminar: `rm -rf "$SB"`.
