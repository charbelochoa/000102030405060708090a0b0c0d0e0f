# Reporte de despliegue: Simulador de teléfono de atención y agentes recursivos

Documento técnico para el equipo y agentes colaboradores (Codex / Antigravity).

---

## 1. Resumen de lo realizado

1. **Nueva funcionalidad: Teléfono de clientes (`/app#phone`)**
   - Interfaz visual en forma de smartphone con chat interactivo en tiempo real.
   - Diseñado para simular conversaciones entre clientes y agentes de atención empresarial.
   - Cada interacción genera una misión unitaria registrada en el ledger de uso (tokens, coste USD, latencia).
   - **Evaluación y aprendizaje**: al calificar una conversación (resuelta/no resuelta + lección), se almacena automáticamente una página `#atencion-cliente` en el **Cerebro de contexto** (`server/brain.ts`), la cual es recuperada dinámicamente por el agente en conversaciones futuras similares.
   - Agrupación estadística de efectividad según lecciones acumuladas.

2. **Rama Git aislada (`phone-test`)**
   - Rama creada en GitHub: `phone-test`
   - URL: `https://github.com/charbelochoa/000102030405060708090a0b0c0d0e0f/tree/phone-test`
   - Commit inicial: `85901f3` (`Add customer phone chat simulator to test learning agents`).
   - Los cambios locales de `main` creados por otros procesos (`src/AgentCycle.tsx`, `docs/GCP.md`, `.github/workflows/pages.yml`, etc.) no fueron alterados ni pisados.

3. **Despliegue en servidor GCP (Temporal)**
   - **Host**: `136.118.8.128` (instancia `instance-20260616-220416`).
   - **Directorio de la app**: `/home/carlitosyt529/aeris-phone-test`
   - **Entorno**: Node.js 24 standalone aislado en el directorio del proyecto (sin tocar el sistema base).
   - **Servicio systemd**: `aeris-phone-test.service` en el puerto interno `127.0.0.1:4330` con tope de RAM de 400 MB.
   - **Servicios coexistentes respetados**: `educatia-lab`, `educatia-portal`, `caddy`, etc. siguen intactos y activos.

4. **Acceso público en Internet y compatibilidad con GitHub Pages**
   - Proxy configurado en Caddy con cabeceras CORS (`Access-Control-Allow-Origin: *`) y soporte para preflight `OPTIONS`.
   - **URL directa (HTTP)**: [http://aeris-phone.136-118-8-128.sslip.io/app#phone](http://aeris-phone.136-118-8-128.sslip.io/app#phone)
   - **URL directa (HTTPS)**: [https://aeris-phone.136-118-8-128.sslip.io/app#phone](https://aeris-phone.136-118-8-128.sslip.io/app#phone)
   - **API Health Check**: `http://aeris-phone.136-118-8-128.sslip.io/api/health`
   - **Para GitHub Pages**: Si se compila el frontend en Pages con `VITE_API_URL=http://aeris-phone.136-118-8-128.sslip.io`, la API aceptará las solicitudes cruzadas sin restricciones.

---

## 2. Mapa de archivos de la funcionalidad

| Archivo | Tipo | Propósito |
| :--- | :--- | :--- |
| `src/Phone.tsx` | Frontend React | Vista del teléfono, chat interactivo, panel de calificación y métricas de mejora. |
| `src/phone.css` | Estilos | Diseño responsive de la carcasa del teléfono, notch, animaciones de typing y burbujas. |
| `shared/phone.ts` | Contrato TypeScript | Tipos compartidos (`PhoneConversation`, `PhoneRating`, `PhoneGroup`, etc.). |
| `server/phone.ts` | Backend Express | Endpoints REST (`/api/phone/conversations`, mensajes, calificaciones y exportación). |
| `tests/phone.test.ts` | Pruebas | Suite automatizada de pruebas para el ciclo de vida del chat y contexto. |
| `docs/API.md` | Documentación | Especificación de los endpoints creados. |
| `docs/INSTRUCCIONES.md` | Documentación | Guía de uso de la pantalla de teléfono. |

---

## 3. Comandos para administración y pruebas

### Acceso SSH (llave dedicada en máquina local)
```powershell
ssh -i $env:USERPROFILE\.ssh\aeris_deploy carlitosyt529@136.118.8.128
```

### Túnel local (alternativa privada)
```powershell
ssh -i $env:USERPROFILE\.ssh\aeris_deploy -N -L 4330:127.0.0.1:4330 carlitosyt529@136.118.8.128
# Navegar a: http://localhost:4330/app#phone
```

### Logs del servicio en el servidor
```bash
sudo journalctl -u aeris-phone-test -f
```

### Desmontar / limpiar el despliegue cuando termine el test
```bash
sudo systemctl disable --now aeris-phone-test
sudo rm /etc/systemd/system/aeris-phone-test.service
sudo systemctl daemon-reload
rm -rf /home/carlitosyt529/aeris-phone-test
```
*(Y remover el bloque `aeris-phone.136-118-8-128.sslip.io` de `/etc/caddy/Caddyfile`).*
