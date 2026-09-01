# Fase 1 — Fundación visual y navegación

## Objetivo y resultado

Se implementó la fundación visual aprobada para el frontend de Admisión, sin cambiar rutas, llamadas, contratos de API ni decisiones de autorización. El alcance incluye tokens semánticos, `AppShell`, encabezado responsive, navegación administrativa y de atención adaptable, estados transversales y manejo accesible de foco y diálogos.

## Clasificación de información

- **Hecho confirmado:** los cambios están limitados a `apps/web` y a esta evidencia visual.
- **Decisión aprobada:** Fase 1 — Fundación visual y navegación, con rama y PR independientes.
- **Supuesto de trabajo:** el estilo visual existente sigue siendo la autoridad; los tokens nuevos formalizan sus colores, espaciado, radios y estados sin introducir una nueva identidad institucional.
- **Pregunta abierta:** la validación visual autenticada contra preproducción requiere que el frontend modificado esté disponible en un origen autorizado por la API. No se realizó despliegue en esta fase.

## Cambios incluidos

- Tokens semánticos de texto, superficies, bordes, acciones, estados, foco, espaciado, radios y elevación.
- `AppShell` común con enlace para saltar al contenido.
- Encabezado adaptable entre 1440 px y 390 px.
- Navegación administrativa y de atención con disclosure compacto en móvil, estado actual y restauración de foco.
- Estados de carga, vacío, error y éxito con semántica `aria-live`, `role` y `aria-busy`; estilos disabled consistentes.
- Indicador de foco de dos tonos con contraste mínimo de 3:1 respecto de superficies adyacentes.
- `aria-current` y `aria-pressed` en navegación y selector de espacio de trabajo.
- Diálogo compartido con foco inicial, trampa de foco, Escape y restauración al disparador; diálogos nativos existentes con foco inicial y nombre accesible.

## Copy

No se cambió copy de producto. El aviso de documentos permanece exactamente igual. Tampoco se añadieron textos legales, datos institucionales ni funcionalidades.

## Seguridad y datos

No se modificaron backend, API, Prisma, migraciones, variables secretas, permisos, RLS, aislamiento por tenant, CSRF ni sesión server-side. Las verificaciones visuales usaron únicamente el tenant sintético de preproducción ya aprobado y no enviaron datos personales ni acciones funcionales.

## Validación

- `pnpm lint`: aprobado, sin advertencias.
- `pnpm typecheck`: aprobado en web, API, worker y database.
- `pnpm build`: aprobado; frontend y paquetes compilados.
- `pnpm test`: 53 archivos y 686 pruebas aprobadas. Los fallos baseline informados en Fase 0 no se reprodujeron en esta ejecución y no se alteraron pruebas para ocultarlos.
- `git diff --check`: aprobado.
- Detector visual de Impeccable: `[]`, sin hallazgos.
- Navegador: comprobados `aria-current`, `aria-pressed`, cierre del menú móvil con foco restaurado, foco inicial del diálogo en “Cancelar”, ciclo de Tab, Escape y restauración al disparador.
- Responsive: 1440×900 y 390×844, sin desborde horizontal.

## Evidencia visual

- [Escritorio 1440×900](./evidence/phase-1/desktop-1440x900.png)
- [Móvil 390×844](./evidence/phase-1/mobile-390x844.png)

Las capturas corresponden al build de producción ejecutado localmente. La API de preproducción no acepta la sesión desde el origen local, por lo que muestran el estado protegido/error del `AppShell`; la navegación autenticada y los diálogos se comprobaron en un arnés local temporal que importó los componentes finales y fue eliminado antes del diff.

## Riesgos y pendientes

- Validar visualmente administración y atención con sesión sintética cuando exista un preview autorizado por CORS; no justifica relajar CORS ni modificar sesión.
- Revisar el PR y aprobar explícitamente antes de cualquier merge. No se realizó merge ni despliegue.
- Flujos de familia, documentos, ofertas y backend quedan fuera de alcance de esta fase.
