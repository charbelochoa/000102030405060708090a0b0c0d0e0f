# Reporte de despliegue: Simulador de teléfono, traza CLI multiagente y ciclo RSI

Documento técnico para el equipo y agentes colaboradores (Codex / Antigravity).

---

## 1. Resumen de lo realizado

1. **Teléfono de clientes (`/app#phone`) con Terminal CLI en vivo (inspiración Claude Code)**
   - **Pantalla del teléfono**: muestra las burbujas reales de conversación entre cliente y empresa.
   - **Terminal CLI integrada (`aeris cli --watch`)**: muestra en tiempo real todo el proceso detrás de escena:
     - **Barra de estado de las 7 etapas del ciclo RSI**:
       - `01 Contexto`: recepción de solicitud y recuperación acotada desde el Cerebro de contexto (`retrieveContext`).
       - `02 1a pasada`: preparación con skills activas (`Caveman`, `Ponytail`, `Evidence first`) y presupuesto.
       - `03 Router`: evaluación de complejidad y asignación de modelos.
       - `04 Orquestador`: desglose del plan de ejecución y delegación a especialistas.
       - `05 Equipo`: diálogo entre agentes en la sala compartida (`[orquestador -> equipo-rsi]`, `[router -> especialista]`, `[constructor -> supervisor]`) y llamadas a herramientas (`|_ args -> out`).
       - `06 Supervisor`: evaluación independiente del candidato (`[supervisor -> constructor]`), puntuación `score/100`, veredicto y mejoras iterativas antes de entregar la respuesta al cliente.
       - `07 Aprendizaje RSI`: entrega verificada al teléfono, calificación del caso y consolidación de la lección (`#atencion-cliente`) en el Cerebro de contexto (`[supervisor-rsi -> cerebro-contexto]`).
   - **Selector de Supervisor RSI e iteraciones**: permite elegir el modelo revisor (`auto`, `none` o modelo específico) y el número máximo de iteraciones del ciclo constructor-supervisor por cada mensaje del cliente.

2. **Cerebro de contexto: Bitácora ciclo por ciclo de errores, mejoras y espacios obligatorios**
   - **Espacios de consulta obligatoria (`requiredContextSpaces` en `shared/brain.ts`)**:
     1. `[[Espacio de errores y mejoras RSI]]` (`#bitacora-rsi #error-agente #mejora-ciclo`)
     2. `[[Lecciones de atención]]` (`#atencion-cliente`)
     3. `[[Reglas de arquitectura y orquestación]]` (`#reglas-orquestacion`)
   - Antes de cada ciclo, `retrieveMandatoryContext(owner, query, maxTokens)` consulta la pregunta junto con los tres espacios obligatorios y entrega los fragmentos relevantes dentro del presupuesto de tokens.
   - Al cierre de cada ciclo revisado (tanto en modo `orchestrated` como `autonomous`), `recordCycleReflection` guarda un registro estructurado (`ContextCycleRecord`) y actualiza la página Markdown `Espacio de errores y mejoras RSI` con:
     - Ciclo y misión (`runId`)
     - Qué agente y modelo (`tier`: `low`, `medium`, `high`, `reasoning`) ejecutó el intento
     - Autochequeo del agente (`¿Está bien o me equivoqué?`)
     - Dónde se equivocó (`mistake`)
     - Qué hizo / debe hacer para mejorar (`improvement`)
     - Decisión del agente líder/revisor (`keep_small`, `escalate_model`, `spawn_subagent`, `accept`)
   - En la interfaz web (`/app#context`), la nueva pestaña **Errores y mejoras RSI** muestra los botones de acceso directo a los espacios obligatorios, la gráfica de mejora y linealidad, y la tabla completa ciclo por ciclo.

3. **Escalado progresivo de modelos, autochequeo y creación de subagentes por el líder**
   - Para no gastar tokens innecesarios en modelos grandes desde el inicio, los ciclos pueden arrancar en un modelo pequeño (`low`) con múltiples iteraciones, enviar reporte de autochequeo al líder (`high`/`reasoning`), y escalar progresivamente (`low` -> `medium` -> `high` -> `reasoning`) solo cuando el líder decide `escalate_model` en lugar de `keep_small`.
   - Si el líder devuelve `leaderAction: "spawn_subagent"` con `{ role, tier, iterations, reasoning }`, `runSubagent` en `server/engine.ts` lanza el subagente con el nivel e iteraciones indicados, publica el diálogo en la sala compartida y entrega sus hallazgos al constructor para el siguiente ciclo.
   - **Herramientas de runtime para el orquestador (`server/tools.ts`)**:
     - `configure_runtime`: permite ajustar `router`, `routerModel`, `optimizer`, `budget`, `maxIterations`, `target` y activar/desactivar `skills` cuando `allowWrites` está habilitado, dejando constancia en `[[Reglas de arquitectura y orquestación]]`.
     - `record_rsi_lesson`: permite registrar errores, mejoras o reglas directamente en los espacios obligatorios del Cerebro de contexto.
   - **Modo de Una Sola API y Un Solo Modelo LLM (`reviewer: "same"` · `docs/UNA_SOLA_API.md`)**:
     - Pensado para hackathon o entornos con una única credencial y un solo modelo LLM.
     - Todos los agentes (`orquestador/tablero`, `constructor/resolver`, `supervisor/líder RSI` y `subagentes`) operan sobre el mismo modelo LLM con contextos separados y escalado progresivo por perfil cognitivo (`low` -> `medium` -> `high` -> `reasoning`).

