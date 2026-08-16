# G5-LP3 — Registro de artefactos legales/privacy prepiloto

## Propósito y boundary

Este registro convierte `G5-EXIT-11` en una lista finita de artefactos y validaciones
previas a una futura solicitud de G5. No es opinión legal, no cita legislación externa y
no declara cumplimiento. Cada fila requiere owner, insumos, aprobación y evidencia antes
de poder cerrarse.

| Campo | Estado |
| --- | --- |
| Paquete | `G5-LP3 / DOCUMENTARY ONLY` |
| Estado | `PREPILOT_LEGAL_ARTIFACTS = OPEN` |
| G5-EXIT-11 | `BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED` |
| Artefactos definidos | `16` |
| Artefactos cerrados | `0` |
| Artefactos abiertos | `16` |
| Implementación | `NO` |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |

Los estados `BLOCKS_G5`, `BLOCKS_PILOT` y `BLOCKS_PRODUCTION` indican que el artefacto o
su aprobación es condición de la compuerta correspondiente; no significan que el artefacto
esté terminado.

## Registro finito

| ARTIFACT_ID | ARTIFACT | RELATED_LP | OWNER_REQUIRED | INPUTS | APPROVAL_REQUIRED | BLOCKS_G5 | BLOCKS_PILOT | BLOCKS_PRODUCTION | STATUS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LP3-ART-001 | Controller/processor final validation | LP-001 | Autoridad institucional + revisor legal/privacy designado + BaseLogic | Working allocation LP3; tenant/purpose scope; inventario 09; síntesis 13 | Aprobación institucional y validación legal/contractual | YES | YES | YES | `OPEN / CONTRACTUAL_VALIDATION_REQUIRED` |
| LP3-ART-002 | DPA / processing agreement | LP-001, LP-012 | Colegio/controller + BaseLogic + revisor legal/privacy | Modelo controller/processor; instrucciones; subencargados; provider inventory 09; ART-001 | Aprobación contractual institucional/legal | YES | YES | YES | `OPEN / DPA_REQUIRED` |
| LP3-ART-003 | Final purpose → legal basis matrix | LP-002 | Autoridad institucional + revisor legal/privacy | Purpose map 09; categorías; actores; candidatos LP2; refinamiento LP3 | Clasificación final independiente por finalidad | YES | YES | YES | `OPEN / FINAL_CLASSIFICATION_REQUIRED` |
| LP3-ART-004 | Short privacy notice | LP-003, LP-004, LP-005, LP-006 | Colegio/controller + revisor legal/privacy + owner operativo | Finalidad principal; controller; canal privacy; minor-data notice; puntos de captura | Texto y versión aprobados | YES | YES | YES | `OPEN / TEXT_AND_APPROVAL_REQUIRED` |
| LP3-ART-005 | Full versioned privacy policy | LP-003, LP-002, LP-007, LP-009, LP-010 | Colegio/controller + revisor legal/privacy | Categorías, finalidades, actores, derechos, retención, acceso/exportación, proveedores | Texto completo, versión y publicación aprobados | YES | YES | YES | `OPEN / TEXT_AND_APPROVAL_REQUIRED` |
| LP3-ART-006 | Final Q-106 guardian authority procedure | LP-004, LP-014 | Autoridad institucional + owner operativo + revisor legal/privacy | Declaraciones requeridas; boundaries; discrepancias; evidencia aún no seleccionada; auditoría | Procedimiento institucional/legal aprobado | YES | YES | YES | `OPEN / FINAL_Q106_PROCEDURE_REQUIRED` |
| LP3-ART-007 | Approved sensitive/PIE/NEE field catalog | LP-005, LP-006 | Autoridad institucional + responsables funcionales autorizados + revisor legal/privacy | Campos dinámicos; propósito; mínimo dato; acceso matriz 10; política C-013 | Catálogo, roles, finalidades y límites aprobados | YES | YES | YES | `OPEN / SENSITIVE_CATALOG_REQUIRED` |
| LP3-ART-008 | Health fields disabled/default verification | LP-006 | Owner técnico + autoridad institucional + revisor legal/privacy si se solicita excepción | Runtime/form configuration facts; `HEALTH_COLLECTION_IN_ADMISSION_PILOT = DISABLED_BY_DEFAULT`; ART-007 | Evidencia de disabled-by-default y aprobación expresa para cualquier excepción | YES | YES | YES | `OPEN / DISABLED_DEFAULT_VERIFICATION_REQUIRED` |
| LP3-ART-009 | Numeric retention matrix | LP-007, LP-015 | Autoridad institucional + owner operativo/técnico + revisor legal/privacy | 27 categorías 09; purposes; triggers; providers; logs; legal hold model | Matriz numérica por categoría y finalidad aprobada | YES | YES | YES | `OPEN / NUMERIC_MATRIX_REQUIRED` |
| LP3-ART-010 | Delete/anonymize/block/legal-hold procedure | LP-007, LP-008, LP-009 | Autoridad institucional + owner operativo/técnico + revisor legal/privacy | Distinciones LP3; categorías; historial; copias; dependencias; ART-009 | Procedimiento, excepciones y evidencia aprobados | YES | YES | YES | `OPEN / PROCEDURE_REQUIRED` |
| LP3-ART-011 | Privacy-rights procedure + public channel | LP-009, LP-010 | Colegio/controller + responsable operativo + revisor legal/privacy | Case record conceptual; verificación; alcance; response proof; rights gap 09 | Procedimiento y canal público aprobados | YES | YES | YES | `OPEN / PROCEDURE_AND_CHANNEL_REQUIRED` |
| LP3-ART-012 | Final access/export legal matrix | LP-010, LP-005, LP-006, LP-009 | Autoridad institucional + dueños funcionales + revisor legal/privacy | Matriz técnica 10; purpose/tenant/elevation; terceros; highly restricted; portabilidad | Matriz legal/institucional aprobada | YES | YES | YES | `OPEN / FINAL_MATRIX_APPROVAL_REQUIRED` |
| LP3-ART-013 | Physical-original procedure + sectoral exception check | LP-011 | Autoridad institucional + owner operativo + revisor legal/privacy | E1 C-014; physical inventory 09; devolución por defecto; custodia temporal | Procedimiento y excepción documentada cuando corresponda | YES | YES | YES | `OPEN / SECTORAL_CHECK_REQUIRED` |
| LP3-ART-014 | Productive provider/DPA/subprocessor/residency/transfer review | LP-012 | Autoridad institucional + owner técnico/operativo + revisor legal/privacy | Provider inventory 09; regiones; categorías; minimización; DPA; subencargados; seguridad | Revisión específica y aprobación por proveedor | YES | YES | YES | `OPEN / PROVIDER_REVIEW_REQUIRED` |
| LP3-ART-015 | Privacy incident runbook | LP-013 | Colegio/Institutional Maximum Admin + BaseLogic/Nicolás + revisor legal/privacy | Role split; incident record fields; escalation facts; evidence; recovery | Runbook y owner privacy/legal confirmados | YES | YES | YES | `OPEN / RUNBOOK_APPROVAL_REQUIRED` |
| LP3-ART-016 | AuditEvent/SecurityEvent retention/access matrix | LP-015, LP-007 | Autoridad institucional + owner técnico/operativo + revisor legal/privacy | Event separation; minimization; purpose/access model; Grafana future destination; ART-009 | Matriz numérica y de acceso aprobada | YES | YES | YES | `OPEN / NUMERIC_RETENTION_AND_ACCESS_REQUIRED` |

## Criterio de cierre del registro

El registro sólo puede cerrarse cuando cada fila tenga owner confirmado, insumos
completos, aprobación requerida y evidencia documental verificable. La existencia de la
lista no cierra ningún artefacto. No se crean tareas de implementación fuera de estas
decisiones aprobadas.

El estado global continúa:

`PREPILOT_LEGAL_ARTIFACTS = OPEN`.

Por tanto:

- `G5-EXIT-11 = BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED`.
- `C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- `Q-106 = DEFERRED / PILOT PRECONDITION`.
- no existe autorización para datos reales, piloto, producción o G5.

## Fuera de alcance

Este registro no crea schema, migraciones, endpoints, permisos, workflows, dependencias,
variables de entorno, proveedores, textos públicos finales ni integración técnica EduPay.
Admisión y EduPay permanecen desacoplados.
