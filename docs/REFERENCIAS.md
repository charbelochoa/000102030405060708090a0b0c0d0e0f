# Referencias y adaptación

Las inspiraciones originales están organizadas en `references/`, fuera de la raíz de código y de la distribución. Se conserva su contenido local.

| Referencia            | Ubicación local                 | Aplicación en AERIS                                                            |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Linear                | `references/design/linear`      | Densidad, sidebar, encabezados, búsqueda, filas, panel de detalle y navegación |
| Apple Music           | `references/design/apple-music` | Jerarquía tipográfica, superficies y espaciado                                 |
| Claude Code           | `references/cli/claude-code`    | Modelo de CLI conversacional, comandos, herramientas y estados                 |
| CSS facilitado        | `references/assets/css`         | Referencia de tokens y transiciones                                            |
| Tipografía facilitada | `references/assets/typography`  | SF Pro en el entorno local                                                     |

## Módulos inspeccionados

La carpeta de Linear incluye 977 módulos JavaScript compilados. Se revisaron nombres, dependencias y fragmentos representativos de agentes, configuración, búsqueda, sidebar, gráficas y animaciones. Entre ellos:

- `ActiveAgentsSection.CZD71B8h.js`: agrupación de agentes, estado, permisos y superficies de detalle.
- `AccountAgentsSettingsPage.DM1_phPh.js`: configuración, estado local y conexiones.
- `IssueDetailsPaneSidebar.DmkI7KRE.js`: panel lateral, secciones y controles accesibles.
- `animations.BOspy5Ke.js` y estilos asociados: estados y transiciones.
- `SearchInput.ICPfX_Ht.js`, `SettingsSidebarSearch.o4g4a4b7.js` y contenedores de búsqueda.
- `GraphHelpers.DwpNKNtC.js` y módulos de gráficas.

AERIS adapta estos patrones a sus propios contratos y componentes React. Los bundles compilados dependen del runtime y los servicios originales, por lo que no se ejecutan como si fueran un backend de AERIS. El código activo tiene su propio estado, accesibilidad, eventos, rutas y pruebas.

## Bibliotecas y proyectos abiertos

- [D3](https://github.com/d3/d3): curvas, escalas, áreas, líneas y disposición de grafo.
- [DataScript](https://github.com/tonsky/datascript): biblioteca usada por Logseq e integrada directamente para consultas de enlaces y backlinks. Conserva su licencia EPL.
- [Logseq](https://github.com/logseq/logseq): referencia de páginas Markdown, bloques, enlaces wiki, backlinks y conocimiento local. Su núcleo tiene licencia AGPL-3.0. El núcleo Clojure de Logseq no está embebido en la aplicación.
- [Ponytail](https://github.com/DietrichGebert/ponytail): perfil compacto adaptado; fuente original y licencia en `skills/upstream/ponytail`.
- [Ponytail-Caveman](https://github.com/ProxyAyush/Ponytail-Caveman): referencia de Caveman; fuente original y licencia en `skills/upstream/caveman`.
- [AI Town](https://github.com/a16z-infra/ai-town) y [Generative Agents](https://github.com/joonspk-research/generative_agents): referencia conceptual de agentes visibles en un espacio. La escena de fábrica de AERIS es SVG original.
- Radix UI: diálogos, foco, Escape y switches accesibles.
- La guía Apple HIG Designer orientó el uso de SF Pro, la jerarquía de superficies y los controles accesibles de los dos temas. [Apple HIG Designer](https://github.com/axiaoge2/Apple-Hig-Designer)
- La isla de actividad utiliza una transición de resorte de Motion y el control de expansión de Radix. [Motion](https://motion.dev/docs/react-layout-animations), [Radix Collapsible](https://www.radix-ui.com/primitives/docs/components/collapsible)

Las referencias de skills están fijadas a sus revisiones del 6 de noviembre de 2026. Los perfiles usados en prompts son adaptaciones compactas; los originales se conservan como referencia y no se interpretan como instrucciones del desarrollador del proyecto.

La tipografía SF Pro local se excluye del repositorio y del Docker público. La interfaz dispone de alternativa con fuentes del sistema. Las capturas de páginas y paquetes originales no se distribuyen como código activo.
