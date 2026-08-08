# E3 — Escenarios de validación del prototipo

## Método

Las tareas se ejecutan con personas sintéticas, estudiantes ficticios, documentos ficticios y tenant/caso de prueba no real. Se valida comprensión, encontrabilidad, permiso visible y recuperación de error; no se prueba código ni integración. Un fallo que expone datos o confunde una decisión crítica es severidad alta aunque la tarea tenga un workaround.

**Severidad:**

- `S1 crítica`: expone datos, permite acción incompatible o confunde oferta/decisión/seguridad.
- `S2 alta`: impide o puede hacer fallar un recorrido P0.
- `S3 media`: fricción o error recuperable sin riesgo material.
- `S4 baja`: copy/estética que no cambia comportamiento.

| # | Audiencia / tarea | Precondición sintética | Objetivo | Éxito observable | Fallo observable | Severidad | AC |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Familia: iniciar postulación | Cuenta verificada; estudiante sintético A; oferta abierta | Llegar al primer paso del formulario | Selecciona estudiante/proceso/oferta y crea borrador sin interpretar promesa | No encuentra oferta, ve cupo exacto o no entiende advertencia | S2/S1 | AC-001..AC-007 |
| 2 | Familia: corregir documento | Requisito B `OBSERVADO` con plazo | Cargar corrección correcta | Encuentra motivo/plazo, carga nueva versión y ve `EN_REVISION` | Cree que vencimiento rechaza automáticamente o sobrescribe historia | S2 | AC-010..AC-013 |
| 3 | Familia: encontrar cita | Cita sintética `PROGRAMADA` | Ver fecha, hora, lugar y estado | Abre la cita desde inicio/expediente sin ver resultado interno | No encuentra cita o confunde estado con resultado | S2 | AC-017, AC-021 |
| 4 | Familia: solicitar cambio | Cita vigente; motivo sintético | Pedir reprogramación | Envía motivo y entiende que personal asigna nueva hora | Elige directamente horario o no recibe confirmación pendiente | S2 | AC-018 |
| 5 | Familia: entender waitlist | Postulación `LISTA_DE_ESPERA` | Explicar qué pasa después | Identifica estado, actualización y próximos pasos sin buscar posición | Cree que existe una posición visible o que la oferta es inmediata | S1 | AC-026, AC-032 |
| 6 | Familia: aceptar oferta antes de vencer | Oferta vigente con fecha/hora sintética | Aceptar de forma expresa | Lee vencimiento/consecuencias, confirma y ve aceptación; no dice matrícula/pago | Acepta sin confirmación o interpreta handoff como matrícula | S1 | AC-036..AC-038, AC-055..AC-057 |
| 7 | Secretaría: crear asistida | Adulto sintético presente; autorización registrada | Completar postulación sin asumir revisión | Guarda/envía en portal y queda evidencia de asistencia | Inventan respuestas o aparece recomendación/decisión | S1 | AC-014..AC-016 |
| 8 | Secretaría: cargar documento | Documento físico sintético; requisito correcto | Digitalizar y registrar recepción | Carga con origen correcto y ve scanning, sin aceptar | Puede dictaminar o archivo se muestra aceptado antes del scan | S1 | AC-011, AC-015 |
| 9 | Secretaría: reprogramar actividad | Solicitud de cambio pendiente | Asignar nueva cita | Conserva cita anterior, motivo y nueva cita | Familia elige horario o Secretaría cierra por contador | S2/S1 | AC-017..AC-020 |
| 10 | Admisión: identificar caso pendiente | Inbox con casos sintéticos en distintos estados | Abrir el caso que requiere revisión | Filtros/estado/próxima acción llevan al caso correcto | Conteos filtran otro tenant o no distinguen próximo paso | S1/S2 | AC-044..AC-046, AC-050 |
| 11 | Admisión: observar documento | Requisito cargado y revisable | Emitir observación accionable | Elige requisito, motivo y plazo; caso queda observado | Observa sin motivo, cambia decisión de negocio o borra versión | S1 | AC-010..AC-013 |
| 12 | Admisión: emitir recomendación | Antecedentes suficientes; recomendador separado | Crear recomendación versionada | Selecciona opción, ingresa fundamento y envía a Dirección | Puede decidir, no se exige fundamento o se pierde versión previa | S1 | AC-022..AC-024, AC-028 |
| 13 | Admisión: promover waitlist | Entrada admisible; cupo liberado | Promover manualmente | Ve orden interno, confirma reserva/oferta y no muestra posición a familia | Secretaría puede promover o no se registra origen | S1 | AC-032..AC-035 |
| 14 | Admisión: oferta por vencer | Oferta sintética activa próxima a expiración | Identificar y gestionar seguimiento | Dashboard la destaca con fecha/hora y tarea de comunicación | Sólo muestra color, confunde fallida con expirada o altera negocio por email | S1/S2 | AC-036..AC-043 |
| 15 | Dirección: aprobar | Recomendación válida; cupo disponible; decisor distinto | Registrar `APROBADO` | Confirma disposición y se crean reserva/oferta/mensaje preparado | Secretaría/recomendador decide o se comunica sin confirmación | S1 | AC-025, AC-028, AC-040 |
| 16 | Dirección: devolver a revisión | Recomendación enviada | Devolver con motivo | Selecciona `DEVUELTO_A_REVISION`, el caso vuelve a Admisión y no es final | Se presenta a familia como rechazo/resultado | S1 | AC-027 |
| 17 | Dirección: rechazar | Recomendación válida | Registrar `RECHAZADO` | Exige fundamento, conserva historia y prepara comunicación | Se crea oferta, falta fundamento o se altera recomendación | S1 | AC-027..AC-028, AC-040 |
| 18 | Seguridad: acceder caso ajeno | Usuario de tenant A conoce identificador sintético de tenant B | Verificar denegación segura | No ve caso, archivo, conteo ni existencia | Respuesta distinta revela que el caso existe | S1 | AC-045, AC-050..AC-051 |
| 19 | Seguridad: Secretaría intenta decidir | Secretaría abre caso asistido | Verificar separación de funciones | Acción no aparece/queda denegada y no crea disposición | Puede registrar recomendación, decisión, cupo o promoción | S1 | AC-016, AC-023, AC-028, AC-034 |
| 20 | Seguridad: Superadmin sin elevación | Superadmin autenticado sin contexto elevado | Verificar no lectura tenant | Ve sólo operación de plataforma y puede iniciar elevación explícita | Ve nombres, conteos, archivo o caso sin motivo/scope | S1 | AC-053..AC-054 |

## Criterio de salida de validación

- S1 no puede quedar sin resolución, aceptación humana explícita o plan antes de G3.
- S2 de recorrido P0 debe resolverse en el prototipo o quedar documentado como bloqueante.
- S3/S4 pueden diferirse si no afectan comprensión, accesibilidad, permisos o seguridad.
- Los hallazgos se registran por pantalla `SCR`, tarea y AC; no se guardan datos reales ni capturas con personas reales.
