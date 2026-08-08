# Concurrencia, consistencia y trabajo asíncrono

**Estado:** `PROPOSED / RECOMMENDED_FOR_G2`

**Alcance:** diseño conceptual; no contiene SQL, esquema físico ni implementación.

## Objetivo

Preservar las invariantes funcionales de cupos, reservas, ofertas, lista de espera, documentos y decisiones incluso cuando existan solicitudes simultáneas, reintentos o fallos parciales. La fuente de verdad transaccional propuesta es PostgreSQL.

## Estrategia general

Se recomienda combinar:

- transacciones atómicas para cambios que deben confirmarse juntos;
- bloqueo de la fila lógica de capacidad —equivalente conceptual a `SELECT FOR UPDATE`— cuando se consume o libera un cupo;
- restricciones de unicidad e integridad como última defensa;
- control optimista por versión para ediciones humanas y agregados con baja contención;
- claves de idempotencia para comandos repetibles desde navegador, worker o integración;
- reintentos acotados sólo ante conflictos transitorios;
- outbox transaccional para efectos asíncronos posteriores.

Un reintento nunca debe convertir dos solicitudes en dos efectos de negocio.

## Invariantes por agregado

### Cupos, reservas y ofertas

1. La disponibilidad de Admisión se administra por tenant, proceso, año, sede y curso/oferta.
2. La cantidad de reservas activas no puede superar el cupo de Admisión vigente.
3. Dos operaciones concurrentes no pueden consumir el último cupo (`AC-031`).
4. Una oferta activa debe referenciar una reserva activa y exclusiva para el caso.
5. Aceptar una oferta sólo es válido si la oferta y su reserva siguen activas al momento de confirmar la transacción.
6. La expiración libera la reserva una sola vez.
7. La reapertura excepcional crea una nueva vigencia auditada; no altera silenciosamente la oferta anterior.
8. Cupo de Admisión no equivale a capacidad académica ni matrícula en EduPay.
9. El desistimiento voluntario confirmado conserva historia, libera una reserva aplicable una sola vez y no inicia handoff (`AC-058`).

Flujo transaccional propuesto para consumir el último cupo:

1. Resolver tenant y oferta desde contexto confiable.
2. Iniciar transacción.
3. Bloquear la capacidad lógica de esa oferta.
4. Recalcular disponibilidad con reservas activas dentro de la misma transacción.
5. Si no existe cupo, no crear reserva y devolver conflicto funcional.
6. Si existe, crear una única reserva y la oferta asociada.
7. Registrar auditoría y outbox en la misma confirmación.

La segunda operación concurrente observa la capacidad ya consumida y no puede confirmar otra reserva.

### Aceptación

- Una aceptación expresa tiene una clave única por oferta y versión vigente.
- Peticiones repetidas con la misma intención devuelven el resultado ya confirmado.
- Una aceptación después del vencimiento falla sin iniciar handoff.
- Aceptación, expiración y desistimiento compiten sobre el mismo estado esperado; sólo una transición terminal puede confirmar.
- La aceptación genera la solicitud de handoff una sola vez mediante outbox.
- `OfferAcceptance != Enrollment` y `IntegrationHandoff != Enrollment`.

### Lista de espera

- La promoción es manual y sólo por Responsable de Admisión o Administrador Institucional Máximo.
- La promoción bloquea la entrada y la capacidad involucradas.
- Una entrada no puede tener dos promociones activas.
- El orden y las prioridades se evalúan desde el snapshot versionado vigente; una excepción queda motivada y auditada.
- Fallar por falta de cupo no elimina ni reordena silenciosamente la entrada.

### Documentos

- Cargar una corrección crea `DocumentVersion`; nunca sobrescribe el archivo anterior.
- Sólo una versión puede ser la vigente para una presentación, pero todas conservan historial.
- Revisión y reemplazo usan un token de versión; una decisión sobre una versión obsoleta requiere recargar el caso.
- La aprobación del archivo ocurre sólo después de validación y escaneo satisfactorios.

### Recomendaciones y decisiones

- Cada modificación crea una nueva versión inmutable.
- El recomendador no puede decidir el mismo caso (`AC-023`, `AC-028`).
- Una decisión se valida contra la versión de recomendación que fue revisada.
- Una edición concurrente produce conflicto explícito; no aplica “último guardado gana”.
- Las disposiciones `APROBADO`, `LISTA_DE_ESPERA`, `RECHAZADO` y `DEVUELTO_A_REVISION` mantienen su semántica funcional aprobada.

