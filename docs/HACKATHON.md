# Ensayo del hackathon

## Antes de presentar

Ejecuta `npm ci`, `npm run check` y `npm run build`. Verifica las credenciales, los modelos disponibles y sus tarifas. Mantén el modo local disponible como respaldo de demostración, identificado como tal.

## Recorrido de cinco minutos

1. Abrir el dashboard y mostrar la separación Demostración / Uso real.
2. Crear una misión breve y revisar eventos, tokens, resultados y razón de parada.
3. Mostrar dos agentes en una sala, desde Agentes o dos terminales.
4. Abrir Cerebro de contexto, navegar enlaces y probar la recuperación de fragmentos.
5. Abrir Evolución del sistema y evaluar v1 con validación.
6. Proponer mejora: el optimizador crea candidate.json y compara con la estable.
7. Abrir el experimento y mostrar cambios, resultados por caso, decisión y hash.
8. Repetir la propuesta: si no hay mejora, se registra rechazo.
9. Restaurar v1 para demostrar rollback, o conservar la nueva estable.
10. Ejecutar el test final desde la CLI cuando se decida cerrar el experimento.

## Comandos de respaldo

```powershell
npm run cli -- benchmark --version v1 --split validation
npm run cli -- optimize
npm run cli -- versions
npm run cli -- benchmark --version v2 --split test
npm run cli -- restore v1
```

La versión candidata puede ser v3 o posterior si ya se han hecho experimentos. Usa `versions` para comprobar el identificador vigente.

## Alcance demostrable

El inventario contiene 12 vehículos sintéticos y los conjuntos de benchmark son reproducibles. La validación mide filtros de software, no la precisión general de un modelo. El optimizador actual propone cambios mediante diagnóstico determinista; no necesita inventar llamadas a un LLM para demostrar una mejora de políticas.

Las misiones LLM requieren APIs disponibles y producen métricas facturadas por respuesta. Las revisiones del modelo se muestran como puntuaciones del revisor. No deben presentarse como pruebas independientes.

El sistema no cambia los pesos del LLM, no incluye un metaoptimizador validado y no ha sido sometido a pruebas de carga distribuida. Esas son fases posteriores sobre el motor y los contratos actuales.
