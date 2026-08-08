# Backlog funcional MVP

## Criterio de priorización

- **P0:** imprescindible para completar de forma segura el recorrido mínimo del piloto.
- **P1:** importante, pero puede incorporarse después del recorrido mínimo sin invalidar la especificación.
- **P2:** evolución aprobada como diferida; no bloquea el piloto inicial.

Los elementos son capacidades funcionales, no tickets técnicos. No prescriben componentes, schemas, endpoints ni stack.

## P0 — Recorrido mínimo completo

| ID | Capacidad | Descripción | Actor principal | Requisitos | Dependencias funcionales | AC | E2E/justificación | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BL-001 | Aislamiento multiempresa | Aislar expedientes, archivos, búsquedas, conteos y exportaciones por tenant | Todos | NFR-TEN-001 a 004; NFR-SEC-001 a 003 | Identidad, membresía y scope | AC-045, AC-050 | E2E-018 | Requisito base SaaS y protección de menores |
| BL-002 | Identidad y familia | Cuenta de adulto responsable, varios hijos, facultades y snapshot versionado | Familia | FR-ID-001 a 005 | Tenant y verificación | AC-001 a AC-003, AC-051 | E2E-001 | Punto de entrada del recorrido familiar |
| BL-003 | Oferta y disponibilidad | Publicar oferta por tenant/sede/año/curso y señal categórica sin promesa | Familia; administrador | FR-APP-001/002; FR-ADM-003 | Configuración institucional | AC-004 a AC-006 | E2E-001, E2E-011 | Permite iniciar una postulación válida |
| BL-004 | Formulario versionado | Builder controlado, borrador, publicación y captura minimizada | Administrador; familia | FR-FRM-001 a 012; FR-ADM-008; NFR-SEC-013/014 | Oferta y permisos | AC-007 a AC-009 | E2E-001 | Recoge sólo antecedentes aprobados sin alterar historia |
| BL-005 | Postulación | Iniciar, guardar, enviar, consultar y desistir con detección de duplicados | Familia | FR-APP-003 a 009 | Identidad, oferta y formulario | AC-002, AC-003, AC-007, AC-058 | E2E-001, E2E-014 | Objeto central del proceso de Admisión |
| BL-006 | Documentos | Catálogo, carga, revisión, observación, equivalencia, exención y versiones | Familia; revisor | FR-DOC-001 a 008 | Postulación y requisitos configurados | AC-010 a AC-013 | E2E-002, E2E-003 | Evidencia necesaria sin pérdida de historia |
| BL-007 | Postulación asistida y físico | Asistencia en portal y digitalización excepcional al expediente oficial | Secretaría; Admisión | FR-APP-008; FR-DOC-009; FR-AUD-001/004 | Postulación y permisos | AC-014 a AC-016 | E2E-004 | Accesibilidad operacional sin expedientes paralelos |
| BL-008 | Agenda de actividades | Programar entrevista/evaluación presencial y solicitar reprogramación | Secretaría; Admisión; familia | FR-ACT-001 a 007; FR-COM-009 | Oferta/proceso y ejecutores | AC-017, AC-018 | E2E-005 | Actividades obligatorias del piloto |
| BL-009 | Asistencia, excepciones e intentos | No-shows, cierre manual, resultado separado y evaluación repetible | Evaluador; Admisión; Dirección | FR-ACT-008/009; FR-AUD-004 | Agenda y permisos | AC-019 a AC-021 | E2E-006 a E2E-008 | Evita cierres automáticos y sobrescritura de evidencia |
| BL-010 | Recomendación de Admisión | Emitir opciones internas con fundamento, versión y auditoría | Responsable de Admisión | FR-DEC-003/005/008 | Expediente consolidado | AC-022 a AC-024 | E2E-001, E2E-009 | Separa revisión de decisión institucional |
| BL-011 | Disposición de Dirección | Aprobar, esperar, rechazar o devolver con semántica inequívoca | Dirección | FR-DEC-004/006/007/009 | Recomendación y separación | AC-025 a AC-028 | E2E-009 a E2E-011 | Autoridad final y base de oferta/espera |
| BL-012 | Cupos y reservas | Cupos manuales, ajustes auditados, reservas y prevención de sobreoferta | Admisión; Administrador Máximo | FR-CAP-001 a 003 | Oferta y disposición | AC-029 a AC-031 | E2E-001, E2E-012 | Controla vacantes sin acoplar EduPay |
| BL-013 | Lista de espera | Orden interno, promoción manual, privacidad de posición y oferta de espera | Admisión; Administrador Máximo | FR-CAP-004/005 | Admisibilidad y cupos | AC-032 a AC-035 | E2E-011 a E2E-013 | Resuelve falta de cupo sin prometer oferta |
| BL-014 | Oferta, aceptación y expiración | Oferta normal/espera, vencimiento, liberación, reapertura y aceptación expresa | Familia; Admisión | FR-CAP-006; FR-COM-006; FR-AUD-004 | Disposición o promoción | AC-036 a AC-039, AC-058 | E2E-001, E2E-012 a E2E-016 | Define el compromiso previo al handoff |
| BL-015 | Comunicación por email | Preparación, confirmación, envío, entrega/fallo, recordatorio y tarea | Admisión; correo | FR-COM-002 a 009 | Decisión, oferta y plantillas | AC-040 a AC-043 | E2E-001, E2E-017 | Único canal automático MVP sin alterar negocio por fallo |
| BL-016 | Portal familiar | Proyectar estado, acciones, plazos e historia segura | Familia | FR-COM-001; FR-AUD-003; NFR-UX-003/004 | Todas las capacidades de caso | AC-005, AC-012, AC-017, AC-021, AC-032, AC-036 | E2E-001 a E2E-017 | El portal es la fuente oficial y oculta deliberaciones |
| BL-017 | Dashboard operativo | Contadores y flujo por etapa, tenant y scope | Personal institucional | FR-ADM-001/002/009 | Estados canónicos y autorización | AC-044 a AC-046 | E2E-001, E2E-018 | Permite operar el volumen del piloto |
| BL-018 | Reportes y exportaciones | Reportes mínimos y exportación autorizada/minimizada | Admisión; Administrador Máximo | FR-ADM-006; NFR-PRV-008 | Permisos, propósito y auditoría | AC-047 a AC-049 | E2E-021, E2E-022 | Necesidad operacional con control de datos |
| BL-019 | Roles y permisos | Capacidades por rol, scopes, sensibilidad, separación y elevación global | Administradores | FR-ADM-005/007; NFR-SEC-001/012; NFR-TEN-003 | Membresías y clasificación | AC-011, AC-016, AC-023, AC-028, AC-034, AC-052 a AC-054 | E2E-019, E2E-020, E2E-022 | Impide escalamiento y conflicto de funciones |
| BL-020 | Auditoría e historia | Registrar acciones críticas, lecturas sensibles, versiones, excepciones y cierres | Todos | FR-AUD-001 a 004; NFR-OBS-003/004 | Identidad, tenant y eventos funcionales | AC-013, AC-020, AC-024, AC-030, AC-039, AC-047, AC-054 | Todos los E2E exigen evidencia | Reconstrucción y accountability |
| BL-021 | Configuración mínima | Configurar sede, proceso, curso, oferta, formulario, requisitos, actividades, plazos y roles | Administrador institucional | FR-ADM-003 a 005/008 | Builder y versionado | AC-004, AC-007, AC-009, AC-017, AC-029 | E2E-001 | Conquistadores debe ser configuración, no código especial |
| BL-022 | Borde funcional EduPay | Habilitar conceptualmente handoff sólo tras aceptación, sin integración ejecutable | Admisión; EduPay | FR-INT-001/003/008; D-007; Q-310 | Oferta aceptada | AC-055 a AC-057 | E2E-001 | Completa el recorrido funcional sin resolver Q-301 a Q-309 |

