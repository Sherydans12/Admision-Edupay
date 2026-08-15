# G5-LP1 — Matriz de acceso, exportación y derechos

## Alcance y lectura

| Campo | Estado |
| --- | --- |
| Paquete | `G5-LP1 / DOCUMENTARY + SYSTEM INVENTORY ONLY` |
| Resultado | `G5-EXIT-11 = BLOCKED / LEGAL_DECISIONS_REQUIRED` |
| G5 | `NO APROBADA / NOT REQUESTED` |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |
| Naturaleza | Matriz factual del runtime; no es aprobación legal de acceso |

La matriz refleja autorización técnica observada en `permission-catalog.ts`,
`authorization.ts`, `request-context.service.ts`, servicios, controladores y pruebas. El
runtime no tiene un catálogo semántico cerrado de roles: `roleKey` es un identificador
validado, pero no concede capacidades por sí mismo. Por ello, los nombres operativos se
tratan como perfiles funcionales de referencia y `CONDITIONAL` significa que la acción
depende de una asignación explícita de permiso, scope, sensibilidad, purpose, tenant y,
cuando corresponde, separación de funciones.

Valores de acceso: `ALLOWED`, `DENIED`, `CONDITIONAL`, `NOT_IMPLEMENTED`.

- `NOT_IMPLEMENTED` significa que no existe esa operación para la categoría en el
  runtime; no equivale a una decisión legal de negar un derecho.
- `AUDIT_ACCESS` indica lectura de `AuditEvent`, no que el actor tenga autorización para
  leer el dato de negocio.
- `PURPOSE_REQUIRED`, `ELEVATION_REQUIRED` y `AUDITED` son indicadores técnicos, no
  conclusiones jurídicas.

## Roles/capacidades observados

| ROLE_ID | Perfil | Evidencia/runtime |
| --- | --- | --- |
| R01 | Family user | `FamilyExecutionContext` y `FAMILY_CAPABILITIES` en `request-context.service.ts`; ownership familiar obligatorio |
| R02 | Secretariat | Fixtures `secretary`/`SYNTHETIC_E5C_SECRETARY`; capacidades operativas sólo si se asignan |
| R03 | Admissions responsible | Fixtures `recommender` y capacidades `application.recommend`, comunicaciones, capacidad/espera según pruebas |
| R04 | Evaluator | Capacidades `activity.perform`, `activity.result.read`, `activity.repeat` y `activity.read` en suites de actividades |
| R05 | Direction | Fixture `direction` y capacidad `application.decide`; separación de funciones con recomendador |
| R06 | Institutional Admin | No existe enum de rol; corresponde a una membership con permisos de administración explícitos |
| R07 | Institutional Maximum Admin | Capacidad funcional definida en E1; el runtime no la materializa como roleKey fijo, por lo que se marca `CONDITIONAL` |
| R08 | Platform Superadmin | `requirePlatformContext`, `globalSuperadmin` y capacidades globales; no crea tenant context automáticamente |
| R09 | Support elevation | Contexto temporal creado por `SupportElevationService`; no es un permiso permanente ni una persona adicional |

## Categorías de acceso

| ACCESS_ID | DATA_CATEGORY | DATA_IDS |
| --- | --- | --- |
| A01 | Identidad, challenges y sesiones | DPI-001, DPI-002, DPI-003 |
| A02 | Memberships y asignaciones de rol | DPI-004 |
| A03 | Perfil familiar y canal de contacto | DPI-005 |
| A04 | Identidad del estudiante | DPI-006 |
| A05 | Oferta, proceso, sede y curso | DPI-007 |
| A06 | Postulación, snapshot y estado | DPI-008 |
| A07 | Formularios y respuestas ordinarias | DPI-009, DPI-010 |
| A08 | PIE/NEE y respuestas `highly_restricted` | DPI-011 |
| A09 | Requisitos, submissions y revisiones documentales | DPI-012, DPI-013 |
| A10 | Bytes, versiones y metadata técnica de documentos | DPI-014 |
| A11 | Evidencia de postulación asistida | DPI-015 |
| A12 | Configuración, citas y cambios de actividades | DPI-016 |
| A13 | Intentos y resultados de actividad/diagnóstico | DPI-017 |
| A14 | Recomendación y decisión de Dirección | DPI-018, DPI-019 |
| A15 | Capacidad, espera, oferta y aceptación | DPI-020 |
| A16 | Comunicaciones y contactos manuales | DPI-021 |
| A17 | Auditoría | DPI-022 |
| A18 | SecurityEvent y logs/metrics operacionales | DPI-023, DPI-024 |
| A19 | Elevación de soporte | DPI-025 |
| A20 | Reportes y CSV | DPI-026 |
| A21 | Functional handoff local | DPI-027 |

