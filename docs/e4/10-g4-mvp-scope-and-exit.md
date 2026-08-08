# E4-E — G4 MVP scope and exit

## Propósito

Este documento fija el alcance que G4 podría autorizar para construir en E5. No afirma
que el MVP esté implementado. Las fuentes canónicas son la especificación funcional,
los criterios de aceptación, los escenarios E2E y el backlog aprobados en G1.

## Alcance funcional confirmado

La cobertura canónica es:

- **P0:** `BL-001..BL-022` (22 capacidades);
- **aceptación:** `AC-001..AC-058` (58 criterios);
- **escenarios:** `E2E-001..E2E-022` (22 escenarios).

Los 22 elementos P0 son: aislamiento multiempresa; identidad y familia; oferta y
disponibilidad; formulario versionado; postulación; documentos; postulación asistida y
físico; agenda de actividades; asistencia, excepciones e intentos; recomendación de
Admisión; disposición de Dirección; cupos y reservas; lista de espera; oferta, aceptación
y expiración; comunicación por email; portal familiar; dashboard operativo; reportes y
exportaciones; roles y permisos; auditoría e historia; configuración mínima; y borde
funcional EduPay sin integración ejecutable.

Referencias: [`docs/e1/11-functional-specification.md`](../e1/11-functional-specification.md),
[`docs/e1/12-acceptance-criteria.md`](../e1/12-acceptance-criteria.md),
[`docs/e1/13-end-to-end-scenarios.md`](../e1/13-end-to-end-scenarios.md) y
[`docs/e1/14-mvp-backlog.md`](../e1/14-mvp-backlog.md).

## Qué autorizaría G4 si se aprueba

- implementación funcional del MVP E5 dentro de `BL-001..BL-022`;
- schemas y migrations funcionales de Admisión, manteniendo dominio y tablas desacoplados
  de EduPay;
- API funcional, UI funcional y worker/jobs funcionales;
- almacenamiento y workflow documental mediante adapters seguros y contratos explícitos;
- pruebas funcionales, de aceptación, aislamiento, seguridad y concurrencia;
- datos únicamente sintéticos/non-production durante desarrollo;
- infraestructura local/development necesaria para implementar y verificar E5.

G4 sería autorización para construir. No sería evidencia de que las capacidades ya
existen ni autorización de lanzamiento.

## Qué no autorizaría G4 por sí sola

- datos reales de estudiantes, familias, trabajadores o instituciones;
- piloto, producción o despliegue externo;
- secretos productivos, TLS productivo o proveedores productivos;
- aceptación legal de `C-013`;
- integración técnica EduPay ni resolución de `Q-301..Q-309`;
- G5 ni autorización de piloto.

Admisión y EduPay continúan desacoplados. El `BL-022` funcional futuro sólo expresa el
borde conceptual posterior a una aceptación; no autoriza construir el handoff técnico.

## Criterios de salida de E5 para solicitar G5

Antes de solicitar G5 deberá existir evidencia revisable de:

1. P0 funcional implementado y trazado a `BL-001..BL-022`;
2. criterios de aceptación críticos verificados y escenarios E2E relevantes ejecutados;
3. aislamiento multiempresa probado en API, worker, documentos, búsquedas, conteos y
   exportaciones;
4. seguridad, autorización deny-by-default, sesiones, SELF-ELEVATION, CSRF, auditoría y
   eventos de seguridad;
5. concurrencia y consistencia de sesiones, cupos, oferta, jobs y documentos;
6. documentos privados, versiones, permisos, cuarentena y malware adapter verificado;
7. backup/restore y recuperación con evidencia de operación autorizada;
8. accesibilidad y responsive conforme al alcance UX aprobado;
9. comunicaciones, errores, reintentos y fallos de email sin alterar indebidamente el negocio;
10. operación, health, monitoring, alerting, runbooks, ownership e incident response;
11. legal/privacy: `C-013`, propósito, minimización, retención, eliminación y solicitudes;
12. autorización explícita y fechada para datos reales, piloto y entorno correspondiente.

C-013 y la autorización de datos reales permanecen pendientes hasta la etapa que corresponda.
G5 no se aprueba ni se solicita mediante este documento.

## Estado de compuerta

| Elemento | Estado |
| --- | --- |
| Alcance P0 confirmado | PASS |
| Criterios de salida definidos | PASS |
| Implementación funcional E5 | NO INICIADA / NO AUTORIZADA |
| G4 | NO APROBADA |
| Datos reales | NO AUTORIZADOS |
| Producción/piloto | NO AUTORIZADOS |
| EduPay técnico | NO AUTORIZADO |
