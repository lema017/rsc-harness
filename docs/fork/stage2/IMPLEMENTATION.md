# Etapa 2 — Consulta de personalizaciones e integración con los 5 asistentes

**Estado:** implementada. Árbol de trabajo sin commitear (los commits los hace el coordinador).
**Cubre:** `REQUIREMENTS.md` §5, §6 y §8; `PLAN.md` §11 criterios **4, 5, 8 y 9**.
**No cubre:** la validación de conformidad sobre las 274 completas y el barrido de la suite entera (Etapa 4).

---

## 0. La invariante, primero

`skills/` no se toca. Comprobado al cerrar la etapa:

```
$ git diff --stat origin/main -- skills/      # vacío
$ ls skills | wc -l                           # 274
```

Y no por disciplina, sino por construcción: el único escritor de gobernanza es
`governBase()`, y el único sitio desde donde se llama es **después** del `cpSync` que
materializa la base en el proyecto consumidor. El catálogo del repositorio nunca es
argumento de una escritura. Hay además un test que lo vigila
(`tests/governance-base.test.js` → *«the invariant: an install never writes inside the
repository catalog»*): instala de verdad y compara las 274 antes y después.

---

## 1. Lo que se escribió, archivo por archivo

### Nuevos

| Archivo | Qué es |
|---|---|
| `scripts/lib/governance.js` | La transformación. Renderiza el preámbulo, calcula el digest, inyecta el bloque y las tres claves, despoja (`stripGovernance`), y emite los dos artefactos de proyecto (`.rsc/governance/v1.md` y `.rsc/governance/always-on.md`) |
| `scripts/lib/customization-validator.js` | El validador de `CUSTOMIZATION-SCHEMA.md` §3: las nueve claves, las ocho reglas, el informe de huérfanas. Devuelve hallazgos; **nunca lanza** |
| `scripts/governance-sync.js` | Mantiene las copias **distribuidas** de los dos artefactos autoritativos byte-idénticas a `docs/fork/stage1/`. `--check` reporta deriva y sale 1 |
| `scripts/validate-customizations.js` | El validador, invocable a mano o desde una puerta. Determinista, offline, de sólo lectura |
| `schema/governance/preamble-v1.txt` | Copia distribuida de `docs/fork/stage1/PREAMBLE-v1.txt` (**787 B**, mismo sha256) |
| `schema/governance/contract-v1.md` | Copia distribuida de `docs/fork/stage1/CONTRACT.md` (**19 774 B**, mismo sha256) |
| `tests/governance-base.test.js` | Base distribuida, idempotencia, integridad del digest, invariante |
| `tests/governance-always-on.test.js` | La entrega always-on en los 5 destinos |
| `tests/governance-delivery.test.js` | La entrega por skill en los 5 destinos, Cursor incluido |
| `tests/governance-customization.test.js` | El validador, sus dos puntos de invocación, el test negativo y la supervivencia del criterio 9 |

**Por qué hay copias en `schema/`.** `package.json` → `files` distribuye `scripts`, `targets`,
`schema`, `skills` y `manifest.json`. **No distribuye `docs/`**, así que el transformador no
puede leer el artefacto autoritativo en la máquina de un consumidor. La copia vive en
`schema/governance/`, la genera `governance-sync.js`, y un test afirma la identidad byte a
byte: el preámbulo sigue sin reescribirse a mano en ningún sitio, y una edición a mano de la
copia **falla un binario** en vez de derivar en silencio.

### Modificados

| Archivo | Cambio | Por qué |
|---|---|---|
| `scripts/install-apply.js` | `governBase(id, dest)` tras el `cpSync` de `ensureBase()` | El punto único de transformación de `ARCHITECTURE.md` §2 |
| | El paso `hook` pasa `writeAlwaysOn(...)` a `wireHook` en vez de la base gobernada | El bloque sale de la superficie always-on, y sólo de ahí |
| | `governProject(cwd)`: regenera el contrato y corre el validador | Los dos puntos de invocación de `CUSTOMIZATION-SCHEMA.md` §3 (`sync` llega aquí a través de `applyInstall`, así que hay una implementación y no dos que deriven) |
| | `managedPathsForInstall` declara los tres artefactos de `.rsc/governance/` | El propio comentario de `install-apply.js:71-74` avisa de que un archivo que el instalador escribe y el inventario omite queda ausente del snapshot, y `rsc restore` no lo recupera |
| `targets/claude.js` | `suggestRel` se deriva de `sourceMd` | Generaliza el mecanismo de `.rsc/suggest-always-on.md` que ya estaba ahí. Detalle: es también el **único** parámetro que este adaptador aceptaba e ignoraba |
| `package.json` | Tres scripts npm: `governance:sync`, `governance:check`, `governance:customizations` | Un validador que nadie invoca no es un instrumento |