## Matriz técnica

`PURPOSE_REQUIRED=YES` en toda ruta de tenant que el runtime autoriza; `ELEVATION_REQUIRED=YES`
indica que un Superadmin global debe crear una elevación explícita antes de acceder al
contenido tenant. `AUDITED=YES` significa que la acción autorizada tiene evidencia de
auditoría o está definida para generarla; no significa que cada lectura familiar se
audite.

| ACCESS_ID | DATA_CATEGORY | ROLE | READ | WRITE | DOWNLOAD | EXPORT | DECIDE | AUDIT_ACCESS | SUPPORT_ACCESS | PURPOSE_REQUIRED | ELEVATION_REQUIRED | AUDITED |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | Identidad/challenges/sesiones | R01 Family user | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A01 | Identidad/challenges/sesiones | R02 Secretariat | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A01 | Identidad/challenges/sesiones | R03 Admissions responsible | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A01 | Identidad/challenges/sesiones | R04 Evaluator | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A01 | Identidad/challenges/sesiones | R05 Direction | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A01 | Identidad/challenges/sesiones | R06 Institutional Admin | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A01 | Identidad/challenges/sesiones | R07 Institutional Maximum Admin | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A01 | Identidad/challenges/sesiones | R08 Platform Superadmin | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A01 | Identidad/challenges/sesiones | R09 Support elevation | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A02 | Memberships/roles | R01 Family user | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A02 | Memberships/roles | R02 Secretariat | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A02 | Memberships/roles | R03 Admissions responsible | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A02 | Memberships/roles | R04 Evaluator | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A02 | Memberships/roles | R05 Direction | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A02 | Memberships/roles | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A02 | Memberships/roles | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A02 | Memberships/roles | R08 Platform Superadmin | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A02 | Memberships/roles | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A03 | Family profile/contact | R01 Family user | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A03 | Family profile/contact | R02 Secretariat | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A03 | Family profile/contact | R03 Admissions responsible | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A03 | Family profile/contact | R04 Evaluator | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A03 | Family profile/contact | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A03 | Family profile/contact | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A03 | Family profile/contact | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A03 | Family profile/contact | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A03 | Family profile/contact | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A04 | Student identity | R01 Family user | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A04 | Student identity | R02 Secretariat | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A04 | Student identity | R03 Admissions responsible | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A04 | Student identity | R04 Evaluator | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A04 | Student identity | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A04 | Student identity | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A04 | Student identity | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A04 | Student identity | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A04 | Student identity | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A05 | Offering/process/course | R01 Family user | ALLOWED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A05 | Offering/process/course | R02 Secretariat | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A05 | Offering/process/course | R03 Admissions responsible | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A05 | Offering/process/course | R04 Evaluator | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A05 | Offering/process/course | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A05 | Offering/process/course | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A05 | Offering/process/course | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A05 | Offering/process/course | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A05 | Offering/process/course | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A06 | Application/snapshot/status | R01 Family user | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A06 | Application/snapshot/status | R02 Secretariat | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A06 | Application/snapshot/status | R03 Admissions responsible | ALLOWED | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A06 | Application/snapshot/status | R04 Evaluator | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A06 | Application/snapshot/status | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A06 | Application/snapshot/status | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A06 | Application/snapshot/status | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A06 | Application/snapshot/status | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A06 | Application/snapshot/status | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A07 | Forms/ordinary answers | R01 Family user | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A07 | Forms/ordinary answers | R02 Secretariat | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A07 | Forms/ordinary answers | R03 Admissions responsible | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A07 | Forms/ordinary answers | R04 Evaluator | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A07 | Forms/ordinary answers | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A07 | Forms/ordinary answers | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A07 | Forms/ordinary answers | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A07 | Forms/ordinary answers | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A07 | Forms/ordinary answers | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A08 | PIE/NEE restricted answers | R01 Family user | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A08 | PIE/NEE restricted answers | R02 Secretariat | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A08 | PIE/NEE restricted answers | R03 Admissions responsible | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A08 | PIE/NEE restricted answers | R04 Evaluator | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A08 | PIE/NEE restricted answers | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A08 | PIE/NEE restricted answers | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A08 | PIE/NEE restricted answers | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A08 | PIE/NEE restricted answers | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A08 | PIE/NEE restricted answers | R09 Support elevation | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A09 | Requirements/submissions/reviews | R01 Family user | ALLOWED | CONDITIONAL | ALLOWED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A09 | Requirements/submissions/reviews | R02 Secretariat | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A09 | Requirements/submissions/reviews | R03 Admissions responsible | ALLOWED | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A09 | Requirements/submissions/reviews | R04 Evaluator | CONDITIONAL | DENIED | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A09 | Requirements/submissions/reviews | R05 Direction | CONDITIONAL | DENIED | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A09 | Requirements/submissions/reviews | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A09 | Requirements/submissions/reviews | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A09 | Requirements/submissions/reviews | R08 Platform Superadmin | DENIED | DENIED | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A09 | Requirements/submissions/reviews | R09 Support elevation | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A10 | Document bytes/versions | R01 Family user | ALLOWED | ALLOWED | ALLOWED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A10 | Document bytes/versions | R02 Secretariat | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A10 | Document bytes/versions | R03 Admissions responsible | ALLOWED | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A10 | Document bytes/versions | R04 Evaluator | CONDITIONAL | DENIED | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A10 | Document bytes/versions | R05 Direction | CONDITIONAL | DENIED | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A10 | Document bytes/versions | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A10 | Document bytes/versions | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A10 | Document bytes/versions | R08 Platform Superadmin | DENIED | DENIED | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A10 | Document bytes/versions | R09 Support elevation | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A11 | Assisted intake evidence | R01 Family user | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A11 | Assisted intake evidence | R02 Secretariat | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A11 | Assisted intake evidence | R03 Admissions responsible | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A11 | Assisted intake evidence | R04 Evaluator | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A11 | Assisted intake evidence | R05 Direction | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A11 | Assisted intake evidence | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A11 | Assisted intake evidence | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A11 | Assisted intake evidence | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A11 | Assisted intake evidence | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A12 | Activity setup/appointments | R01 Family user | ALLOWED | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A12 | Activity setup/appointments | R02 Secretariat | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A12 | Activity setup/appointments | R03 Admissions responsible | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A12 | Activity setup/appointments | R04 Evaluator | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A12 | Activity setup/appointments | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A12 | Activity setup/appointments | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A12 | Activity setup/appointments | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A12 | Activity setup/appointments | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A12 | Activity setup/appointments | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A13 | Activity attempts/results | R01 Family user | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A13 | Activity attempts/results | R02 Secretariat | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A13 | Activity attempts/results | R03 Admissions responsible | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A13 | Activity attempts/results | R04 Evaluator | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A13 | Activity attempts/results | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A13 | Activity attempts/results | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A13 | Activity attempts/results | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A13 | Activity attempts/results | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A13 | Activity attempts/results | R09 Support elevation | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A14 | Recommendation/decision | R01 Family user | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | NO |
| A14 | Recommendation/decision | R02 Secretariat | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | NO |
| A14 | Recommendation/decision | R03 Admissions responsible | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | YES |
| A14 | Recommendation/decision | R04 Evaluator | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | NO |
| A14 | Recommendation/decision | R05 Direction | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | ALLOWED | DENIED | DENIED | YES | NO | YES |
| A14 | Recommendation/decision | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | CONDITIONAL | CONDITIONAL | DENIED | YES | NO | YES |
| A14 | Recommendation/decision | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | CONDITIONAL | CONDITIONAL | DENIED | YES | NO | YES |
| A14 | Recommendation/decision | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | ALLOWED | YES | YES | YES |
| A14 | Recommendation/decision | R09 Support elevation | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | CONDITIONAL | CONDITIONAL | ALLOWED | YES | YES | YES |
| A15 | Capacity/waitlist/offer | R01 Family user | ALLOWED | CONDITIONAL | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | YES |
| A15 | Capacity/waitlist/offer | R02 Secretariat | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | YES |
| A15 | Capacity/waitlist/offer | R03 Admissions responsible | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | YES |
| A15 | Capacity/waitlist/offer | R04 Evaluator | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | NO |
| A15 | Capacity/waitlist/offer | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | DENIED | YES | NO | YES |
| A15 | Capacity/waitlist/offer | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | CONDITIONAL | CONDITIONAL | DENIED | YES | NO | YES |
| A15 | Capacity/waitlist/offer | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | CONDITIONAL | CONDITIONAL | DENIED | YES | NO | YES |
| A15 | Capacity/waitlist/offer | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | DENIED | ALLOWED | YES | YES | YES |
| A15 | Capacity/waitlist/offer | R09 Support elevation | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | CONDITIONAL | CONDITIONAL | ALLOWED | YES | YES | YES |
| A16 | Communications/contacts | R01 Family user | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A16 | Communications/contacts | R02 Secretariat | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A16 | Communications/contacts | R03 Admissions responsible | ALLOWED | ALLOWED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A16 | Communications/contacts | R04 Evaluator | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A16 | Communications/contacts | R05 Direction | CONDITIONAL | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A16 | Communications/contacts | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A16 | Communications/contacts | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A16 | Communications/contacts | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A16 | Communications/contacts | R09 Support elevation | CONDITIONAL | CONDITIONAL | CONDITIONAL | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A17 | Audit events | R01 Family user | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A17 | Audit events | R02 Secretariat | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A17 | Audit events | R03 Admissions responsible | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A17 | Audit events | R04 Evaluator | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A17 | Audit events | R05 Direction | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A17 | Audit events | R06 Institutional Admin | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A17 | Audit events | R07 Institutional Maximum Admin | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A17 | Audit events | R08 Platform Superadmin | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A17 | Audit events | R09 Support elevation | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A18 | Security/events/logs/metrics | R01 Family user | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A18 | Security/events/logs/metrics | R02 Secretariat | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A18 | Security/events/logs/metrics | R03 Admissions responsible | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A18 | Security/events/logs/metrics | R04 Evaluator | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A18 | Security/events/logs/metrics | R05 Direction | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A18 | Security/events/logs/metrics | R06 Institutional Admin | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A18 | Security/events/logs/metrics | R07 Institutional Maximum Admin | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A18 | Security/events/logs/metrics | R08 Platform Superadmin | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | NO | YES |
| A18 | Security/events/logs/metrics | R09 Support elevation | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A19 | Support elevation records | R01 Family user | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A19 | Support elevation records | R02 Secretariat | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A19 | Support elevation records | R03 Admissions responsible | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A19 | Support elevation records | R04 Evaluator | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A19 | Support elevation records | R05 Direction | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A19 | Support elevation records | R06 Institutional Admin | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A19 | Support elevation records | R07 Institutional Maximum Admin | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A19 | Support elevation records | R08 Platform Superadmin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | NO | YES |
| A19 | Support elevation records | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A20 | Reports/CSV | R01 Family user | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A20 | Reports/CSV | R02 Secretariat | CONDITIONAL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A20 | Reports/CSV | R03 Admissions responsible | ALLOWED | NOT_IMPLEMENTED | ALLOWED | ALLOWED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A20 | Reports/CSV | R04 Evaluator | DENIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A20 | Reports/CSV | R05 Direction | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A20 | Reports/CSV | R06 Institutional Admin | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A20 | Reports/CSV | R07 Institutional Maximum Admin | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A20 | Reports/CSV | R08 Platform Superadmin | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A20 | Reports/CSV | R09 Support elevation | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |
| A21 | Functional handoff | R01 Family user | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A21 | Functional handoff | R02 Secretariat | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A21 | Functional handoff | R03 Admissions responsible | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | YES |
| A21 | Functional handoff | R04 Evaluator | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A21 | Functional handoff | R05 Direction | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | DENIED | YES | NO | NO |
| A21 | Functional handoff | R06 Institutional Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A21 | Functional handoff | R07 Institutional Maximum Admin | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | DENIED | YES | NO | YES |
| A21 | Functional handoff | R08 Platform Superadmin | DENIED | DENIED | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | DENIED | ALLOWED | YES | YES | YES |
| A21 | Functional handoff | R09 Support elevation | CONDITIONAL | CONDITIONAL | NOT_IMPLEMENTED | DENIED | NOT_IMPLEMENTED | CONDITIONAL | ALLOWED | YES | YES | YES |

