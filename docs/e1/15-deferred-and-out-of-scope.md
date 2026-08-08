# Diferidos y fuera de alcance de E1/G1

## Propósito

Esta clasificación evita convertir configuración, validación legal o diseño técnico posterior en bloqueos artificiales de G1. Ningún elemento listado se considera resuelto por esta entrega.

## A. `PILOT_CONFIGURATION_PENDING`

Valores que completan la operación del piloto sin cambiar el comportamiento funcional aprobado:

- nombres de suplentes y delegaciones concretas;
- persona concreta que realiza entrevista y persona concreta que realiza evaluación;
- duración exacta por actividad;
- valores numéricos de cupos por curso/año;
- catálogo concreto de informe de personalidad por curso, condición, equivalentes y vigencia;
- prioridades especiales de Conquistadores y desempates, si la institución decide configurarlos;
- texto institucional final de disponibilidad y de lista de espera;
- textos finales, remitentes, horarios y nombres de plantillas de email;
- anticipación exacta del recordatorio de oferta;
- SLA numéricos de revisión, citas, decisión y respuesta;
- calendario institucional aplicable a días hábiles;
- pauta concreta de entrevista dentro del builder controlado.

Estos valores deben completarse antes de su uso operativo cuando apliquen. No bloquean G1 porque la regla, el rango de configuración y sus efectos ya están definidos.

## B. `PRE_PILOT_LEGAL_PENDING`

Obligatorio antes de datos reales y piloto productivo, pero no para aprobar comportamiento funcional en G1:

- C-013 `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`;
- responsable legal/normativo formal;
- fundamento y textos aplicables a tratamiento de datos;
- matriz de retención, bloqueo, eliminación y anonimización;
- procedimiento para solicitudes de titulares;
- validación legal final de acceso, exportación y categorías sensibles;
- conservación o devolución de documentación física;
- consentimientos y avisos definitivos cuando corresponda.

E1-C no emite conclusiones legales ni autoriza datos reales.

## C. `FUTURE_INTEGRATION_PENDING`

Q-301 a Q-309 permanecen abiertas para E7/G7 y no bloquean G1:

| ID | Pendiente futuro |
| --- | --- |
| Q-301 | Sistema maestro e identificadores externos de institución, año, curso, persona y estudiante |
| Q-302 | Evento o condición contractual que inicia el procesamiento técnico del handoff |
| Q-303 | Comando, evento u otro mecanismo de operación con EduPay |
| Q-304 | Estados contractuales de matrícula iniciada, pendiente, confirmada, cancelada y revertida |
| Q-305 | Payload mínimo y fundamento de transferencia |
| Q-306 | Interfaz, autenticación, versionado y límites |
| Q-307 | SLA, reintentos, reconciliación y soporte |
| Q-308 | Tratamiento de oferta expirada o desistimiento con handoff ya iniciado |
| Q-309 | Estado de EduPay previo al pago y evento contractual de matrícula realizada |

Q-310 no pertenece a esta lista: está `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED`. La aceptación familiar expresa de una oferta vigente precede al handoff.

## D. `OPEN_SECURITY_AND_OPERATION_QUESTIONS`

Q-201 a Q-210 se conservan abiertas para sus compuertas técnicas, legales u operativas:

| ID | Pregunta abierta |
| --- | --- |
| Q-201 | Jurisdicción, bases de tratamiento y textos de consentimiento |
| Q-202 | Matriz de retención por dato y resultado, especialmente C-013 |
| Q-203 | Residencia de datos y proveedores permitidos |
| Q-204 | MFA por rol y acciones reforzadas |
| Q-205 | Soporte con datos, incidentes y notificación |
| Q-206 | RPO, RTO, disponibilidad y mantenimiento |
| Q-207 | Volúmenes y picos de convocatoria |
| Q-208 | Auditoría, exportación legal y solicitudes de titulares |
| Q-209 | Dispositivos y redes del personal |
| Q-210 | Amenazas y pruebas externas antes del piloto |

Los controles funcionales ya aprobados —denegación por defecto, aislamiento tenant, mínimo privilegio, auditoría y elevación explícita— sí forman parte de G1. Sus mecanismos técnicos y parámetros operativos quedan diferidos.

## E. Evolución de producto

Capacidades previstas o expresamente diferidas que no bloquean el piloto inicial:

- WhatsApp como canal automático adicional;
- modalidad remota avanzada e integración de videollamada;
- cuentas familiares colaborativas para varios adultos;
- pauta diagnóstica avanzada;
- internacionalización completa si no se requiere para el MVP;
- automatizaciones o canales adicionales que sólo podrán aprobarse en una etapa posterior.

Esta lista no aprueba nuevas funcionalidades; conserva diferidos ya registrados.

## F. Explícitamente fuera de E1/G1

- arquitectura lógica o física;
- schemas, tablas, modelos persistentes o migraciones;
- endpoints, DTO, API o contratos ejecutables;
- Prisma o cualquier tecnología específica;
- deployment, infraestructura, hosting o topología;
- elección final de stack y aprobación de ADR-0001;
- colas, webhooks, eventos técnicos, outbox/inbox o reintentos concretos;
- autenticación sistema-sistema y contrato técnico EduPay;
- implementación, scaffolding, dependencias y pruebas técnicas;
- datos personales reales, documentos reales o carga productiva.

## Efecto sobre compuertas

Los diferidos correctamente clasificados permiten `PASS_WITH_DEFERRED` en el checklist de G1 cuando el comportamiento funcional ya es verificable. No autorizan E2/G2, implementación, integración ejecutable ni datos reales.
