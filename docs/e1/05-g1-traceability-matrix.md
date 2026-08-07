# Matriz de trazabilidad G1

La validación institucional de C-009, C-011, C-013 y C-014 está registrada en [`07-institutional-validation-baseline.md`](07-institutional-validation-baseline.md). Esta matriz conserva referencias históricas y agrega el estado E1-B sin cerrar G1.

## Estado

Matriz de trazabilidad consolidada para responder qué falta, quién decide, qué evidencia se requiere y dónde se consolidará. `E1-A` registra decisiones de producto; `E1-B` incorpora validaciones institucionales; `E1-C` verificará consistencia y preparará la solicitud de G1. Los estados `PROPOSED`, `NEEDS_DECISION` y `PARTIAL` de la tabla histórica muestran el estado previo a la validación y no reemplazan el estado consolidado.

## Estado consolidado de producto

Las 33 preguntas objetivo tienen estado `APPROVED_PRODUCT` por aprobación de Nicolás Sena el `2026-08-06T22:09:00-04:00`: Q-101–Q-108, Q-120–Q-124, Q-140–Q-145, Q-160–Q-167, Q-180–Q-184 y Q-310. Permanecen como pendientes de validación o detalle: C-009, C-011, C-013, C-014; cifras/responsables/pautas/plantillas; y Q-301 a Q-309. La aprobación de producto no satisface por sí sola los criterios de G1.

## Criterios de salida de G1

| Criterio G1 | Preguntas/contradicciones | Decisiones heredadas | Evidencia faltante | Responsable de aprobación | Estado | Entrega objetivo |
| --- | --- | --- | --- | --- | --- | --- |
| Q-101 a Q-184 resueltas para piloto | Todas las filas funcionales siguientes; C-005/C-009/C-011/C-013/C-014 | D-001 a D-020 | Acta de decisiones y documentos actualizados | Nicolás Sena + autoridad institucional por tema | `OPEN` | E1-B/E1-C |
| Q-310 resuelta | Q-310, C-002/C-006 | D-021 a D-024 | Secuencia aprobada y aceptación/vencimiento definidos | Nicolás Sena + representante institucional; EduPay después para contrato | `OPEN` | E1-B |
| Proceso validado por responsables reales | Todos los journeys | D-014 a D-017 | Registro de reunión con Admisión, Dirección y actividades | Representante institucional | `OPEN` | E1-B |
| Datos sensibles justificados/minimizados | Q-104, C-013 | D-004/D-005 | Finalidad, obligatoriedad, audiencia y etapa por dato | Institución + Nicolás Sena; legal antes de datos reales | `OPEN` | E1-B, hito legal posterior |
| Casos felices, alternos y excepciones aprobados | Q-102, Q-122/123/124, Q-142/145, Q-163/164/166/167 | D-001/D-003/D-008/D-016 | Casos de uso revisados y criterios funcionales aceptados | Producto + responsables institucionales | `OPEN` | E1-C |
| Backlog MVP priorizado y fuera de alcance | Todas; dependencias Q-201+ y Q-301+ | Roadmap aprobado en G0 | Priorización por requisito/UC y exclusiones | Nicolás Sena + institución | `OPEN` | E1-C |

## Trazabilidad pregunta a comportamiento

Abreviaturas de aprobación: `NS` Nicolás Sena; `RI` representante institucional; `ADM` Admisión; `DIR` Dirección; `CUP` responsable de cupos; `ACT` entrevistadores/evaluadores; `COM` comunicaciones. “Evidencia” implica respuesta fechada, responsable y resultado `APPROVED/MODIFIED/REJECTED/PENDING`.

