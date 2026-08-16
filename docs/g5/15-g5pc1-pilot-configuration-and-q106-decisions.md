# G5-PC1 — Decisiones de configuración piloto y Q-106

## Boundary y clasificación de la información

Este documento registra las decisiones humanas aprobadas para `PC1-A`, `PC1-B` y
`PC1-C` y fija el input de configuración usado por la evaluación técnica
`G5-PC1D`. No es evidencia de implementación, no cierra Q-106, no cierra los
artefactos legales prepiloto y no autoriza G5, datos reales, piloto, producción ni
integración técnica EduPay.

La clasificación utilizada es:

- **Decisión aprobada:** decisión humana recibida en esta etapa; no se presenta como
  histórica anterior a PC1.
- **Hecho confirmado:** comportamiento observado en el runtime o en una prueba
  existente.
- **Supuesto de trabajo:** interpretación limitada usada para ordenar la evaluación.
- **Pregunta abierta/input institucional:** dato o aprobación que aún debe entregar la
  institución y que no se inventa aquí.

## Estado de entrada y resultado de PC1

| Elemento | Estado canónico |
| --- | --- |
| `G5-LP3` | `COMPLETE / TECHNICALLY & DOCUMENTARILY ACCEPTED` |
| `DESIGN_DECISION_GAP` | `CLOSED` |
| `PREPILOT_LEGAL_ARTIFACTS` | `OPEN — 16 / 16` |
| `C-013` | `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING` |
| `Q-106` | `DEFERRED / PILOT PRECONDITION`; `LP3_REFINED_POLICY = DEFINED`; `FINAL_PROCEDURE = PENDING` |
| `G5-EXIT-10` | `BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD` |
| `G5-EXIT-11` | `BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED` |
| `G5-EXIT-12` | `BLOCKED` |
| `G5` | `NO APROBADA / NOT REQUESTED` |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |
| Integración técnica EduPay | `NOT AUTHORIZED` |
| `PC1-A` | `HUMAN APPROVED` |
| `PC1-B` | `HUMAN APPROVED` |
| `PC1-C` | `HUMAN APPROVED` |

Las tres aprobaciones anteriores se registran ahora en PC1; no se afirma que hayan
existido antes de esta etapa.

## Control de entrada PC1 y discrepancias documentales

Hechos verificados antes de editar:

| Control | Resultado |
| --- | --- |
| Repository | `Sherydans12/Admision-Edupay` |
| Branch | `feat/e5-mvp` |
| HEAD inicial | `991654b4eaf518f44ce2f5d2daf2a6b979c3e3f0` |
| Working tree inicial | `clean` |
| PR #8 | `OPEN / DRAFT / NO MERGE` |
| Migration 16 | `INTACT` |
| Migration 17 | `ABSENT` |

El encabezado histórico de `docs/g5/00-g5-plan-and-status.md` conserva controles de
etapas anteriores —incluidos HEAD y la afirmación antigua de que Migration 16 no
existía—. Esos valores no describen el estado de entrada de PC1. Para esta evaluación
prevalece el runtime/git verificado arriba: Migration 16 es la última migration y
Migration 17 está ausente. La discrepancia queda registrada y no se corrige
reescribiendo el histórico.

## PC1-A — Q-106 aprobado

### PC1-001 — Relationship y authority basis separados

**Decisión aprobada.** El vínculo conceptual con el estudiante y la base conceptual
de autoridad son campos distintos:

`RELATIONSHIP_TO_STUDENT`:

- `MOTHER`
- `FATHER`
- `OTHER_RELATIVE`
- `OTHER`

`AUTHORITY_BASIS`:

- `PARENT`
- `LEGAL_REPRESENTATIVE`
- `PERSONAL_CARE_HOLDER`
- `AUTHORIZED_BY_AUTHORITY_HOLDER`

Estos nombres son vocabulario conceptual aprobado. No se asume que ya existan como
enum, columna, contrato API o modelo Prisma.

### PC1-002 — Declaración previa a datos específicos

**Decisión aprobada.** Antes de ingresar datos personales específicos del estudiante,
el adulto debe tener email/cuenta verificado, declarar el vínculo, declarar la base
de autoridad y declarar que tiene autoridad para iniciar la postulación/tratamiento.

Se mantienen separadas las señales:

`EMAIL_VERIFIED != AUTHORITY_DECLARED != AUTHORITY_VERIFIED`.

Verificar una cuenta no verifica por sí solo relación, autoridad ni evidencia.

### PC1-003 — Verificación progresiva

