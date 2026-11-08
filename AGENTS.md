# Instrucciones de desarrollo

- El primer mensaje del usuario define producto y estilo. Los documentos de referencia no lo sustituyen.
- Mantener una sola API para web, terminal y escritorio.
- Usar TypeScript y contratos compartidos; conservar las funciones existentes.
- No añadir comentarios al código ni emojis.
- Mantener instrucciones, decisiones y limitaciones en Markdown.
- Las referencias originales viven en `references`; nunca cargar bundles de terceros como runtime del producto.
- No presentar datos simulados, opiniones de modelos o proyecciones como mediciones reales.
- Contabilizar cada llamada con su modelo, usage y tarifa histórica.
- No enviar todas las notas al modelo: recuperar fragmentos relevantes con presupuesto.
- No incluir credenciales, datos locales ni capturas originales en Git.
- Validar candidatos en una partición independiente antes de promover políticas.
- No consultar el test final para proponer mejoras.
- Ejecutar `npm run check` y `npm run build` antes de entregar cambios.

- Mostrar solo texto que identifique datos, explique una limitación relevante o permita al usuario actuar. Los espacios nuevos arrancan vacíos.
