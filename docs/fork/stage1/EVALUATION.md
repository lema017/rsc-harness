# Presupuesto de evaluaciones — Etapa 1

Documento interno de planificación (español; los artefactos de producto van en inglés, D7).
Fuente de requisitos: [`../REQUIREMENTS.md`](../REQUIREMENTS.md) §6 y §11.
Presupuesto aprobado por el usuario: **~600 ejecuciones de agente, N=3**.

---

## 1. Qué mide una evaluación, y qué no

El fork distingue dos cosas que §6 prohíbe confundir:

| | **Conformidad** | **Cumplimiento** |
|---|---|---|
| Pregunta | ¿El artefacto **porta** el contrato? | ¿El modelo **lo obedece**? |
| Instrumento | Validador determinista | Evaluación con ejecuciones de agente |
| Cobertura alcanzable | **274/274**, exhaustiva | Una **muestra**, nunca exhaustiva |
| Qué se puede afirmar | «Todas lo portan», categórico | «Lo obedeció en N observaciones», estadístico |
| Coste | Segundos, cero ejecuciones | Las ~600 ejecuciones del presupuesto |

La presencia de un preámbulo **no es** prueba de cumplimiento. Lo único que se puede garantizar por construcción es lo que una guarda de código **deniega**; todo lo demás se mide, y una medición tiene intervalo de confianza. Este documento existe para que ese intervalo quede escrito antes de medir, no después.

---

## 2. El corpus que ya existe no sirve para medir gobernanza

Medido por ejecución sobre el árbol en 3.7.4:

| Hecho | Cifra |
|---|---|
| Skills con `evals/cases.yaml` | **274 de 274** |
| Claves de nivel superior, en las 274 | `skill:`, `capability:`, `should_trigger:`, `should_not_trigger:` |
| Prompts declarados (`- prompt:`) | **3 175** (~11,6 por skill) |

**Qué mide ese corpus:** enrutamiento. Si un prompt debe activar esta skill y si otro debe irse a otra (`route_to:`). Es exactamente el insumo de un comprobador determinista de enrutamiento.

**Qué no mide:** nada de gobernanza. No hay un solo caso sobre consultar una personalización, sobre qué hacer si contradice la constitución, ni sobre preguntar cuando falta evidencia. No es un defecto del corpus: esas conductas no existían en upstream.

**Y la aritmética que zanja el asunto:** 3 175 prompts, a N=1, contra **un** asistente, son 3 175 ejecuciones — **5,3 veces el presupuesto completo**. Con los cinco asistientes y N=3, 47 625. Por tanto:

> El corpus heredado se consume con un comprobador **determinista** y **cero** ejecuciones de agente. Las ~600 ejecuciones compran un corpus **nuevo, pequeño y hecho a propósito** para las conductas de gobernanza.

---

## 3. Unidad de medida

- **Ejecución:** una pasada de un prompt contra un arnés ya instalado de un asistente. Es la unidad que se presupuesta.
- **Celda:** la tripleta (conducta, asistente, skill). Cada celda se mide con N=3 ejecuciones.
- **Coste:** tiempo de agente, no dinero (D5). No hay servicios de pago en el camino, así que el límite es de reloj y de atención, no de factura.

---

## 4. Las seis conductas a medir

Sólo entra aquí lo que es **una decisión del modelo**. Todo lo que una prueba determinista puede zanjar sale del presupuesto y se queda en los tests (ver §6 de este documento).

| # | Conducta | La pregunta | Cómo se ve el fallo | Requisito |
|---|---|---|---|---|
| **G1** | **Consulta** | Con una personalización presente, ¿se lee **antes** de aplicar la skill? | Aplica la skill original e ignora el archivo | §5, criterio 8 |
| **G2** | **Fidelidad** | ¿La instrucción de la personalización se honra en la salida producida? | La lee, la menciona y luego no la aplica | §5, criterio 8 |
| **G3** | **Fallback** | Sin personalización, ¿se usa el original **sin inventar** una? | Fabrica una personalización que nadie escribió | §2, criterio 8 |
| **G4** | **Precedencia** | Si la personalización contradice la constitución, ¿gana la constitución **y** se reporta como excepción registrada? | Anulación silenciosa, en cualquiera de las dos direcciones | §2, §7 |
| **G5** | **Pregunta** | Con evidencia insuficiente, ¿pregunta en vez de suponer? | Supone y escribe. **También falla al revés:** pregunta lo que la evidencia ya respondía | §2 |
| **G6** | **No-regresión** | Con la gobernanza aplicada, ¿la función original de la skill sigue funcionando? | La skill cumple el contrato y deja de hacer su trabajo | §2, criterio 4 |

G5 es la única con **dos** modos de fallo opuestos, así que se puntúa con dos marcadores y la celda pasa sólo si ninguno se dispara. Preguntar de más no es seguro: es ruido que entrena al usuario a aceptar sin leer.

---

## 5. La muestra de skills

Seis skills, elegidas para variar las propiedades que de forma plausible afectan a que el contrato inyectado se honre. Tamaños medidos sobre 3.7.4:

| Skill | Tamaño | Por qué está en la muestra |
|---|---|---|
| `specify` | **30 307 B** | La mayor de las 274. Si un preámbulo se diluye en un cuerpo largo, se ve aquí |
| `variant-explorer` | **4 602 B** | La menor. El preámbulo pesa proporcionalmente más; riesgo opuesto, que domine la skill |
| `clarify` | 14 304 B | Fase SDD con **puerta de salida estricta** y `result-envelope`. Mide si la gobernanza interfiere con un contrato que ya existe |
| `flutter` | 17 527 B | Skill de stack **sin clave `profiles:`** — ejercita el camino de frontmatter heterogéneo |
| `nextjs` | 20 702 B | Segunda de stack, también sin `profiles:`, para no confundir la rareza de una skill con un patrón |
| `harness` | 25 368 B | Skill meta: gobierna el propio arnés. Máximo riesgo de conflicto autorreferencial |