---

## 2. La transformación

```
---
<frontmatter de upstream, intacto>
governance: v1
governance-customization: 02-DOCS/wiki/skills/<id>/README.md
governance-digest: <12 hex>
---
<!-- rsc-governance:begin v1 -->
…las cinco reglas…
<!-- rsc-governance:end -->

<cuerpo de upstream>
```

Cinco condiciones que respeta, cada una con su medición sobre las **274**:

| Condición | Medido |
|---|---|
| **Idempotencia** | 274/274 byte-idénticas en la segunda pasada; ninguna con dos bloques |
| **Delimitadores de código equilibrados** | 0 desequilibradas antes, **0 después** (`scripts/lib/skill-lint.js`) |
| **`origin:` en los primeros 2048 B** | Las claves se **añaden al final** del frontmatter, así que `origin:` no se mueve. Offset más profundo medido: **880 B** |
| **Nada se pierde** | `stripGovernance(transform(x))` devuelve `x` en las 274, salvo **una línea en blanco** normalizada entre el frontmatter y el primer encabezado. Esa normalización es deliberada: sin ella la segunda pasada difiere de la primera en exactamente esos saltos de línea |
| **Profundidad 2** | Sólo se reescribe `<base>/SKILL.md`; los subárboles congelados por `tests/ux-upstream.test.js` quedan fuera por construcción |

Coste: **+936 B** como máximo (784 B de bloque + 2 de separación + ~111 de claves + la línea
normalizada). El preámbulo renderizado para `suggest` mide **785 B**, la cifra que mide
`ARCHITECTURE.md` §4 — confirmada, no copiada.

El digest cubre el bloque **con sus marcadores**, así que un bloque al que le falte el
marcador de cierre no digiere como si estuviera íntegro. Hay test de las dos mutaciones
(edición del texto y truncado del cierre).

---

## 3. El archivo always-on, y la decisión que tuve que tomar

El diseño adoptado en `ARCHITECTURE.md` §4 dice tres cosas y las tres están implementadas:

1. El transformador emite un archivo always-on propio. → `writeAlwaysOn()` escribe
   `.rsc/governance/always-on.md`.
2. `install-apply.js` apunta el cableado del gancho a **ese** archivo. → hecho en el paso `hook`.
3. `targets/claude.js` reapunta su variable de ruta a él. → hecho, derivándola de `sourceMd`.

**Una discrepancia que tuve que resolver, y la resolví contra la letra de `CONTRACT.md` §1.**
Ese párrafo describe la superficie always-on como *«base minus the block»*. Pero la base lleva
también las tres claves planas, y en `claude` el gancho escribe el archivo **entero, frontmatter
incluido** (`targets/session-start.mjs:52`). «Base menos el bloque» costaría por tanto ~111 B de
claves en cada SessionStart y en cada compactación, y su tamaño **no** sería el de upstream —
con lo que el test que la Etapa 1 especifica («su tamaño es el de upstream») no podría pasar.

**Decisión: el archivo always-on es el `SKILL.md` prístino de `suggest`, byte-idéntico a
upstream** (7 280 B). Consecuencias, todas medidas:

- El coste de gobernanza en la superficie always-on es **exactamente 0 B**, que es lo que
  afirma la tabla de `ARCHITECTURE.md` §4, y «base menos el bloque» no conseguía.
- El test puede afirmar **igualdad byte a byte** con el archivo de upstream, no un techo.
- En los tres destinos de la familia `AGENTS.md` y en Cursor, el cuerpo entregado es idéntico
  en ambos diseños, porque esos adaptadores despojan el frontmatter de todas formas.
