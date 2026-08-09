# E4-E — Recovery evidence

## Objetivo y alcance

Demostrar backup y restore reproducibles con datos sintéticos, una base fuente y una
base de recuperación separada. El procedimiento es exclusivamente local/development y
no selecciona proveedor, región, retención ni SLA productivo.

RPO `1 hora` y RTO `4 horas` siguen siendo **INITIAL TECHNICAL TARGETS**. El tiempo
observado en esta máquina no demuestra esos objetivos ni constituye un compromiso
operacional.

## Estrategia probada

Se probó la estrategia **A: recrear schema mediante migrations y restaurar datos**:

1. levantar PostgreSQL fuente y PostgreSQL recovery con volúmenes distintos;
2. inicializar roles y permisos sintéticos mediante el bootstrap existente;
3. aplicar las migraciones forward a ambas bases;
4. insertar un fixture sintético en la fuente;
5. crear un dump lógico de schema/datos con `pg_dump` en un archivo temporal;
6. restaurarlo con `psql` en la base recovery limpia;
7. comprobar fingerprints, ownership, RLS y comportamiento fail-closed.

Git y `packages/database/prisma/migrations` son la fuente de verdad del schema. El
backup protege los datos de la instancia; no reemplaza versionado, revisión ni aplicación
de migrations. No se implementaron dos sistemas de backup.

## Procedimiento reproducible

```bash
pnpm e4:recovery:smoke
```

El script usa `compose.e4-recovery.yaml`, crea un proyecto Compose dedicado y elimina
sus volúmenes al finalizar. Internamente ejecuta el equivalente seguro de:

- `docker compose up` para `source` y `recovery`;
- `prisma migrate deploy` en ambas bases;
- inserción de fixture de control-plane y dos tenants;
- inserción de filas tenant-owned bajo contextos A y B;
- `pg_dump` lógico de la fuente;
- `psql` hacia la base recovery;
- consultas de conteos, policies, roles y aislamiento;
- `docker compose down --volumes --remove-orphans`.

No hay passwords en este documento. Las credenciales del ejercicio son sintéticas,
locales al script/Compose y no son reutilizables fuera de development.

## Synthetic fixture

El fixture contiene únicamente identificadores y correos `.invalid` sintéticos:

- control-plane: dos usuarios plataforma y dos tenants;
- tenant A y tenant B;
- memberships y role assignments de cada tenant;
- una elevación de soporte de tenant A;
- filas de outbox para A y B;
- registros probe tenant-owned para A y B.

No contiene postulantes, estudiantes, apoderados reales, documentos reales ni información
funcional de admisión.

## Resultados REC-01..REC-08

| ID | Evidencia | Resultado |
| --- | --- | --- |
| REC-01 | `pg_dump` sintético creado, tamaño observado `27723` bytes | PASS |
| REC-02 | restore en PostgreSQL recovery limpio y aislado | PASS |
| REC-03 | conteos/fingerprint esperados coinciden después del restore | PASS |
| REC-04 | roles, ownership y policies necesarias permanecen operativas | PASS |
| REC-05 | `admission_app` continúa sin superuser y sin `BYPASSRLS` | PASS |
| REC-06 | cross-tenant permanece DENY después del restore | PASS |
| REC-07 | sin tenant context permanece fail-closed después del restore | PASS |
| REC-08 | tiempo real del ejercicio registrado | PASS |

## Tiempo observado

El ejercicio final observado duró `31.807 s` (`31807 ms`) y terminó con
`RECOVERY_SMOKE=PASS`. Este valor es sólo una observación local para esta fixture y esta
configuración; no es RTO productivo.

## Qué fue restaurado

Se restauraron schema lógico y datos sintéticos de las tablas de control-plane y
tenant-owned creadas por las migrations actuales. Los roles de cluster y el bootstrap
se recrearon previamente en la base recovery; no se afirma que un dump lógico sea un
backup completo de cluster PostgreSQL.

El dump se ejecuta con el rol de bootstrap local porque las tablas tenant-owned tienen
`FORCE ROW LEVEL SECURITY`; el rol migrator no puede leer todos los tenants para producir
el backup. El rol app nunca se usa para backup, no recibe privilegios elevados y conserva
`superuser=false` y `bypassrls=false`.

## Validación posterior a restore

Después del restore se comprobó que:

- el rol app puede observar sólo el tenant del contexto activo;
- el tenant contrario no es visible;
- sin `admission.tenant_id` no hay filas visibles;
- policies y force-RLS permanecen presentes;
- el ownership necesario sigue en el rol migrator;
- la base recovery no comparte volumen con la fuente.

## Límites y tareas pendientes para producción

- seleccionar proveedor de backup y región;
- definir cifrado, retención, eliminación y restauración auditada;
- revalidar RPO/RTO con infraestructura real y carga representativa;
- demostrar restauración de secretos/configuración sin exponerlos;
- definir monitorización, alertas, runbooks y owner de incident response;
- verificar backups de object storage privado y malware/quarantine cuando E5 los implemente;
- ejecutar una prueba autorizada de producción antes de cualquier piloto.

G4 no autoriza ninguna de esas tareas productivas ni el uso de datos reales.
