# Verificación de AERIS v0.1

Fecha: 6 de noviembre de 2026. Código funcional de referencia: `0a04b68149654045b826d68f54913e9bfb44bde4`.

## Comprobaciones ejecutadas

| Comprobación | Resultado observado |
| --- | --- |
| TypeScript | Sin errores |
| Pruebas automáticas | 15 aprobadas, cero fallos, cero omitidas |
| Build web y servidor | Correcto |
| CLI compilada | Estado, modelos, misión de demo y recuperación de contexto correctos |
| Dos procesos CLI | Mensajes atlas → nova y nova → atlas en sala qa-cli |
| Worktree real | Creación de rama aeris/verification y checkout correctos; limpieza posterior correcta |
| Dashboard en escritorio | Interfaz, misiones y datos del motor visibles |
| Diseño móvil | A 390 px, ancho del documento 383 px y ancho del contenido 383 px; sin desbordamiento horizontal de página |
| Context Brain | Grafo de seis páginas y ocho enlaces, navegación de páginas y recuperación probados |
| Recuperación de prueba | Tres páginas, 501 tokens estimados dentro de un límite de 1 800 |
| Evolución de prueba | v1: 5/15 casos; v2: 15/15 casos de validación, cero errores críticos |
| Aplicación empaquetada | Motor iniciado en 4319, health correcto y ruta /app con HTTP 200 |
| Portable Windows | Ejecutable lanzado directamente; motor responde ok=true, versión 0.1.0 |
| Repositorio | Código subido y rama main verificada en origin |
| Secretos y referencias | Datos locales, credenciales, fuentes locales y paquetes originales excluidos de Git |
| Reglas de código | Sin comentarios en el código propio y sin emojis en archivos de texto publicados |

## Binario generado

Archivo: `release/AERIS-0.1.0-Windows.exe`.

SHA-256:

```text
D144962CB6828E749654281D7735DB4736565E2CAABE10E9952A14F1849F53B3
```

El portable no tiene firma comercial. Los artefactos binarios quedan en la computadora del usuario; no se incluyen en el historial Git.

## Límites de esta verificación

Las pruebas de proveedores usan respuestas controladas para verificar las herramientas, el formato de mensajes y la contabilidad por modelo. No se realizaron llamadas pagadas ni login real en Google o GitHub porque no se proporcionaron credenciales.

El benchmark de evolución mide una política de filtros sobre datos sintéticos. La mejora 5/15 → 15/15 no es una evaluación de inteligencia general de modelos ni una medición sobre inventario real de una empresa. El test final no se utilizó para proponer la mejora.

`npm audit --omit=dev` reportó cero vulnerabilidades. La auditoría completa reportó seis avisos moderados en la cadena de herramientas de empaquetado de desarrollo, originados por minimatch en @electron/universal. No corresponden a las dependencias del servidor de producción. La actualización de esa cadena queda registrada para mantenimiento.

No se ha validado un despliegue público, un entorno Docker en ejecución, escalado distribuido ni metaoptimización. Las instrucciones del servidor y los contratos para continuar el proyecto están en la documentación.
