# Verificación de la versión 1.0

## Ensayo con inferencia real

Se ejecutó Qwen2.5 0.5B Instruct Q4_K_M con llama.cpp b12198 en CPU. Cada tarea pedía el total de registros de una tabla pública de NHTSA vPIC. Se contrastó la respuesta con el campo Count que entrega el servicio. Los ocho archivos corresponden a combinaciones distintas de fabricante y año. Todos comparten la pregunta y el esquema de columnas. El conjunto de prueba se abrió después de la promoción. [Mediciones, hashes y fuentes](medicion-vpic.json)

| Partición y rama | Aciertos | Llamadas LLM | Tokens reportados | Cargo de API |
| --- | ---: | ---: | ---: | ---: |
| Desarrollo, router estático | 2/2 | 2 | 382 | USD 0 |
| Validación, modelo fijo | 4/4 | 4 | 764 | USD 0 |
| Validación, router estático sin memoria | 4/4 | 4 | 764 | USD 0 |
| Validación, política inicial | 4/4 | 4 | 764 | USD 0 |
| Validación, candidata con memoria | 4/4 | 0 | 0 | USD 0 |
| Test reservado, router estático | 2/2 | 2 | 382 | USD 0 |
| Test reservado, política promovida | 2/2 | 0 | 0 | USD 0 |

En las dos tareas de desarrollo el modelo eligió la operación de conteo. El consolidador guardó esa operación con sus dos casos de evidencia. En cada archivo posterior la política volvió a calcular el resultado con DuckDB. La media de latencia de validación fue 691 ms para el router estático y 432 ms para la candidata en esta máquina. La política aceptada fue `p-b6d7c01ddde3`.

La comparación principal incluyó 22 ejecuciones y 3 056 tokens. Una llamada anterior de calibración en desarrollo consumió otros 353 tokens y falló al pedir una agrupación mensual inválida. Se ajustaron las instrucciones antes de consolidar. Las 17 llamadas medidas del protocolo y su calibración sumaron 3 409 tokens. Las consultas manuales de ingeniería durante el ajuste quedan fuera de ese total. El protocolo incluye los consumos de desarrollo y validación y conserva los errores. La inferencia local tuvo cargo de API cero. El coste eléctrico y la amortización del equipo no se midieron.

En esta familia el sistema prescindió del planificador para operaciones conocidas y mantuvo la exactitud. La prueba utilizó un único LLM local. Quedan abiertas las comparaciones monetarias con servicios facturados, la transferencia a otras preguntas o esquemas y la mejora del propio optimizador. [Protocolo de reproducción](HACKATHON.md)

## Verificación del producto

Pasaron las 22 pruebas automatizadas. Cubren contabilidad, presupuestos, permisos, aislamiento de cuentas, rechazo de los modos de ejemplo, mensajes, uso no reportado, recuperación de contexto con presupuesto, procesamiento completo de 50 000 filas, divisas mixtas, procedencia, unión de tablas, protección entre particiones y validación de experiencias desde una misión.

Los contratos de OpenAI y Anthropic se comprobaron con respuestas controladas. Una prueba distribuye planificación, ejecución y revisión entre tres modelos con una sola credencial. Otras dos someten una misión a cifras inventadas por el modelo. Cuando falta la evidencia, la misión falla. Cuando la evidencia existe, publica los valores calculados con el archivo. La inferencia real de la tabla anterior usó Qwen local. Las API comerciales quedan pendientes de comprobación con las credenciales de la organización.

El ensayo con datos públicos dispone de un espacio propio. La distribución abre vacías las misiones, las notas, las estadísticas de investigación y la mensajería de un espacio nuevo.

## Escritorio Windows

La prueba del portable usa un perfil nuevo en Windows y el servidor incluido en el ejecutable. Desde la interfaz se abrió un Excel de Honda 2023 con 83 filas, se comprobó el conteo, se exportó la gráfica SVG y se vinculó el cálculo a una referencia independiente. La búsqueda documental localizó el pasaje en la página 2 del PDF y en el párrafo 2 del archivo Word. Los siete logotipos de Configuración cargaron correctamente. La interfaz de análisis también se comprobó a 390 píxeles de ancho.

El portable local `AERIS-1.0.0-Windows.exe` es x64, pesa 137 085 220 bytes y se distribuye sin firma de editor. Su SHA-256 es `de7b7a3c7ce1855e02cde9c1d1196bcb6f5862c91ea11c1ec31fbe8d607720c8`.
