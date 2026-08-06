# Preguntas abiertas, supuestos y decisiones

## Convenciones

- **Bloqueante G0:** impide aprobar la fundación o delimitar correctamente el producto.
- **Bloqueante G1:** puede esperar al diseño funcional, pero impide cerrarlo.
- **No bloqueante actual:** se registra ahora y se resuelve antes de la etapa indicada.
- Estados: `ABIERTA`, `PROPUESTA`, `APROBADA`, `RECHAZADA`, `DIFERIDA`.

Ninguna propuesta de este documento se considera aprobada por estar escrita.

## Preguntas bloqueantes para aprobar G0

| ID | Pregunta | Por qué bloquea | Propietario sugerido | Estado |
| --- | --- | --- | --- | --- |
| Q-001 | ¿El encargo inicial es la única fuente autorizada por ahora y quién actuará como propietario funcional? | Se necesita autoridad para resolver contradicciones y validar requisitos. | Sponsor de producto | ABIERTA |
| Q-002 | ¿“Preparación multiinstitución” significa onboarding/operación posterior, manteniendo aislamiento multiempresa desde el primer incremento técnico? | Evita interpretar la multitenancy como mejora tardía. | Sponsor + arquitectura | PROPUESTA |
| Q-003 | ¿Se aprueba separar etapa, estado interno, actividad, evento y resultado en vez de implementar literalmente la lista inicial? | Determina todo el diseño del flujo. | Producto + admisión | PROPUESTA |
| Q-004 | ¿Se aprueba distinguir decisión favorable, reserva, oferta, aceptación familiar, handoff y matrícula confirmada? | Afecta cupos, UX e integración. | Producto + colegio + EduPay | PROPUESTA |
| Q-005 | ¿Quiénes revisarán y aprobarán la fundación documental por parte del colegio, EduPay, seguridad/privacidad y producto? | La compuerta requiere revisores identificados. | Sponsor | ABIERTA |

## Propuestas que requieren aprobación

| ID | Decisión propuesta | Recomendación | Alternativas y riesgo | Estado |
| --- | --- | --- | --- | --- |
| D-001 | Semántica común del flujo | Pocas etapas/estados canónicos; actividades y resultados con ciclo propio | Enumeración única: más simple al inicio, rígida y ambigua después | PROPUESTA |
| D-002 | Reutilización de datos familiares | Perfil familiar global + instantánea por postulación/tenant | Compartir el perfil vivo: menos duplicación, mayor fuga y cambio retroactivo | PROPUESTA |
| D-003 | Configuración | Versiones publicadas inmutables y límites canónicos | Configuración editable en vivo: rápida, pero rompe trazabilidad | PROPUESTA |
| D-004 | Autorización | RBAC + scopes + condiciones de sensibilidad/propósito | Sólo roles: insuficiente para datos restringidos y asignaciones | PROPUESTA |
| D-005 | Acceso de plataforma | Sin lectura implícita; elevación temporal auditada | Superadmin universal: operativo, pero excesivo y riesgoso | PROPUESTA |
| D-006 | Archivos | Privados, cuarentena y escaneo antes de revisión | Escaneo posterior/opcional: menor latencia, riesgo no aceptable | PROPUESTA |
| D-007 | Integración EduPay | Handoff por contrato idempotente, sin tablas compartidas | API directa síncrona o BD compartida: mayor acoplamiento | PROPUESTA |
| D-008 | Primera promoción de lista de espera | Confirmación humana con política versionada | Automatización total: eficiente, pero riesgosa antes de validar excepciones | PROPUESTA |
| D-009 | Accesibilidad | Adoptar WCAG 2.2 AA como objetivo | Objetivo no definido: riesgo de retrabajo y exclusión | PROPUESTA |
| D-010 | Decisiones arquitectónicas | ADR antes de adoptar opciones relevantes o difíciles de revertir | Decisiones sólo en PR/chat: baja trazabilidad | PROPUESTA |

## Supuestos de trabajo