- No se reclama integridad de este archivo, igual que antes: es una derivación que **resta**, y
  una resta no distingue «despojado bien» de «corrompido». Lo cubre un test negativo.

**Y un comportamiento de upstream que NO se desarmó.** La rama
`policy.codeHooks === false && !laneGate` de `claude.js` escribe un *stub* de tres líneas y
reapunta `suggestRel` a `.rsc/suggest-always-on.md`. La generalización cambia el **valor por
defecto** de la variable; el stub sigue sobrescribiéndolo. Si se hubiera reapuntado «en todos
los casos» de forma literal, un proyecto de operaciones pequeño habría pasado de recibir un
stub de tres líneas a recibir el cuerpo completo de `suggest`: una regresión de upstream
disfrazada de cumplimiento del diseño. Hay test (*«the no-code-hooks operations stub still
wins»*).

---

## 4. El validador y sus dos puntos de invocación

Las nueve claves obligatorias y las ocho reglas de `CUSTOMIZATION-SCHEMA.md` §3, con el id de
regla en cada hallazgo (`R1`, `R2`, `R2-orphan`, `R3`, `R4`, `R4b`, `R4c`, `R5`, `R6`, `R7`, `R8`).

**Dónde corre:** `install` y `sync`, **sólo cuando existe `02-DOCS/wiki/skills/`**. `sync`
desemboca en `applyInstall`, así que es un solo punto de código con dos puertas de entrada.
Fuera de eso, `npm run governance:customizations`.

**Cómo informa, y por qué no lanza.** El contrato §6 dice que a un archivo roto se **pregunta**,
no se muere. Una instalación que abortase porque una página del wiki tiene el frontmatter roto
sería un arnés peor que el de upstream, que ni mira ese archivo. Así que los hallazgos:

- se devuelven en el resultado de `applyInstall` (`state.governance.customizations`),
- se persisten en `.rsc/governance/customizations.json`, que está en el inventario de
  recuperación,
- y **nombran siempre el archivo y la regla**.

**Tres decisiones del validador que conviene conocer:**

1. **Frontmatter roto ≠ clave ausente.** El lector del repositorio (`scripts/lib/frontmatter.js`)
   ignora en silencio una línea que no sabe leer, que es correcto para leer un catálogo de
   confianza y **falso** aquí: una línea ilegible es el caso «roto», y se reporta como tal, con
   su número de línea y su texto citado.
2. **Huérfana se reporta, no es error.** Una personalización cuya skill ya no existe sobrevive
   en disco, se reporta con su nombre, y un renombrado se declara **migración que requiere
   decisión** — nunca se re-aloja por parecido (criterio 12).
3. **Regla 8 tiene un límite declarado.** Detecta el intento **declarado** de desactivar una
   guarda, un permiso o una regla de seguridad, por coincidencia de un verbo de desactivación
   con un sustantivo protegido en la misma entrada. Una decisión que desactiva una guarda **sin
   decirlo** no es detectable por ninguna regla de palabras clave; esa mitad es G4 de
   `EVALUATION.md`. La dirección del error es deliberada: una frase que sólo *suena* a eso queda
   **nombrada y preguntada**, porque el nivel 1 de precedencia no se negocia desde este archivo.

---

## 5. Conformidad no es cumplimiento

Lo que esta etapa entrega es **determinista y comprobable**: que el artefacto porte el contrato
en las cinco superficies de los cinco asistentes. Lo que **no** entrega, y no debe leerse como si
lo entregara:

- Que el modelo **lea** la personalización antes de aplicar la skill.
- Que la **honre** dentro de su alcance.
- Que **reporte** un conflicto en vez de resolverlo.
- Que **pregunte** cuando la evidencia no alcanza.

Eso se mide (G1–G6 de `EVALUATION.md`) y nunca se garantiza, salvo donde una guarda de código
**deniegue** — y `ARCHITECTURE.md` §5 ya midió que la aplicación de una skill **no es un evento
observable** en ninguno de los cinco asistentes, así que ninguna cláusula del contrato se puede
imponer en el momento de aplicarse en ninguno de ellos. `REQUIREMENTS.md` §6 prohíbe equiparar
las dos cosas; este documento las mantiene separadas.
