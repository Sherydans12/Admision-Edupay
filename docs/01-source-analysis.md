# Análisis de fuentes

## Inventario de fuentes

| ID | Fuente | Estado | Uso permitido |
| --- | --- | --- | --- |
| SRC-001 | Encargo inicial “Admisión EduPay”, 6 de agosto de 2026 | Disponible en la conversación; no versionado previamente | Fuente principal para esta fundación |
| SRC-002 | Contenido previo del repositorio | No existe; el repositorio remoto estaba vacío | Ninguno |
| SRC-003 | Reglamentos, formularios y comunicaciones vigentes de Colegio Conquistadores | No entregados | Pendiente de validación |
| SRC-004 | Políticas legales, privacidad, retención y seguridad aplicables | No entregadas | Pendiente de especialista y responsables |
| SRC-005 | Contratos o documentación técnica de EduPay | No entregados | Pendiente de equipos propietarios |

Esta documentación no debe presentarse como reproducción de un proceso institucional aprobado. Es una interpretación estructurada de `SRC-001`.

## Requisitos extraídos

### Producto y operación

- SaaS multiempresa con primera implementación en Colegio Conquistadores.
- Familias capaces de gestionar varios estudiantes y postulaciones.
- Operación segmentada por institución, sede, año académico y curso.
- Formularios, documentos, observaciones, entrevistas, evaluaciones, resultados y matrícula.
- Administración de cupos, lista de espera, responsables, comunicaciones y reportes.
- Flujo configurable sobre una estructura común auditable.

### Datos y seguridad

- Aislamiento multiempresa obligatorio desde el inicio.
- Contexto de tenant derivado de identidad y permisos, nunca confiado desde el cliente.
- Acceso restringido a datos de menores, salud, necesidades educativas y finanzas.
- Cifrado, auditoría, archivos privados, protección contra enumeración y cargas maliciosas.
- Decisiones pendientes para escaneo antivirus, retención, eliminación y consentimientos.
- Prohibición de secretos y datos personales reales en el repositorio.

### Integración

- Admisión y EduPay son dominios desacoplados.
- No deben compartir tablas.
- El límite debe contemplar aceptación, reserva de vacante, aceptación familiar, inicio de matrícula, obligación de pago y confirmación de matrícula.
- Se requieren identificadores externos, contratos, idempotencia y estado de sincronización.

### Forma de trabajo

- Trabajo por etapas con aprobación humana.
- Trazabilidad y lista viva de preguntas.
- No seleccionar stack ni implementar producción en esta etapa.

## Diferencias, tensiones e inconsistencias

### C-001 — “Estados” mezclan conceptos distintos

La lista propuesta combina:

- estados operativos (`DOCUMENT_REVIEW`, `FINAL_REVIEW`);
- tareas pendientes o agendadas (`GUARDIAN_INTERVIEW_PENDING`, `..._SCHEDULED`);
- hitos ya ocurridos (`DOCUMENTS_COMPLETE`, `..._COMPLETED`);
- resultados (`ACCEPTED`, `WAITLISTED`, `REJECTED`);
- estados de otro proceso o handoff (`ENROLLMENT_PENDING`, `ENROLLED`);
- cierres transversales (`WITHDRAWN`, `EXPIRED`).

Una única enumeración produciría transiciones rígidas y semántica ambigua. La propuesta en `02-admission-workflow.md` separa estas dimensiones.

### C-002 — Aceptación institucional versus aceptación familiar

`ACCEPTED` puede significar decisión favorable, vacante ofrecida, vacante reservada o aceptación de la oferta por la familia. El encargo nombra esos momentos por separado para EduPay, por lo que no deben colapsarse.

### C-003 — Preparación multiinstitución como etapa tardía

El roadmap solicitado incluye “Preparación multiinstitución”, pero el aislamiento multiempresa es obligatorio desde el comienzo. Se propone interpretar esa etapa posterior como **preparación operacional para incorporar más instituciones**, no como incorporación tardía de `tenant_id` o controles de aislamiento.

### C-004 — Configuración libre versus estructura común

Cada institución debe configurar su proceso, pero debe conservarse una estructura común auditable. Falta definir qué elementos son invariantes de plataforma y cuáles pueden omitirse, reordenarse o repetirse.

### C-005 — Disponibilidad visible versus confidencialidad de capacidad

El portal debe mostrar cursos habilitados y “disponibilidad definida por la institución”, pero no se especifica si se mostrarán cantidades exactas, categorías como “disponible” o solamente la posibilidad de postular. Esto afecta experiencia, competencia por cupos y exposición de información operacional.

### C-006 — Responsabilidad de la obligación de pago

Se solicita que Admisión pueda emitir una señal cuando “debe generarse una obligación de pago”, pero la obligación pertenece conceptualmente a EduPay. Debe acordarse si Admisión solicita el inicio, publica un hecho o emite un comando, sin atribuirse la creación financiera.

### C-007 — Historial inmutable versus eliminación de datos

Se requieren historial inmutable, retención y eliminación. Falta una política que separe evidencia auditable, datos personales eliminables o anonimizables y obligaciones de conservación.

### C-008 — Datos familiares reutilizables versus aislamiento institucional

La cuenta familiar puede reutilizar estudiantes y antecedentes entre postulaciones, pero una institución no debe acceder a información aportada para otra. Se requiere definir qué datos son globales de la familia, qué se copian como instantánea y qué consentimientos habilitan cada uso.

## Datos faltantes

- Reglamento, formulario actual, documentos exigidos y plantillas de comunicación del colegio.
- Sedes, niveles, cursos, calendarios, zonas horarias, cupos y responsables reales.
- Reglas para entrevistas y evaluaciones por nivel.
- Criterios y autoridad para decidir, reservar, esperar, rechazar y expirar.
- Política de hermanos, prioridades, desempates y orden de lista de espera.
- Tiempos objetivo, ventanas de postulación y reglas de reprogramación.
- Canales de notificación y evidencia válida de entrega.
- Necesidades de accesibilidad, idiomas y soporte asistido.
- Reglas legales y contractuales de consentimiento, residencia de datos, retención y eliminación.
- Modelo de identidad de familias y personal; requisitos de autenticación reforzada.
- Volumen esperado de instituciones, postulaciones, documentos y concurrencia.
- Sistemas actuales y contrato de integración de EduPay.
- Definiciones de matrícula confirmada, obligación financiera y reconciliación.

## Validaciones requeridas con Colegio Conquistadores

1. Confirmar el proceso real y excepciones por nivel o curso.
2. Validar el formulario, obligatoriedad, momento de captura y visibilidad de cada dato sensible.
3. Entregar catálogo de documentos, criterios de vigencia y responsables de revisión.
4. Definir roles reales, delegaciones, reemplazos y separación de funciones.
5. Acordar estados comprensibles para familias y textos de próximos pasos.
6. Validar cupos, reservas, expiraciones, lista de espera y reingreso de vacantes.
7. Definir entrevista, evaluación, reprogramación, inasistencia y excepciones.
8. Aprobar plantillas, canales, horarios y responsables de comunicaciones.
9. Acordar reportes y exportaciones, incluyendo quién puede acceder a datos restringidos.
10. Validar política de retención, eliminación, consentimiento y atención de solicitudes de titulares.

## Criterio de evidencia futuro

Cada requisito nuevo debe registrar su fuente, fecha, propietario y estado de aprobación. Cuando una minuta o documento contradiga otro, no se debe elegir silenciosamente: se registra la diferencia en `09-open-questions.md` y se solicita decisión al propietario funcional.
