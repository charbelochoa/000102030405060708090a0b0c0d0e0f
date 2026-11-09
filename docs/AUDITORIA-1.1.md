# Auditoría del hackatón

## Qué aprende AERIS

La unidad que cambia es la política de ejecución del agente. En análisis de tablas puede recordar un procedimiento respaldado por una respuesta independiente y utilizarlo en archivos nuevos con la misma pregunta normalizada, columnas, tipos y hoja. Una generación ensaya un cambio. Los planes de desarrollo incompatibles se excluyen o motivan una propuesta de retirada. La política activa sigue resolviendo misiones mientras se prueba la candidata.

El buscador adaptativo conserva las promociones y rechazos de cada clase de operación, por ejemplo conteo global y conteo filtrado. Para elegir el siguiente experimento ordena las clases por `(aceptadas + 1) / (decididas + 2)`. El empate se resuelve por orden de incorporación de las experiencias. El control fijo sigue ese orden durante todo el estudio. Ambos modos evitan repetir propuestas equivalentes. Una regresión atribuible a un cambio descarta ese mismo cambio con idéntica evidencia. Las decisiones incluyen la pregunta, la operación, las experiencias y los identificadores del historial consultado. La fórmula de búsqueda y los pesos del LLM siguen fijos.

La aprobación requiere acierto en todos los casos de validación, contabilidad completa, configuración comparable para todas las ramas, coste y tokens iguales o menores y alguna mejora en calidad, tokens o coste. La decisión guarda las dos mediciones y los identificadores de las ejecuciones. Un fallo del proveedor deja la candidata pendiente para poder repetir la medición.

Tras ejecutar el control y la política estable sobre todos los casos reservados, **Nuevo ciclo** conserva las políticas y el aprendizaje de decisiones anteriores. Permite nuevos casos de desarrollo y exige nuevos archivos de evaluación. Comprueba tanto el hash del archivo como el del contenido tabular. El buscador recibe experiencias de desarrollo y decisiones históricas de validación. Las respuestas de test quedan excluidas. Para decisiones de versiones anteriores solo se recuperan las cifras si existen las trazas emparejadas con fecha anterior a la decisión.

## Prueba controlada del orden de propuestas

Se compararon dos motores aislados con igual catálogo, modelo, orden inicial, cuatro generaciones y el mismo presupuesto. Ambos recibieron las mismas tablas reales de NHTSA vPIC y cuatro redacciones de una pregunta de conteo. Se fijaron dos planes de desarrollo con un filtro que coincidía con todo el archivo inicial y dos planes de conteo global. El diseño introduce deliberadamente la oportunidad de aprender de un rechazo. Cada operación se ejecutó sobre las tablas completas, y el evaluador utilizó el conteo publicado por NHTSA. Las cuatro preguntas comparten una tabla por partición. [Datos, fuentes y mediciones](medicion-propuestas.json)

| Medición | Orden fijo | Adaptativo |
| --- | ---: | ---: |
| Propuestas hasta la primera promoción | 3 | 2 |
| Propuestas hasta la segunda promoción | 4 | 3 |
| Propuestas aceptadas de cuatro | 2 | 2 |
| Aciertos de la política final en las cuatro preguntas reservadas | 4/4 | 4/4 |
| Llamadas LLM en el protocolo completo de cada estrategia | 29 | 27 |
| Tokens en el protocolo completo | 5 553 | 5 170 |
| Cargo de API | USD 0 | USD 0 |

El modelo real fue Qwen2.5 0.5B Instruct en CPU mediante la API local de llama.cpp. En desarrollo se proporcionaron planes de referencia verificados. El planificador intervino en las ramas de control y en las consultas sin memoria. En la cuarta generación adaptativa se rechazó una candidata que reducía el consumo pero fallaba una de las cuatro preguntas. Se conservó la versión anterior. Esta comparación mide el orden en que se descubren mejoras en un escenario controlado. Para evaluar generalización, costes comerciales o la ventaja de equipos mayores en otras familias harán falta más problemas y proveedores.

## Aprender cuándo repartir el trabajo

En la campaña puede activarse la calibración de equipos en desarrollo. Se miden tres flujos sobre los mismos casos. Un agente planifica en nivel bajo. El segundo examina ese plan en nivel medio. El tercero puede corregirlo en nivel alto. Un proveedor único puede atender varios niveles. Con un único modelo disponible, los roles se ejecutan como llamadas independientes al mismo modelo. El motor computa el resultado de cada plan y lo coteja con la respuesta externa. Un JSON de plan inválido se conserva como fallo de resolución. Un problema de transporte o uso desconocido interrumpe la campaña.

Con cobertura completa y configuración comparable, el buscador puede proponer el equipo que acertó todos los casos de desarrollo con el menor coste, luego menos tokens y, en empate, menos agentes. Se conservan las identidades de los modelos y las trazas de desarrollo. Un procedimiento determinista también puede competir si hay un plan consistente. El equipo solo se utiliza como política activa una vez que supera la comparación independiente. Una repetición posterior de la misma clase de problema vuelve a consultar al equipo promovido.