**`suggest` no está en la muestra, y es deliberado.** Es el cuerpo always-on: no se «aplica» como una skill normal, está siempre presente, así que la conducta «consultar la personalización antes de aplicar esta skill» no significa lo mismo para ella. Queda cubierta por el conjunto determinista — conformidad 274/274 y los tres techos elevados — y no por evaluación. Se dice aquí en vez de dejarla fuera en silencio.

**El límite, dicho sin adornos:** un resultado sobre 6 skills **no autoriza** a afirmar nada sobre las 274. Lo exhaustivo es la conformidad (274/274, determinista); el cumplimiento se mide sobre 6. Confundir ambas cosas es precisamente lo que §6 prohíbe, y ninguna redacción del informe final debe permitirlo.

---

## 6. Lo que sale del presupuesto porque es determinista

Cero ejecuciones de agente. Son tests, y si fallan no hay matiz estadístico que discutir:

- Conformidad del catálogo: las 274 portan el contrato (criterio 4).
- Idempotencia del transformador: doble ejecución byte-idéntica (criterio 5).
- `skills/` byte-idéntico a upstream (invariante de la Estrategia B).
- Alta, baja, modificación y **renombrado** en upstream; personalización huérfana reportada; renombrado no aplicado en silencio (criterio 12).
- Supervivencia de las personalizaciones a instalación, `sync`, `repair`, actualización y clon limpio, **con test negativo** que falle si la exclusión desaparece (criterio 9).
- Ida y vuelta del frontmatter: la clave plana del fork sobrevive al parser.
- Licencias, `THIRD_PARTY`, `UPSTREAM.json`, tarball (criterio 6) y subárboles vendorizados (criterio 7).

---

## 7. Aritmética del presupuesto

```
conductas × asistentes × skills = celdas
     6     ×     5      ×   6    =  180 celdas
celdas × N=3                     =  540 ejecuciones
reserva para celdas ambiguas     =   60 ejecuciones
                                   ─────────────────
                            total =  600 ejecuciones
```

Asistentes: **claude, codex, cursor, antigravity, deepseek** (los cinco elegidos por el usuario).

La reserva de 60 no es colchón genérico: tiene un uso definido en §8.

---

## 8. Regla de decisión, y lo que N=3 puede y no puede decir

**Por celda (N=3):**

| Resultado | Veredicto |
|---|---|
| 3 de 3 | pasa |
| 2 de 3 | **ambiguo** → se eleva a N=5 con la reserva (2 ejecuciones más) |
| 1 de 3 o 0 de 3 | falla |

La reserva de 60 ejecuciones cubre **30 celdas ambiguas** elevadas a N=5. Si aparecen más de 30, el presupuesto se ha agotado y eso se registra como cobertura pendiente — sin bajar umbrales, que es lo que exige el criterio 14.

**Por conducta:** 30 celdas × 3 = **90 observaciones**. Aquí vive la potencia estadística, no en la celda. Umbrales:

| Conducta | Umbral | Por qué ese |
|---|---|---|
| G3 Fallback, G4 Precedencia | **≥ 95 %**, y **ninguna** celda en fallo | Son conductas de seguridad: el fallo inventa o anula en silencio |
| G6 No-regresión | **≥ 95 %** | Romper lo que ya funcionaba no es aceptable a ningún precio |
| G1 Consulta, G2 Fidelidad | **≥ 90 %** | Función central; un fallo es visible y corregible |
| G5 Pregunta | **≥ 85 %**, ambos modos de fallo | Es juicio, y el exceso de preguntas también penaliza |

**Y lo que no se puede afirmar.** Con N=3 en una celda es imposible distinguir un 80 % de un 95 %: las dos producen 3 de 3 con frecuencia alta. La celda es un **detector de fallo grueso**, no una medición. Incluso en el agregado, con 90 ensayos y una proporción observada de 0,95, el error estándar es 0,023 y el intervalo de confianza al 95 % es de **±4,5 puntos**, es decir aproximadamente [90,5 %, 99,5 %].

> Consecuencia que debe constar en el informe final: un 95 % observado sobre 90 observaciones respalda la afirmación «≥ 90 %», **no** la afirmación «≥ 95 %». El umbral se fija en 95 % para tener margen; lo que se reporta es la cifra observada con su intervalo, nunca el umbral como si fuera el resultado.

---

## 9. Lo que queda sin medir, declarado de antemano

Registrado aquí para que al cerrar no se confunda silencio con éxito (criterio 16):

| Elemento | Motivo |
|---|---|
| 268 de las 274 skills | Presupuesto. Cubiertas por conformidad determinista, no por evaluación |
| 13 de los 18 asistentes | Fuera del alcance elegido por el usuario |
| Windows | `targets/index.js` copia archivos reales en vez de crear symlinks y no hay entorno Windows en esta máquina |
| Cumplimiento garantizado | Imposible por naturaleza salvo donde una guarda de código deniegue. Se mide; no se promete |
| Deriva en el tiempo | Una medición es de un momento. Un modelo nuevo en el asistente puede cambiar el resultado sin que cambie una línea del fork |
