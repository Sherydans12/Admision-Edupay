# Estrategia de testing

**Estado:** `PROPOSED / RECOMMENDED_FOR_G2`

**Alcance:** estrategia para E4/E5; no crea pruebas ejecutables.

## Principios

- Los 58 criterios funcionales `AC-001..AC-058` son la base verificable.
- Las pruebas usan únicamente tenants, personas, documentos e identificadores sintéticos.
- Aislamiento tenant, autorización, concurrencia y archivos se validan con pruebas negativas, no sólo con casos felices.
- Cada defecto de seguridad o consistencia corregido agrega una regresión.
- Las pruebas de integración usan PostgreSQL real de versión compatible; mocks no demuestran constraints, locks ni RLS.
- Ningún test depende de EduPay real mientras la integración técnica no esté autorizada.

## Capas

| Capa | Objetivo | Ejemplos | Ejecución |
|---|---|---|---|
| Unit | Reglas puras y autorizadores | estados, plazos, permisos, minimización | Cada cambio |
| Integration | Módulo + PostgreSQL/object storage/job adapter | repositorios tenant-aware, versionado, outbox | Cada PR relevante |
| API | Contratos y comportamiento HTTP sin fijarlos en E2 | auth, validación, errores, idempotencia | Cada PR de API |
| DB integration | Constraints, transacciones, RLS y migraciones | último cupo, uniqueness tenant, rollback | Cada PR de persistencia |
| Frontend | UI, accesibilidad y proyección por rol | portal familiar, estados, errores | Cada PR de interfaz |
| E2E | Recorridos canónicos completos | E2E-001..E2E-022 | PR crítico y pre-release |
| Security | Abuso y controles | IDOR, CSRF, XSS, subida maliciosa | Continua + pre-release |
| Operational | Jobs, backup y recuperación | reintentos, worker caído, restore | Staging/pre-release |

## Mapeo por capacidad y AC

| Capacidad | AC principales | Validación técnica requerida |
|---|---|---|
| Identidad/familia | AC-001..AC-004 | cuentas, relación adulto-estudiante, acceso ajeno denegado |
| Oferta/formulario/postulación | AC-005..AC-010 | publicación versionada, snapshot, disponibilidad categórica |
| Documentos | AC-011..AC-017 | versiones, equivalentes, exención, cuarentena y autorización |
| Asistencia y actividades | AC-018..AC-022 | operador auditado, reprogramación, no-show e intentos |
| Recomendación/decisión | AC-023..AC-030 | permisos, separación de funciones, versiones y proyección familiar |
| Cupos | AC-031..AC-032 | concurrencia real, auditoría y modificación autorizada |
| Lista de espera | AC-033..AC-036 | promoción manual, orden, oferta y posición oculta |
| Oferta/aceptación | AC-037..AC-041, AC-058 | expiración/aceptación/desistimiento, reapertura e idempotencia |
| Comunicación | AC-042..AC-045 | estados/reintentos; fallo no cambia negocio |
| Dashboard/reporting | AC-046..AC-049 | scopes, minimización y exportación auditada |
| Seguridad/multitenancy | AC-050..AC-054 | tenant breakout, elevación y categorías sensibles |
| Handoff funcional | AC-055..AC-057 | aceptación previa, boundary y no equivalencia con matrícula |

## Aislamiento multiempresa y autorización

Cada operación tenant-owned debe probar al menos:

1. acceso permitido dentro del tenant con permiso y propósito correctos;
2. mismo identificador o identificador conocido desde otro tenant denegado sin filtrar existencia;
3. ausencia o manipulación de tenant en cliente no cambia el contexto efectivo;
4. servicio/repository sin contexto tenant falla cerrado;
5. RLS, si se aprueba, bloquea una consulta que omita el filtro de aplicación;
6. logs y auditoría no exponen contenido del tenant equivocado.

La matriz cubre familia, Secretaría, Admisión, Dirección, evaluadores, Administrador Institucional Máximo y Superadministrador Global. Se prueba que:

