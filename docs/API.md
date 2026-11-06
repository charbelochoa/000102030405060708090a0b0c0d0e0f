# Contrato HTTP

La API vive en `/api`. El navegador usa cookies HttpOnly. La CLI usa `Authorization: Bearer` con el token local de `.aeris/cli-token`. Las respuestas de error tienen `{ "error": "descripción" }`.

| Método | Ruta                             | Uso                                                                 |
| ------ | -------------------------------- | ------------------------------------------------------------------- |
| GET    | `/health`                        | Estado del motor                                                    |
| GET    | `/snapshot`                      | Misiones, ledger, eventos, skills y configuración pública           |
| POST   | `/auth/local`                    | Sesión local, solo loopback y sin autenticación pública obligatoria |
| POST   | `/auth/demo`                     | Sesión de visitante de demostración                                 |
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
| GET    | `/evolution`                     | Versiones, experimentos y reportes                                  |
| POST   | `/optimizations`                 | Generar y validar un candidato local                                |
| POST   | `/benchmarks`                    | Evaluar version y split                                             |
| POST   | `/versions/:id/restore`          | Rollback a una versión aceptada                                     |

Las rutas de archivos, proveedores, ajustes, skills y promoción de políticas requieren administrador. La sesión demo no puede crear misiones con APIs reales.

## Crear una misión

```json
{
  "prompt": "Revisar el proyecto y resolver los errores de validación",
  "model": "gpt-5.4-mini",
  "reviewer": "claude-haiku-4-5",
  "mode": "live",
  "budget": 0.5,
  "maxIterations": 8,
  "target": 90,
  "session": "equipo",
  "attachments": []
}
```

`auto` permite selección del router. `mode=demo` no ejecuta APIs ni archivos. Los adjuntos admiten hasta cinco elementos de 5 MB codificados en base64. Texto: txt, md, json y csv. Imágenes: PNG, JPEG y WebP, de acuerdo con la capacidad del modelo.

## Evolución

`POST /optimizations` no recibe instrucciones ni comandos arbitrarios. El espacio de cambios está restringido por un esquema y la disponibilidad del inventario no se puede desactivar.

```json
{
  "budgetInclusive": true,
  "normalizeFuel": true,
  "minimumSeats": true,
  "onlyAvailable": true
}
```

El reporte del benchmark determinista usa `inputTokens=null`, `outputTokens=null` y coste API cero porque no llama a modelos. La latencia sí se mide. Los experimentos conservan hipótesis, cambios, dictamen y rutas de artefactos locales.
