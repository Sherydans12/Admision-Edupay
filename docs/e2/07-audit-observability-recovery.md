# Auditoría, observabilidad y recuperación

**Estado:** `PROPOSED / RECOMMENDED_FOR_G2`

**Alcance:** diseño arquitectónico; valores operativos iniciales sujetos a aprobación.

## Separación de señales

| Señal | Propósito | Contenido permitido | Audiencia principal |
|---|---|---|---|
| Audit Log | Evidenciar acciones y cambios de negocio | Actor, tenant, propósito, recurso, acción y resultado | Institución y control autorizado |
| Application Log | Diagnosticar ejecución | Evento técnico estructurado, correlación y error sanitizado | Operación técnica |
| Security Event | Detectar abuso o control fallido | Intento, identidad, tenant efectivo, regla y resultado | Seguridad/operación restringida |
| Metrics | Medir salud y tendencia | Contadores, latencias y disponibilidad agregada | Operación de plataforma |

Una señal no reemplaza a otra. Los logs técnicos no son el historial institucional y la auditoría no debe usarse como volcado de depuración.

## Modelo conceptual de auditoría

`AuditEvent` es append-only a nivel de aplicación. Debe incluir, cuando corresponda:

- identificador y timestamp UTC;
- actor autenticado y actor efectivo;
- tenant y sede/proceso de alcance;
- propósito declarado;
- correlation ID y request/job ID;
- tipo e identificador opaco del recurso;
- acción, resultado y motivo;
- versión anterior y posterior como identificadores o cambios permitidos;
- metadatos mínimos y clasificados;
- origen de sesión, postulación asistida o elevación cuando aplique.

No se guardan contraseñas, tokens, cookies, secretos, contenido completo de documentos, respuestas sensibles, información clínica detallada ni payloads indiscriminados. Los valores before/after se limitan a campos autorizados o referencias a versiones.

## Eventos mínimos auditables

- inicio/cierre de sesión relevante, bloqueo y recuperación de cuenta;
- creación/cambio de membresía, rol o permiso;
- publicación de configuración o formulario;
- acceso y modificación de datos restringidos;
- carga, lectura, descarga, revisión, reemplazo o eliminación autorizada de archivos;
- asistencia institucional y digitalización física;
- creación/reprogramación/cierre de actividad e intentos;
- recomendación, disposición de Dirección y sus versiones;
- modificación de cupo, reserva, oferta, expiración, reapertura y aceptación;
- ingreso/promoción/excepción de lista de espera;
- exportación y resultado;
- elevación de Superadministrador, acceso durante ella y expiración;
- creación/procesamiento del handoff funcional;
- operaciones administrativas de retención/eliminación cuando sean aprobadas legalmente.

El acceso ordinario de plataforma a métricas, disponibilidad y salud no debe requerir leer contenido personal.

## Integridad y acceso

- Escritura centralizada y sin edición ordinaria.
- Permiso de lectura separado por tenant, sensibilidad y propósito.
- Los administradores institucionales comunes no heredan lectura global.
- El Administrador Institucional Máximo se limita a su tenant.
- El Superadministrador Global necesita elevación explícita incluso para consultar auditoría con contenido institucional.
- Se proponen controles de encadenamiento/hash o exportación inmutable como evolución si el riesgo o la obligación normativa lo exige; no se declara inmutabilidad criptográfica en MVP.

Retención, eliminación, anonimización y solicitudes de titulares siguen sujetos a `C-013 / LEGAL_VALIDATION_PENDING` y `Q-201..Q-203`; no se fija aquí una conclusión legal.

## Logging estructurado

Cada proceso emitirá eventos estructurados con:

- nivel, servicio/módulo y ambiente;
- timestamp y correlation ID;
- request ID o job ID;
- tenant opaco cuando sea necesario para operación;
- código de evento y resultado;
- error sanitizado y stack sólo en el destino restringido.

Se aplican redacción de campos, allowlist de metadatos y límites de tamaño. La identidad personal se sustituye por identificadores opacos siempre que sea posible.

## Trazabilidad y correlación

El portal inicia o propaga un correlation ID no autoritativo. La API genera uno si falta y lo transmite a worker, outbox, proveedor de email y frontera futura EduPay. Un ID recibido del cliente sirve para correlación, nunca para autorizar.

## Error tracking y eventos de seguridad

La herramienta concreta queda por seleccionar. Debe admitir:

- sanitización antes de envío;
- ambientes y releases;
- muestreo y control de acceso;
- alertas por tendencia, no por contenido personal;
- residencia y condiciones contractuales compatibles con decisiones legales futuras.

Eventos como intentos cross-tenant, uso de elevación, descarga masiva, credenciales repetidas, URLs firmadas inválidas y cambios de permisos requieren canal de seguridad y alertas proporcionales.

## Métricas y salud

Métricas mínimas propuestas:

- tasa/latencia/error por ruta o capacidad, sin etiquetas de alta cardinalidad personal;
- profundidad y edad máxima de jobs/outbox;
- email exitoso/fallido y reintentos;
- ofertas próximas/vencidas y retraso del scheduler;
- escaneos pendientes/fallidos;
- conexiones y saturación de base de datos;
- uso y errores de object storage;
- elevaciones activas y fallidas como métrica de seguridad agregada.

`liveness` confirma que el proceso responde. `readiness` comprueba dependencias imprescindibles para recibir trabajo. Un worker expone salud separada; la API no debe aparecer sana si no puede operar de forma segura.

## Backups y recuperación

La estrategia debe cubrir de forma coordinada:

- PostgreSQL con backups automáticos, cifrados y restaurables;
- object storage privado con versionado/protección acorde al proveedor;
- configuración y secretos mediante mecanismos externos al repositorio;
- inventario que permita detectar base restaurada sin objetos o viceversa;
- procedimientos de restauración por ambiente;
- pruebas periódicas de restore con datos sintéticos hasta autorizar datos reales.

Queda registrado como objetivo técnico inicial:

- **RPO:** hasta 1 hora;
- **RTO:** hasta 4 horas para el servicio principal del piloto.

Estos valores no constituyen SLA, compromiso comercial, garantía legal ni compromiso de disponibilidad. Deben revalidarse considerando proveedor, volumen, costo, ventanas de admisión y operación real.

## Respuesta y degradación

- Si email falla, el portal y el estado de admisión siguen siendo fuente oficial y se crea tarea interna.
- Si el worker está caído, las transacciones guardan outbox/jobs para recuperación posterior.
- Si el escáner no está disponible, el archivo permanece en cuarentena.
- Si object storage no está disponible, no se confirma una carga inexistente.
- Si EduPay no está disponible en una integración futura, la aceptación no se revierte; el handoff queda pendiente/reintentable según el contrato aún no definido.

## Validaciones antes de producción

- restauración integral base + objetos;
- medición de RPO/RTO alcanzables;
- revisión de redacción de logs y error tracking;
- alertas de jobs, capacidad, archivos y seguridad;
- acceso tenant-aware a auditoría;
- expiración efectiva de elevaciones;
- runbooks de incidente y recuperación aprobados.
