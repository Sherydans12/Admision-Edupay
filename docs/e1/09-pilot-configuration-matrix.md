# E1-B — Matriz de configuración del piloto

## Uso

Esta matriz separa el valor inicial confirmado para Colegio Conquistadores 2027 de los parámetros que deben continuar configurables en el núcleo. `DEFINED_FOR_PILOT` indica detalle operativo definido para el piloto; no autoriza implementación ni cierra G1. El estado de E1-B es `IN PROGRESS / READY FOR CLOSURE REVIEW`, pendiente de revisión humana.

“Quién puede modificarlo” describe capacidad funcional y no una asignación técnica de permisos. Todo cambio debe respetar tenant, alcance, propósito, versionado y auditoría.

| Parámetro | Nivel de configuración | Valor del piloto | Configurable | Quién puede modificarlo | Auditoría requerida | Visibilidad familiar | Pendiente futuro |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cupos de admisión | Curso/año académico | Número definido manualmente por el colegio; valor concreto no registrado aquí | Sí | Responsable de Admisión; Administrador Institucional Máximo; Dirección sólo si recibe capacidad configurada | Actor, fecha/hora, anterior, nuevo, motivo/comentario | Sólo señal/estado aprobado; no cupo interno por defecto | Valores concretos y texto de disponibilidad |
| Plazo de aceptación | Institución/proceso/oferta | `3 días hábiles` | Sí | Rol configurador institucional autorizado | Publicación/versionado y cambios | Estado, vencimiento exacto, acción aceptar y tiempo restante | Calendario institucional de días hábiles |
| Plazo de corrección documental | Institución/proceso/requisito | `3 días hábiles` | Sí | Rol configurador institucional autorizado | Solicitud, límite, cambios y vencimiento | Requisito afectado, instrucciones, límite exacto | Calendario y escalamiento |
| Reprogramaciones normales | Institución/proceso/actividad | `2` | Sí | Rol configurador institucional autorizado; excepción por personal autorizado | Solicitud, motivo, cita anterior/nueva, actor | Estado de solicitud y nueva cita | Reglas de reprogramación adicional |
| Tolerancia de atraso | Institución/proceso/actividad | `15 minutos` | Sí | Rol configurador institucional autorizado | Configuración y aplicación | Instrucción operativa cuando corresponda | Política detallada por actividad |
| Modalidad de entrevista | Oferta/actividad | Presencial en el colegio | Sí | Rol configurador institucional autorizado | Publicación y cambios | Fecha, hora, lugar | Modalidad remota futura |
| Modalidad de evaluación | Oferta/actividad | Presencial en el colegio | Sí | Rol configurador institucional autorizado | Publicación y cambios | Fecha, hora, lugar | Modalidad remota futura |
| Duración de actividad | Tipo de actividad | Configurable; minutos concretos no definidos | Sí | Rol configurador institucional autorizado | Versionado de configuración | No necesariamente; sólo si afecta instrucciones | Valor concreto del piloto |
| Disposición de Dirección | Postulación/proceso | `APROBADO`, `LISTA_DE_ESPERA`, `RECHAZADO` o `DEVUELTO_A_REVISION` | Sí | Capacidad Dirección | Actor, tenant, fecha/hora, disposición, fundamento/motivo y versión de antecedentes | `APROBADO`: oferta y aceptación; `LISTA_DE_ESPERA`: estado general sin oferta ni plazo; rechazo/devolución según comunicación autorizada | Criterios y textos finales |
| Obligatoriedad de entrevista | Tenant/proceso/oferta/curso/tipo | Obligatoria para todos los cursos 1º básico–4º medio | Sí | Rol configurador institucional autorizado | Regla versionada y excepciones auditadas | Próximo paso/actividad aplicable | Catálogo y excepciones operativas |
| Obligatoriedad de evaluación | Tenant/proceso/oferta/curso/tipo | Obligatoria para todos los cursos 1º básico–4º medio | Sí | Rol configurador institucional autorizado | Regla versionada y excepciones auditadas | Próximo paso/actividad aplicable | Catálogo y excepciones operativas |
| Ejecutor de entrevista | Institución/oferta/actividad | Configurable; cargo concreto pendiente | Sí | Rol configurador institucional autorizado | Asignación y cambios | No necesariamente; sólo datos de cita | Persona y suplencia |
| Ejecutor de evaluación | Institución/oferta/actividad | Configurable; cargo concreto pendiente | Sí | Rol configurador institucional autorizado | Asignación, intentos y cambios | No necesariamente; sólo datos de cita | Persona y suplencia |
| Requisitos documentales | Tenant/proceso/curso/oferta/condición | Catálogo versionado; detalle de personalidad por curso pendiente | Sí | Responsable de Admisión y Administrador Institucional Máximo | Publicación, revisión y exención | Requisitos aplicables, estado y acciones | Catálogo concreto, formatos y vigencias |
| Prioridades de espera | Institución/proceso/oferta | Sin prioridad adicional registrada; orden de ingreso por defecto | Sí | Autoridad institucional configurada | Regla, versión, desempate y cambios | No posición ni reglas internas | Prioridades concretas y desempate |
| Promoción de espera | Oferta/lista de espera | Nunca automática; acción de Responsable de Admisión o Administrador Máximo; sin nueva decisión de Dirección si la admisibilidad ya fue decidida | Sí | Responsable de Admisión; Administrador Institucional Máximo | Selección, motivo, actor, reserva y oferta | Oferta y origen lista de espera | Criterios operativos de promoción |
| Recordatorio de oferta | Oferta/proceso | Automático antes del vencimiento; anticipación no definida | Sí | Rol configurador institucional autorizado | Plantilla, programación y envío | Mensaje mínimo y vencimiento | Cantidad/anticipación exacta |
| SLA operativos | Institución/proceso/etapa | Configurables; no se fijan valores adicionales | Sí | Rol configurador institucional autorizado | Configuración, atraso, alerta/tarea | Sólo acción/plazo comunicable | Valores por revisión, cita y decisión |
| Plantillas de correo | Tenant/proceso/propósito | Postulación, corrección, cita, resultado y oferta; textos finales pendientes | Sí | Rol configurador institucional autorizado; Responsable de Admisión confirma resultado | Versión, preparación, envío, entrega/fallo | Mensaje aplicable | Texto, remitente y horarios |
| Roles de revisión documental | Requisito/tenant/alcance | Validación definitiva: Responsable de Admisión o revisor autorizado; Secretaría sólo recepción/carga | Sí | Administrador Máximo/Responsable de Admisión según matriz | Asignación, acceso y dictamen | Estado y corrección accionable | Personas y suplencias |
| Capacidad de exportación | Tenant/rol/propósito | Responsable de Admisión y Administrador Máximo; Secretaría sin masiva por defecto | Sí | Según matriz de permisos y propósito | Solicitud, columnas, tenant, descarga y expiración | No aplica | Catálogo final y restricciones legales |

## Reglas de lectura

- Las filas de cupos, plazos, actividades y documentos son configuración funcional, no diseño de tablas o API.
- Los parámetros de C-013 no agregan ingreso familiar al formulario MVP.
- El acceso a resultados internos, comentarios, PIE/NEE y salud sigue sujeto a propósito, rol, tenant y auditoría.
- Q-301 a Q-309, ADR-0001, arquitectura, API, base de datos y dependencias no se resuelven en esta matriz.
