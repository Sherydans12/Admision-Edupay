# Requisitos no funcionales iniciales

## Estado

Estos requisitos expresan cualidades y controles esperados, pero aún carecen de métricas aprobadas. Donde no existe umbral, se define la decisión que debe tomarse antes de arquitectura o producción.

## Seguridad

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-SEC-001 | Denegar por defecto y aplicar mínimo privilegio. | Pruebas por rol, recurso, tenant, sede y sensibilidad. |
| NFR-SEC-002 | Derivar el tenant efectivo de identidad, membresía y recurso; ignorar `tenant_id` del cliente como autoridad. | Pruebas negativas de cambio de identificador y acceso cruzado. |
| NFR-SEC-003 | Autorizar cada operación en servidor, incluyendo archivos, exportaciones y búsquedas. | Matriz automatizada de autorización y revisión de rutas. |
| NFR-SEC-004 | Cifrar comunicaciones en tránsito y almacenamiento persistente. | Configuración y evidencia de proveedores; gestión de claves separada. |
| NFR-SEC-005 | Proteger sesiones con expiración, rotación, revocación y atributos seguros. | Pruebas de sesión robada, cierre, cambio de credenciales y tiempo ocioso. |
| NFR-SEC-006 | La recuperación de cuenta no debe permitir enumeración ni reutilización de tokens. | Mensajes uniformes, rate limiting y pruebas adversariales. |
| NFR-SEC-007 | Identificadores públicos deben ser no predecibles y no sustituir autorización. | Pruebas de enumeración y respuestas no reveladoras. |
| NFR-SEC-008 | Aplicar rate limiting contextual en autenticación, recuperación, búsqueda, carga y acciones sensibles. | Límites por riesgo, identidad, origen y tenant; métricas de falsos positivos. |
| NFR-SEC-009 | Validar entradas, salidas, plantillas y esquemas para mitigar inyección y contenido activo. | Pruebas de seguridad y política de render seguro. |
| NFR-SEC-010 | Secretos deben residir fuera del repositorio y rotarse. | Escaneo de secretos y proceso de respuesta. |
| NFR-SEC-011 | Operaciones críticas deben ser idempotentes y seguras ante concurrencia. | Pruebas de doble envío, reintento y carrera de cupos. |
| NFR-SEC-012 | Cambios de permisos, cupos, decisiones, exportaciones y soporte excepcional requieren auditoría reforzada. | Eventos completos, alertas y revisión periódica. |
| NFR-SEC-013 | El constructor de formularios no ejecutará JavaScript, HTML activo ni expresiones arbitrarias aportadas por una institución. | Catálogo cerrado de tipos/operadores, sanitización y pruebas adversariales. |
| NFR-SEC-014 | Publicar o archivar esquemas requiere autorización separada de la edición de borradores. | Pruebas por permiso y auditoría de publicación. |

## Privacidad y datos sensibles

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-PRV-001 | Clasificar datos como públicos, internos, personales, restringidos o altamente restringidos. | Inventario de datos y propietario por categoría. |
| NFR-PRV-002 | Minimizar captura y condicionar cada campo sensible a propósito, obligatoriedad y retención documentados. | Revisión de salud, PIE/NEE e ingreso familiar con colegio y responsable legal. |
| NFR-PRV-003 | Datos de menores, salud, NEE y finanzas requieren permisos específicos, no sólo acceso a la postulación. | Pruebas de acceso a nivel de campo/sección. |
| NFR-PRV-004 | No incluir datos sensibles en URLs, logs, métricas, nombres de archivo ni mensajes de error. | Escaneo y revisión de observabilidad. |
| NFR-PRV-005 | Lecturas y modificaciones de datos restringidos deben ser auditables. | Muestreo y consulta de auditoría por propósito. |
| NFR-PRV-006 | Retención, bloqueo, anonimización y eliminación deben aplicarse por categoría y obligación. | Política aprobada y pruebas de ciclo de vida. |
| NFR-PRV-007 | Consentimientos y documentos institucionales aceptados deben versionarse. | Evidencia de texto, versión, actor, instante y contexto. |
| NFR-PRV-008 | Las exportaciones deben minimizar columnas, expirar y conservar trazabilidad. | Pruebas de permisos, caducidad y descarga. |
| NFR-PRV-009 | Entornos no productivos usarán exclusivamente datos sintéticos o anonimizados de forma aprobada. | Control de carga y revisión periódica. |
| NFR-PRV-010 | Debe existir un proceso futuro para solicitudes de acceso, rectificación o eliminación. | SLA, responsables y evidencia por definir con asesoría. |

