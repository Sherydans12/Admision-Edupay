# Borrador de roles y permisos

## Estado

Propuesta para revisión. No es una matriz cerrada ni autoriza implementación. Los permisos efectivos combinarán rol, tenant, alcance, asignación, sensibilidad, propósito y estado del recurso.

## Roles conceptuales

### Superadministrador de plataforma

Administra operación global, tenants y soporte técnico. No obtiene por defecto acceso al contenido de postulaciones. Cualquier acceso excepcional a datos institucionales debe ser temporal, justificado y auditado.

### Administrador institucional

Administra configuración, membresías y operación dentro de una institución. No necesariamente puede leer datos de salud, finanzas o deliberación detallada; esos privilegios deben separarse.

### Encargado de admisión

Coordina casos, documentos, agenda, comunicaciones, capacidad y recomendaciones según alcance. En el piloto revisa y emite la recomendación, pero no decide ni publica automáticamente el resultado.

### Entrevistador o evaluador

Accede sólo a actividades o casos asignados y a la mínima información necesaria. El entrevistador de apoderados y el evaluador del estudiante podrían separarse en roles futuros.

### Dirección o aprobador final

Revisa antecedentes permitidos y puede aprobar, rechazar o devolver a revisión con justificación. No debería administrar sus propios permisos ni alterar evidencia o recomendaciones previas.

### Apoderado postulante

Gestiona estudiantes y postulaciones bajo una relación autorizada. Ve una proyección familiar y nunca notas internas, puntajes o datos de terceros.

## Capacidades conceptuales

Leyenda: `P` permitido por rol sujeto a alcance; `C` condicionado/reforzado; `—` no permitido por defecto; `PROPIO` sólo recursos familiares autorizados.

| Capacidad | Plataforma | Admin. institucional | Admisión | Entrev./eval. | Aprobador | Apoderado |
| --- | --- | --- | --- | --- | --- | --- |
| Crear/suspender tenant | P | — | — | — | — | — |
| Ver metadatos operativos del tenant | P | P | C | — | C | — |
| Acceder a contenido institucional | C excepcional | C | P | C asignado | C | PROPIO |
| Administrar sedes/años/ofertas | — | P | C | — | — | — |
| Publicar requisitos/flujo | — | P/C | C | — | C revisión | — |
| Editar borradores de formulario | — | P/C | C | — | — | — |
| Publicar/archivar versiones de formulario | — | C reforzado | C si delegado | — | C revisión | — |
| Administrar membresías y roles | — | P dentro de delegación | — | — | — | — |
| Administrar cupos | — | P/C | C | — | C consulta | — |
| Crear/editar borrador | — | — | C soporte auditado | — | — | PROPIO |
| Enviar o desistir postulación | — | — | C excepcional | — | — | PROPIO |
| Ver datos identificatorios | C excepcional | C | P | C mínimo | C | PROPIO |
| Ver salud/PIE/NEE | C excepcional | C específico | C específico | C asignado | C según propósito | PROPIO |
| Ver ingreso/finanzas | C excepcional | C específico | C específico | — | C si aplica | PROPIO |
| Revisar documentos | C excepcional | C | P | C asignado | C consulta | PROPIO limitado |
| Solicitar corrección | — | C | P | C recomendación | — | — |
| Gestionar citas | — | C | P | C asignado | — | Confirmar/solicitar cambio |
| Registrar pauta/resultado | — | — | C | P asignado | C consulta | — |
| Crear notas internas | — | C | P | C asignado | P | — |
| Ver todas las notas internas | C excepcional | C | C | C propias/asignadas | C | — |
| Recomendar decisión | — | C | P | C | C | — |
| Devolver recomendación a revisión | — | — | — | — | P | — |
| Aprobar/rechazar decisión final | — | — | — | — | P | — |
| Publicar/comunicar resultado | — | C | P tras decisión | — | C | — |
| Emitir oferta/gestionar espera | — | C | P/C | — | C | Responder propia |
| Enviar comunicaciones | — | C | P | C acotado | C | — |
| Ver auditoría | C plataforma | P/C | C acotado | — | C | Historial familiar |
| Exportar datos | C excepcional | C | C | — | C | Exportar propios por definir |
| Reintentar integración EduPay | C soporte | C | C | — | — | — |

