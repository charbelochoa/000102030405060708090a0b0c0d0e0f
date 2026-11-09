# Prueba en GCP y GitHub Pages

Servidor indicado: `carlitosyt529@136.118.8.128`, instancia `instance-20260616-220416`.
El acceso SSH desde el entorno de desarrollo fue rechazado antes de autenticar. No se ha publicado ni configurado la VM.

## Servidor

Una VM de Compute Engine ejecuta una sola instancia de AERIS. Docker Compose conserva datos, claves de cifrado, documentos y archivos en volúmenes persistentes. No usar varias réplicas del servidor: el almacenamiento actual es de un solo escritor.

1. Instala Docker Engine y Compose en la VM. Autoriza TCP 80 y 443 en el firewall de GCP; el puerto 4318 queda interno a Docker.
2. Asigna un dominio al registro A de `136.118.8.128`. Es necesario HTTPS para llamadas desde GitHub Pages; una API HTTP en esa IP será bloqueada como contenido mixto.
3. Clona este repositorio en la VM y entra en su carpeta.
4. Copia `deploy/server.env.example` a `deploy/server.env`. Define `AERIS_PUBLIC_URL` con el dominio HTTPS de la API y `AERIS_FRONTEND_URL` con la dirección exacta de Pages.
5. Crea primero la cuenta administradora sin publicar el proxy HTTPS:

```bash
export AERIS_DOMAIN=api.tudominio.com
docker compose -f deploy/compose.yaml up -d --build api
read -r -p 'Correo del administrador: ' ADMIN_EMAIL
read -r -s -p 'Contraseña de al menos 10 caracteres: ' ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_PASSWORD
docker compose -f deploy/compose.yaml exec -T -e ADMIN_EMAIL -e ADMIN_PASSWORD api node --input-type=module -e '
const r = await fetch("http://127.0.0.1:4318/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: "Administrador" }) });
if (!r.ok) throw new Error("Registro HTTP " + r.status);
console.log("Administrador creado");'
unset ADMIN_EMAIL ADMIN_PASSWORD
docker compose -f deploy/compose.yaml up -d https
```

Conserva `AERIS_DOMAIN` en `deploy/.env` para reinicios y ejecuta Compose desde `deploy` si usas ese archivo. Haz respaldo de los volúmenes, especialmente `/data/master.key`: sin esa clave no se pueden recuperar las credenciales ni la réplica cifrada.

## Firebase Realtime Database

La primera versión mantiene el disco como fuente de verdad y replica el estado cifrado en Firebase. No es todavía una base primaria compartida ni permite varios escritores. Los eventos de la API actualizan la interfaz mediante SSE; la reconciliación periódica recupera desconexiones.

1. Crea una instancia de Realtime Database en el proyecto GCP/Firebase.
2. Aplica las reglas de `deploy/firebase.rules.json`: acceso público denegado.
3. Asigna a la cuenta de servicio de la VM permisos para administrar esa base de pruebas. La REST API acepta tokens OAuth de Google; revisa los permisos y los scopes de la VM indicados en la documentación oficial.
4. Establece `AERIS_FIREBASE_URL` en `deploy/server.env`, por ejemplo `https://TU-BASE-default-rtdb.firebaseio.com`, y recrea el servicio API.
5. Consulta `GET /api/database/status` con una sesión administradora: `configured`, `pending`, `updatedAt` y `error` describen el estado real de la réplica.

Cada escritura local dispara una réplica cifrada; las escrituras pendientes se agrupan. Una falla conserva el disco local y se reintenta en la siguiente escritura. No se realiza recuperación automática desde Firebase ni se expone la base al navegador. El estado remoto es una instantánea cifrada, no tablas consultables de clientes.

Referencia: [autenticación REST de Firebase](https://firebase.google.com/docs/database/rest/auth).

## GitHub Pages

En Settings → Pages selecciona GitHub Actions. En Settings → Secrets and variables → Actions → Variables define `VITE_API_URL=https://api.tudominio.com` sin `/api` final. Ejecuta manualmente el workflow `Publish interface`.

El workflow publica solamente la interfaz. Las claves de proveedores permanecen en el servidor. Las rutas de navegación usan `?page=app#providers` para que una recarga funcione en Pages sin reglas de reescritura. Las sesiones remotas utilizan un token revocable en sessionStorage; SSE y descargas usan Authorization para funcionar sin cookies de terceros. OAuth continúa orientado al sitio del servidor; para Pages utiliza correo y contraseña en esta primera versión.

## Proveedores y teléfono

Proveedores y APIs muestra las credenciales disponibles y su historial sin revelar secretos. «Consultar modelos disponibles» consulta el catálogo de la cuenta; no garantiza que todos sean modelos de chat ni que la cuenta tenga cuota para ejecutarlos. Los nuevos modelos se añaden con sus tarifas y capacidades verificadas para conservar la contabilidad real.

El teléfono utiliza la misma API que las misiones. Un error `EACCES` indica que el proceso no tiene permiso para salir a Internet. En este entorno ocurre al contactar OpenAI, Gemini y NVIDIA. En la VM comprueba DNS y salida HTTPS; no desactives TLS. No se ha comprobado una respuesta real de modelo desde este entorno.

Para probar localmente fuera del entorno restringido del agente, detén el servidor de desarrollo anterior y ejecuta `start-dev.cmd` desde Windows. Esto permite comprobar si la restricción corresponde al entorno de ejecución; no modifica el firewall ni garantiza disponibilidad o cuota del proveedor.

## RSI

Se conserva activo con `AERIS_RSI_ENABLED=true`. El ciclo existente propone políticas a partir de desarrollo, evalúa con validación independiente y decide su promoción; el test reservado sella el ciclo. No cambia pesos del LLM ni crea subagentes ilimitados. La campaña se inicia explícitamente y respeta presupuesto y número de generaciones. `AERIS_RSI_ENABLED=false` bloquea propuestas, ensayos, promociones y nuevas lecciones del teléfono conservando el historial y las calificaciones.

## Comprobaciones en la VM

Comprueba `/api/health`, login desde Pages, persistencia tras reiniciar la API, conexión SSE, catálogo de un proveedor, una conversación con presupuesto bajo y `/api/database/status`. Una publicación completa requiere dominio, permisos de GCP/Firebase y ejecución de estas comprobaciones en la VM.

Verificación local realizada: TypeScript, las cinco pruebas nuevas de catálogo/red/Firebase/sesiones/pausa RSI y la compilación de la interfaz para una subruta de Pages pasan. La suite completa conserva ocho fallos vinculados al motor Python no accesible y la compilación del servidor falla por permisos de lectura de esbuild. Docker, Firebase real, SSH y respuestas reales de proveedores siguen pendientes de verificación en la VM.
