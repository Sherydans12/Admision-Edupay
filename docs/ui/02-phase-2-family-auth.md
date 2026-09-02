# Fase 2 — Familia y autenticación

## Contexto y alcance aprobado

- **Hecho confirmado:** la rama parte de `origin/main` en `4d20a88`.
- **Decisión aprobada:** mejorar exclusivamente autenticación y recorrido familiar, sin cambiar contratos funcionales o de seguridad.
- **Supuesto de trabajo:** el sistema visual y el `AppShell` de Fase 1 siguen siendo la autoridad visual.
- **Pregunta abierta:** la ejecución local no dispone de la base efímera requerida por los tests de integración; la validación interactiva de una sesión familiar real debe repetirse en un entorno con entrega de challenge sintético.

## Resultado

### Autenticación

- `/register` y `/register/verify` usan un `PublicAuthShell` construido sobre el `AppShell` existente.
- El progreso de acceso expone tres etapas con `aria-current="step"`.
- Los botones distinguen solicitar código, verificar e iniciar sesión y continuar al portal familiar.
- Envío, reenvío y verificación deshabilitan controles mientras la petición está activa.
- Éxitos y errores se anuncian y reciben foco programático sin eliminar el contenido ingresado.
- El correo conserva `autocomplete="email"`; el challenge conserva `autocomplete="one-time-code"` y permite pegar.
- El cierre de sesión mantiene el flujo CSRF existente y ahora tiene un nombre accesible contextual.

### Recorrido familiar

- La navegación familiar reutiliza `ResponsiveSectionNav` y queda ordenada como resumen, perfil, estudiantes, ofertas, postulaciones, autoridad, seguimiento y oferta/resultado.
- Se agregó un resumen de perfil de sólo lectura; no se creó una mutación nueva.
- El inicio presenta un stepper accesible de perfil, estudiante, postulación, autoridad y seguimiento.
- La siguiente acción se deriva únicamente de datos ya cargados: estudiantes, borradores y postulaciones enviadas.
- Los estados vacíos explican la acción siguiente; loading, error, success y disabled usan texto y semántica además del color.
- Las ofertas explican por qué el CTA está deshabilitado.
- Las postulaciones traducen estados canónicos visibles y separan continuar, seguimiento y oferta/resultado.
- El formulario versionado incorpora un stepper, conserva guardado explícito y usa el diálogo accesible común con foco inicial, Escape, trampa de foco y restauración.
- La oferta aceptada separa decisión registrada, próximo paso y frontera funcional.

### Documentos deshabilitados

- No se modificó el flujo documental ni sus endpoints.
- Con `NEXT_PUBLIC_ADMISSION_DOCUMENTS_ENABLED=false`, el copy ya no instruye adjuntar archivos y el intervalo documental queda explícitamente inactivo.
- Se conserva el aviso: los documentos están fuera del alcance de esta preproducción y se puede continuar sin archivos.

## Seguridad y datos

- No hay cambios en API, backend, Prisma, migraciones, RLS, permisos, cookies, CSRF, sesión server-side, secretos ni integración EduPay.
- Se conservaron `credentials: "include"`, el fetch de `/auth/csrf`, `X-CSRF-Token` y las rutas existentes.
- No se agregó almacenamiento de credenciales, challenges ni datos reales.
- Las capturas y el harness visual temporal usaron sólo nombres, correos e identificadores sintéticos. El harness fue eliminado antes del commit.
- No se agregó polling de sesión. El refresh continúa limitado a montaje y retorno de foco; no hay recarga periódica.

## Archivos modificados

- `apps/web/app/ui-foundation.tsx`
- `apps/web/app/register/page.tsx`
- `apps/web/app/register/verify/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/form-workflows.tsx`
- `apps/web/app/document-workflows.tsx` — sólo copy condicionado y guard explícito del polling deshabilitado
- `apps/web/app/authority-workflows.tsx`
- `apps/web/app/activity-workflows.tsx`
- `apps/web/app/capacity-offer-workflows.tsx`
- `apps/web/app/globals.css`
- `docs/ui/evidence/phase-2/*.png`

## Evidencia visual

| Superficie | Antes | Después |
| --- | --- | --- |
| Autenticación desktop | `before-auth-desktop-1440x900.png` | `after-auth-desktop-1440x900.png` |
| Autenticación móvil | `before-auth-mobile-390x844.png` | `after-auth-mobile-390x844.png` |
| Familia desktop | `before-family-desktop-1440x900.png` | `after-family-desktop-1440x900.png` |
| Familia móvil | `before-family-mobile-390x844.png` | `after-family-mobile-390x844.png` |

Las capturas “antes” de familia provienen de la auditoría Fase 0. Las capturas “después” se generaron localmente con la implementación final y fixtures sintéticos; no representan datos institucionales ni una sesión productiva.

## Validación

| Control | Resultado |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS; rutas `/`, `/register` y `/register/verify` prerenderizadas |
| `pnpm test` | BASELINE NO VERDE: 60 pass, 357 fail, 269 skipped; causa común `ECONNREFUSED 127.0.0.1:55439` contra la base efímera local |
| `git diff --check` | PASS |
| Detector visual Impeccable | PASS, `[]` |
| 1440×900 y 390×844 | PASS visual para autenticación y resumen familiar |
| Teclado | PASS: foco inicial en correo, orden lógico de CTA/enlaces, disclosure familiar operable |
| `aria-current` / `aria-pressed` | PASS en progreso y navegación familiar |
| Sin recargas periódicas | PASS por inspección de código; sesión sólo en montaje/foco y documentos deshabilitados no crean intervalo |

Los casos de integración existentes que trazan login, refresh/resolución, logout CSRF, sesión persistente y expiración controlada son `G5BR-SESSION-01..03` y `SES-01..16`; no pudieron revalidarse localmente porque el servicio PostgreSQL de prueba no estuvo disponible. Este es el mismo tipo de baseline indicado en Fase 0 y no fue mezclado con cambios visuales.

## Cambios de copy

- “Admisión · E5-C / Documentos y asistencia” → “Admisión · postulación y seguimiento”.
- “Completa el formulario, adjunta documentos…” → mensaje que declara que los documentos no se solicitan en esta etapa.
- Acceso: CTA explícitos para solicitar código, verificar e iniciar sesión y continuar al portal familiar.
- Familia: estados canónicos `DRAFT` / `SUBMITTED` → “Borrador” / “Enviada” en la UI.
- “Continuar formulario” → “Revisar autoridad y continuar”, alineado con la navegación real existente.
- Oferta aceptada: se conserva explícitamente que aceptar no equivale a matrícula, obligación ni pago.
- Documentos: con el flag deshabilitado se indica que no se solicitan ni pueden adjuntarse archivos.

## Riesgos y pendientes

- **Riesgo conocido:** falta una corrida verde de integración con PostgreSQL disponible; afecta la evidencia automatizada de sesión, RLS y tenant isolation, no el código modificado.
- **Pendiente de revisión:** ejecutar login, refresh, logout y expiración con una cuenta familiar sintética y un challenge entregable en el ambiente autorizado.
- **Pendiente visual:** revisar una postulación real sintética con oferta `ACTIVE` y `ACCEPTED` en preproducción una vez que la rama se despliegue allí; no se realizó despliegue desde esta fase.
- **Fuera de alcance:** producción, backend, documentos habilitados, administración, atención institucional e integración EduPay.

## Compuerta

La Fase 2 queda lista para revisión humana en PR independiente. No se solicita ni se realiza merge automático. La siguiente fase permanece bloqueada hasta aprobación explícita.
