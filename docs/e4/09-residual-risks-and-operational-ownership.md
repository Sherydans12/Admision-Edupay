# E4-E — Riesgos residuales y ownership operacional

## Resultado de clasificación

### BLOCKING_G4

**Ninguno identificado.** La PoC tenant/RLS/Prisma, aislamiento multiempresa, sesiones,
autorización, scans, deployment smoke local, recovery sintético, reproducibilidad,
alcance MVP, criterios de salida y ownership técnico tienen evidencia para revisión.

Esta clasificación no convierte el paquete en aprobación: G4 continúa `NO APROBADA` y
requiere decisión humana explícita.

### BLOCKING_G5

- `C-013` legal/privacy y los fundamentos, propósito, acceso, retención, eliminación y
  atención de solicitudes antes de datos reales.
- autorización explícita para usar datos reales y para cualquier piloto.
- implementación funcional P0 y evidencia de sus criterios críticos de aceptación.
- controles operacionales productivos y recuperación revalidada antes de pilotar.
- ownership legal/normativo e incident response productivo aún no confirmados (`Q-205`).

### DEFERRED_TO_E5

- construcción funcional del MVP P0: familias, estudiantes, postulaciones, formularios,
  documentos, revisión, entrevistas, diagnóstico, recomendación, decisión, cupos,
  waitlist, oferta y comunicaciones funcionales;
- adapters funcionales de email y sus políticas de entrega/error;
- workflow de documentos privados y adapters de object storage/malware;
- sinks durables de `AuditSink` y `SecurityEventSink` para la operación funcional;
- APIs, UI, jobs y pruebas funcionales del recorrido aprobado;
- concurrencia, accesibilidad y comunicaciones del MVP como evidencia de salida.

No se marca como bloqueo G4 porque la fundación actual permite construir esas capacidades
con las fronteras y controles previstos.

### PRODUCTION_READINESS

- secretos productivos, gestión/rotación y recuperación de configuración;
- TLS, reverse proxy, dominios, balanceo y configuración multi-instancia;
- estrategia CSRF stateless/compartida para múltiples instancias, si el despliegue la requiere;
- proveedor y región de PostgreSQL/object storage/email/malware;
- backup provider, cifrado, retención, eliminación y restore auditado;
- monitorización, alerting, logs/telemetría, runbooks y soporte;
- revalidación RPO/RTO, capacidad, escalamiento y pruebas de carga;
- deployment productivo y aceptación operacional;
- `Q-301..Q-309` y la integración técnica EduPay en E7/G7;
- validación legal/privacy y autorización de datos reales.

### ACCEPTED_TECHNICAL_DEBT

- migraciones forward-only; no se inventan down migrations ni rollback automático de Prisma;
- credenciales sintéticas del Compose local, únicamente para development;
- heartbeat y probe worker sin jobs de negocio;
- smoke de E4 separado de contratos funcionales y de proveedores productivos;
- CSRF actual orientado al proceso local/development; multi-instancia queda condicionado
  a la decisión de deployment posterior.

## Ownership operacional

La fuente aprobada identifica al propietario funcional y técnico en
[`docs/00-vision-scope.md`](../00-vision-scope.md) y [`docs/01-source-analysis.md`](../01-source-analysis.md).
Para minimizar exposición de datos personales, este documento no duplica el nombre y
usa el rol como referencia trazable.

| Responsabilidad | Owner actual | Estado para G4 | Evidencia / límite |
| --- | --- | --- | --- |
| desarrollo técnico | propietario técnico registrado en fuente aprobada | `OWNER_CONFIRMED_BY_APPROVED_SOURCE` | G1/G2/G3 y ADR-0001..0005 |
| seguridad técnica | propietario técnico registrado en fuente aprobada | `OWNER_CONFIRMED_BY_APPROVED_SOURCE` | E4-C/D, `docs/e4/06-e4-security-evidence.md` |
| PostgreSQL y migrations | propietario técnico registrado en fuente aprobada | `OWNER_CONFIRMED_BY_APPROVED_SOURCE` | bootstrap, Prisma migrations, PoC RLS |
| CI y scans | propietario técnico registrado en fuente aprobada | `OWNER_CONFIRMED_BY_APPROVED_SOURCE` | `.github/workflows/e4-foundation.yml` |
| aprobación de cambios | aprobador humano según compuertas; owner técnico prepara evidencia | `OWNER_CONFIRMED_BY_APPROVED_SOURCE` | G1/G2/G3; G4 queda pendiente |
| incident response local/development | propietario técnico registrado en fuente aprobada | `OWNER_CONFIRMED_BY_APPROVED_SOURCE` | alcance E4; no es on-call productivo |
| incident response productivo/legal | responsable por confirmar | `OWNER_CONFIRMATION_REQUIRED` | Q-205 y C-013; no bloquea construir E5 |
| backup/restore productivo | responsable/proveedor por confirmar | `OWNER_CONFIRMATION_REQUIRED` | recovery de E4 es sintético solamente |

Una misma persona puede cubrir las responsabilidades técnicas durante E4. La tabla no
crea un equipo ficticio ni designa un owner productivo no confirmado.

## Preguntas y condiciones que permanecen abiertas

- `C-013` y cualquier autorización de datos reales;
- proveedor de email, object storage y malware scanner real;
- sinks durables de auditoría y seguridad;
- secretos, TLS, reverse proxy, monitoring y alerting productivos;
- backup provider, retención y revalidación RPO/RTO;
- capacidad, escala, proveedor/región y deployment productivo;
- `Q-301..Q-309` para E7/G7;
- confirmación de incident response productivo/legal (`Q-205`).

## Recomendación de compuerta

Con los bloqueantes G4 en cero, el paquete puede pasar a revisión humana como
`PASS_WITH_DEFERRED`. La decisión solicitada es autorizar o no la construcción E5 dentro
del alcance documentado; no es una autorización de lanzamiento.
