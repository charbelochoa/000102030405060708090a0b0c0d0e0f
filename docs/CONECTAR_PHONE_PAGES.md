# Conexión del servicio existente con Pages

API: `https://aeris-phone.136-118-8-128.sslip.io`.
Frontend: `https://charbelochoa.github.io/000102030405060708090a0b0c0d0e0f/?page=app#phone`.
Servicio existente: `aeris-phone-test.service`, aplicación en `/home/carlitosyt529/aeris-phone-test`, puerto local `4330`.

El reporte original describe el commit `85901f3`. Ese código todavía no incluye sesiones Bearer para Pages ni `AERIS_FRONTEND_URL`. Debe publicarse la integración de la copia de trabajo actual en la rama `phone-test` antes de actualizar el servidor. Un reinicio del código antiguo no basta.

## Actualizar el servicio aislado

Desde una terminal con acceso a la llave dedicada:

```powershell
ssh -i "$env:USERPROFILE\.ssh\aeris_deploy" carlitosyt529@136.118.8.128
```

En la VM, inspecciona primero el servicio para usar la ruta real del runtime Node 24 y conservar su ExecStart, usuario, directorio de datos y límite de memoria:

```bash
sudo systemctl cat aeris-phone-test.service
cd /home/carlitosyt529/aeris-phone-test
git status --short
git branch --show-current
```

Si la copia está limpia y está en `phone-test`, actualiza después de publicar el cambio de integración. Si hay cambios locales, revísalos antes de continuar; no uses reset ni limpieza forzada. Con el runtime aislado en PATH:

```bash
git pull --ff-only origin phone-test
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
npm run check
npm run build
```

Si las comprobaciones fallan, conserva el servicio previo y resuelve el fallo antes de reiniciar.

Abre `sudo systemctl edit aeris-phone-test.service` y agrega las variables siguientes bajo `[Service]`; no cambies ExecStart ni los límites existentes:

```ini
[Service]
Environment="HOST=127.0.0.1"
Environment="PORT=4330"
Environment="AERIS_PUBLIC_URL=https://aeris-phone.136-118-8-128.sslip.io"
Environment="AERIS_FRONTEND_URL=https://charbelochoa.github.io/000102030405060708090a0b0c0d0e0f/"
Environment="AERIS_AUTH_REQUIRED=true"
Environment="AERIS_RSI_ENABLED=true"
```

Conserva los ajustes de AERIS_DATA_DIR y AERIS_WORKSPACE actuales para mantener las conversaciones y credenciales. El RSI permanece activo.

```bash
sudo systemctl daemon-reload
sudo systemctl restart aeris-phone-test.service
sudo systemctl is-active aeris-phone-test.service
curl --fail http://127.0.0.1:4330/api/health
```

## Proxy del sitio dedicado

En `/etc/caddy/Caddyfile`, sustituye únicamente el bloque del host `aeris-phone.136-118-8-128.sslip.io` por el contenido de `deploy/phone-test.Caddyfile`. No añadas un segundo bloque con el mismo host. Conserva los bloques de educatia y de los otros servicios.

Quita de ese bloque las cabeceras CORS con `*` y las respuestas OPTIONS del proxy: Express debe resolver CORS y preflight para que login, Authorization, errores y SSE compartan el mismo control de origen. El proxy conserva `/api` y envía al puerto `4330`.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
npx tsx scripts/check-phone-api.ts
```

La comprobación no crea cuentas, conversaciones ni llamadas pagadas. Verifica HTTPS, preflight de Pages, autenticación requerida y rechazo de orígenes ajenos. No demuestra por sí sola que una credencial de modelo funcione.

## Publicar Pages

El workflow `.github/workflows/pages.yml` publica la rama `phone-test` y usa la API HTTPS indicada como valor predeterminado. Si existe la variable de repositorio `VITE_API_URL`, debe contener exactamente `https://aeris-phone.136-118-8-128.sslip.io`, sin `/api` final. Una variable antigua con HTTP hará fallar la compilación para evitar contenido mixto.

En GitHub, Settings → Pages debe usar GitHub Actions. Publica los cambios de integración en `phone-test` o ejecuta `Publish interface` seleccionando esa rama. Esto no requiere fusionar a main.

Abre la URL de frontend indicada arriba. Usa una cuenta del servidor remoto: las sesiones locales del equipo no se transfieren a la VM. Las sesiones remotas usan Bearer, y SSE y descargas funcionan sin depender de cookies de terceros.

## Estado de verificación

Este entorno rechazó tanto la lectura de `C:\Users\Juan\.ssh\aeris_deploy` como la conexión TCP al puerto 22. No se ha reiniciado el servicio remoto ni publicado Pages desde este turno. Las URLs públicas tampoco pudieron verificarse con la herramienta web. La integración y su comprobación deben validarse desde la VM o desde una terminal con acceso antes de declararlas operativas.
