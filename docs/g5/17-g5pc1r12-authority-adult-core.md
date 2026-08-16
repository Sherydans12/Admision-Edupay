# G5-PC1-R12 — Núcleo de autoridad por postulación y estudiante adulto

## Alcance autorizado

Esta implementación técnica autorizada cubre `PC1-TECH-001`, `002`, `004`, `005` y `006`.
No constituye procedimiento legal/institucional ni autoriza G5, piloto, datos reales,
producción, providers o integración ejecutable con EduPay. `PC1-TECH-003` permanece
`NOT_IMPLEMENTED / DEFERRED_TO_PC1-R4`; no se sustituyó un catálogo aprobado por
sensibilidad técnica.

## Modelo, migración y aislamiento

Migration 17: `packages/database/prisma/migrations/20260816070000_g5pc1r12_authority_core`.
Agrega `students.date_of_birth` como `DATE NULL`, sin backfill ni autoridades verificadas
inventadas. `ApplicationAuthority` es único por tenant/postulación y conserva principal,
modo, relación, base, estado, snapshot DOB y `concurrencyVersion`.

`ApplicationAuthorityReview` es historial append-only. `ApplicationAuthorityEvidence`
referencia `DocumentVersion` privado existente, sin bytes duplicados ni object keys.
`Student` sigue global/family-owned y no recibe `tenantId`.

Las tres tablas nuevas tienen `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`,
políticas con `admission.tenant_id`, owner `admission_migrator` y grants mínimos a
`admission_app`. Reviews y evidence no se pueden actualizar/eliminar por el role runtime.

## Edad, declaración y estados

`isAdultStudent(dateOfBirth, referenceDate)` usa fechas calendario estrictas `YYYY-MM-DD`
e inyección de fecha de referencia, sin milisegundos ni aritmética 365/365.25. Una DOB
29-febrero alcanza mayoría el 1-marzo cuando el año no tiene 29-febrero.

- Menor: `MINOR_REPRESENTATIVE`, relación y base distintas de `SELF`.
- Adulto >=18: `ADULT_STUDENT_SELF` y `SELF/SELF` explícito.
- Una diferencia entre DOB global y snapshot bloquea la acción crítica sin refresco tácito.
- Al cumplir 18, la representación deja de servir: exige re-declaración self y revisión.

```text
ABSENT/NOT_DECLARED -> DECLARED
DECLARED -> EVIDENCE_PENDING | UNDER_REVIEW
EVIDENCE_PENDING -> UNDER_REVIEW
UNDER_REVIEW -> VERIFIED | EVIDENCE_PENDING | DISPUTED | REJECTED
VERIFIED -> DISPUTED
DISPUTED -> UNDER_REVIEW | VERIFIED | REJECTED
REJECTED -> DECLARED (re-declaración familiar explícita)
```

La familia no fija estados de revisión. En `DRAFT`, una re-declaración con versión esperada
vuelve a `DECLARED`, preserva historia e incrementa versión. Después de `SUBMITTED`, sólo
se permite la transición explícita por mayoría de representante a self.

## Evidencia, permisos y gates

Capacidades añadidas: `application.authority.declare`, `application.authority.read` y
`application.authority.review`. Secretaría no recibe review por defecto; superadmin no
tiene acceso tenant ambiental sin elevación.

La revisión es manual. `PARENT` y `SELF` requieren motivo no vacío; otras bases requieren
evidencia privada enlazada. El enlace valida tenant/postulación y exige `DocumentVersion`
`READY_FOR_REVIEW` y `CLEAN`; no define tipos jurídicos de documento.

El guard central falla cerrado ante autoridad ausente/no verificada, DOB/snapshot distinto,
principal inconsistente o modo incorrecto para la edad en la fecha de acción. Protege submit
final (incluido asistido), aceptación de oferta y creación de handoff. La aceptación conserva
`OfferAcceptance.actorId`; handoff exige que coincida con autoridad vigente. Decline no se
amplió. Las denegaciones generan `APPLICATION_AUTHORITY_CRITICAL_ACTION_DENIED` seguro.

## API y UX mínima

Se agregan rutas familiares de lectura/declaración y staff de detalle/revisión, con Zod,
contexto tenant/familia, CSRF/correlación y envelope existentes. La UI familiar pone la
declaración antes del formulario, muestra estado y fuerza self para adulto; no expone
deliberación interna. La UI staff muestra historial y controles sólo con capability review.

No se fuerza una transacción artificial entre Student global y recursos tenant. Un borrador
puede existir, pero no cruza submit, accept ni handoff sin DOB y autoridad verificada.

## Disposición y residuales

La smoke Migration 17 prueba fresh `0→17` e incremental `16→17`, DOB, enums, tablas,
RLS/FORCE, grants/roles distintos y ausencia de backfill `VERIFIED`.

| Item | Disposición |
| --- | --- |
| `PC1-TECH-001`, `002`, `004`, `005`, `006` | `IMPLEMENTED / PENDING_HUMAN_TECHNICAL_REVIEW` |
| `PC1-TECH-003` | `NOT_IMPLEMENTED / DEFERRED_TO_PC1-R4` |
| `PC1-TECH-007..015` | Sin cambio |
| `Q-106` | `TECHNICAL_CORE_IMPLEMENTED / FINAL_INSTITUTIONAL_LEGAL_PROCEDURE_PENDING / PILOT_PRECONDITION` |

`LP3-ART-006` sigue abierto, `C-013` sigue `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`,
y `G5-EXIT-10`, `G5-EXIT-11` y `G5-EXIT-12` siguen bloqueados. G5, datos reales, piloto,
producción e integración técnica EduPay permanecen `NOT AUTHORIZED`.
