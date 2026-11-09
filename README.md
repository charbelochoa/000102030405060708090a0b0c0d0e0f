# AERIS

Coordinación por misión: [con orquestador y equipos autónomos](docs/EQUIPOS.md).

Despliegue de prueba: [servidor GCP, Firebase y GitHub Pages](docs/GCP.md).

Espacio de trabajo para coordinar modelos, analizar datos y evaluar políticas de ejecución. La web, el escritorio Windows y la terminal comparten una API y el mismo registro de uso.

## Iniciar

Desde el código se necesitan Node.js 24, npm y Python 3.11 o posterior. En Windows, el portable incluye el motor de documentos.

```powershell
npm ci
npm run tools:setup
npm run dev
```

Abre [el espacio local](http://localhost:5173/app). En **Configuración → Proveedores y APIs** puedes guardar las claves y revisar las tarifas. El análisis manual de documentos y tablas funciona sin clave.

```powershell
npm run check
npm run build
npm run desktop:build
```

El portable queda en `release/AERIS-1.1.0-Windows.exe`. Abre un servidor en loopback en el puerto 4319. El motor de desarrollo usa el 4318.

## Terminal

```powershell
.\aeris.cmd chat --name atlas --room equipo
.\aeris.cmd run "Revisa los cambios de código" --wait
.\aeris.cmd profile ventas.xlsx
.\aeris.cmd analyze ventas.xlsx --sheet Ventas --plan operacion.json --chart resultado.html
.\aeris.cmd document-search contrato.pdf "plazo de entrega"
.\aeris.cmd vehicles Honda 2023
```

Un plan tabular mínimo puede ser `{"aggregation":"count"}`. Para sumar una columna por categoría, usa `{"aggregation":"sum","metric":"ingresos","group_by":"categoria","currency_column":"moneda"}`. Los nombres deben existir en el archivo.

- [Instrucciones de uso](docs/INSTRUCCIONES.md)
- [Arquitectura y alcance](docs/ARQUITECTURA.md)
- [API](docs/API.md)
- [Protocolo del experimento](docs/HACKATHON.md)
- [Auditoría, referencias y resultados del aprendizaje entre generaciones](docs/AUDITORIA-1.1.md)
- [Resultados y verificación](docs/VERIFICACION.md)
- [Referencias](docs/REFERENCIAS.md) y [atribuciones](docs/TERCEROS.md)