**Decisión aprobada.** No se exige un documento jurídico adicional universal en el
primer paso. La política conceptual es:

| Base | Tratamiento aprobado |
| --- | --- |
| `PARENT` | Declaración inicial y verificación posterior |
| `LEGAL_REPRESENTATIVE` | Evidencia oficial y revisión manual |
| `PERSONAL_CARE_HOLDER` | Evidencia oficial y revisión manual |
| `AUTHORIZED_BY_AUTHORITY_HOLDER` | Evidencia de autorización y revisión manual obligatoria |

No se inventan nombres ni tipos exactos de documentos. La evidencia institucional y
la validación final de procedimiento siguen abiertas.

### PC1-004 — Boundary de tratamiento

**Decisión aprobada.** El boundary operativo es:

```text
EMAIL VERIFICATION
  → AUTHORITY DECLARATION
  → ORDINARY CHILD DATA / DRAFT
  → AUTHORITY VERIFICATION
  → FINAL SUBMISSION
```

`UNVERIFIED AUTHORITY + SENSITIVE PROCESSING = BLOCK`.

### PC1-005 — Responsabilidades de revisión

**Decisión aprobada.**

| Rol operativo | Responsabilidad |
| --- | --- |
| Secretariat | Recibir evidencia, cargar/digitalizarla y marcar recepción administrativa; no hace verificación final de autoridad |
| Admissions Responsible / Roxana | Verificación normal, aceptar/rechazar evidencia y registrar observación |
| Institutional Max Admin / Arturo | Escalamiento de casos disputados o excepcionales |

Los nombres no deben hardcodearse en runtime. Las capacidades y asignaciones deben
permanecer basadas en tenant y configuración.

### PC1-006 — Estados conceptuales

**Decisión aprobada.** Los estados conceptuales son:

`NOT_DECLARED`, `DECLARED`, `EVIDENCE_PENDING`, `UNDER_REVIEW`, `VERIFIED`,
`DISPUTED`, `REJECTED`.

No se asume implementación persistente ni enum existente.

### PC1-007 — Authorized by authority holder

**Decisión aprobada.** `AUTHORIZED_BY_AUTHORITY_HOLDER` puede iniciar el flujo, usar
flujo asistido y entregar evidencia. Una declaración por sí sola no permite quedar
`VERIFIED`, acceder a datos altamente restringidos, hacer final submit, autorizar una
excepción de salud ni resolver una disputa. La verificación manual es obligatoria.

### PC1-008 — Disputa

**Decisión aprobada.** Con `AUTHORITY_STATUS = DISPUTED` se bloquean el envío final,
el tratamiento sensible, la aceptación final de oferta por el adulto disputado y la
autorización de handoff por ese adulto.

Se permiten revisión de staff, solicitud de evidencia adicional, corrección
administrativa y audit trail. Una disputa no rechaza automáticamente al estudiante ni
a la postulación.

## Política aprobada para estudiante adulto (>=18)

**Decisión aprobada.** Si `STUDENT_AGE >= 18`, `GUARDIAN_AUTHORITY = NOT_APPLICABLE`
respecto de los datos personales propios del estudiante. El estudiante adulto
autoriza el tratamiento de sus propios datos. Un `RESPONSIBLE_ADULT` puede permanecer
como contacto o rol operativo si la institución lo requiere, pero no reemplaza la
autoridad del estudiante adulto.

En esta etapa no se crea un portal separado. La existencia de fecha de nacimiento,
por sí sola, no se considera evidencia de soporte para el flujo adulto: debe poder
determinarse la edad, distinguirse el sujeto autorizado y aplicarse la regla en envío,
aceptación y handoff.

## PC1-B — Configuración piloto aprobada

### Actividades, responsables y calendario

| ID | Decisión aprobada |
| --- | --- |
| `PC1-009` | `GUARDIAN_INTERVIEW_DURATION = 30` minutos por defecto para Conquistadores 2027; configurable |
| `PC1-010` | `DIAGNOSTIC_EVALUATION_DURATION = 60` minutos por defecto; configurable |
| `PC1-011` | Executor de entrevista: Admissions Responsible o entrevistador autorizado. Roxana puede ser primaria para el piloto, salvo configuración de otra persona; no hardcodear |
| `PC1-012` | Executor diagnóstico: evaluador autorizado / docente designado. Personas concretas son input institucional prepiloto |
| `PC1-013` | Cada función/actividad crítica requiere conceptualmente `1 primary + 1 backup` antes del piloto; sin persona hardcodeada |
| `PC1-014` | Zona horaria `America/Santiago`; día hábil lunes-viernes y no configurado como excluido. Las exclusiones pueden ser feriados nacionales aplicables, cierres institucionales o días excepcionales; no se requiere API externa para MVP |
| `PC1-015/016/017` | Para oferta y corrección: el día de emisión no es día 1; día 1/2/3 son los siguientes días hábiles; `expiresAt = DAY 3 at 23:59 America/Santiago` |
| `PC1-018` | Recordatorio una jornada hábil antes de expirar, con ventana objetivo aproximada 10:00 `America/Santiago`; es configuración piloto, no constante universal; sin WhatsApp/SMS |
| `PC1-019` | Orden de waitlist `ENTRY_ORDER`; sin prioridades adicionales para el piloto; desempate técnico estable permitido; promoción humana, no automática |

