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

El script `scripts/vpic-study.mjs` usa la API de AERIS para descargar ocho tablas oficiales de fabricantes y años distintos. La referencia independiente es el conteo de NHTSA. Alterna el orden de las ramas en validación. Requiere un espacio experimental nuevo. Para un proveedor de pago activa únicamente su API e indica su identificador y un presupuesto mediante `--provider openai --max-usd 2`. Guarda el reporte fuera del directorio público. Una conexión o medición fallida se informa como error. Nunca precarga los resultados en el producto. [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/)

Para reproducir la prueba local, inicia un servidor llama.cpp compatible en `127.0.0.1:8089` con el alias `qwen2.5-0.5b-instruct`, fija `AERIS_LOCAL_API_KEY=local` y `AERIS_DATA_DIR` a un directorio nuevo antes de iniciar el motor. En la terminal de investigación usa el mismo `AERIS_DATA_DIR`, configura `AERIS_URL` si cambiaste el puerto y ejecuta `node scripts/vpic-study.mjs informe.json`. [Modelo utilizado](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF)

Para un estudio más amplio hacen falta tareas de más familias, varias semillas, controles con distintos modelos, referencias anotadas fuera del equipo que diseña la política e intervalos de incertidumbre. El ensayo inicial mide el uso de memoria en una familia. El experimento comparativo de la versión 1.1 evalúa cómo el historial cambia el orden de búsqueda.

## Aprendizaje por generaciones

En **Evolución → Campaña de aprendizaje**, elige estrategia, número máximo de generaciones, USD por rama y presupuesto total. Cada intento añade un procedimiento o propone cambiar uno. El panel compara la versión anterior y la candidata en los mismos casos. Abre G1, G2 o G3 para ver la pregunta, la decisión y los casos usados. Puedes cambiar entre aciertos, tokens, llamadas, USD y latencia. El gráfico se actualiza también si las mediciones vienen de la CLI.

```powershell
.\aeris.cmd learn --mode adaptive --generations 4 --budget 0.10 --max-usd 2
.\aeris.cmd benchmark --split test --strategy static --version v1
.\aeris.cmd benchmark --split test --strategy adaptive
.\aeris.cmd next-round
```

La campaña se detiene cuando agota las propuestas respaldadas por desarrollo, alcanza el límite de generaciones o presupuesto, recibe una orden de parada o falla una medición. La CLI y la web consumen los mismos endpoints. Al cerrar el cliente termina la coordinación de nuevas ramas. Las mediciones ya terminadas se conservan y una llamada en curso puede finalizar. El presupuesto de campaña reserva un presupuesto de rama antes de enviarla y suma cada ID de ejecución utilizado una vez, incluidas las mediciones existentes que reutiliza. El ledger registra solo llamadas efectuadas.

## Repetir la comparación de optimizadores

Inicia dos servidores de investigación con directorios `AERIS_DATA_DIR` distintos en los puertos 4393 y 4394. Ambos deben tener el mismo catálogo, tarifa y único proveedor conectado. El script obtiene las tres tablas oficiales una vez para ambos motores. En cuatro consultas por partición compara un orden fijo y uno adaptativo. Guarda el informe indicado. El presupuesto se divide entre las dos estrategias y las fases de campaña y test de cada una.

```powershell
node --import tsx scripts/proposal-study.mjs --static-data RUTA_CONTROL --adaptive-data RUTA_ADAPTATIVA --provider nvidia --max-usd 2 --output informe.json
```

El protocolo original de ocho archivos admite también un proveedor comercial único desde un espacio nuevo.

```powershell
node scripts/vpic-study.mjs informe.json --provider openai --max-usd 2
```

[Mediciones comparativas y alcance](AUDITORIA-1.1.md)

Para incluir la calibración de equipos activa **Comparar equipos de 1, 2 y 3 agentes** o añade `--teams` a `learn`. Esta opción añade hasta seis llamadas de inferencia por caso de desarrollo para los tres flujos. La preparación estática inicial, los ensayos de validación y las repeticiones tras un error se contabilizan aparte. Para medir un solo flujo usa `benchmark --split dev --strategy team2 --version v1`. El endpoint rechaza la calibración de equipos en test y validación. [Resultados de la calibración](AUDITORIA-1.1.md)
