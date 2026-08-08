# Escenarios funcionales end-to-end

## Uso

Los escenarios usan actores y datos sintéticos. Describen resultados de negocio y auditoría, no protocolo, API, interfaz ni integración ejecutable.

### E2E-001 — Postulación aprobada, aceptada y entregada al borde EduPay

- **Precondiciones:** oferta publicada; formulario/requisitos vigentes; cupo disponible; actividades completadas.
- **Actores:** familia, Admisión, entrevistador, evaluador, Dirección, EduPay externo.
- **Flujo principal:** familia envía; documentos se validan; actividades concluyen; Admisión recomienda; Dirección aprueba; se reserva cupo y emite oferta; Admisión confirma comunicación; familia acepta; se habilita handoff.
- **Resultado:** aceptación expresa registrada y solicitud funcional de handoff; matrícula aún no presumida.
- **Auditoría requerida:** versiones, revisiones, actividades, recomendación, disposición, reserva, comunicación, aceptación y handoff.
- **Proyección familiar:** avance, citas, resultado comunicado, oferta/vencimiento, aceptación y próximo paso; nunca deliberaciones.
- **AC relacionados:** AC-007, AC-010, AC-017, AC-022, AC-025, AC-036, AC-038, AC-055 a AC-057.

### E2E-002 — Corrección documental

- **Precondiciones:** requisito cargado y revisable.
- **Actores:** familia, revisor autorizado, sistema de correo.
- **Flujo principal:** revisor observa requisito; portal y correo informan motivo accionable y plazo de 3 días hábiles; familia carga corrección; revisor acepta.
- **Resultado:** requisito `ACEPTADO` con trazabilidad de observación y respuesta.
- **Auditoría requerida:** versión observada, motivo, límite, comunicación, nueva carga y dictamen.
- **Proyección familiar:** requisito afectado, instrucciones, plazo y estado; sin notas internas.
- **AC relacionados:** AC-010, AC-012, AC-013, AC-041.

### E2E-003 — Documento reemplazado sin pérdida de historia

- **Precondiciones:** existe documento cargado o observado.
- **Actores:** familia, revisor autorizado.
- **Flujo principal:** familia aporta una nueva versión; el sistema relaciona versiones; el revisor evalúa la nueva.
- **Resultado:** versión previa `REEMPLAZADO`; versión nueva conserva su propio estado.
- **Auditoría requerida:** actor, fechas, relación entre versiones y decisiones de revisión.
- **Proyección familiar:** versión actual y estado accionable; historial seguro cuando corresponda.
- **AC relacionados:** AC-007, AC-013, AC-024.

### E2E-004 — Postulación asistida con documento físico

- **Precondiciones:** apoderado presente y personal autorizado disponible.
- **Actores:** apoderado, Secretaría o Admisión.
- **Flujo principal:** operador completa en portal con respuestas del adulto; digitaliza documento físico; registra origen; adulto autoriza envío.
- **Resultado:** una única postulación oficial y documento digital en el requisito correcto.
- **Auditoría requerida:** tenant, operador, rol, adulto presente, autorización, acciones, origen `PHYSICAL_DOCUMENT` y fecha.
- **Proyección familiar:** borrador/postulación y documento cargado como cualquier expediente oficial.
- **AC relacionados:** AC-014 a AC-016.

### E2E-005 — Cita y solicitud de reprogramación

- **Precondiciones:** actividad obligatoria y cita programada.
- **Actores:** familia, Secretaría o Admisión.
- **Flujo principal:** familia recibe cita; solicita cambio con motivo; personal asigna nuevo horario y comunica.
- **Resultado:** cita reprogramada sin elección directa de horario por la familia.
- **Auditoría requerida:** cita anterior/nueva, solicitud, motivo, operador y comunicación.
- **Proyección familiar:** fecha, hora, lugar, estado y nueva cita.
- **AC relacionados:** AC-017, AC-018, AC-043.

### E2E-006 — Primera inasistencia

- **Precondiciones:** cita vigente y primera inasistencia.
- **Actores:** entrevistador/evaluador, Admisión, familia.
- **Flujo principal:** actor registra `INASISTENCIA`; Admisión revisa y reprograma o define próximo paso.
- **Resultado:** caso continúa; no existe cierre ni rechazo automático.
- **Auditoría requerida:** actividad, intento, actor, instante y acción posterior.
- **Proyección familiar:** estado operativo y próximo paso, sin resultado interno.
- **AC relacionados:** AC-019, AC-021.

### E2E-007 — Segunda inasistencia y cierre manual

