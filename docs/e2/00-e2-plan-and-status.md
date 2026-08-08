# E2 — Plan y estado de arquitectura

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E2 — Arquitectura |
| Estado | `IN PROGRESS / READY FOR G2 REVIEW` |
| Inicio autorizado | `2026-08-08T06:20:00-04:00` |
| Base | `main` en `c88b8a9ddb094fa37025a9c5c0f40a9c34887425` |
| Rama | `docs/e2-architecture` |
| Dependencia | G1 `APPROVED / CLOSED` |
| G2 | `NO APROBADA` |
| ADR-0001..ADR-0005 | `PROPOSED / RECOMMENDED_FOR_G2` |
| Implementación | No autorizada |
| Datos reales | No autorizados |
| Integración técnica EduPay | No autorizada |

## Objetivo

Convertir la especificación funcional aprobada en una arquitectura segura, reversible y suficientemente concreta para que G2 pueda decidir si el proyecto está listo para avanzar a UX/fundación técnica, sin crear todavía código de producción.

## Principios de E2

- Preferir decisiones reversibles y explícitas.
- Mantener multi-tenancy desde el primer incremento técnico.
- Separar Admisión y EduPay por contratos; sin tablas compartidas.
- Denegación por defecto, mínimo privilegio y auditoría como invariantes.
- No introducir excepciones hardcodeadas para Colegio Conquistadores.
- Diseñar para cPanel/Passenger sólo si la evidencia de despliegue lo hace viable; no sacrificar seguridad o mantenibilidad por el target.
- Resolver ADR antes de scaffolding.
- No usar datos reales.

## Decisiones arquitectónicas que E2 debe cerrar o dejar justificadamente diferidas

1. Arquitectura lógica y límites de módulos/contextos.
2. Estructura de repositorio: monorepo/multirepo y estrategia de paquetes compartidos.
3. Evaluación y resolución de `ADR-0001` para stack base.
4. Modelo lógico de datos y ownership por agregado.
5. Estrategia concreta de multi-tenancy y propagación segura de `tenantContext`.
6. Identidad, autenticación, sesiones, verificación de email y recuperación.
7. Autorización: RBAC + scopes + sensibilidad/propósito + separación de funciones.
8. Elevación explícita del Superadministrador Global y auditoría reforzada.
9. Archivos privados, cuarentena, validación, malware scanning, URLs temporales y metadata.
10. Versionado/inmutabilidad de formularios, snapshots, documentos, recomendaciones y decisiones.
11. Concurrencia para cupos/reservas/ofertas y prevención de sobreoferta.
12. Correo transaccional, plantillas, estados de entrega, reintentos y tareas por fallo.
13. Auditoría, observabilidad, logging seguro y trazabilidad.
14. Backups, recuperación, RPO/RTO iniciales y política de restauración.
15. Gestión de secretos y configuración por ambiente.
16. Estrategia de despliegue para desarrollo, staging y producción propuesta.
17. Estrategia de pruebas: unitarias, integración, E2E, aislamiento tenant, autorización y concurrencia.
18. Modelo de amenazas inicial.
19. Presupuesto/capacidad inicial y riesgos operacionales.
20. Borde técnico futuro con EduPay, sin resolver Q-301 a Q-309 ni implementar integración.

## Q-201 a Q-210

E2 debe abordar estas preguntas al nivel necesario para G2. Si una pregunta requiere validación legal o evidencia operacional posterior, se debe separar claramente:

- decisión técnica que sí corresponde a E2;
- dato/validación externa pendiente;
- compuerta donde debe cerrarse.

No convertir validaciones legales pre-piloto en bloqueos artificiales de arquitectura cuando exista una decisión técnica segura y reversible.

## Entregables consolidados

- `01-architecture-overview.md` — arquitectura lógica y de despliegue propuesta.
- `02-stack-evaluation.md` — evaluación comparativa y recomendación de stack.
- `ADR-0001` actualizado como recomendación, sin aceptación automática.
- `ADR-0002..ADR-0005` propuestos para decisiones de alto impacto.
- `03-logical-data-model.md` — entidades/agregados, ownership y relaciones lógicas.
- `04-multitenancy-authorization-architecture.md` — tenancy, identidad y autorización.
- `05-files-security-architecture.md` — almacenamiento privado y pipeline seguro.
- `06-concurrency-and-consistency.md` — invariantes, transacciones, jobs, outbox y email.
- `07-audit-observability-recovery.md` — auditoría, logs, métricas, backups y recuperación.
- `08-deployment-and-environments.md` — ambientes, secretos y despliegue propuesto.
- `09-testing-strategy.md` — estrategia de pruebas y criterios técnicos.
- `10-threat-model.md` — modelo de amenazas inicial.
- `11-e2-decision-workbook.md` — decisiones, alternativas, recomendación y estado.
- `12-g2-readiness-checklist.md` — evidencia para revisión G2.
- `docs/approvals/G2-architecture-approval-DRAFT.md`, sin aprobación automática.

Los nombres pueden ajustarse si mejora la organización, manteniendo trazabilidad.

## Límites

E2 no autoriza:

- scaffolding o código de producción;
- dependencias de aplicación;
- migraciones o schema ejecutable;
- infraestructura productiva;
- datos reales;
- integración ejecutable con EduPay;
- asumir que `ADR-0001` está aprobado por existir como propuesta;
- cerrar G2 por inferencia o por merge.

Se permiten diagramas, pseudocódigo, contratos conceptuales y ejemplos sintéticos cuando sean necesarios para decidir arquitectura, siempre que no constituyan implementación.

## Criterio de salida hacia G2

E2 puede solicitar revisión G2 cuando:

- arquitectura lógica y ownership estén claros;
- estrategia multi-tenant y autorización tengan invariantes verificables;
- stack y estructura de repo tengan decisión recomendada con riesgos/costos;
- persistencia, archivos, correo, auditoría, recuperación y despliegue estén suficientemente definidos;
- decisiones de concurrencia para cupos/reservas estén resueltas;
- exista modelo de amenazas y estrategia de pruebas;
- Q-201 a Q-210 estén tratadas o correctamente diferidas;
- no existan decisiones irreversibles sin justificación;
- `ADR-0001` tenga propuesta final lista para aprobación humana;
- implementación y datos reales sigan bloqueados hasta sus compuertas.

## Siguiente compuerta humana

Las ocho elecciones humanas están registradas en `11-e2-decision-workbook.md#human-decisions-status`. El checklist resulta `PASS_WITH_DEFERRED`, sin bloqueante arquitectónico material. La siguiente acción es la revisión humana de G2; E2 no puede aprobar G2 automáticamente.
