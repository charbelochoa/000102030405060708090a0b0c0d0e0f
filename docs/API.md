# Contrato HTTP

La API vive en `/api`. El navegador usa cookies HttpOnly. La CLI usa `Authorization: Bearer` con el token local de `.aeris/cli-token`. Las respuestas de error tienen `{ "error": "descripción" }`.

| Método | Ruta                             | Uso                                                                 |
| ------ | -------------------------------- | ------------------------------------------------------------------- |
| GET    | `/health`                        | Estado del motor                                                    |
| GET    | `/snapshot`                      | Misiones, ledger, eventos, skills y configuración pública           |
| POST   | `/auth/local`                    | Sesión local, solo loopback y sin autenticación pública obligatoria |
| POST   | `/auth/register`                 | Registro con nombre, correo y contraseña                            |
| POST   | `/auth/login`                    | Acceso por correo                                                   |
| POST   | `/auth/logout`                   | Revocar sesión                                                      |
| GET    | `/auth/google`                   | Inicio OAuth Google                                                 |
| GET    | `/auth/github`                   | Inicio OAuth GitHub                                                 |
| GET    | `/events`                        | Stream SSE de eventos del propietario                               |
| POST   | `/runs`                          | Crear y ejecutar misión                                             |
| GET    | `/runs/:id`                      | Inspeccionar misión propia                                          |
| POST   | `/runs/:id/stop`                 | Cancelar misión propia                                              |
| GET    | `/export`                        | CSV de métricas por misión                                          |
| PATCH  | `/settings`                      | Cambiar preferencias, catálogo o proveedores                        |
| PUT    | `/providers/:id`                 | Guardar o quitar una clave                                          |
| POST   | `/skills`                        | Importar instrucciones                                              |
| PATCH  | `/skills/:id`                    | Activar, desactivar o editar                                        |
| GET    | `/messages?room=general`         | Mensajes de una sala                                                |
| POST   | `/messages`                      | Mensaje con room, from, to y text                                   |
| GET    | `/files?path=.`                  | Archivos del espacio                                                |
| GET    | `/file?path=README.md`           | Contenido UTF-8                                                     |
| PUT    | `/file`                          | Escritura autorizada con path y content                             |
| GET    | `/search?q=router&path=server`   | Búsqueda literal                                                    |
| POST   | `/worktrees`                     | Crear worktree con name                                             |
| GET    | `/context`                       | Páginas del propietario                                             |
| POST   | `/context`                       | Guardar página con title, content, enabled e id opcional            |
| GET    | `/context/backlinks?title=AERIS` | Referencias entrantes                                               |
| POST   | `/context/retrieve`              | Recuperar contexto con query y maxTokens                            |


## Herramientas y evidencia

Todos los endpoints de esta tabla requieren sesión. Experimentos y cambios de versión requieren administrador, salvo lectura del estado.

| Método | Ruta | Entrada o salida |
| --- | --- | --- |
| POST | /lab/inspect | file, sheet opcional. Cobertura, columnas, hojas y limitaciones |
| POST | /lab/search | file, query. Fragmentos y ubicación |
| POST | /lab/analyze | file, plan, sheet opcional. Artefacto de la cuenta, asociado a una misión |
| GET | /lab/artifacts/:id | Resultado completo con procedencia y comprobaciones |
| POST | /lab/artifacts/:id/experience | Contrasta el artefacto de una misión con una respuesta de referencia independiente para desarrollo. Body con prompt y expected |
| GET | /lab/artifacts/:id/chart.svg | kind bar o line y offset de grupos |
| GET | /lab/vehicles | make y year. Respuesta oficial vPIC con origen y hora |
| GET | /context/procedures | Procedimientos de la versión activa y casos de desarrollo que los respaldan |
| GET | /evolution | Versiones, ensayos, mediciones y estado de cierre |
| POST | /evolution/cases | prompt, file, split, expected, sheet opcional. Solo desarrollo admite plan de referencia |
| POST | /optimizations | Propone un cambio a partir de desarrollo. Acepta mode adaptive o static |
| POST | /benchmarks | taskId, strategy, version y budget por caso. team1, team2 y team3 calibran arquitecturas en desarrollo |
| POST | /evolution/decide | Decide en validación y conserva métricas pareadas. Admite candidate para prevenir decisiones obsoletas |
| POST | /evolution/rounds | Archiva la evaluación finalizada y abre otro ciclo conservando políticas y experiencia |
| POST | /versions/:id/restore | Restaura una versión validada antes del cierre |

Los adjuntos de entrada usan name, type y data en base64. Una misión admite cinco archivos de hasta 5 MB. El motor devuelve errores de validación HTTP 400 y errores de ejecución HTTP 422. Una misión asíncrona que falla conserva el error recuperable en /runs/:id. La transcripción de la misión puede incluir datos de los archivos. Pertenece a la cuenta que ejecutó la misión.

## Teléfono de clientes

Requieren sesión. Cada conversación usa la sala `tel-ID` y cada mensaje del cliente crea una misión de una iteración, así que tokens, USD y latencia quedan en el mismo registro de uso.

- `GET /api/phone/conversations`: conversaciones con mensajes, turnos y uso medido.
- `POST /api/phone/conversations`: `{company, customer, scenario?, model?}`.
- `POST /api/phone/conversations/:id/messages`: `{text, budget?}`. Responde 202; la respuesta de la empresa aparece como mensaje cuando termina la misión. Si falla, no se inventa texto.
- `POST /api/phone/conversations/:id/rating`: `{resolved, score?, note?}`. Con `note` guarda una página `Lección de atención` en el Cerebro de contexto.
- `GET /api/phone/export`: descarga las conversaciones en JSON.
