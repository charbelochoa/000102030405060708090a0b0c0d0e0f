# Protocolo de evaluación

Hipótesis de trabajo. Una configuración aprendida puede reducir tokens y coste por tarea manteniendo la calidad frente a un flujo estático. La comparación de dinero requiere modelos con costes reales distintos de cero. El experimento local mide tokens, exactitud de resultados, llamadas y latencia.

## Preparación

Registra casos independientes con pregunta, archivo, partición y respuesta de referencia compuesta por pares `label/value` con decimales como texto. Para el total sin agrupar la etiqueta es `Total`. La CLI acepta rutas de archivo relativas al manifiesto. La interfaz acepta el mismo JSON con `file` como objeto `{name,type,data}`, donde `data` es base64.

```powershell
.\aeris.cmd case-import caso.json
.\aeris.cmd benchmark --split dev --strategy static --version v1
.\aeris.cmd optimize
```

La consolidación usa los planes correctos de desarrollo o un plan de referencia que el motor haya ejecutado y verificado contra el resultado esperado. Desacuerdos se excluyen. Cada candidato tiene un identificador de contenido. Importa las tres particiones antes de consolidar. Se rechaza la reutilización del mismo archivo entre particiones, también al reordenar filas con la misma representación tabular.

## Controles y decisión

En cada caso de validación ejecuta cuatro ramas con la misma tarifa, catálogo, presupuesto y esquema. **Fixed** planifica con el nivel más alto disponible. **Static** usa el planificador ligero fijo. **Adaptive estable** y **adaptive candidata** prueban la política anterior y la nueva. Con un solo modelo, las dos primeras ramas usan el mismo LLM. La candidata ejecuta el procedimiento verificado directamente cuando hay coincidencia. Las respuestas esperadas nunca se envían al modelo.

```powershell
.\aeris.cmd benchmark --split validation --strategy fixed --version v1
.\aeris.cmd benchmark --split validation --strategy static --version v1
.\aeris.cmd benchmark --split validation --strategy adaptive --version v1
.\aeris.cmd benchmark --split validation --strategy adaptive --version ID_CANDIDATA
.\aeris.cmd promote
.\aeris.cmd versions
```

La pantalla Evolución ejecuta las ramas de un caso y conserva cada medición. La puerta exige acierto en toda la validación, contabilidad completa, ausencia de errores de ejecución, ninguna subida de tokens ni de coste agregados y al menos una mejora. El dashboard de memoria compara intentos con recuperación frente al control estático emparejado. La CLI permite restaurar una versión aceptada antes de abrir el test. Abrir el test sella el estudio.

## Reproducción con datos públicos

El script `scripts/vpic-study.mjs` usa la API de AERIS para descargar ocho tablas oficiales de fabricantes y años distintos. La referencia independiente es el conteo de NHTSA. Alterna el orden de las ramas en validación. Requiere un espacio experimental nuevo y proveedores exclusivamente locales o declarados gratuitos. Guarda el reporte fuera del directorio público. Una conexión o medición fallida se informa como error. Nunca precarga los resultados en el producto. [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/)

Para reproducir la prueba local, inicia un servidor llama.cpp compatible en `127.0.0.1:8089` con el alias `qwen2.5-0.5b-instruct`, fija `AERIS_LOCAL_API_KEY=local` y `AERIS_DATA_DIR` a un directorio nuevo antes de iniciar el motor. En la terminal de investigación usa el mismo `AERIS_DATA_DIR`, configura `AERIS_URL` si cambiaste el puerto y ejecuta `node scripts/vpic-study.mjs informe.json`. [Modelo utilizado](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF)

Para un estudio más amplio hacen falta tareas de más familias, varias semillas, controles con distintos modelos, referencias anotadas fuera del equipo que diseña la política e intervalos de incertidumbre. El ensayo actual no prueba una mejora del algoritmo de búsqueda ni el coste de infraestructura.