| Q | C / D relacionada | FR/NFR | Journeys | Casos de uso | Aprueba | Estado previo a aprobación | Evidencia necesaria | Entrega |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q-101 | D-002/D-013 | FR-APP-001/003/004 | J-FAM-001/002; J-ADM-001 | UC-APP-001 | NS+RI | `PROPOSED` | Combinaciones permitidas por estudiante/oferta | E1-B |
| Q-102 | D-002/D-003 | FR-APP-004 | J-FAM-001/003; J-ADM-001 | UC-APP-001/003 | NS+ADM | `PROPOSED` | Clave funcional de duplicado y excepciones | E1-B |
| Q-103 | C-005; A-006 | FR-APP-002 | J-FAM-001/007; J-ADM-001 | UC-ADM-001/UC-CAP-001 | CUP+DIR | `PROPOSED` | Señal/texto de disponibilidad | E1-B |
| Q-104 | C-013; D-004 | FR-FRM-002 a 010; NFR-PRV-002/003 | J-FAM-001; J-ADM-007 | UC-FRM-001/002 | RI+NS | `NEEDS_DECISION` | Matriz finalidad-obligatoriedad-audiencia-etapa por dato | E1-B |
| Q-105 | D-013; C-002 | FR-ID-003/006; FR-COM-006 | J-FAM-001/002/010 | UC-FAM-003; UC-APP-003/006/007 | RI+NS | `PROPOSED` | Facultades por adulto/acción y conflictos | E1-B |
| Q-106 | D-004 | FR-ID-004; NFR-SEC-006/007 | J-FAM-001 | UC-FAM-004 | RI+NS | `PROPOSED` | Evidencia y momento de verificación | E1-B |
| Q-107 | C-014; D-017 | FR-APP-003/008; FR-AUD-001 | J-OPS-001 | UC-ADM-002 | RI+NS | `NEEDS_DECISION` | Canal elegido, operador, autorización y evidencia | E1-B |
| Q-108 | D-009 | NFR-UX-001 a 003 | J-FAM-001/003 | UC-FRM-001 | NS+RI | `PROPOSED` | Necesidades reales y alcance idiomático | E1-B/E1-C |
| Q-120 | C-011/C-012; D-003 | FR-DOC-001/007/008 | J-FAM-001/004; J-ADM-002/007 | UC-DOC-001/002 | RI+ADM+NS | `NEEDS_DECISION` | Catálogo por curso/periodo/condición y equivalentes | E1-B |
| Q-121 | D-004 | FR-DOC-004 | J-ADM-002 | UC-DOC-002/003 | ADM+DIR | `PROPOSED` | Revisor/eximidor/suplente por tipo | E1-B |
| Q-122 | — | FR-DOC-005; FR-COM-001 | J-FAM-004 | UC-APP-004 | ADM+DIR | `NEEDS_DECISION` | Intentos, plazos y escalamiento | E1-B |
| Q-123 | D-006 | FR-DOC-002/003; NFR-FIL-003/005 | J-FAM-001/004; J-ADM-002 | UC-APP-004/UC-DOC-002 | NS+ADM | `PROPOSED` | Formatos y tratamiento funcional de excepciones | E1-B |
| Q-124 | C-007; D-003 | FR-DOC-005/006; FR-AUD-004 | J-FAM-004 | UC-APP-004 | NS+RI | `PROPOSED` | Regla de retirar/reemplazar y dependencia retención | E1-B |
| Q-140 | C-009; D-015 | FR-ACT-001 | J-ADM-003 | UC-ACT-003 | RI+NS | `NEEDS_DECISION` | Validación institucional, repetición y exención | E1-B |
| Q-141 | D-014 | FR-ACT-002/003/007 | J-FAM-005; J-ADM-003 | UC-ACT-001/003 | ADM+RI | `PARTIAL` | Confirmación y solicitud de cambio | E1-B |
| Q-142 | A-008 | FR-ACT-002/004 | J-FAM-006; J-ADM-003 | UC-ACT-002/004 | ADM+DIR | `NEEDS_DECISION` | Reprogramación, cancelación, tolerancia e inasistencia | E1-B |
| Q-143 | — | FR-ACT-002/006 | J-FAM-005/006; J-ADM-003 | UC-ACT-002/003 | ADM+ACT | `PROPOSED` | Modalidades y datos de ubicación | E1-B |
| Q-144 | C-013; D-004 | FR-ACT-005 | J-ADM-004; J-DIR-001 | UC-ACT-005 | ACT+ADM+DIR | `NEEDS_DECISION` | Pauta, conclusión, visibilidad y comunicación | E1-B |
| Q-145 | D-003 | FR-ACT-004/005; FR-AUD-004 | J-ADM-004; J-DIR-001 | UC-ACT-005 | ACT+ADM+DIR | `PROPOSED` | Autoridad/proceso de corrección | E1-B |
| Q-160 | D-016 | FR-DEC-003 a 007 | J-ADM-004; J-DIR-001 | UC-DEC-001/003 | ADM+DIR+RI | `NEEDS_DECISION` | Criterios, evidencia y fundamentos | E1-B |
| Q-161 | D-016 | FR-DEC-004 | J-ADM-004; J-DIR-001 | UC-DEC-001/003 | DIR+NS | `PARTIAL` | Personas, suplencias y excepciones | E1-B |
| Q-162 | C-005 | FR-CAP-001/002 | J-ADM-004/006 | UC-CAP-001 | CUP+DIR | `NEEDS_DECISION` | Concepto y fuente de cupo de admisión | E1-B |
| Q-163 | C-002 | FR-CAP-002/003 | J-FAM-008/010; J-ADM-006 | UC-CAP-001/003/004; UC-APP-007 | CUP+DIR+ADM | `NEEDS_DECISION` | Momento/duración/liberación de reserva | E1-B |
| Q-164 | D-008 | FR-CAP-004 | J-FAM-009; J-ADM-006 | UC-CAP-002/003 | DIR+CUP+RI | `NEEDS_DECISION` | Orden, prioridades y desempates | E1-B |
| Q-165 | — | FR-CAP-005; FR-COM-001 | J-FAM-007/009 | UC-APP-005/UC-CAP-002 | DIR+COM | `PROPOSED` | Visibilidad y texto de espera | E1-B |
| Q-166 | C-002 | FR-COM-006; FR-CAP-002 | J-FAM-008/009 | UC-APP-007/UC-CAP-003/004 | DIR+CUP+NS | `PROPOSED` | Efectos de ofertas múltiples dentro del tenant | E1-B |
| Q-167 | D-003 | FR-AUD-004 | J-FAM-010; J-DIR-001 | UC-APP-006/UC-DEC-003 | DIR+ADM+CUP | `NEEDS_DECISION` | Autoridades, motivos y efectos de reapertura | E1-B |
| Q-180 | D-017/D-018 | FR-COM-007/008 | Todos con notificación | UC-COM-001 | Decisión heredada; ADM detalle | `PARTIAL` | Procedimiento de fallo/fallback sin nuevo canal automático | E1-B |
| Q-181 | D-017 | FR-COM-002/003/005 | J-FAM-004 a 010; J-ADM-005 | UC-COM-001 | COM+ADM+DIR | `NEEDS_DECISION` | Plantillas, remitente, horarios y dueño de fallo | E1-B |
| Q-182 | D-001 | FR-COM-001; FR-AUD-003 | J-FAM-007 | UC-APP-005 | ADM+COM+DIR | `PROPOSED` | Lista de hitos/textos visibles | E1-B |
| Q-183 | D-004/D-005 | FR-ADM-006; NFR-PRV-008 | J-ADM-001/006 | UC-ADM-003 | ADM+DIR+NS | `NEEDS_DECISION` | Catálogo, audiencia, columnas y periodicidad | E1-B/E1-C |
| Q-184 | — | NFR-REL/PER/OBS por definir | Todos | Todos los operativos | ADM+DIR+dueños | `NEEDS_DECISION` | SLA funcionales, calendario, dueño y escalamiento | E1-C |
| Q-310 | C-002/C-006; D-021 a D-024 | FR-INT-005/006/008 | J-FAM-008/010; J-INT-001 | UC-APP-007; UC-INT-001 | NS+RI+ADM+DIR | `NEEDS_DECISION` | Secuencia decisión-oferta-aceptación-handoff aprobada | E1-B |

