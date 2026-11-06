# Instrucciones de AERIS

## Abrir el proyecto

1. Instalar Node.js 24 y Git.
2. Abrir una terminal dentro de AERIS.
3. Ejecutar `npm ci` y `npm run dev`.
4. Abrir `http://localhost:5173/app`.

El acceso local crea una sesión del propietario de la computadora. Se puede explorar sin conectar proveedores. Usa el formulario de la página de login para probar el registro y las sesiones por correo.

## Ejecutar modelos reales

1. Ir a Proveedores y APIs.
2. Conectar una credencial y habilitar el proveedor.
3. Comprobar ID, capacidad de visión y precios por millón de tokens.
4. Crear una misión y cambiar a Usar APIs.
5. Elegir constructor y revisor; ambos deben tener un proveedor conectado.
6. Establecer presupuesto, iteraciones máximas y objetivo.
7. Iniciar y revisar el inspector.

El router usa el clasificador designado si está disponible. Si no lo está, emplea reglas locales. La selección manual respeta el modelo seleccionado y no cambia silenciosamente de proveedor.

Las tarifas verificadas corresponden a las fuentes enlazadas en cada modelo. Deben revisarse si cambia el proveedor, el modelo, la modalidad, la región o el contrato. El importe de AERIS es una contabilidad de tokens con la tarifa configurada, no una lectura de la factura del proveedor. Se actualiza después de cada respuesta. Las llamadas de clasificación y revisión también se incluyen y se atribuyen a sus propios modelos.

Si falta `usage`, la ejecución se detiene y el coste se identifica como incompleto. El razonamiento no reportado queda en `null`; no se infiere. Los tokens de razonamiento reportados como parte de salida no se cobran dos veces.

## Archivos y worktrees

Lectura y búsqueda se limitan al directorio configurado. `.git`, `.aeris`, archivos `.env`, dependencias y enlaces simbólicos están protegidos. Activa Crear y editar archivos en Configuración para permitir escritura.

La CLI permite listar, leer, buscar y escribir archivos. `write --from archivo` toma el contenido desde un archivo local. Las comprobaciones de Git admiten únicamente status, diff y branches; los modelos no reciben una shell arbitraria.

```powershell
npm run cli -- worktree feature-router
npm run cli -- read README.md
npm run cli -- search "router" --path server
```

Los worktrees se crean en `.aeris/worktrees` con ramas `aeris/nombre`. Requieren un repositorio con al menos un commit. No cambian automáticamente el directorio de ejecución de una misión; usa otra instancia del motor con `AERIS_WORKSPACE` apuntando al worktree para trabajar allí.

## Colaboración

En Agentes, Lanzar equipo crea dos misiones concurrentes y una sala compartida. Cada misión tiene su propio presupuesto. Las ejecuciones comparten mensajes; no son un sistema de consenso y pueden discrepar.

En dos terminales, usa la misma sala y nombres diferentes:

```powershell
npm run cli -- chat --name atlas --room equipo
npm run cli -- chat --name nova --room equipo
```

Los comandos `/message`, `/messages`, `/files` y `/stop` siguen disponibles mientras se ejecuta una misión. El texto sin prefijo inicia una nueva misión. Ctrl+C sale del chat; para cancelar trabajo del servidor usa `/stop`.

## Cerebro de contexto

Crea páginas o importa hasta 50 archivos Markdown por operación, de máximo 80 KB cada uno. Los enlaces `[[Página]]` conectan notas y `#etiquetas` ayudan a recuperar información.

El grafo permite seleccionar y arrastrar nodos. La vista de página ofrece edición, enlaces internos y backlinks. Puedes desactivar una página para excluirla del contexto del agente.

Probar recuperación muestra los fragmentos elegidos para un objetivo. La recuperación considera términos de título, contenido, etiquetas y referencias explícitas consultadas con DataScript. Se seleccionan hasta seis páginas y cuatro bloques por página. La estimación usa un margen conservador de caracteres; la contabilidad real procede del proveedor después de la llamada.

No se realizan embeddings ni se envía el cuaderno completo automáticamente. Los documentos y notas son contexto de tarea y no autoridad para cambiar instrucciones o permisos.

## Skills

Caveman, Ponytail y Evidence first están habilitadas por defecto. Los perfiles activos son adaptaciones compactas para el motor de AERIS. Las referencias originales y licencias se conservan en `skills/upstream`. Puedes activar, desactivar o importar un `SKILL.md` desde web o CLI.

No se promete un porcentaje fijo de ahorro. Compara tokens y resultados en ejecuciones equivalentes.

## Paradas

- Calidad objetivo alcanzada.
- Presupuesto consumido o reserva insuficiente para la siguiente llamada.
- Número máximo de iteraciones.
- Falta de mejora durante la paciencia configurada.
- Cancelación del usuario.
- Error explícito del proveedor o respuesta sin uso.
- Límite global de diez minutos por misión.
- Reinicio del motor: las misiones pendientes se recuperan como detenidas.

El mejor candidato se conserva si una iteración empeora la puntuación.

## Conectar OAuth

Configura en `.env` los IDs y secretos de cliente. Para el entorno de desarrollo registra:

```text
http://localhost:5173/api/auth/google/callback
http://localhost:5173/api/auth/github/callback
```

Para producción usa el dominio HTTPS de `AERIS_PUBLIC_URL` y las mismas rutas. Configura un cliente para escritorio con origen `http://127.0.0.1:4319` si el proveedor lo admite. Los botones no simulan un login exitoso cuando faltan credenciales.

## Servidor del hackathon

```powershell
npm ci
npm run check
npm run build
```

Configura `HOST=0.0.0.0`, `AERIS_AUTH_REQUIRED=true` y `AERIS_PUBLIC_URL` con el dominio público. Ejecuta `npm start` detrás de un proxy HTTPS con soporte SSE. Usa almacenamiento persistente para `AERIS_DATA_DIR` y configura el workspace del servidor.

El prototipo está diseñado para un propietario y un espacio local compartido. Las cuentas tienen misiones y notas separadas, pero las claves, políticas y archivos son del espacio y solo su administrador puede cambiarlos. Un servicio público multiempresa necesita almacenamiento transaccional, autorización por organización, invitaciones, verificación de correo, recuperación de cuentas y pruebas operativas antes de desplegarse como SaaS.

## Escritorio y CLI juntos

El ejecutable usa `http://127.0.0.1:4319`. Para dirigir la CLI a esa instancia, establece `AERIS_URL` y `AERIS_DATA_DIR` apuntando al directorio `engine` dentro de los datos de usuario de la aplicación Electron. La ubicación habitual es `%APPDATA%/AERIS/engine`.

Guarda copia de todo el directorio de datos, incluida la clave maestra. `workspace.json.bak` conserva el estado anterior a cada escritura. No deben ejecutarse dos servidores sobre el mismo directorio de datos: usa una sola API por espacio.
