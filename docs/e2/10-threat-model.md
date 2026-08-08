# Threat model

**Estado:** `PROPOSED / RECOMMENDED_FOR_G2`

**Método:** STRIDE complementado con privacidad, fraude operacional y abuso de negocio.

## Alcance y activos

Activos principales:

- identidades, sesiones y mecanismos de recuperación;
- datos de familias, estudiantes y postulaciones;
- PIE/NEE/salud y documentos restringidos;
- decisiones, cupos, reservas, lista de espera y ofertas;
- auditoría, exportaciones y elevaciones de soporte;
- archivos y URLs de acceso;
- secretos, backups, jobs y frontera EduPay.

Fronteras de confianza: navegador/API, tenant/plataforma, módulos internos, API/base de datos, cuarentena/storage, worker/proveedores y boundary futuro EduPay.

## Escala de riesgo residual

- **Alto:** necesita control o decisión antes de producción.
- **Medio:** controlado parcialmente; validar en E4/E5 y operación.
- **Bajo:** controles estándar suficientes, sujeto a regresión.

## Amenazas y controles

| STRIDE | Activo | Amenaza | Impacto | Controles propuestos | Riesgo residual | Validación |
|---|---|---|---|---|---|---|
| E/I | Recursos tenant | IDOR sobre caso/documento/oferta | Lectura o cambio ajeno | Autorización por recurso+tenant, IDs opacos, denegación uniforme, tests negativos | Medio | E4/E5 |
| E/I | Aislamiento | Tenant breakout por filtro ausente | Exposición masiva | tenant server-side, repositorios tenant-aware, constraints, RLS propuesto, pruebas cross-tenant | Medio | PoC E4; E4/E5 |
| E | Roles/permisos | Escalada horizontal o vertical | Decisión/exportación no autorizada | deny-by-default, memberships, scopes, SoD, auditoría y revisión | Medio | E3/E4/E5 |
| S | Cuenta | Account takeover | Control de familia/personal | verificación email, reset de un uso, revocación de sesiones, alertas | Medio | E4/E5 |
| S/D | Login | Credential stuffing | Secuestro/denegación | rate limits, bloqueo progresivo, detección, MFA por riesgo futura | Medio | E5/operación |
| S | Sesión | Robo/replay de sesión | Acceso persistente | cookie HttpOnly/Secure/SameSite, identificador opaco hasheado server-side, revocación y expiración | Medio | E4/E5 |
| T | Requests | CSRF | Acciones con sesión de víctima | SameSite, token/origin checks en mutaciones, no cambios por GET | Bajo-medio | E4/E5 |
| T/I | Portal | XSS almacenado/reflejado | Robo de sesión/contenido | escaping, CSP, sanitización, builder sin código arbitrario | Medio | E4/E5 |
| T/I | Datos | SQL injection | Fuga/corrupción | consultas parametrizadas/ORM, validación, mínimo privilegio DB | Bajo-medio | E4/E5 |
| T/D | Archivos | Upload malicioso o polyglot | Malware/ejecución/abuso | cuarentena, tamaño/MIME/firma, AV, storage privado, servir como attachment | Medio | E4/E5 |
| T | Archivos | Malware no detectado | Daño al operador/familia | firmas actualizadas, fail-closed, reescaneo/aislamiento, proceso de incidente | Medio | E5/operación |
| I/T | Fetch externo | SSRF por URL/importación | Acceso a red interna | no fetch arbitrario MVP, allowlist, egress restringido, bloqueo metadatos | Bajo-medio | E4/E5 |
| I | Objetos | Acceso directo inseguro a archivo | Exposición sensible | autorización previa, key aleatoria, bucket privado, URL corta y scoped | Medio | E4/E5 |
| I | URL firmada | Filtración/reuso | Descarga fuera de propósito | TTL corto, no log/referrer, revocación cuando posible, streaming para alta sensibilidad | Medio | E4/E5 |
| T/E | DTO/config | Mass assignment | Cambio de rol/tenant/estado | allowlist explícita, comandos por capacidad, campos server-owned | Bajo-medio | E4/E5 |
| I | Logs/errores | Sensitive logging | Fuga secundaria | redacción, allowlist, IDs opacos, acceso restringido y pruebas de logs | Medio | E4/E5 |
| I/E | Exportaciones | Exfiltración masiva | Fuga de datos/menores | permiso separado, minimización, step-up futuro, auditoría, límites y tarea controlada | Alto-medio | E3 decisión; E5 |
| E/R | Elevación | Abuso de SELF-ELEVATION | Acceso global injustificado | acción explícita, tenant/purpose/scope/categories/expiry, auditoría y alertas | Alto-medio | G2; E4/E5; operación |
| T/D | Capacidad | Race condition en último cupo | Sobreasignación | transacción, lock focalizado, constraints, idempotencia | Bajo-medio | E4/E5 (`AC-031`) |
| I/S | Registro/reset | Enumeración de email | Perfilado y ataque dirigido | respuestas uniformes, rate limit, timing controlado | Bajo-medio | E4/E5 |
| S/T | Identidad | Identidades duplicadas o relación falsa | Casos fragmentados/acceso indebido | Q-101/Q-102, verificación, revisión humana y auditoría | Medio | E4/E5 |
| I/T | Backups | Compromiso o restore no autorizado | Exposición/corrupción masiva | cifrado, acceso separado, inventario, restore controlado, retención legal | Medio-alto | Pre-piloto/operación |
| I/E | Secretos | Secret leakage en repo/log/runtime | Compromiso sistémico | gestor externo, escaneo, rotación, mínimos privilegios, no secretos cliente | Medio | E4/operación |
| R/T | Auditoría | Borrado/alteración de evidencia | Repudio y pérdida de trazabilidad | append-only aplicativo, permisos separados, backups, alertas; evolución inmutable | Medio | E4/E5 |
| D | Jobs | Duplicación o starvation | Email repetido, reservas no liberadas | claims/leases, idempotencia, métricas de edad, dead-letter/revisión | Bajo-medio | E4/E5 |
| S/T | Email callbacks | Webhook falso o repetido | Estado de comunicación incorrecto | firma, timestamp, deduplicación y tenant desde referencia interna | Medio | Etapa de proveedor |
| I/T | Boundary EduPay | Confundir handoff con matrícula | Estado falso o exposición | dominio separado, contrato futuro, idempotencia y estados no equivalentes | Medio | E7/G7 |