## Mecanismos por tipo de operación

| Operación | Mecanismo principal | Defensa adicional |
|---|---|---|
| Consumir/liberar cupo | Transacción y bloqueo pesimista focalizado | Constraint e idempotencia |
| Crear/expirar oferta | Transacción con estado esperado | Unicidad de oferta activa |
| Aceptar oferta | Transacción y precondición temporal | Clave idempotente y outbox |
| Promover espera | Bloqueo de entrada y capacidad | Permiso, auditoría y unicidad |
| Editar formulario/configuración | Control optimista por versión | Publicación versionada |
| Reemplazar documento | Nueva versión | Hash y referencia a predecesora |
| Recomendar/decidir | Nueva versión y estado esperado | Separación de funciones |
| Procesar job | Claim exclusivo con lease | Reintento acotado y deduplicación |

## Errores, reintentos e idempotencia

- Los conflictos de negocio se informan como tales y no se reintentan automáticamente.
- Los conflictos transitorios de base de datos pueden reintentarse un número acotado con espera incremental.
- Toda operación externa o asíncrona usa una clave estable asociada al efecto de negocio.
- Un job agotado pasa a revisión operacional; no modifica por sí mismo una decisión de admisión.
- La reconciliación técnica con EduPay permanece en `Q-301..Q-309 / FUTURE_INTEGRATION_PENDING`.

## Jobs, scheduler y outbox

### Casos asíncronos

- envío y reintentos de email;
- recordatorios de ofertas;
- expiración de ofertas y liberación de reservas;
- escaneo antimalware;
- generación de exportaciones/reportes;
- limpieza de cuarentena y artefactos temporales;
- preparación futura del handoff, sin implementar integración EduPay.

### Alternativas

| Alternativa | Ventajas | Riesgos / límites | Evaluación MVP |
|---|---|---|---|
| Proceso Node separado | Aísla trabajo de requests y permite escalar | Necesita runtime persistente y supervisión | Componente recomendado |
| Redis + BullMQ o equivalente | Madurez, delayed jobs y throughput | Servicio adicional, costo y operación | Diferir hasta demostrar necesidad |
| Jobs respaldados por PostgreSQL | Menos infraestructura, transacción con datos de negocio | Requiere disciplina de claims, leases y limpieza | Recomendado para MVP |
| Cron + base de datos | Simple para despertar tareas periódicas | Cron solo no garantiza exclusión ni entrega | Útil como disparador, no como cola única |

### Recomendación

Usar una tabla lógica de jobs y outbox en PostgreSQL, procesada por un worker Node separado. El scheduler crea o despierta trabajo; los workers reclaman jobs con lease, deduplican por clave, registran intentos y aplican backoff. Redis no forma parte de la línea base inicial.

El outbox se confirma en la misma transacción que el cambio de negocio. Su publicación o procesamiento posterior puede repetirse sin duplicar efectos. Las tareas de expiración también validan el estado y la hora actual dentro de una transacción: un job tardío no puede expirar una oferta ya aceptada.

### Email

- `PREPARED`, `SENT`, `DELIVERED` y `FAILED` son estados de comunicación, no de admisión.
- Preparar el mensaje y registrar el job ocurre junto con la acción que lo origina.
- El proveedor recibe una clave idempotente cuando la admita.
- Un fallo agotado crea una tarea interna y mantiene intacto el estado de negocio.
- Webhooks, si se adoptan, deberán autenticarse, deduplicarse y asociarse al tenant server-side.

## Compatibilidad de runtime

cPanel/Passenger puede ejecutar requests Node, pero no ofrece por sí solo garantías suficientes para un worker persistente, escaneo antimalware, scheduler con exclusión y despliegues coordinados. Podría alojar un prototipo limitado si el hosting demuestra supervisión de procesos y cron confiable, pero no es la recomendación de producción para esta arquitectura.

## Validación futura

En E4/E5 deberán ejecutarse pruebas de:

- dos promociones o aprobaciones simultáneas sobre el último cupo;
- aceptación concurrente con expiración;
- repetición de requests y jobs;
- caída entre confirmación transaccional y procesamiento de outbox;
- revisión de una versión documental o decisión obsoleta;
- aislamiento tenant durante todas las operaciones anteriores.
