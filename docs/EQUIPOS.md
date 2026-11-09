# Dos modos de coordinación

Cada misión elige `coordination: orchestrated | autonomous`. Las misiones y conversaciones anteriores conservan el comportamiento con orquestador. El modo por defecto es `orchestrated`.

Ambos modos comparten una sola API, permisos, herramientas, recuperación acotada de notas, contabilidad por llamada, tarifas históricas, límite de coste y cancelación. Las políticas y experimentos RSI existentes se conservan. El nuevo modo no promueve políticas automáticamente ni cambia los pesos de un modelo. Para ejecutar todos los roles multiagente (constructor/resolver, supervisor/revisor y subagentes) con **una sola llave de API y un único modelo LLM**, consulta `docs/UNA_SOLA_API.md` (`reviewer: "same"`).

## Con orquestador

Conserva el flujo existente: router/planificador cuando corresponde, encargos opcionales a especialistas, constructor y revisión según la solicitud. La selección manual de modelo sigue disponible.

## Equipo autónomo

Primera implementación dentro de un solo proceso, con dos funciones de trabajador: resolver y revisar. El software publica una solicitud inicial y los trabajadores toman encargos compatibles del tablero. No se llama al planificador LLM central.

1. Resolver toma `solve-1`, consulta contexto y usa las herramientas autorizadas.
2. Publica `review-1`, que depende de la finalización de `solve-1`.
3. El revisor toma el resultado en una llamada separada y devuelve puntuación y correcciones.
4. Si no se cumple la condición de parada, publica el siguiente encargo de resolución con dependencia en la revisión.
5. Se termina por objetivo, presupuesto, número máximo de rondas, falta de mejora, cancelación o error. Los encargos pendientes se cancelan ante un fallo.

Los identificadores por función y ronda evitan publicar dos veces el mismo encargo dentro de una misión. La toma de un encargo es síncrona antes de cualquier espera, por lo que dos trabajadores del mismo proceso no pueden tomarlo simultáneamente. Las dependencias bloqueadas producen un error en lugar de un ciclo infinito. Los encargos y transiciones se guardan con la misión y generan eventos SSE.

En automático, resolver empieza con el nivel bajo disponible y puede subir un nivel ante una revisión insuficiente. El revisor se selecciona por reglas locales, preferentemente con otro modelo. Si solo hay uno, se usa en una llamada con contexto separado. Un modelo fijado manualmente no cambia. Las puntuaciones de revisión son opiniones de modelo; no sustituyen casos con respuestas de referencia ni prueban que un modelo mayor sea mejor.

## Uso

En Nueva misión o al iniciar una conversación en Teléfono, selecciona Organización del equipo. En el modo autónomo aparece un tablero con dependencias, estados, trabajador y modelo de cada encargo.

```bash
npm run cli -- run "Resuelve esta consulta" --coordination autonomous --budget 0.50 --iterations 3 --wait
npm run cli -- run "Resuelve esta consulta" --coordination orchestrated --budget 0.50 --iterations 3 --wait
```

```json
{
  "prompt": "Resuelve esta consulta",
  "coordination": "autonomous",
  "model": "auto",
  "reviewer": "auto",
  "budget": 0.5,
  "maxIterations": 3
}
```

El JSON se envía a `POST /api/runs`. `POST /api/phone/conversations` acepta el mismo selector y lo conserva para cada turno. `GET /api/runs/:id` incluye `coordination` y `tasks`; los turnos del teléfono incluyen sus tareas. Los modelos de prueba y sus resultados automatizados no representan mediciones reales de calidad.

## Límites de esta etapa

Se ejecutan encargos secuencialmente dentro del proceso actual para mantener la reserva de presupuesto compartida. Es una colaboración con funciones predefinidas y entrega de encargos entre trabajadores; todavía no es un mercado de tareas abiertas ni una empresa con departamentos que se creen solos.

El tablero persiste para inspección, pero no reanuda misiones tras reiniciar. La recuperación existente detiene misiones interrumpidas. No hay trabajadores distribuidos, reservas con vencimiento, sustitución automática de procesos ni una cola transaccional externa. La réplica Firebase no implementa esos mecanismos. Antes de desplegar varios trabajadores se requiere almacenamiento con toma transaccional y recuperación de reservas.

La deduplicación del tablero no garantiza idempotencia de pagos ni reembolsos: esas acciones aún requieren contratos y controles específicos del proveedor. La mejora RSI del reparto de trabajo y la comparación experimental entre modos quedan como pasos posteriores; esta versión permite ejecutar y observar ambos modos sin reemplazar la arquitectura existente.