- Secretaría no recomienda, decide ni promueve;
- el recomendador no decide el mismo caso (`AC-023`, `AC-028`);
- el Administrador Institucional Máximo no cruza de tenant;
- el Superadministrador no lee contenido sin elevación, y pierde acceso al expirar (`AC-053`, `AC-054`);
- sensibilidad y propósito pueden denegar aunque exista un rol general.

## Concurrencia e idempotencia

Pruebas obligatorias con operaciones realmente paralelas:

- dos consumos del último cupo: sólo uno confirma (`AC-031`);
- promoción simultánea de una entrada de espera;
- aceptación y expiración en carrera;
- aceptación, expiración y desistimiento en carrera;
- dos aceptaciones/reintentos del mismo request;
- procesamiento repetido de outbox/job;
- decisión o revisión sobre versión obsoleta;
- rollback completo si falla una parte de la transacción.

## Archivos

La suite incluye:

- tamaño excedido, MIME declarado falso y firma incompatible;
- malware conocido de prueba seguro y escáner no disponible;
- archivo dañado, vacío o protegido por contraseña;
- cuarentena no descargable por usuario ordinario;
- URL firmada expirada, filtrada o usada por otro actor/tenant;
- hash, versión, reemplazo e historial;
- limpieza y conservación coherente con la política aprobada;
- autorización y auditoría de lectura, descarga y eliminación.

No se almacenan muestras peligrosas reales fuera de mecanismos de prueba controlados.

## Jobs, email y fallos parciales

- claim exclusivo, lease vencido y recuperación por otro worker;
- backoff, máximo de intentos y paso a revisión;
- scheduler duplicado sin doble expiración;
- caída después de commit y antes de procesar outbox;
- proveedor de email lento, fallido o con callback repetido;
- `FAILED` genera tarea interna y no rechazo/cambio de decisión (`AC-042`);
- reporte grande se autoriza antes de generar y antes de descargar;
- handoff futuro simulado sólo en el boundary, sin contrato técnico.

## Migraciones

Cuando E4 las autorice, cada migración debe probar:

- aplicación desde la versión soportada anterior;
- compatibilidad con despliegue expand/contract;
- constraints y RLS esperados;
- rollback lógico o plan de recuperación cuando no sea reversible;
- ejecución con volumen sintético representativo;
- ausencia de datos reales en fixtures y logs.

## Backup y restore

En staging se realizará una restauración periódica de PostgreSQL y objetos sintéticos. Se verifica integridad referencial lógica, disponibilidad de versiones, auditoría y medición de RPO/RTO alcanzado. Un backup no se considera válido por existir: debe poder restaurarse.

## Frontend y accesibilidad

- estados de carga, vacío, error y reintento;
- navegación por teclado, foco, etiquetas y contraste;
- mensajes que no revelen existencia de recursos ajenos;
- fechas/plazos en zona institucional;
- familia no ve resultados internos, deliberaciones ni posición de espera;
- vencimiento exacto visible y consistente;
- compatibilidad de navegadores definida antes de E5.

## Qué bloquea CI en E4/E5

### En cada pull request

- unit e integración relacionadas;
- API/contratos afectados;
- análisis estático, dependencias y secretos;
- migraciones aplicables;
- pruebas tenant/authorization del módulo cambiado;
- ausencia de tests omitidos sin justificación.

### Antes de integrar una capacidad crítica

- E2E del recorrido afectado;
- pruebas negativas de seguridad;
- concurrencia si toca cupos/ofertas/espera;
- archivos si toca upload/download;
- jobs y fallos parciales si introduce efectos asíncronos.

### Antes de release/piloto

- suite E2E P0;
- threat-model regression;
- restore probado;
- escaneo de archivos validado;
- performance mínima acordada;
- observabilidad y alertas verificadas;
- autorización legal y de datos reales, independiente del resultado técnico.

Los umbrales de cobertura numéricos se definirán en E4; no se usa un porcentaje como sustituto de cubrir riesgos críticos.