| ID | Supuesto | Evidencia | Riesgo si es falso | Validar antes de |
| --- | --- | --- | --- | --- |
| A-001 | Colegio Conquistadores es piloto, no tenant especial en código/modelo. | Encargo inicial | Acoplamiento o reglas ocultas | G1 |
| A-002 | Una oferta se identifica por institución, sede, año y curso/nivel. | Encargo inicial | Modelo de oferta incompleto | G1 |
| A-003 | No todas las etapas de entrevista/evaluación aplican a todos los niveles. | “dependiendo del nivel” | Flujo rígido | G1 |
| A-004 | Una familia puede tener varios estudiantes y varias postulaciones. | Encargo inicial | Identidad/UX incorrecta | G1 |
| A-005 | Los datos enviados forman evidencia histórica y no cambian automáticamente al editar perfil. | Necesidad de auditoría | Decisiones no reproducibles | G2 |
| A-006 | La institución puede definir disponibilidad visible sin que necesariamente sea un número exacto. | Redacción “definida por la institución” | Exposición o expectativas erróneas | G1 |
| A-007 | Elegibilidad, cupo y matrícula son decisiones/hechos distintos. | Proceso e integración descritos | Sobreasignación y estados ambiguos | G1 |
| A-008 | Entrevistas y evaluaciones pueden reprogramarse más de una vez. | Caso solicitado | Historial insuficiente | G1 |
| A-009 | EduPay es un sistema/dominio separado con equipo o contrato propio. | Encargo inicial | Borde de integración errado | G2 |
| A-010 | La institución operará en una zona horaria configurable; UTC se usará conceptualmente para instantes. | Naturaleza SaaS | Errores de agenda/expiración | G2 |
| A-011 | Los ejemplos sintéticos son suficientes durante documentación y pruebas tempranas. | Prohibición de PII real | Falta de casos realistas | Siempre |
| A-012 | El repositorio remoto vacío requirió crear `main` con un commit inicial vacío para permitir el PR documental. | Inspección Git/GitHub del 6-08-2026 | Ninguno funcional | Entrega G0 |

## Contradicciones y tensiones registradas

| ID | Tema | Lecturas en tensión | Resolución propuesta | Estado |
| --- | --- | --- | --- | --- |
| C-001 | Lista de estados | Estados, etapas, hitos y resultados mezclados | Separar dimensiones | ABIERTA |
| C-002 | `ACCEPTED` | Decisión institucional vs respuesta familiar | `AdmissionDecisionApproved`, `OFFERED`, `OFFER_ACCEPTED` | ABIERTA |
| C-003 | Multiinstitución | Obligatoria desde inicio vs etapa tardía del roadmap | Etapa tardía = hardening/onboarding, no retrofit | ABIERTA |
| C-004 | Configuración | Libertad institucional vs estructura auditable común | Núcleo canónico + versiones y extensiones acotadas | ABIERTA |
| C-005 | Disponibilidad | Mostrar disponibilidad vs proteger capacidad operativa | Configurar señal visible | ABIERTA |
| C-006 | Pago | Admisión “emite cuando debe generarse” vs propiedad financiera de EduPay | EduPay deriva; comando sólo si contrato lo requiere | ABIERTA |
| C-007 | Datos | Historial inmutable vs eliminación | Minimizar/seudonimizar auditoría y aplicar matriz de retención | ABIERTA |
| C-008 | Familia | Datos reutilizables vs aislamiento por institución | Perfil global controlado + instantánea por tenant | ABIERTA |

## Preguntas funcionales para G1

### Oferta, formulario y familia

- Q-101: ¿Puede una familia postular al mismo estudiante a más de una sede, curso o institución simultáneamente?
- Q-102: ¿Qué identifica una postulación duplicada y qué excepciones existen?
- Q-103: ¿Qué disponibilidad se muestra: exacta, categórica o sólo convocatoria abierta?
- Q-104: ¿Qué campos son obligatorios por nivel y en qué momento?
- Q-105: ¿Qué adulto puede crear, editar, enviar, aceptar o desistir? ¿Puede haber coadministración?
- Q-106: ¿Cómo se verifican RUT, fecha de nacimiento y relación con el estudiante?
- Q-107: ¿Se admiten postulaciones asistidas por personal y cómo se acredita consentimiento?
- Q-108: ¿Qué idiomas y necesidades de accesibilidad existen?