## Estado E1-B de las contradicciones validadas

| ID | Estado | Impacto trazable | Pendiente para G1 |
| --- | --- | --- | --- |
| C-009 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Actividades obligatorias en piloto; configuración versionada, excepciones, reprogramación, repetición y cierre auditados | Catálogo operativo, pautas, responsables, suplencias y cifras |
| C-011 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Personalidad configurable; último vigente/disponible o equivalente; exención autorizada | Catálogo concreto por curso/nivel y condición |
| C-013 | `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING` | PIE/NEE progresivos; salud mínima por necesidad; ingreso familiar fuera del formulario MVP; acceso restringido y auditable | Fundamento legal, retención, eliminación/anonimización, titulares y matriz legal |
| C-014 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Portal oficial, asistencia presencial auditada y digitalización física excepcional al expediente | Personal, suplencias, evidencias y detalle físico |

Estas cuatro contradicciones ya no bloquean conceptualmente el inicio de E1-B. G1 permanece `NO APROBADA`.

## Trazabilidad de reglas operativas E1-B

| Regla | Requisitos | Journeys | Casos de uso | Artefacto canónico | Estado |
| --- | --- | --- | --- | --- | --- |
| Responsables y separación | FR-DEC-004/005; FR-ADM-005 | J-ADM-002/003/004/006; J-DIR-001 | UC-DEC-001/003; UC-CAP-001/003; UC-ADM-002/003 | `01-actors-and-responsibilities.md`, `08-pilot-operational-rules.md` | `DEFINED_FOR_PILOT`; suplencias pendientes |
| Cupos y auditoría de ajustes | FR-CAP-001/002/003 | J-ADM-006; J-FAM-008/009/010 | UC-CAP-001/003/004 | `08-pilot-operational-rules.md`, `09-pilot-configuration-matrix.md` | `DEFINED_FOR_PILOT` |
| Plazos y expiración | FR-CAP-002/006; FR-DOC-005 | J-FAM-004/008/009/010; J-ADM-005/006 | UC-APP-007; UC-CAP-004; UC-COM-001 | `08-pilot-operational-rules.md` | `DEFINED_FOR_PILOT`; calendario pendiente |
| Actividades y reprogramación | FR-ACT-001 a 007; FR-ACT-008/009 | J-FAM-005/006; J-ADM-003 | UC-ACT-001 a 006 | `08-pilot-operational-rules.md`, `09-pilot-configuration-matrix.md` | `DEFINED_FOR_PILOT`; ejecutores/duración pendientes |
| Recomendación y decisión | FR-DEC-008/009 | J-ADM-004; J-DIR-001; J-FAM-008 | UC-DEC-001 a 003; UC-CAP-004 | `08-pilot-operational-rules.md` | `DEFINED_FOR_PILOT`; pautas y suplencias pendientes |
| Lista de espera | FR-CAP-004/005 | J-FAM-009; J-ADM-006 | UC-CAP-002/003/004 | `08-pilot-operational-rules.md` | `DEFINED_FOR_PILOT`; prioridades pendientes |
| Comunicaciones y dashboard | FR-COM-006/007/009; FR-ADM-001/009 | J-FAM-005/006/007/008/009; J-ADM-005 | UC-ACT-001/002; UC-COM-001; UC-ADM-003 | `08-pilot-operational-rules.md` | `DEFINED_FOR_PILOT`; plantillas/recordatorio pendientes |
| Gestión documental física | FR-DOC-009; FR-DOC-001 a 008 | J-FAM-004; J-ADM-002; J-OPS-001 | UC-DOC-001/002; UC-ADM-002 | `08-pilot-operational-rules.md` | `DEFINED_FOR_PILOT`; conservación física pendiente |