- **Precondiciones:** existe primera inasistencia y una segunda injustificada registrada.
- **Actores:** evaluador/entrevistador, Responsable de Admisión o Dirección.
- **Flujo principal:** se registra segunda inasistencia; actor autorizado revisa antecedentes; decide cierre manual con motivo.
- **Resultado:** caso cerrado por acción humana explícita, nunca sólo por contador.
- **Auditoría requerida:** ambas inasistencias, revisión, actor de cierre, motivo e instante.
- **Proyección familiar:** estado/cierre comunicado de forma autorizada; sin deliberación.
- **AC relacionados:** AC-019, AC-020, AC-040.

### E2E-008 — Evaluación inconclusa y repetición

- **Precondiciones:** primer intento no puede completarse.
- **Actores:** evaluador, Admisión, familia.
- **Flujo principal:** evaluador registra `NO_COMPLETADA` e `INCONCLUSO`; evaluador o Admisión inicia repetición; nuevo intento se programa y concluye.
- **Resultado:** ambos intentos permanecen relacionados; el último no sobrescribe al anterior.
- **Auditoría requerida:** secuencia, responsables, motivos, estados, resultados y relación.
- **Proyección familiar:** reprogramación y estado operacional; no resultado/comentario.
- **AC relacionados:** AC-017, AC-018, AC-021.

### E2E-009 — Dirección devuelve a revisión

- **Precondiciones:** recomendación enviada a Dirección.
- **Actores:** Dirección, Responsable de Admisión.
- **Flujo principal:** Dirección registra `DEVUELTO_A_REVISION` con motivo; Admisión corrige/completa; envía una nueva versión.
- **Resultado:** no existe decisión definitiva ni comunicación de resultado prematura.
- **Auditoría requerida:** devolución, motivo, versiones de antecedentes y nueva recomendación.
- **Proyección familiar:** sólo próximos pasos que deban solicitarse; no devolución ni deliberación interna.
- **AC relacionados:** AC-024, AC-027, AC-040.

### E2E-010 — Dirección rechaza

- **Precondiciones:** recomendación disponible y decisor separado.
- **Actores:** Dirección, Admisión, familia.
- **Flujo principal:** Dirección registra `RECHAZADO` con fundamento; se prepara mensaje; Admisión confirma; se envía.
- **Resultado:** decisión negativa versionada y comunicada sin oferta ni handoff.
- **Auditoría requerida:** recomendación, separación, fundamento, disposición y comunicación.
- **Proyección familiar:** resultado comunicado y próximos pasos permitidos; no fundamento interno completo si no corresponde.
- **AC relacionados:** AC-027, AC-028, AC-040, AC-041.

### E2E-011 — Ingreso a lista de espera

- **Precondiciones:** Dirección considera admisible al postulante sin oferta inmediata.
- **Actores:** Dirección, Admisión, familia.
- **Flujo principal:** Dirección registra `LISTA_DE_ESPERA`; el caso ingresa al orden interno.
- **Resultado:** no hay reserva, oferta, plazo, aceptación ni handoff.
- **Auditoría requerida:** disposición, fundamento, instante y posición/orden interno.
- **Proyección familiar:** estado general de espera, sin número ni prioridades.
- **AC relacionados:** AC-026, AC-032.

### E2E-012 — Promoción manual desde espera y aceptación

- **Precondiciones:** postulante admisible en espera y cupo liberado.
- **Actores:** Responsable de Admisión o Administrador Máximo, familia.
- **Flujo principal:** actor promueve manualmente; se crea reserva/oferta; se comunica; familia acepta dentro de 3 días hábiles.
- **Resultado:** aceptación habilita handoff sin nueva decisión de Dirección.
- **Auditoría requerida:** selección, actor, origen espera, reserva, oferta, comunicación y aceptación.
- **Proyección familiar:** oferta con origen, vencimiento y acción de aceptación; no posición previa.
- **AC relacionados:** AC-033, AC-036, AC-038, AC-055.

### E2E-013 — Promoción desde espera con oferta expirada

- **Precondiciones:** oferta de promoción vigente.
- **Actores:** familia, Admisión.
- **Flujo principal:** familia no responde; llega vencimiento.
- **Resultado:** oferta expira, libera cupo, conserva origen/historia y no inicia handoff.
- **Auditoría requerida:** emisión, vencimiento, expiración y liberación.
- **Proyección familiar:** oferta expirada y próximo estado permitido.
- **AC relacionados:** AC-035 a AC-037.

### E2E-014 — Retiro voluntario de la familia

- **Precondiciones:** postulación u oferta activa sin handoff completado.
- **Actores:** familia, Admisión.
- **Flujo principal:** adulto autorizado solicita desistimiento; confirma; el sistema registra y libera reserva si existe.
- **Resultado:** caso desistido, sin handoff, con historia preservada.
- **Auditoría requerida:** actor, facultad, confirmación, instante y efectos sobre oferta/reserva.
- **Proyección familiar:** confirmación de desistimiento.
- **AC relacionados:** AC-002, AC-058.