## Permisos granulares tentativos

- `tenant.settings.read`, `tenant.settings.manage`, `tenant.settings.publish`
- `form.draft.read`, `form.draft.manage`, `form.version.publish`, `form.version.archive`
- `membership.read`, `membership.grant`, `membership.revoke`
- `offering.read`, `offering.manage`, `capacity.read`, `capacity.adjust`
- `application.read`, `application.assign`, `application.transition`
- `application.identity.read`, `application.health.read`, `application.financial.read`
- `document.metadata.read`, `document.content.read`, `document.review`
- `interview.schedule`, `interview.conduct`, `assessment.schedule`, `assessment.conduct`
- `internal_note.create`, `internal_note.restricted.read`
- `decision.recommend`, `decision.return`, `decision.approve`, `decision.reject`, `result.communicate`, `offer.issue`, `waitlist.manage`
- `communication.compose`, `communication.approve`, `communication.send`
- `audit.read`, `export.create`, `support.elevate`
- `integration.read`, `integration.retry`, `integration.reconcile`

Los nombres son lenguaje de análisis, no API aprobada.

## Alcances tentativos

- Tenant completo.
- Una o varias sedes.
- Uno o varios años académicos.
- Uno o varios cursos/ofertas.
- Casos asignados.
- Actividad específica.
- Ventana temporal.
- Sección de datos (identidad, salud/NEE, finanzas, documentos, deliberación).

Una persona puede tener más de una membresía, incluso en distintos tenants, pero cada solicitud opera en un solo contexto institucional explícito resuelto en servidor.

## Separación de funciones por validar

- Quien configura criterios no necesariamente aprueba decisiones.
- En el piloto, Admisión recomienda y Dirección decide; Admisión no aprueba su propia recomendación.
- Editar un borrador no concede automáticamente permiso de publicación.
- Ajustar cupos y emitir ofertas podrían requerir doble control.
- Administrar roles no debe habilitar autoelevación fuera del límite delegado.
- Exportar datos restringidos puede requerir aprobación o justificación adicional.
- Acceso excepcional de plataforma requiere control independiente.

## Ciclo de acceso

1. Solicitud o invitación con alcance definido.
2. Aprobación por autoridad válida.
3. Activación y, si corresponde, MFA.
4. Uso auditado y revisiones periódicas.
5. Ajuste o revocación inmediata por cambio de función.
6. Expiración automática de accesos temporales.

## Preguntas para cerrar la matriz

- ¿Quién administra roles en el colegio y quién lo reemplaza?
- ¿Entrevistador y evaluador son personas/roles diferentes?
- ¿Qué roles pueden leer salud, NEE e ingreso familiar, y para qué decisión?
- ¿Se exige doble aprobación para rechazo, oferta, ajuste de cupos o exportación?
- ¿Dirección puede editar datos o sólo revisar y decidir?
- ¿Personal de admisión puede corregir información familiar o sólo pedir corrección?
- ¿Qué soporte de plataforma se permite y quién lo aprueba?
- ¿Se necesita acceso temporal para terceros o profesionales externos?
- ¿Qué reportes requieren datos identificables?

## Recomendación

Validar tareas reales mediante talleres y construir una matriz permiso × alcance × sensibilidad. Evitar roles demasiado amplios y permisos basados únicamente en pantallas.

## Responsabilidades conocidas del piloto

| Actividad | Responsable confirmado | Pendiente |
| --- | --- | --- |
| Revisión de antecedentes | Admisión | Personas y reemplazos |
| Recomendación | Admisión | Pauta, estados y visibilidad detallada |
| Decisión final | Dirección | Representante formal y delegación |
| Horarios de entrevista/evaluación | Colegio | Rol operativo concreto y reprogramación |
| Comunicación inicial | Colegio mediante correo | Remitente, plantillas, proveedor y fallos |
| Integración EduPay | Nicolás Sena | Contrato y soporte operativo |
| Seguridad y privacidad técnica en diseño | Nicolás Sena | Revisión independiente futura |
| Legal/normativo | Pendiente | Debe definirse antes del piloto |
