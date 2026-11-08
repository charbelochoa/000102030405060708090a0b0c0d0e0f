# Arquitectura de ejecución

React y Electron consumen la misma API Express que la CLI. TypeScript y Zod definen adjuntos, modelos, planes, artefactos y casos. Un espacio comparte administración de proveedores y políticas de acceso al sistema de archivos. Cada cuenta tiene sus propias misiones, mensajes, documentos y memoria. El servidor debe ejecutarse como un proceso único por volumen. El despliegue empresarial distribuido requiere almacenamiento transaccional, administración de organizaciones y controles operativos adicionales.

## Flujo de una misión

1. Se registra el objetivo y se filtran los modelos disponibles por credencial, capacidad visual, activación y tarifa. El planificador designado, o un modelo ligero conectado, clasifica el objetivo y puede generar pasos. Una selección manual permite fijar el constructor.
2. El constructor utiliza contratos de función. Puede consultar el espacio, leer documentos, buscar citas, agregar tablas, consultar NHTSA, unir tablas y enviar o recibir mensajes de la sala. Un revisor independiente puede recibir el candidato y devolver cambios. El registro conserva el modelo real, el solicitado, la tarifa histórica y el uso disponible. Una respuesta con uso ausente se registra como incompleta y detiene la misión.
3. Las operaciones numéricas se ejecutan en un proceso Python separado con DuckDB sin acceso SQL externo. Un segundo cálculo decimal y un control de cobertura contrastan los resultados. Los CSV y hojas se recorren completos. La unión conserva todas las filas izquierdas y exige una clave derecha única. Los artefactos tienen identificador, hash, origen, hoja, plan y cobertura. El renderizador comparte la especificación entre web y CLI.
4. El motor usa definiciones y programas instalados. La entrada selecciona operaciones de un catálogo cerrado. El proceso analítico carece de credenciales de proveedores. Su separación en un proceso con límites de entrada, concurrencia y tiempo no constituye una jaula de sistema operativo para contenido hostil.
5. El inspector permite seleccionar cada paso registrado. El estudio y la isla visualizan eventos del servidor.

## Memoria

Las notas Markdown y los enlaces forman el cerebro de contexto. Los documentos adjuntos se consultan por fragmentos. El contexto personal y los mensajes se consideran datos. En los ensayos controlados el planificador recibe solo la pregunta y el esquema de columnas.

El cerebro de optimización consolida operaciones que hayan producido la respuesta de referencia en desarrollo. Agrupa por pregunta normalizada, nombres y tipos de columnas y hoja. Cuando dos planes válidos discrepan para una misma llave, la consolidación se abstiene. Conserva los casos que respaldan cada regla. La política versionada almacena el procedimiento, nunca la respuesta de validación. Cada ejecución con memoria calcula de nuevo sobre el archivo actual. Una regresión, consumo incompleto, cambio de configuración o falta de mejora bloquea la promoción.

El diseño de lectura selectiva y consolidación se inspira en el artículo y el cuaderno de Anthropic revisados en `references/brain` y `references/code`. El cuaderno separa sesiones de origen, análisis y organización del almacén. AERIS usa un consolidador determinista con un evaluador externo al planificador. Los resultados publicados por Anthropic corresponden a sus experimentos. [The components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)

La investigación incorporada busca modificar un flujo de planificación dentro de componentes autorizados. Los pesos, la regla de promoción y el algoritmo que genera las propuestas permanecen fijos. Un procedimiento se reutiliza en preguntas y esquemas coincidentes. La evidencia de una familia de tareas no valida generalización semántica, metaoptimización ni reducciones de coste en otra API.

## Marcos de referencia

`docs/frameworks.json` fija diez repositorios por SHA. `python scripts/references.py` obtiene el código en `references/frameworks`. MetaGPT, ChatDev, CrewAI y AOrchestra aportan referencias de roles y traspasos. Agents SDK y Microsoft Agent Framework aportan referencias de herramientas tipadas y flujos. AFlow y DSPy motivan la separación entre búsqueda y evaluación. LangGraph orienta el inspector de pasos y OpenCode la interacción con archivos y terminal. El runtime de AERIS conserva una sola implementación del registro de uso, permisos y ejecución.