## Riesgos destacados

### SELF-ELEVATION

La autoelevación del único operador de plataforma está aprobada funcionalmente para el MVP, pero concentra riesgo. Arquitectura debe exigir intención explícita, justificación, tenant, propósito, categorías, alcance, expiración corta y auditoría visible. Alertas y revisión periódica reducen el riesgo; aprobación independiente para categorías altamente restringidas permanece como control futuro propuesto.

### Datos sensibles y legal

Los controles técnicos minimizan PIE/NEE/salud, pero no resuelven fundamento normativo, textos, retención, eliminación ni solicitudes de titulares. `C-013 / LEGAL_VALIDATION_PENDING` sigue siendo condición antes de datos reales/piloto productivo, no una conclusión de esta etapa.

### Disponibilidad

Ataques o fallos sobre worker, base, storage, email o DNS pueden degradar el proceso. Outbox, backups, health checks, límites y runbooks reducen impacto. RPO 1 hora y RTO 4 horas quedan registrados como objetivos técnicos iniciales y deben revalidarse con proveedor, volumen, costo y operación reales.

## Validación y mantenimiento

- Revisar el modelo en E3 cuando existan contratos y diagramas físicos.
- Convertir amenazas aplicables en pruebas de E4/E5.
- Ejecutar revisión antes de cada release y ante cambios en identidad, tenancy, archivos, exportaciones o integración.
- Registrar riesgo aceptado sólo mediante aprobación humana; este documento no acepta riesgos automáticamente.
