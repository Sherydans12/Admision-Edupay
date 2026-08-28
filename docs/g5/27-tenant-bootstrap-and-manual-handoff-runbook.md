# G5-P1/P2 — Bootstrap de tenant y límite manual de matrícula

## 1. Alcance y estado

Este runbook cubre exclusivamente el onboarding técnico inicial de un tenant y su primer
administrador sobre los modelos existentes. El bootstrap no crea una migración, no incorpora datos
institucionales al código y no conecta Admisión con EduPay.

| Elemento | Estado |
| --- | --- |
| P1/P2 con fixtures sintéticos | `AUTHORIZED` |
| Datos, cuentas, destinatarios o documentos reales | `NOT AUTHORIZED` |
| Tenant/configuración codificados por nombre de colegio | `PROHIBITED` |
| Migration 21 para controles de email | `AUTHORIZED / IMPLEMENTED / SYNTHETIC ONLY` |
| Integración técnica o importación desde EduPay | `NOT AUTHORIZED` |
| Piloto y producción real | `NOT AUTHORIZED` |

El servicio usa `tenantCode` normalizado como clave operativa estable y deriva IDs
deterministas. El esquema actual no posee una columna `tenantCode`; por eso el mapeo entre
el código operativo y el tenant debe conservarse en el registro operacional restringido.
Cambiar el código crea otra identidad lógica y no es una operación de renombre.

## 2. Precondiciones

1. Las migraciones autorizadas hasta Migration 21 están aplicadas.
2. `DATABASE_APP_URL` referencia el rol de aplicación, no una cuenta superuser.
3. El administrador ya completó el registro normal de cuenta.
4. La cuenta está `ACTIVE` y posee `emailVerifiedAt`; el bootstrap nunca crea, activa ni
   omite la verificación de una identidad.
5. Para P1/P2, el correo y todo valor usado son íntegramente sintéticos.
6. El operador registró una ventana, propósito y evidencia de ejecución sin guardar
   secretos ni datos personales en Git, logs públicos o tickets abiertos.

## 3. Ejecución sintética

Definir las variables en la consola one-shot de Coolify o en una sesión administrativa
equivalente. No incorporarlas a la imagen ni al repositorio:

```text
TENANT_BOOTSTRAP_CODE=synthetic-school
TENANT_BOOTSTRAP_NAME=Synthetic School
TENANT_BOOTSTRAP_ADMIN_EMAIL=admin.synthetic@example.invalid
TENANT_BOOTSTRAP_CONFIRM=synthetic-school
```

`TENANT_BOOTSTRAP_CONFIRM` debe coincidir exactamente con el código normalizado. En
preproducción Coolify, ejecutar explícitamente el servicio one-shot con el perfil
`bootstrap` desde el directorio del Compose desplegado:

```bash
docker compose --profile bootstrap run --rm tenant-bootstrap
```

El servicio está excluido de `docker compose up -d` normal. Sólo se crea cuando el
operador invoca el perfil y se detiene al terminar; no debe dejarse configurado como un
servicio permanente. Después de una ejecución exitosa, eliminar las cuatro variables
one-shot del entorno de Coolify y conservar únicamente la evidencia sanitizada.

La salida contiene únicamente IDs técnicos, `tenantCode` y flags `created`; no imprime el
correo. En la primera ejecución los cuatro flags deben ser `true`. Una repetición con los
mismos valores devuelve los mismos IDs y los flags en `false`.

La ejecución falla cerrada cuando:

- la cuenta no existe, no está activa o su correo no está verificado;
- `tenantCode`, nombre o correo no cumplen validación;
- el mismo código presenta otro nombre;
- la membresía o el rol determinista existen con estado o permisos incompatibles.

No se corrige ni reactiva silenciosamente un estado conflictivo. El operador debe revisar
la auditoría y resolverlo mediante un procedimiento separado y aprobado.

## 4. Resultado y mínimo privilegio

El bootstrap crea como una única operación transaccional e idempotente:

1. `Tenant` activo;
2. `Membership` activa entre la cuenta verificada y el tenant;
3. `RoleAssignment` `institution_admin.bootstrap` con scope `*`;
4. `AuditEvent` append-only `TENANT_ADMIN_BOOTSTRAPPED`.

El rol inicial permite configurar tenant, formularios, requisitos, actividades, cupos,
reportes, auditoría y delegar sólo el subconjunto de capacidades que ya posee.
Deliberadamente no concede decisión, recomendación, lectura de datos restringidos,
habilitación de categorías sensibles, procesamiento de casos ni elevación de soporte
global. Las funciones operativas requieren cuentas y asignaciones separadas mediante un
procedimiento de provisión posterior expresamente aprobado; este bootstrap no lo
sustituye.

Después del bootstrap, la configuración se carga mediante superficies tenant-scoped:
sede, año, niveles, proceso, ofertas, capacidad, calendario, formulario, requisitos,
actividades, ejecutores y roles. Ningún valor depende del nombre del colegio.

## 5. Verificación y reversión

Verificar:

- un solo tenant para el código operativo registrado;
- una sola membresía y un solo rol bootstrap;
- auditoría `TENANT_ADMIN_BOOTSTRAPPED` con actor, tenant y recursos esperados;
- resolución normal del contexto tenant para la cuenta;
- ausencia de permisos `application.decide`, `application.recommend`,
  `admission.sensitive_processing.configure`, `restricted.read` y
  `platform.support.elevate`.

No existe borrado automático. Si una ejecución sintética debe revertirse, se usa un
procedimiento de eliminación de ambiente completo o uno específicamente aprobado para el
tenant sintético. Nunca se ejecuta una limpieza destructiva sobre una base con datos
reales ni sobre un target no verificado.

## 6. Operación desacoplada hasta matrícula pendiente

Admisión puede operar sin consultar EduPay durante:

1. publicación de ofertas;
2. registro familiar y postulación;
3. formulario, documentos y correcciones;
4. entrevista y evaluación;
5. recomendación y decisión;
6. reserva, oferta y aceptación familiar.

Al aceptar una oferta, el límite local puede registrar `IntegrationHandoff` con estado
`REQUESTED`. Operacionalmente significa **oferta aceptada / matrícula pendiente**. No
significa entrega a EduPay, creación de estudiante, deuda, pago ni matrícula confirmada.

Para P1/P2 el flujo termina allí y sólo usa fixtures sintéticos. No se importan alumnos,
cursos, apoderados ni documentos desde EduPay y no se exporta un payload hacia ese
sistema.

Antes de cualquier handoff real, incluso manual, deben aprobarse finalidad, base de
tratamiento, payload mínimo, responsables, canal seguro, acuse, estados, cancelación y
reconciliación. Esto mantiene abiertas `Q-301..Q-309` y la compuerta E7/G7. Un operador no
puede convertir `REQUESTED` en matrícula ni comunicar datos a EduPay por fuera de una
autorización formal.

## 7. Evidencia técnica

La suite focal `tenant-bootstrap.integration.spec.ts` demuestra:

- creación e idempotencia de tenant, membresía, rol y auditoría;
- permisos iniciales mínimos y ausencia de elevación/decisión;
- rechazo de cuenta ausente o correo no verificado;
- conflicto fail-closed ante reutilización incompatible de `tenantCode`;
- validación y normalización del código sin referencias institucionales hardcodeadas.