## Archivos

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-FIL-001 | Objetos privados, segregados lógicamente por tenant y no servidos directamente desde rutas públicas. | Pruebas de acceso cruzado y configuración del almacenamiento. |
| NFR-FIL-002 | URLs firmadas deben ser breves, de propósito limitado y emitidas después de autorización. | Pruebas de expiración, reutilización y revocación práctica. |
| NFR-FIL-003 | Cargas pasan por límites, validación de firma real, nombre seguro y cuarentena. | Conjunto de archivos maliciosos y formatos engañosos. |
| NFR-FIL-004 | El escaneo antimalware es obligatorio como capacidad; proveedor y modo son decisión arquitectónica. | EICAR/control equivalente, fallos cerrados y métricas. |
| NFR-FIL-005 | Archivos no deben procesarse activamente ni permitir macros o contenido ejecutable por defecto. | Política de formatos y sandbox de procesamiento. |
| NFR-FIL-006 | Versiones reemplazadas siguen la política de retención y no son visibles por enlaces antiguos. | Pruebas de versión y ciclo de vida. |

## Aislamiento multiempresa

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-TEN-001 | Toda entidad institucional posee pertenencia a tenant explícita o derivable sin ambigüedad. | Revisión de modelo y constraints en arquitectura futura. |
| NFR-TEN-002 | Consultas, trabajos asíncronos, cachés, índices, archivos y telemetría preservan contexto de tenant. | Pruebas end-to-end y de componentes. |
| NFR-TEN-003 | Un rol de plataforma no obtiene acceso implícito a contenido institucional. | Flujo de soporte justificado y temporal. |
| NFR-TEN-004 | Un fallo de filtro no debe convertirse en fuga transversal; se requieren defensas en profundidad. | Pruebas deliberadas de omisión de contexto y revisión arquitectónica. |
| NFR-TEN-005 | Backups, restauraciones y exportaciones consideran aislamiento y alcance. | Simulacro de restauración y procedimientos aprobados. |

## Disponibilidad, integridad y resiliencia

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-REL-001 | No se debe perder un envío confirmado ni una aceptación de oferta. | Pruebas de fallo antes/después de confirmación y reconciliación. |
| NFR-REL-002 | Operaciones externas usan reintentos limitados, idempotencia y cola de errores observable. | Pruebas de duplicados, demora y caída externa. |
| NFR-REL-003 | Cupos y reservas mantienen invariantes bajo concurrencia. | Pruebas de carga focalizadas y consistencia. |
| NFR-REL-004 | Deben definirse RPO, RTO y objetivo de disponibilidad antes del piloto. | Aprobación de negocio y simulacro. |
| NFR-REL-005 | Cambios de configuración publicable deben ser versionados y recuperables. | Pruebas de publicación, rollback lógico y postulaciones históricas. |

## Rendimiento y escala

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-PER-001 | Definir volumen de tenants, usuarios, postulaciones, documentos y picos antes de seleccionar arquitectura. | Modelo de capacidad aprobado. |
| NFR-PER-002 | Establecer percentiles objetivo para carga, guardado, búsqueda, tableros y descarga. | Pruebas con datos sintéticos representativos. |
| NFR-PER-003 | Operaciones masivas y exportaciones no deben degradar el flujo familiar. | Límites, colas y pruebas de aislamiento de carga. |
| NFR-PER-004 | La UI debe comunicar cargas y reintentos sin producir dobles acciones. | Pruebas de latencia y redes inestables. |