## P1 — Importante después del recorrido mínimo

| ID | Capacidad | Descripción | Actor principal | Requisitos | Dependencias funcionales | AC | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BL-023 | Filtros y visualización ampliada | Refinar filtros y proyección del flujo operativo | Admisión | FR-ADM-001/002 | BL-017 | AC-044 a AC-046 | Mejora eficiencia sin cambiar estados |
| BL-024 | Catálogo ampliado de reportes | Incorporar vistas operativas adicionales ya descritas | Admisión; Dirección | FR-ADM-006 | BL-018 | AC-047, AC-049 | Útil para gestión, no imprescindible para el primer recorrido |
| BL-025 | Pauta configurable de entrevista | Usar builder controlado para preguntas de entrevista | Entrevistador; administrador | FR-FRM-001/008; FR-ACT-005 | BL-004, BL-008 | AC-007, AC-009, AC-021 | MVP puede operar con pauta mínima mientras se completa configuración |
| BL-026 | Gestión ampliada de membresías | Delegaciones, suplencias y scopes configurables con mayor detalle | Administrador Máximo | FR-ADM-005 | BL-019 | AC-023, AC-028, AC-052 | Las suplencias concretas son configuración previa al piloto |
| BL-027 | Alertas y SLA operativos | Resaltar atrasos y crear tareas según valores configurados | Admisión | FR-ADM-001/009; Q-184 | BL-017 | AC-044, AC-046 | Los valores numéricos no cambian el comportamiento base |
| BL-028 | Historial de comunicaciones ampliado | Refinar plantillas, remitentes, horarios y seguimiento | Admisión | FR-COM-002/003/007 | BL-015 | AC-040 a AC-043 | Textos y parámetros finales son configuración |

## P2 — Evolución posterior

| ID | Capacidad | Descripción | Actor principal | Dependencias | Motivo |
| --- | --- | --- | --- | --- | --- |
| BL-029 | WhatsApp | Canal adicional sujeto a costo, privacidad, consentimiento y decisión técnica | Familia; Admisión | D-018; FR-COM-008 | Expresamente diferido |
| BL-030 | Modalidad remota avanzada | Entrevistas/evaluaciones remotas y eventual integración de videollamada | Familia; actividades | BL-008 | MVP presencial aprobado |
| BL-031 | Cuentas familiares colaborativas | Varios adultos con invitación, revocación y resolución de conflictos | Familia | FR-ID-006; Q-105 | MVP usa un adulto responsable |
| BL-032 | Pauta diagnóstica avanzada | Campos/preguntas avanzadas para evaluación diagnóstica | Evaluador | BL-004, BL-009 | Resultado simple y comentario bastan en MVP |
| BL-033 | Internacionalización completa | Idiomas adicionales y adaptación integral de contenidos | Familia | Q-108 | No es requisito del recorrido piloto inicial |

## Resumen y cobertura

| Prioridad | Cantidad | Cobertura |
| --- | --- | --- |
| P0 | 22 | Cada elemento tiene requisito, criterio AC y escenario E2E o justificación explícita |
| P1 | 6 | Capacidades ya previstas que mejoran operación sin bloquear el recorrido mínimo |
| P2 | 5 | Evolución expresamente diferida |

La prioridad no autoriza implementación. El orden técnico, estimación y desglose pertenecen a etapas posteriores a G1.