## Contradicciones y vacíos

| ID | Riesgo abierto | Preguntas/UC afectados | Evidencia para cerrar o avanzar | Entrega |
| --- | --- | --- | --- | --- |
| C-005 | Señal de disponibilidad puede prometer cupo | Q-103, Q-162; UC-ADM-001/UC-CAP-001 | Política y texto aprobados | E1-B |
| C-009 | Detalles de ejecución aún no definidos | Q-140; UC-ACT-003/006 | Catálogo versionado, excepciones, repetición, reprogramación y cierre; validación institucional ya registrada | E1-B |
| C-011 | Catálogo concreto aún no definido | Q-120; UC-DOC-001/003 | Tabla curso/periodo/condición/equivalente; validación institucional ya registrada | E1-B |
| C-013 | Legalidad y ciclo de vida aún pendientes | Q-104/Q-144/Q-183; formularios/actividades/exportación | Matriz funcional registrada; legal/retención antes de datos reales | E1-B y etapas posteriores |
| C-014 | Procedimiento operativo aún no definido | Q-107; UC-ADM-002 | Evidencia de asistencia y origen físico; personal/suplencias pendientes | E1-B |
| Vacío E1-A-001 | No hay personas/suplentes operativos nominados | Q-121/Q-141/Q-161/Q-167 | Matriz de responsables institucional aprobada | E1-B |
| Vacío E1-A-002 | No existen cifras de plazos/capacidad | Q-122/Q-163/Q-184 | Valores entregados por autoridad; no estimados por el agente | E1-B/E1-C |
| Vacío E1-A-003 | No existe pauta de entrevista/evaluación/recomendación | Q-144/Q-160 | Pautas institucionales revisadas y versionadas | E1-B |

## Qué falta para cerrar G1

1. Registrar decisiones humanas para todas las filas `NEEDS_DECISION`, `PROPOSED` y detalles `PARTIAL`.
2. Incorporar las respuestas en catálogos, reglas, estados familiares, permisos y criterios de aceptación de E1-B.
3. Validar los casos con personal real y corregir inconsistencias en E1-C.
4. Priorizar backlog y fuera de alcance del MVP.
5. Solicitar aprobación explícita de G1 sobre un commit/documentos identificados.

La fusión del PR de E1-A no satisface ninguno de estos pasos por sí sola.
