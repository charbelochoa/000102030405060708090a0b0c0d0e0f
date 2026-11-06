# AERIS

Autonomous Efficiency & Recursive Intelligence System.

Un espacio de trabajo para agentes que colaboran desde web, escritorio y terminal, con consumo observable, contexto selectivo y experimentos de mejora verificables.

## Arranque local

Requiere Node.js 24 y Git. Ejecuta desde la carpeta del proyecto:

```powershell
npm ci
npm run dev
```

- Sitio y aplicación web: http://localhost:5173
- Dashboard: http://localhost:5173/app
- Motor compartido: http://127.0.0.1:4318

La demostración funciona sin claves. Los resultados, tokens y costes de ejemplo están identificados como simulados. Al conectar una API, el modo de misión “Usar APIs” ejecuta el motor real.

## CLI

Con el motor encendido:

```powershell
npm run cli -- chat --name atlas --room equipo
```

En otra terminal:

```powershell
npm run cli -- chat --name nova --room equipo
```

Ambas terminales consultan el mismo servidor y comparten mensajes persistentes por sala. `/message nova texto` envía un mensaje; los agentes consultan la sala entre iteraciones. `/help` muestra los comandos.

```powershell
npm run cli -- run "Revisar el proyecto" --wait
npm run cli -- run "Inspeccionar los archivos" --live --model gpt-5.4-mini --budget 0.50 --wait
npm run cli -- files
npm run cli -- models
npm run cli -- context
npm run cli -- recall "presupuestos y router"
npm run cli -- optimize
npm run cli -- benchmark --version v2 --split validation
npm run cli -- versions
```

Después de `npm run build`, también puedes ejecutar `aeris.cmd` en Windows sin el compilador TypeScript:

```powershell
.\aeris.cmd chat --name atlas --room equipo
```

## Escritorio Windows

```powershell
npm run desktop:build
```

Genera `release/AERIS-0.1.0-Windows.exe`, un ejecutable portable sin firma comercial. Para ejecutar el entorno de escritorio desde el código:

```powershell
npm run build
npm run desktop
```

La aplicación usa el mismo motor y la misma interfaz. Guarda sus datos en el directorio de usuario de Electron y trabaja por defecto sobre `Documentos/AERIS Workspace`. El puerto local del ejecutable es 4319. El acceso a archivos del agente requiere habilitar escritura en Configuración.

## Qué está implementado

- Sitio de presentación, registro por correo, sesiones y rutas OAuth para Google y GitHub.
- Dashboard oscuro, misiones, inspector de resultados, gráficas D3 y exportación CSV.
- Adaptadores OpenAI, Anthropic, Gemini, xAI y DeepSeek; catálogo y tarifas editables.
- Constructor y revisor, herramientas de archivos, búsqueda, Git, inventario sintético y simulador de pagos.
- Dos o más misiones concurrentes, hasta cuatro, con mensajes por sala.
- Worktrees de Git mediante CLI, después del primer commit del repositorio.
- Adjuntos de texto y visión para PNG, JPEG y WebP según el modelo.
- Contabilidad por llamada y modelo efectivo, con tarifa conservada, caché y razonamiento reportado.
- Optimizador de salida, perfiles Caveman y Ponytail, importación de skills.
- Cerebro de contexto Markdown con enlaces wiki, etiquetas, backlinks DataScript, grafo D3 y recuperación de bloques.
- Registro de políticas, optimización determinista automática, validación independiente y rollback.
- Aplicación Electron y CLI sobre el mismo contrato de API.

## Qué significa la mejora en esta versión

Hay dos mecanismos distintos:

1. Las misiones LLM refinan candidatos con la opinión de un revisor. Una puntuación del revisor no representa un benchmark independiente ni entrenamiento de pesos.
2. Evolución genera configuraciones candidatas del filtro de inventario, valida con casos independientes, promueve o rechaza y conserva rollback. Esta mejora de políticas se verifica con código determinista. No utiliza un LLM para inventar puntuaciones ni consumo.

La metaoptimización del propio optimizador, el entrenamiento de pesos y la orquestación distribuida no están implementados. El motor puede mejorarse de forma incremental conservando las trazas y contratos actuales.

## Conectar servicios

Copia `.env.example` a `.env` y configura las credenciales necesarias, o guarda las API keys en Proveedores. Las claves locales se cifran con AES-256-GCM y nunca se devuelven en respuestas de API. La clave maestra y el token CLI permanecen en `.aeris`, que está excluido de Git.

Google y GitHub requieren sus respectivos clientes OAuth y callbacks registrados. El registro por correo y contraseña funciona localmente sin servicios de terceros; la verificación de correo y recuperación por email requieren integrar un servicio de correo antes de ofrecer registro público.

DeepSeek está disponible como adaptador. Añade el ID vigente y sus tarifas en Proveedores antes de ejecutarlo. La cuota gratuita de Gemini se activa solo si corresponde a la cuenta del usuario.

Consulta [INSTRUCCIONES.md](docs/INSTRUCCIONES.md), [ARQUITECTURA.md](docs/ARQUITECTURA.md), [API.md](docs/API.md) y [HACKATHON.md](docs/HACKATHON.md).

## Validación

```powershell
npm run check
npm run build
npm audit --omit=dev
```

Las pruebas cubren contabilidad, límites, permisos, sesiones, cifrado, aislamiento de cuentas, herramientas, mensajes SSE, ejecución LLM con proveedores simulados, uso desconocido, contexto y evolución con rollback. Las llamadas a modelos pagados no se realizan durante las pruebas.

## Estructura

```text
src/          Interfaz web, gráficas y vistas
server/       API, runtime, proveedores, contexto y evolución
shared/       Contratos y catálogo
cli/          Interfaz de terminal
desktop/      Aplicación Windows
skills/       Perfiles de referencia y licencias
tests/        Pruebas del comportamiento crítico
docs/         Instrucciones y arquitectura
references/   Inspiraciones originales organizadas, solo locales
```

Las capturas originales y los paquetes de referencia permanecen en `references/`, fuera del código distribuido. La tipografía SF Pro facilitada por el usuario se usa localmente; el repositorio público usa fuentes del sistema como alternativa. Véase [REFERENCIAS.md](docs/REFERENCIAS.md).
