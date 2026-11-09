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

2. **CLI del sistema (`./aeris.cmd` / `cli/index.ts`) y Terminal Web (`/app#terminal`)**
   - Nuevo comando `./aeris.cmd watch [--room <sala>]`: transmite en vivo en la terminal del sistema cada etapa del ciclo RSI, el diálogo entre agentes (`[de -> para]`) y el uso de herramientas.
   - `follow(id)` en `./aeris.cmd run --wait` y `./aeris.cmd chat` ahora imprime línea por línea la traza de etapas `[RSI 01..07]` y los mensajes entre agentes en lugar de solo el resumen de estado.
   - En `/app#terminal`, los comandos `/watch` y `/rsi` permiten monitorear en vivo todas las salas (incluidas las conversaciones `tel-*` del teléfono y equipos `team-*`).

3. **Rama Git (`phone-test`)**
   - Rama remota: `https://github.com/charbelochoa/000102030405060708090a0b0c0d0e0f/tree/phone-test`
   - Los archivos locales de `main` creados por otros procesos (`src/AgentCycle.tsx`, `docs/GCP.md`, `.github/workflows/pages.yml`, `server/realtime.ts`, etc.) se conservaron intactos.

4. **Despliegue en servidor GCP (`136.118.8.128`)**
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

# Filtrar una sala específica del teléfono en la CLI:
.\aeris.cmd watch --room tel-ID_CONVERSACION

# Iniciar chat interactivo en terminal:
.\aeris.cmd chat --name atlas --room equipo
```