Total de combinaciones rol/categoría: **189** (`21` categorías de acceso × `9` perfiles).

## Superadmin global ≠ acceso implícito al tenant

Hecho confirmado: `globalSuperadmin=true` no crea un `TenantExecutionContext` ni permite
leer contenido institucional. `authorize()` devuelve `SUPERADMIN_REQUIRES_ELEVATION` cuando
un contexto global intenta acceder a un recurso tenant sin elevación.

Para contenido tenant, la elevación debe registrar y verificar:

- actor;
- tenant objetivo;
- purpose;
- scopes;
- categorías;
- motivo;
- inicio y expiración;
- cierre/revocación y resultado;
- auditoría/correlación.

El runtime implementa esta frontera mediante `SupportElevationService`,
`SupportElevation`, `getElevationContext()` y la cabecera de elevación validada por el
controller. No se modifica en G5-LP1.

### Discrepancias reales

1. **Role semantics:** `roleKey` no es un catálogo semántico; una asignación podría
   contener permisos incompatibles con el nombre operativo. La matriz describe el perfil
   funcional esperado y marca `CONDITIONAL` cuando el runtime deja la decisión a la
   asignación explícita.
2. **SecurityEvent:** el contrato existe, pero `app.module.ts` inyecta
   `NoopSecurityEventSink` en desarrollo. No se presenta como monitorización productiva.
3. **Derechos:** no existe un flujo general de solicitudes de titulares; las capacidades
   de lectura/corrección/exportación existentes son de operación del producto, no una
   respuesta formal a una solicitud.

## Soporte, exportación y auditabilidad

No se agregan permisos. La exportación implementada es el catálogo allowlisted de
`ReportingService`, con filtros tenant/scope, columnas declaradas, límite técnico, CSV
privado/no-store y auditoría de solicitud/resultado. La familia, Secretaría y Evaluador no
obtienen exportación masiva por defecto. La validación legal de columnas, destinatarios,
minimización y retención sigue pendiente.

`AuditEvent` y `SecurityEvent` son categorías separadas. `AuditEvent` es durable en la
configuración actual mediante `PrismaAuditSink`; `SecurityEvent` es un canal de detección
operacional cuyo destino productivo aprobado queda diferido a preprod.

## Rights gap

La matriz técnica no decide qué derechos aplican. El estado técnico por capacidad y las
acciones manuales están en la sección de derechos de `docs/g5/09-g5lp1-data-processing-inventory.md`;
la decisión requerida se registra en LP-007 a LP-015.
