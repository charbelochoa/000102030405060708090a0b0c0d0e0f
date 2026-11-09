# Arquitectura Multiagente con Una Sola API y Un Solo Modelo LLM

Este documento describe cómo AERIS ejecuta su ciclo completo de mejora recursiva (RSI), coordinación multiagente, creación de subagentes y bitácora del Cerebro de contexto utilizando **una única credencial de API y un único modelo LLM**, manteniendo exactamente las mismas capacidades que la arquitectura multimodelo.

---

## 1. Motivación (Modo Hackathon / Entorno de una sola API)

En entornos de evaluación o hackathon es habitual contar con:
- **Una sola llave de API** (por ejemplo, únicamente `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY` o un endpoint local compatible).
- **Un único modelo LLM autorizado** para todas las llamadas.

AERIS soporta de forma nativa dos topologías equivalentes bajo la misma API y contratos compartidos (`shared/types.ts`, `shared/brain.ts`, `shared/phone.ts`):

| Capacidad del sistema | Topología Multimodelo (`reviewer: "auto"`) | Topología de Un Solo Modelo (`reviewer: "same"` o 1 modelo activo) |
| :--- | :--- | :--- |
| **Agente Orquestador / Tablero** | Modelo clasificador ligero (`routerModel`) o tablero autónomo (`server/team.ts`) | El mismo modelo LLM con prompt de planificación o tablero autónomo sin LLM central |
| **Agente Constructor / Resolver** | Escala entre modelos distintos (`nano` -> `mini` -> `base` -> `reasoning`) | El mismo modelo LLM escalando por **perfil cognitivo** (`low` -> `medium` -> `high` -> `reasoning`) |
| **Agente Supervisor / Líder RSI** | Modelo de nivel `high` distinto al constructor | El mismo modelo LLM en una llamada con **contexto limpio e independiente** y rúbrica estricta |
| **Subagentes Especialistas** | Modelos seleccionados según el `tier` pedido por el líder | El mismo modelo LLM instanciado con rol especialista (`subagente-<rol>`), iteraciones e instrucciones acotadas |
| **Cerebro de contexto y Bitácora RSI** | Registra errores, mejoras y decisiones en `[[Espacio de errores y mejoras RSI]]` | Idéntico: registra ciclo por ciclo qué agente/perfil falló, qué mejoró y qué decidió el líder |

---

## 2. Cómo funciona un sistema multiagente con un solo modelo LLM

Cuando `reviewer` se configura como `"same"`, cuando `model` y `reviewer` apuntan al mismo identificador, o cuando el catálogo activo tiene un único modelo disponible (`availableModels(run).length === 1`), `server/engine.ts` activa `singleModelMode`:

### 2.1 Separación estricta de contextos entre agentes
Aunque el binario del modelo sea el mismo, los agentes **no comparten el mismo historial de conversación**:
1. **Constructor (`candidate`)**: recibe la tarea, las skills activas (`Caveman`, `Ponytail`, `Evidence first`), los fragmentos recuperados de los espacios obligatorios del Cerebro de contexto (`retrieveMandatoryContext`) y el acceso a herramientas.
2. **Supervisor / Líder RSI (`reviewerInstruction`)**: recibe en una llamada independiente únicamente `{ task, candidate }` como datos no confiables, evalúa el autochequeo del constructor (`¿Está bien o me equivoqué?`), califica bajo rúbrica (corrección 40, cobertura 30, restricciones 20, evidencia 10) y decide la acción del siguiente ciclo:
   - `keep_small`: mantener el perfil económico (`low`) para otra iteración sin gastar tokens extra.
   - `escalate_model`: escalar al siguiente perfil cognitivo (`low` -> `medium` -> `high` -> `reasoning`) sobre el mismo modelo.
   - `spawn_subagent`: crear un subagente especialista (`runSubagent`) sobre el mismo modelo con un objetivo acotado y entregar sus hallazgos al constructor.
   - `accept`: aprobar el candidato cuando alcanza el umbral (`target`).
3. **Subagente especialista (`runSubagent`)**: se ejecuta con su propio prompt de sistema (`You are a specialized subagent (<rol>) spawned by the RSI leader...`), realiza `1..2` pasadas focalizadas y publica su hallazgo en la sala compartida (`[subagente-<rol> -> constructor]`).

### 2.2 Escalado cognitivo progresivo en un solo modelo (`cognitivePrompts`)
Para evitar gastar tokens innecesarios desde el primer intento cuando se usa un solo LLM, `server/engine.ts` aplica cuatro perfiles cognitivos progresivos al mismo modelo:

- **`low` (Pasada rápida y económica)**: resuelve de forma directa con el mínimo de tokens y concisión máxima (`Caveman`).
- **`medium` (Pasada analítica)**: verifica supuestos con herramientas y corrige los errores señalados en la bitácora del ciclo previo.
- **`high` (Pasada profunda)**: audita casos borde, restricciones y completitud antes de emitir la respuesta.
- **`reasoning` (Pasada exhaustiva)**: descompone invariantes paso a paso y verifica cada requisito frente a la evidencia.

---

## 3. Consulta obligatoria del Cerebro de contexto

Tanto con múltiples modelos como con un solo modelo, antes de cada ciclo el agente consulta obligatoriamente los tres espacios del Cerebro de contexto (`shared/brain.ts`):
1. `[[Espacio de errores y mejoras RSI]]` (`#bitacora-rsi #error-agente #mejora-ciclo`)
2. `[[Lecciones de atención]]` (`#atencion-cliente`)
3. `[[Reglas de arquitectura y orquestación]]` (`#reglas-orquestacion`)

Al terminar cada ciclo, `recordCycleReflection` guarda en `Espacio de errores y mejoras RSI` qué perfil/agente se equivocó, cuál fue el error y qué acción tomó para mejorar. Así, en el siguiente ciclo, incluso el perfil `low` del mismo modelo consulta los errores previos y evita repetirlos sin necesidad de gastar más tokens.

---

## 4. Cómo activarlo en Web, Teléfono, CLI y API

### En la interfaz Web (`Nueva misión` y `Teléfono de clientes`)
- En **Supervisor RSI / Agente revisor**, selecciona:
  - `Mismo modelo constructor (1 sola API / 1 LLM)` (`value="same"`).
- Funciona tanto con **Con orquestador (`orchestrated`)** como con **Equipo autónomo (`autonomous`)**.

### Desde la terminal CLI (`./aeris.cmd`)
```powershell
# Modo con orquestador usando 1 sola API y 1 solo modelo para todos los agentes:
.\aeris.cmd run "Audita el módulo y corrige bordes" --model gpt-5.4-mini --reviewer same --iterations 3 --wait

# Modo equipo autónomo (tablero sin planificador central) usando 1 solo modelo:
.\aeris.cmd run "Resuelve el caso del cliente" --coordination autonomous --model gpt-5.4-mini --reviewer same --iterations 3 --wait

# Ver la gráfica ASCII de desempeño, linealidad (R^2) y bitácora de errores en terminal:
.\aeris.cmd metrics
```

### Por API HTTP (`POST /api/runs` y `POST /api/phone/conversations`)
```json
{
  "prompt": "Resuelve la solicitud verificando restricciones",
  "coordination": "orchestrated",
  "model": "gpt-5.4-mini",
  "reviewer": "same",
  "maxIterations": 3,
  "budget": 0.25
}
```
