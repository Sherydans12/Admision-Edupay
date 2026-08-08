# E3 — Estados de pantalla y feedback

## Regla base

La interfaz siempre distingue:

> **Estado técnico** = qué ocurrió con la operación de interfaz, red, almacenamiento, escaneo o proveedor.
>
> **Estado de negocio** = qué ocurrió con la postulación, documento, actividad, decisión, cupo, espera u oferta.

Un estado técnico fallido no debe inventar, revertir o disfrazar un estado de negocio. Por ejemplo, `email FAILED` no transforma `APROBADO` en `RECHAZADO`; un escaneo pendiente no transforma un documento en `ACEPTADO`.

**Trazabilidad:** NFR-UX-003/004, BL-001, BL-006, BL-008, BL-014..BL-016, BL-019..BL-020; AC-010..AC-013, AC-017..AC-021, AC-025..AC-058; E2E-002, E2E-005, E2E-010, E2E-013, E2E-017..E2E-022.

## Patrón común de feedback

1. Identificar la operación y el contexto sin exponer datos sensibles.
2. Decir si la acción se guardó, quedó pendiente o no se realizó.
3. Explicar la próxima acción concreta.
4. Anunciar el cambio para tecnología de asistencia mediante región viva conceptual.
5. Mantener el mensaje junto al campo/sección y una síntesis al inicio cuando corresponda.
6. No usar sólo color, icono o posición para comunicar estado.

## Catálogo de estados

| Estado/patrón | Tipo principal | Representación UX | Acción/next step | Regla de seguridad/negocio |
| --- | --- | --- | --- | --- |
| `loading` | Técnico | Indicador breve en control o región | Esperar; no duplicar mutación | No afirmar éxito ni cambiar estado de negocio |
| `skeleton` | Técnico | Estructura de la sección sin datos falsos | Esperar o volver | No mostrar placeholders que parezcan datos reales |
| `empty` | Negocio/consulta | Mensaje del alcance: “No hay elementos para mostrar” | Crear, filtrar o volver | No confundir vacío de scope con inexistencia global |
| `success` | Técnico + negocio confirmado | Confirmación explícita, estado nuevo y próxima acción | Continuar | Sólo después de confirmación durable del negocio |
| `validation error` | Técnico/entrada | Resumen y error junto al campo | Corregir campo | No borra otros datos guardados |
| `business error` | Negocio | Motivo de regla y alternativa permitida | Revisar antecedentes/contactar | No expone reglas internas, prioridad o existencia ajena |
| `network error` | Técnico | “No pudimos completar la operación” | Reintentar seguro / verificar estado | Mutaciones usan idempotencia conceptual; no duplicar envío |
| `forbidden` | Autorización | “No tienes permiso para realizar esta acción” | Volver o solicitar acceso por canal definido | No revela recurso, tenant, contador o sensibilidad |
| `not found` | Seguridad/consulta | “No encontramos ese recurso o ya no está disponible” | Volver a bandeja | Respuesta uniforme, sin enumeración cross-tenant |
| `session expired` | Seguridad/técnico | Bloqueo de acción y retorno a login | Reautenticar | No reintentar mutación crítica en segundo plano |
| `offline/degraded` | Técnico | Banda persistente no obstructiva + operación limitada | Reintentar cuando haya conectividad | Nunca confirmar carga/envío no confirmado |
| `async pending` | Técnico/negocio | Estado pendiente, timestamp/acción en curso | Esperar, salir o consultar | No presentar como final; conserva contexto |
| `email failed` | Técnico | Falla de comunicación y tarea para personal | Gestionar tarea; portal oficial | Disposición, oferta, aceptación y estado no cambian |
| `document scanning` | Técnico | Archivo recibido, en cuarentena/escaneo | Esperar; cargar otro si permitido | Nunca descargar/validar bytes antes de resultado autorizado |
| `document observed` | Negocio | Requisito, motivo accionable, plazo y corregir | Cargar nueva versión | No auto-rechazo al vencer; exige revisión humana |
| `offer expiring` | Negocio | Fecha/hora absoluta + tiempo restante + alerta | Aceptar/rechazar | No depender sólo del color ni del contador |
| `offer expired` | Negocio | Estado histórico, fecha y próximo paso | Contactar/esperar reapertura autorizada | No aceptar tardíamente de forma automática |
| `waitlist` | Negocio | Estado general, fecha de actualización y próximos pasos | Esperar comunicación | Sin posición numérica, prioridad interna o cupos exactos |
| `case closed` | Negocio | Estado final y explicación comunicable | Ver historia/contacto | No confundir desistimiento, rechazo, vencimiento o cierre manual |

## Aplicación por operación

### Documentos

- Upload aceptado por interfaz → `CARGADO` + `document scanning` técnico.
- Escaneo exitoso y revisión pendiente → `EN_REVISION`.
- Revisión definitiva → `ACEPTADO`, `OBSERVADO`, `EXENTO` o nueva versión `REEMPLAZADO` según la acción autorizada.
- Fallo de escaneo → `document scanning failed` técnico; no es `OBSERVADO` ni `RECHAZADO`.

### Actividades

- Guardar cita → éxito técnico + `PROGRAMADA`/`REPROGRAMADA` negocio.
- No-show → `INASISTENCIA`; no cierre automático.
- Evaluación no completada → `NO_COMPLETADA` + resultado interno `INCONCLUSO`; no se proyecta el resultado a familia.

### Recomendación y decisión

- Guardar recomendación → versión interna confirmada; no es `APROBADO`.
- Dirección `DEVUELTO_A_REVISION` → vuelve a Admisión; no es rechazo ni decisión definitiva.
- Dirección `APROBADO` → reserva/oferta/comunicación preparada según reglas; comunicación técnica pendiente no cambia el negocio.

### Oferta y espera

- `LISTA_DE_ESPERA` → estado general de familia y orden interno de personal.
- Promoción → reserva + oferta; la familia ve origen y vencimiento, no la posición previa.
- Vencimiento → oferta expirada + reserva liberada; la expiración se conserva.

## Accesibilidad del feedback

- Errores se anuncian en el resumen y junto al campo.
- `aria-live` conceptual se reserva para cambios relevantes, no para cada contador.
- Toasts no son el único canal para una mutación crítica.
- El foco se mueve al resumen de error, diálogo o encabezado de éxito según la acción.
- Mensajes de estado tienen texto, iconografía redundante y relación semántica.

## Copy mínimo recomendado

| Situación | Mensaje base |
| --- | --- |
| Sesión expirada | “Tu sesión terminó por seguridad. Inicia sesión nuevamente para continuar.” |
| Sin permiso | “No tienes permiso para realizar esta acción.” |
| Recurso no disponible | “No encontramos ese recurso o ya no está disponible.” |
| Email fallido | “El correo no pudo enviarse. El estado oficial sigue disponible en el portal y se creó una tarea de seguimiento.” |
| Documento observado | “Necesitamos una corrección en este requisito. Revisa el motivo y carga una nueva versión antes del plazo indicado.” |
| Espera | “Tu postulación está en lista de espera. Te informaremos si cambia la disponibilidad.” |
| Oferta por vencer | “Esta oferta vence el [fecha y hora]. Revisa las consecuencias antes de aceptar o rechazar.” |

Estos textos son patrones de trabajo, no copy legal ni marketing final.