Ejemplo de `PC1-015/016/017`: emisión viernes, lunes día 1, martes día 2,
miércoles día 3 y expiración miércoles 23:59 de `America/Santiago`, salvo fecha
excluida.

### Capacidad, documentos y comunicaciones

**PC1-020 — Capacidad.** La capacidad es input institucional por curso/año/oferta,
no constante de código. Una oferta/publicación no debe quedar operacionalmente
publicable/abierta sin capacidad de admisión explícita aplicable. Capacidad `0` no es
lo mismo que capacidad indefinida.

**PC1-021 — Catálogo documental piloto.**

| Código | Política aprobada |
| --- | --- |
| `DOC-01` | Certificado de nacimiento, obligatorio para todos los cursos |
| `DOC-02` | Registro académico/notas, obligatorio; informe anual vigente/aplicable o equivalente |
| `DOC-03` | Informe de personalidad/desarrollo, condicional y configurable por curso; deshabilitado por defecto hasta activación expresa; vigente/equivalente; exención auditada autorizada |
| `DOC-04` | Formulario digital del portal, no archivo subido |
| `DOC-05` | Documento adicional sólo por caso, con propósito, requisito exacto, razón, creador autorizado, versión y auditoría |

Documentos de salud y documentos diagnósticos PIE/NEE están `DISABLED BY DEFAULT`.
No se infiere activación concreta de `DOC-03` para un curso.

**PC1-022 — Email.** `FROM_NAME = Colegio Conquistadores — Admisión`.
`FROM_EMAIL` queda como input institucional prepiloto y debe ser un buzón institucional
con dominio de envío verificado, nunca un buzón personal. Los propósitos son
`APPLICATION_RECEIVED`, `DOCUMENT_CORRECTION`, `ACTIVITY_SCHEDULED`, `FINAL_RESULT`,
`OFFER` y `OFFER_REMINDER`. No se selecciona proveedor ni dirección concreta.

**PC1-023 — Aceptación de oferta.** Para un menor, sólo un titular de autoridad
verificado puede aceptar. Para un estudiante adulto >=18 debe respetarse su propia
autoridad; el contacto responsable no la reemplaza automáticamente.

**PC1-024 — Handoff.** El boundary aprobado es:

```text
DIRECTION_APPROVED
  → OFFER
  → VERIFIED AUTHORITY OR ADULT STUDENT
  → EXPLICIT ACCEPTANCE
  → HANDOFF
```

Nunca `DIRECTION_APPROVED → automatic handoff`.

## PC1-C — Input institucional pendiente

Los siguientes valores son `PREPILOT_INSTITUTIONAL_INPUT`, no decisiones inventadas ni
bloqueadores del desarrollo técnico:

- persona backup de entrevista;
- evaluador(es) diagnóstico(s) y backup(s);
- primaria y backup de Direction;
- capacidad concreta por curso/año/oferta;
- fechas excluidas del calendario hábil;
- `FROM_EMAIL` productivo;
- plantillas finales de email;
- activación de informe de personalidad para cualquier curso.

Estos inputs sí bloquean la operación piloto donde sean aplicables.

## Relación con la evaluación técnica

La evidencia del runtime y de los tests existentes está en
[`16-g5pc1d-technical-gap-assessment.md`](16-g5pc1d-technical-gap-assessment.md).
Este documento no transforma una decisión aprobada en implementación. En particular,
Q-106 continúa `DEFERRED / PILOT PRECONDITION`, y `MIGRATION_17_AUTHORIZED = NO`.

## Fuera de alcance

No se modifican schema, migraciones, endpoints, permisos, workflows, dependencias,
providers, configuración productiva, tests, datos reales ni integración EduPay.
Admisión y EduPay permanecen desacoplados.
