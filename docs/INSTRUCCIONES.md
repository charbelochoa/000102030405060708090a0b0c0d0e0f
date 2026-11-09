# Operación

## Espacios y cuentas

En local se abre la cuenta del equipo. Para un servidor compartido configura `AERIS_AUTH_REQUIRED=true`, una URL pública HTTPS y los secretos OAuth si vas a ofrecer Google o GitHub. Los callbacks terminan en `/api/auth/google/callback` y `/api/auth/github/callback`. La primera cuenta registrada administra modelos, precios, herramientas de archivos y experimentos. Utiliza un directorio de datos y un proceso servidor por espacio. El almacén JSON y los archivos de documentos deben estar en un volumen persistente.

Al actualizar desde 0.1, la migración identifica las misiones de demostración por su modo, las notas iniciales por su contenido y los experimentos por su registro anterior. Conserva las notas editadas, el ledger de uso real y las credenciales. Cierra la versión anterior antes de abrir el portable nuevo.

## Proveedores

En Configuración abre **Proveedores y APIs**. Registra una clave o configura el nombre de variable que figura en `.env.example`. NVIDIA NIM usa su endpoint compatible con Chat Completions. Declara la cuota gratuita solo cuando la cuenta la tenga habilitada. Para un contrato de pago introduce sus tarifas antes de ejecutar. Una clave puede dar acceso a varios modelos. El identificador del modelo debe ser único en el catálogo de este espacio.

El servidor local compatible usa `http://127.0.0.1:8089/v1/chat/completions`. Configura la clave real del proceso, o escribe `local` si tu servicio de loopback admite acceso sin clave. El alias del servidor debe coincidir con el del catálogo. El modelo utilizado para la prueba fue `qwen2.5-0.5b-instruct`. El portable incluye el analizador y los logotipos. Los pesos LLM se instalan por separado.

## Documentos y análisis

En **Análisis de archivos**, abre un documento. Para una tabla, selecciona la hoja, operación, grupo y filtros. Puedes descargar el resultado verificable como JSON o como gráfica SVG. Las gráficas paginan 32 grupos, el JSON incluye todos. La CLI exporta todas las páginas a un HTML autónomo.

El conteo incluye las filas que pasan el filtro. La suma, media, mediana, desviación poblacional, mínimos y máximos exigen números válidos en esas filas. Para utilidad puedes indicar un campo `subtract` que se resta de la métrica por fila antes de agregar. Las deducciones, impuestos y unidades dependen de las columnas elegidas. El motor reconoce encabezados habituales de moneda o admite `currency_column`, rechaza mezclas y conserva decimales y negativos. La media y desviación se contrastan con tolerancia numérica. Los valores atípicos se cuentan con la regla de 1.5 rangos intercuartílicos y las columnas llamadas fecha/date se revisan como fechas ISO.

Para PDF, Word o texto, busca términos y examina los fragmentos con página, párrafo o fila de tabla. Excel usa valores almacenados. Un PDF escaneado requiere OCR externo. La extracción de texto de un PDF no valida la estructura de una tabla. Límites por archivo de 5 MB, 250 000 filas, 2 millones de celdas y 5 000 grupos.

## Misiones

Adjunta documentos o imágenes y escribe un objetivo. En automático, el planificador puede devolver hasta cuatro pasos. El constructor solicita herramientas, intercambia mensajes y devuelve el resultado. Una revisión de código solicitada o un revisor explícito habilita el ciclo de crítica. Las notas se recuperan por coincidencia y presupuesto. Las imágenes se envían a modelos marcados con visión. Accede al flujo ejecutado, a los artefactos y a la razón de parada desde la misión.

Para solicitudes de cálculo reconocidas sobre tablas, la misión publica los valores del artefacto verificado. Si el modelo omite el cálculo, el motor lo solicita una vez más. Si sigue faltando evidencia, la misión termina con error. El análisis manual permite elegir y revisar la operación directamente.

La CLI usa la misma API. En dos terminales, usa `chat --room equipo --name atlas` y `chat --room equipo --name nova`, y consulta `/help`. Los permisos de escritura y comprobaciones Git se activan en Configuración. Para apuntar al escritorio, configura `AERIS_URL=http://127.0.0.1:4319` y `AERIS_DATA_DIR` con el directorio `engine` de los datos de usuario de AERIS.

## Experimentos

Desde el resultado de una misión o análisis, **Validar para memoria** contrasta la operación con una respuesta independiente y registra el vínculo a la traza. La pregunta y el esquema identifican el procedimiento. La consolidación y promoción requieren casos adicionales de validación.

El protocolo, los datos requeridos y las condiciones para promover o restaurar una política están en [el ensayo del hackathon](HACKATHON.md). Las mediciones empiezan vacías en cada espacio.

En **Evolución → Campaña de aprendizaje**, ejecuta varias propuestas con presupuesto y límite de generaciones. **Generaciones** permite inspeccionar aciertos, tokens, llamadas, coste y latencia por tarea. Al evaluar el test se sella el ciclo. Una vez medidos todos los casos reservados en ambas ramas, **Nuevo ciclo** abre otra evaluación y conserva la experiencia anterior. [Comandos y reproducción](HACKATHON.md) La opción **Comparar equipos de 1, 2 y 3 agentes** mide los tres flujos en desarrollo antes de proponer una configuración.