4. **Gráficas de desempeño, linealidad ($R^2$) y barras de progreso (Terminal CLI y Web)**
   - `computePerformanceTrend`, `renderAsciiProgressBar` y `renderAsciiPerformanceChart` en `shared/phone.ts` calculan la recta de regresión lineal ($y = mx + b$), pendiente por ciclo ($m$) y coeficiente de determinación ($R^2$) sobre las evaluaciones de cada ciclo, indicando explícitamente el tamaño de muestra y que las puntuaciones provienen del modelo revisor.
   - **CLI del sistema (`./aeris.cmd` / `cli/index.ts`) y Terminal Web (`/app#terminal`)**:
     - Nuevo comando `./aeris.cmd metrics [--run <id>]` y comando `/metrics` dentro de `aeris chat` y `/app#terminal` para graficar en ASCII la barra de progreso del pipeline RSI, la curva de desempeño (`*`) frente a la recta de regresión lineal (`.`) y la bitácora de errores y mejoras.
     - Nuevo comando `./aeris.cmd watch [--room <sala>]` y `follow(id)` muestran en vivo la barra de progreso y la gráfica ASCII al finalizar misiones iterativas.
   - **Gráfica SVG (`src/Charts.tsx`)**: `ImprovementChart` traza ahora la recta de regresión lineal y muestra en cabecera la pendiente ($\text{pts/ciclo}$) y linealidad ($R^2$).

5. **Base de datos exacta de Kavak, Evals Estadísticas y Gráfica del Loop RSI (`shared/kavak.ts`, `server/kavak.ts`, `src/Evals.tsx`, `shared/catalog.ts`)**
   - **Catálogo ampliado de modelos LLM (`shared/catalog.ts`)**: 30 modelos en los 7 proveedores (`OpenAI`, `Anthropic`, `Google Gemini`, `DeepSeek`, `xAI`, `NVIDIA NIM` e `Inferencia local`).
   - **Catálogo ampliado de la base de datos Kavak en el servidor (`shared/kavak.ts`)**:
     - `vehicles` (20 modelos específicos de Mazda, Volkswagen, Toyota, Nissan, Honda, KIA, Hyundai, Chevrolet, Ford, BMW, Audi, SEAT, Cupra, Suzuki, MG, Peugeot, Chirey, BYD, Subaru y Jeep) con precio exacto en MXN, kilometraje, caballaje, transmisión, sede, puntos aprobados sobre 240, días de garantía, porcentaje/monto de enganche y mensualidad a 48 meses.
     - `orders` (6 expedientes `ORD-9044`, `ORD-8821`, `ORD-7712`, `ORD-6509`, `ORD-5410`, `ORD-4328`) con datos numéricos exactos (`daysSinceDelivery`, `kmSinceDelivery`, `priceMxn`, `downPaymentMxn`, `monthlyPaymentMxn`, `warrantyDays`).
     - `policies` (`POL-DEV-01`, `POL-GAR-02`, `POL-INSP-03`, `POL-FIN-04`).
   - **Cálculo Estadístico del Error sobre Datos Exactos (`evaluateKavakResponse` en `shared/kavak.ts`)**:
     - Extrae los valores numéricos y categóricos de la respuesta del agente y calcula residuales por variable $e_i = \min(1, |\hat{y}_i - y_i| / |y_i|)$ frente a los objetivos exactos (`numericTargets`) de la base de datos:
       - **RMSE normalizado**: $\text{RMSE} = \sqrt{\frac{1}{N}\sum_{j=1}^N e_j^2}$
       - **MAPE**: $\text{MAPE} = \frac{1}{K}\sum_{i=1}^K e_i \times 100\%$
       - **Desviación estándar del residual ($\sigma_e$)**: $\sqrt{\frac{1}{N}\sum_{j=1}^N (e_j - \bar{e})^2}$
       - **Precisión, Recall y $F_1$-Score** de hechos verificados en BD.
     - En `server/engine.ts`, cuando una misión o conversación corresponde a un caso de Kavak, el motor inyecta el diagnóstico estadístico (`RMSE`, `MAPE`, `F1` y lista exacta de variables con residual $> 0$) al revisor y al Cerebro de Contexto (`[[Espacio de errores y mejoras RSI]]` y `[[Lecciones de atención]]`) para que el modelo reduzca su error estadístico en la siguiente iteración o ciclo.
   - **Dónde ver las gráficas del Loop RSI y las Evals (`src/Evals.tsx`)**:
     1. **Sección principal en la barra lateral: `Evals y Loop RSI` (`/app#evals`)**
     2. **Integrado en `Métricas y progreso` (`/app#metrics`)**
     3. **Integrado en `Teléfono de clientes` (`/app#phone`, pestaña `Gráfica Loop y Evals`)**
     4. **En la terminal CLI**: `./aeris.cmd evals [--run-kavak]` y `./aeris.cmd kavak --simulate`