### E2E-015 — Oferta normal expirada

- **Precondiciones:** disposición `APROBADO` y oferta normal vigente.
- **Actores:** familia, Admisión.
- **Flujo principal:** transcurren 3 días hábiles sin respuesta.
- **Resultado:** expiración automática, liberación de reserva y ausencia de handoff.
- **Auditoría requerida:** oferta, vencimiento, expiración y cupo liberado.
- **Proyección familiar:** estado expirado y vencimiento histórico.
- **AC relacionados:** AC-025, AC-036, AC-037.

### E2E-016 — Reapertura excepcional

- **Precondiciones:** oferta expirada y causa excepcional revisada.
- **Actores:** actor institucional autorizado, familia.
- **Flujo principal:** actor registra motivo y reabre; se emite nuevo plazo/estado sin borrar expiración previa.
- **Resultado:** nueva oportunidad trazable y separada.
- **Auditoría requerida:** autoridad, motivo, oferta anterior, nueva vigencia e instante.
- **Proyección familiar:** oferta vigente y nuevo vencimiento.
- **AC relacionados:** AC-039.

### E2E-017 — Fallo de correo

- **Precondiciones:** existe mensaje `PREPARED` confirmado para envío.
- **Actores:** Admisión, sistema de correo.
- **Flujo principal:** envío cambia a `SENT`; proveedor informa fallo; comunicación cambia a `FAILED`; se crea tarea.
- **Resultado:** disposición/oferta no cambian y el caso requiere seguimiento operativo.
- **Auditoría requerida:** preparación, confirmación, intento, fallo y tarea.
- **Proyección familiar:** el portal mantiene el estado oficial; no se muestra un rechazo por fallo técnico.
- **AC relacionados:** AC-040 a AC-042.

### E2E-018 — Intento de acceso cross-tenant

- **Precondiciones:** usuario de tenant A conoce un identificador de tenant B.
- **Actores:** usuario institucional, control de autorización.
- **Flujo principal:** intenta abrir expediente, archivo o conteo de B.
- **Resultado:** acceso denegado sin revelar existencia.
- **Auditoría requerida:** identidad, tenant efectivo, recurso solicitado, acción y resultado seguro.
- **Proyección familiar:** ninguna; no se filtra información.
- **AC relacionados:** AC-045, AC-050.

### E2E-019 — Acceso a dato restringido sin permiso

- **Precondiciones:** usuario puede ver el caso, pero no PIE/NEE, salud o evaluación.
- **Actores:** usuario institucional.
- **Flujo principal:** solicita la sección restringida.
- **Resultado:** lectura denegada sin ampliar privilegios por acceso general al expediente.
- **Auditoría requerida:** intento y resultado conforme a sensibilidad.
- **Proyección familiar:** ninguna exposición adicional.
- **AC relacionados:** AC-052.

### E2E-020 — Elevación explícita de Superadministrador

- **Precondiciones:** Superadministrador sin acceso activo necesita soporte en tenant concreto.
- **Actores:** Superadministrador Global.
- **Flujo principal:** primero se deniega lectura; luego registra `SELF-ELEVATION` con motivo, tenant, alcance, categorías y expiración; accede sólo dentro de esa ventana.
- **Resultado:** soporte temporal y scope-specific, sin lectura permanente.
- **Auditoría requerida:** acción de elevación, actor, motivo, alcance, inicio, expiración, accesos y resultado.
- **Proyección familiar:** ninguna por defecto; obligaciones de notificación quedan en Q-205.
- **AC relacionados:** AC-053, AC-054.

### E2E-021 — Exportación autorizada

- **Precondiciones:** Responsable de Admisión o Administrador Máximo tiene propósito válido.
- **Actores:** actor autorizado.
- **Flujo principal:** elige reporte y columnas mínimas; confirma tenant/alcance; genera y descarga.
- **Resultado:** exportación minimizada sin archivos ni datos altamente restringidos por defecto.
- **Auditoría requerida:** solicitante, propósito, tenant, filtros, columnas y descarga.
- **Proyección familiar:** no aplica.
- **AC relacionados:** AC-047, AC-049, AC-050.

### E2E-022 — Exportación masiva no autorizada por Secretaría

- **Precondiciones:** Secretaría posee consulta operativa, no exportación masiva.
- **Actores:** Secretaría.
- **Flujo principal:** intenta exportar el conjunto de postulaciones.
- **Resultado:** solicitud denegada y ningún archivo generado.
- **Auditoría requerida:** identidad, tenant, acción solicitada y denegación.
- **Proyección familiar:** ninguna.
- **AC relacionados:** AC-048, AC-050.
