# Fase 3 — Operación administrativa y atención institucional

## Objetivo y compuerta

Esta fase mejora la orientación visual de los espacios de administración y atención institucional. Parte de `main` después de integrar las fases 1 y 2; no cambia API, backend, Prisma, permisos, RLS, sesión ni despliegue.

- **Hecho confirmado:** administración ya expone configuración, formularios, calendario, actividades, accesos, auditoría y soporte; atención ya expone dashboard, expedientes, seguimiento, comunicaciones, reportes y auditoría.
- **Decisión de fase:** ordenar esas superficies para que el primer ingreso empiece en un resumen operativo y las acciones queden agrupadas por intención.
- **Supuesto de trabajo:** la identidad visual y los tokens de las fases 1 y 2 siguen siendo la autoridad.
- **Fuera de alcance:** no se agregan endpoints, filtros de expedientes, métricas nuevas, datos institucionales reales ni integración con EduPay.

## Cambios incluidos

- Administración abre en **Resumen**, con conteos derivados de la configuración ya cargada y accesos directos a sedes, años, cursos, procesos y ofertas.
- El resumen administrativo muestra una ruta de configuración de tres etapas, sin inventar estados remotos: estructura, proceso y oferta/cupos.
- La navegación administrativa queda agrupada como Inicio, Estructura, Diseño y Control.
- La navegación de atención queda agrupada como Inicio, Expedientes, Seguimiento y Control.
- Atención abre en **Resumen operativo**, separando colas que requieren atención de agenda y disponibilidad.
- Los grupos de navegación son responsivos y conservan `aria-current`, `aria-pressed`, disclosure móvil y restauración de foco.
- Se mantiene visible la frontera de datos sintéticos y la separación de tenant; no se muestra padrón de alumnos, apoderados ni información de EduPay.

## Archivos modificados

- `apps/web/app/page.tsx`
- `apps/web/app/ui-foundation.tsx`
- `apps/web/app/communications-dashboard-workflows.tsx`
- `apps/web/app/globals.css`

## Seguridad y datos

Los cambios sólo afectan presentación y navegación. Los conteos de atención provienen del endpoint existente; no se persisten, exportan ni agregan datos. Se conservan las verificaciones server-side de tenant, rol, propósito y permiso. Las pruebas y ejemplos no usan personas ni datos reales.

## Validación

| Control | Resultado |
| --- | --- |
| `pnpm lint` | PASS; sin errores ni advertencias |
| `pnpm typecheck` | PASS en los 4 proyectos |
| `pnpm build` | PASS; database, web, API y worker |
| `pnpm test` | PASS; 53 archivos / 686 pruebas |
| `git diff --check` | PASS |
| Detector visual Impeccable | PASS; `[]` |
| `pnpm format:check` | BASELINE NO VERDE; reporta 219 archivos preexistentes fuera de esta fase |

El formateador se aplicó únicamente a los cuatro archivos modificados. No se realizó un reformateo masivo del repositorio.

## Riesgos y pendientes

- La validación visual autenticada contra preproducción debe repetirse cuando este PR se despliegue; preproducción continúa en DNS-only y el workflow de GitHub puede no alcanzar el origen desde runners hospedados.
- Los números del resumen administrativo representan sólo registros ya cargados; un cero no implica que la configuración esté aprobada para producción.
- La revisión de roles, capacidad, documentos y políticas sigue dependiendo de los contratos existentes y sus compuertas funcionales.

## Aprobación solicitada

Revisar este PR como incremento de interfaz de administración y atención. Tras aprobarlo y obtener CI verde, se puede integrar a `main` y repetir el despliegue sintético desde GitHub, manteniendo los dominios profundos de preproducción en DNS-only.