## Accesibilidad y usabilidad

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-UX-001 | La experiencia debe ser utilizable en móvil y escritorio. | Matriz de dispositivos y pruebas responsivas por definir. |
| NFR-UX-002 | WCAG 2.2 nivel AA es el objetivo aprobado mediante D-009. | Auditoría automática y manual, teclado y lector de pantalla. |
| NFR-UX-003 | Formularios deben mostrar progreso, errores accionables y recuperación de borrador. | Pruebas con usuarios y escenarios de fallo. |
| NFR-UX-004 | Lenguaje de estado familiar debe ser claro y no revelar decisiones internas. | Revisión de contenido por institución. |
| NFR-UX-005 | Zona horaria, formato de fecha y canal deben ser consistentes por institución y usuario. | Casos de horario de verano y confirmaciones. |

## Observabilidad y auditoría

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-OBS-001 | Logs estructurados deben usar correlación y contexto seguro, sin payloads personales. | Revisión automatizada y muestreo. |
| NFR-OBS-002 | Métricas deben cubrir salud, seguridad, integración, colas y resultados operativos sin cardinalidad sensible. | Dashboard y alertas antes del piloto. |
| NFR-OBS-003 | Eventos de auditoría deben protegerse contra modificación y tener acceso restringido. | Controles de integridad y segregación. |
| NFR-OBS-004 | Relojes y marcas temporales deben ser consistentes. | Uso conceptual de UTC, sincronización y pruebas de zona horaria. |
| NFR-OBS-005 | Alertas deben tener propietario, severidad y procedimiento. | Ejercicios de respuesta. |

## Mantenibilidad y entrega

| ID | Requisito | Verificación futura |
| --- | --- | --- |
| NFR-MNT-001 | Límites de dominio y contratos deben ser explícitos y versionados. | Revisión de arquitectura y compatibilidad. |
| NFR-MNT-002 | Configuración no debe convertirse en código específico por colegio. | Pruebas con al menos dos tenants sintéticos. |
| NFR-MNT-003 | Cambios incluyen trazabilidad a requisito/ADR y pruebas proporcionales. | Plantilla y control de PR. |
| NFR-MNT-004 | Dependencias futuras requieren justificación, mantenimiento y análisis de riesgo. | Registro de decisión e inventario. |
| NFR-MNT-005 | Despliegues y migraciones futuras deben ser reversibles o tener plan de recuperación. | Ensayo previo y aprobación por etapa. |
| NFR-MNT-006 | La alineación con el stack vigente de EduPay debe evaluarse mediante ADR antes de scaffolding. | `ADR-0001` aceptado o rechazado con evidencia; no basta la preferencia operacional. |
| NFR-MNT-007 | Ninguna regla del piloto puede depender del nombre “Colegio Conquistadores”. | Configurar dos tenants sintéticos y revisar ausencia de condicionales institucionales. |

## Contexto tecnológico no vinculante

EduPay usa actualmente NestJS 11, TypeScript, Prisma 7, Passport JWT, Next.js 16 App Router, React 19, Tailwind CSS, Zod 4, React Hook Form, PostgreSQL 15, Swagger/OpenAPI 3.0, cPanel/Passenger y Docker Compose para PostgreSQL local. Es evidencia para `ADR-0001`, no un requisito no funcional ni una selección definitiva.

Siguen sin decidirse arquitectura de repositorios, archivos, correo, colas, integración, despliegue y arquitectura física multiempresa.

## Cumplimiento por validar

La jurisdicción, base jurídica, deberes especiales respecto de menores, transferencias internacionales, firma o aceptación electrónica y plazos legales no se infieren en este documento. Requieren validación legal y contractual antes de producción.