### Documentos

- Q-120: ¿Catálogo de documentos, formatos, tamaños, vigencias y condiciones por curso?
- Q-121: ¿Quién revisa cada tipo y quién puede eximirlo?
- Q-122: ¿Cuántas correcciones se permiten y qué plazos aplican?
- Q-123: ¿Cómo se tratan documentos protegidos con contraseña, múltiples páginas o firmas?
- Q-124: ¿La familia puede eliminar un archivo antes/después del envío?

### Entrevistas y evaluaciones

- Q-140: ¿Qué actividad aplica por nivel y puede repetirse?
- Q-141: ¿Quién propone horarios y quién confirma?
- Q-142: ¿Reglas de reprogramación, cancelación, inasistencia y tolerancia?
- Q-143: ¿Presencial, remota o híbrida? ¿Se requiere ubicación o enlace?
- Q-144: ¿Qué pauta, resultado y nivel de confidencialidad usa cada actividad?
- Q-145: ¿Una conclusión puede ser corregida y por quién?

### Decisión, cupos y espera

- Q-160: ¿Qué criterios y evidencia sustentan decisión y quién aprueba?
- Q-161: ¿Se necesita separación recomendador/aprobador o doble aprobación?
- Q-162: ¿Qué significa cupo: capacidad total, cupo de admisión o vacante disponible?
- Q-163: ¿Cuándo se reserva y cuánto dura la reserva/oferta?
- Q-164: ¿Cómo se ordena la lista de espera y existen prioridades/desempates?
- Q-165: ¿La familia ve posición exacta? ¿Cómo cambia?
- Q-166: ¿Qué ocurre si una familia acepta varias ofertas?
- Q-167: ¿Quién y bajo qué condiciones puede reabrir un rechazo, desistimiento o expiración?

### Comunicaciones y reportes

- Q-180: ¿Canales requeridos (correo, SMS, mensajería, portal) y cuál es vinculante?
- Q-181: ¿Plantillas, remitentes, horarios y escalamiento por fallo?
- Q-182: ¿Qué historial se muestra a la familia?
- Q-183: ¿Qué reportes/exportaciones son necesarios, periodicidad y audiencia?
- Q-184: ¿Qué SLA operativos espera el colegio por etapa?

## Preguntas de seguridad, legalidad y operación para G2/G4

- Q-201: Jurisdicción, bases de tratamiento y textos de consentimiento aplicables.
- Q-202: Matriz de retención por dato y resultado de postulación.
- Q-203: Residencia de datos y proveedores permitidos.
- Q-204: MFA por rol y acciones que requieren autenticación reforzada.
- Q-205: Procedimiento de soporte con datos, incidentes y notificación.
- Q-206: RPO, RTO, disponibilidad y ventanas de mantenimiento.
- Q-207: Volúmenes actuales/proyectados y picos de convocatoria.
- Q-208: Requisitos de auditoría, exportación legal y solicitudes de titulares.
- Q-209: Política de dispositivos y redes para personal institucional.
- Q-210: Amenazas y pruebas externas requeridas antes del piloto.

## Preguntas para el contrato EduPay

- Q-301: ¿Cuál es el sistema maestro de institución, sede, año, curso, persona y estudiante?
- Q-302: ¿Qué evento exacto inicia matrícula?
- Q-303: ¿EduPay deriva la obligación o Admisión la solicita explícitamente?
- Q-304: ¿Definición de matrícula iniciada, pendiente, confirmada, cancelada y revertida?
- Q-305: ¿Datos mínimos y fundamento para transferirlos?
- Q-306: ¿Interfaz disponible, autenticación, versionado y límites?
- Q-307: ¿SLA, reintentos, reconciliación y responsable de soporte?
- Q-308: ¿Qué ocurre si la oferta expira o la familia desiste durante el handoff?

## Mantenimiento

Al resolver una pregunta se debe registrar: respuesta, responsable, fecha, evidencia y artefactos afectados. Una respuesta arquitectónicamente relevante debe convertirse en ADR; no basta con borrar la pregunta.