6. **Rama Git (`main` y `phone-test`)**
   - Rama remota: `https://github.com/charbelochoa/000102030405060708090a0b0c0d0e0f/tree/phone-test`
   - Incluye tanto el modo con orquestador (`orchestrated`) como el tablero de equipo autónomo (`autonomous` en `server/team.ts`, `src/TeamBoard.tsx` y `docs/EQUIPOS.md`).

6. **Despliegue en servidor GCP (`136.118.8.128`)**
   - **Directorio**: `/home/carlitosyt529/aeris-phone-test`
   - **Servicio systemd**: `aeris-phone-test.service` en `127.0.0.1:4330` (límite de 400 MB de RAM).
   - **Servicios coexistentes intactos**: `educatia-lab`, `educatia-portal` y `caddy` continúan operando sin cambios.
   - **URL pública HTTP**: [http://aeris-phone.136-118-8-128.sslip.io/app#phone](http://aeris-phone.136-118-8-128.sslip.io/app#phone)
   - **URL pública HTTPS**: [https://aeris-phone.136-118-8-128.sslip.io/app#phone](https://aeris-phone.136-118-8-128.sslip.io/app#phone)
   - **Health Check**: `http://aeris-phone.136-118-8-128.sslip.io/api/health`

---

## 2. Mapa de archivos actualizados

| Archivo | Propósito |
| :--- | :--- |
| `shared/phone.ts` | Contratos compartidos, definición de las 7 etapas `rsiStages`, mapeo `eventRsiStage` y generador de traza `buildRsiTrace`. |
| `server/phone.ts` | Coordinación de turnos con `orquestador`, `equipo-rsi`, `supervisor-rsi` y `cerebro-contexto`; soporte de `reviewer` y `maxIterations`. |
| `server/engine.ts` | Emisión explícita de `rsi.first_pass` con skills activas y activación del bucle constructor-supervisor en salas `tel-*`. |
| `src/Phone.tsx` | Simulador de teléfono + Terminal CLI integrada con pipeline visual de las 7 etapas RSI y diálogo entre agentes. |
| `src/phone.css` | Estilos del teléfono, terminal CLI acoplada (`.phone-cli`) e indicadores de etapa (`.rsi-pipeline`, `.rsi-stage-pill`). |
| `src/WorkspaceViews.tsx` | `TerminalView` actualizada con barra de ciclo RSI, modo `/watch` global y comando `/rsi`. |
| `cli/index.ts` | Comando `aeris watch [--room]` y renderizado en vivo de la traza RSI en `follow()`. |
| `tests/phone.test.ts` | Pruebas de integración del teléfono, lecciones de contexto y verificación de las 7 etapas en `buildRsiTrace`. |

---

## 3. Comandos rápidos para el equipo

```powershell
# Ver en vivo en tu terminal cómo hablan los agentes y ejecutan el ciclo RSI:
.\aeris.cmd watch

# Graficar en la terminal la barra de progreso, desempeño, linealidad (R^2) y bitácora de errores/mejoras:
.\aeris.cmd metrics

# Ver el diagrama del Loop RSI (7 etapas), qué se está resolviendo y la tabla de Evals con RMSE, MAPE y F1:
.\aeris.cmd evals --run-kavak

# Consultar la base de datos de Kavak en el servidor:
.\aeris.cmd kavak --query ORD-9044

# Ejecutar las Evals de 4 ciclos sobre la base de datos de Kavak y ver gráficas ASCII:
.\aeris.cmd kavak --simulate

# Filtrar una sala específica del teléfono en la CLI:
.\aeris.cmd watch --room tel-ID_CONVERSACION

# Iniciar chat interactivo en terminal (incluye /metrics, /watch, /rsi):
.\aeris.cmd chat --name atlas --room equipo
```