Se calibró Qwen real con 83 registros de Honda 2023 obtenidos de NHTSA. Los tres flujos acertaron. Usaron 191, 431 y 685 tokens en una, dos y tres llamadas respectivamente. Es una calibración de una tarea de desarrollo. En una prueba de contrato adicional con transportes controlados, solo el tercer rol produjo la operación correcta y el buscador ofreció el equipo de tres para validación. [Medición de equipos](medicion-equipos.json)

## Cobertura del producto

| Requisito | Entrega y comprobación |
| --- | --- |
| Web, CLI y Windows | Una API Express, contratos TypeScript compartidos y portable x64 con el motor de documentos. Acceso por correo y adaptadores OAuth para Google y GitHub. La activación OAuth depende del registro del cliente y su callback público. |
| Equipo de modelos | Planificador, constructor, revisor y hasta dos encargos analíticos opcionales a especialistas de distintos niveles. El constructor recibe sus contribuciones. Los mensajes, modelos y llamadas quedan en la misión. Las llamadas de una misión se contabilizan secuencialmente. Varias misiones y terminales pueden operar a la vez. |
| Terminal, contexto y herramientas | Archivos, escrituras autorizadas, worktrees, salas compartidas y skills Caveman y Ponytail. Notas enlazadas con DataScript y recuperación con presupuesto. Procedimientos verificados con trazabilidad. |
| Telemetría | Modelo solicitado y atendido, uso reportado, tarifas conservadas y costes por llamada. La cuota gratuita se configura explícitamente. El uso ausente queda incompleto. La puntuación del revisor se muestra separada de la exactitud verificada. |
| Documentos, datos y gráficos | PDF con texto, DOCX, XLSX, CSV, JSON y texto. Análisis sobre todas las filas con DuckDB, verificación de valores y procedencia, perfilado, uniones, búsqueda de citas, API NHTSA vPIC y exportación de gráficos. Las imágenes requieren un proveedor con visión. Excel depende de los valores almacenados y los PDF escaneados requieren OCR externo. |
| Interfaz | Espacios sin precarga de datos, SF Pro local con alternativa del sistema, blanco y negro, logotipos, isla dinámica y fábrica pixel art vinculada a eventos. Evolución grafica cambios por generación y conserva los rechazos. |
| Operación empresarial | Ejecución local o servidor de un proceso por volumen. Pendientes de infraestructura externa el dominio, HTTPS, registro OAuth, credenciales, cuotas comerciales y firma del portable. El ensayo publicado usa tres archivos de una familia. |

## Repositorios

El manifiesto fija 22 repositorios. El verificador revisa el remoto, el SHA, el estado limpio y el directorio de código seleccionado para cada referencia parcial. Las fuentes están en `references/frameworks/<nombre>/source`. [Manifiesto](frameworks.json) · [Referencias locales y atribuciones](REFERENCIAS.md)

| Repositorios | Uso |
| --- | --- |
| MetaGPT, ChatDev, CrewAI, AOrchestra | Diseño de roles, coordinación y encargos entre modelos. |
| OpenAI Agents SDK, Microsoft Agent Framework | Referencias de contratos y traspasos. Los adaptadores propios mantienen la contabilidad compartida en TypeScript. |
| AFlow, DSPy | Propuestas, evaluación y selección de políticas. El buscador y el comparador de AERIS se implementaron en el proyecto. |
| LangGraph, OpenCode | Inspector de pasos y referencia de interacción de terminal. |
| Logseq, AI Town, Generative Agents, Apple HIG Designer | Segundo cerebro, representación de actividad y estilo de la interfaz. |
| D3, ImPlot, ECharts, Tremor, Plotly.py, Seaborn | D3 es dependencia del producto. Las demás están disponibles para comparar implementaciones y visualizaciones. |
| Ponytail, Ponytail-Caveman | Perfiles de ahorro y fuentes con atribución. |

El artículo local de Anthropic y su cuaderno sobre dreaming están en `references/brain` y `references/code`. La separación entre experiencias, consolidación y recuperación orienta el diseño. [Investigación de Anthropic](https://www.anthropic.com/research/components-of-agent-memory)

## Verificación de la entrega

Pasaron 27 pruebas automatizadas y la compilación de producción. Se abrió el portable con una copia aislada del estudio medido. Desde la interfaz se inspeccionaron las cuatro generaciones, los aciertos y tokens por tarea, las decisiones y la apertura de un nuevo ciclo con su historial. También se verificaron los controles para comparar equipos y el ancho móvil de 390 píxeles. En una copia del estudio 1.0 se recuperó la decisión histórica de cuatro pares con 764 y 0 tokens, utilizando las trazas originales.

El ejecutable Windows x64 de esta entrega pesa 157 610 119 bytes y no tiene firma de editor. SHA-256 `03ffeb7633813910ff15a7815bd689aeed24fb984a3c761827c1104c06791142`.

En el equipo donde se midió el ensayo, las carpetas locales de investigación quedaron separadas del espacio de trabajo habitual. Para visualizar la rama adaptativa registrada en la web, desde la raíz:

```powershell
$env:AERIS_DATA_DIR = (Resolve-Path 'artifacts/search-eval/adaptive').Path
$env:PORT = '4394'
npm start
```

Abre `http://127.0.0.1:4394/app#evolution`. Las cifras publicadas y el protocolo de reproducción sí acompañan al código en Git. La base de datos local de las ejecuciones queda en el equipo.
