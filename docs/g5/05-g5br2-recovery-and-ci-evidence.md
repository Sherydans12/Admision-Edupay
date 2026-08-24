# G5-BR2 — Evidencia de recovery passwordless y Migration 16 en CI

## Resultado ejecutivo

La revisión acotada de `G5-BR2` selecciona:

`PATH A = RECOVERY_ALREADY_PRESENT / DIRECT_EVIDENCE_MISSING` al inicio de la
etapa, cerrado técnicamente mediante evidencia directa del runtime existente.

El flujo passwordless de `POST /auth/register` y `POST /auth/verify` ya satisface el
criterio conceptual aprobado de `FR-ID-002`: expiración, consumo único, no enumeración
y restauración de acceso. Para una cuenta `ACTIVE`, el registro no crea otra identidad;
emite un challenge nuevo por el mismo adapter de email y la verificación entrega una
nueva `PlatformSession` opaca mediante la política de sesión existente.

Esta conclusión no reabre `AC-001`, no agrega una política de credenciales, no selecciona
proveedor productivo, no resuelve `Q-106` ni `C-013`, y no aprueba G5.

## Control y fuentes

| Campo | Evidencia |
| --- | --- |
| HEAD de entrada | `a260d37b64f1d0947b60059258883e952bd748f1` |
| Rama | `feat/e5-mvp` |
| PR | `#8`, `OPEN / DRAFT / NO MERGE` |
| AC-001 | `IMPLEMENTED / TECHNICALLY REVIEWED` |
| G5-BR | `HARDENING_REQUIRED` al inicio; evidencia de esta etapa completada técnicamente |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |
| Fuentes | `FR-ID-001..005`, `UC-FAM-001/002`, especificación E1, `AC-001..003`, `BL-002`, E4 identity/session, G5-BR `03/04` |

`FR-ID-002` exige recuperación segura y define como criterio conceptual expiración,
single-use y no enumeración. `UC-FAM-002` además exige canal, respuesta uniforme, prueba
breve de un uso, acceso restaurado y sesiones según riesgo. La lectura de E4 confirma que
la sesión es un verificador opaco server-side, con hash SHA-256 persistido, expiración,
revocación y cookie `HttpOnly`; la sesión no concede membresía ni permisos tenant.

## Decisión de semántica

Para un email normalizado de una cuenta `ACTIVE`, el flujo existente:

1. responde externamente con `202`, el mismo schema y el mismo mensaje genérico;
2. no crea otro `PlatformUser` y no crea tenant, membership, rol, familia ni estudiante;
3. crea un challenge nuevo y lo entrega al adapter `DevelopmentIdentityEmailAdapter`;
4. persiste sólo `SHA-256(challenge)` en `verifier_hash`;
5. al verificar, valida existencia segura, hash, expiración, estado, attempts y consumo;
6. consume el challenge bajo locks transaccionales y emite una nueva sesión opaca;
7. deja la cuenta `ACTIVE` y no convierte el email verificado en relación guardian.

La mención de UC-FAM-002 a “establecer un nuevo medio secreto” se interpreta aquí como
la emisión de un nuevo verificador opaco de `PlatformSession` en la arquitectura
passwordless aprobada por E4. No se inventa una contraseña ni una segunda credencial.
Esta es una interpretación técnica acotada y no una nueva política de autenticación.

`SESSION_REVOCATION_ON_RECOVERY = POLICY_NOT_DEFINED / RESIDUAL`: las fuentes dicen que
las sesiones se revocan según riesgo, pero no fijan una regla de revocación total para
este caso. Por ello el flujo no revoca arbitrariamente todas las sesiones. E4 sí conserva
las primitives transaccionales `revokeSession`, `revokeAllUserSessions` y `rotateSession`
para una futura política aprobada.

La UI sólo recibió una corrección mínima de descubribilidad: la pantalla existente ahora
expresa “crear cuenta o recuperar el acceso” y sigue usando exactamente el mismo
endpoint anti-enumerativo. No se creó un segundo sistema de login.

## Evidencia directa

### Suite de servicio PostgreSQL

`packages/database/src/account-registration.integration.spec.ts` contiene:

| ID | Resultado |
| --- | --- |
| `G5BR2-REC-01` | `PASS` — cuenta `ACTIVE` solicita acceso sin resultado de existencia |
| `G5BR2-REC-02` | `PASS` — challenge válido emite y resuelve una nueva sesión |
| `G5BR2-REC-03` | `PASS` — no aparece un segundo `PlatformUser` |
| `G5BR2-REC-04` | `PASS` — no hay tenant, membership, rol ni relación familiar |
| `G5BR2-REC-05` | `PASS` — challenge vencido no crea sesión |
| `G5BR2-REC-06` | `PASS` — challenge de recovery es one-time |
| `G5BR2-REC-07` | `PASS` — replay no emite una segunda sesión |
| `G5BR2-REC-08` | `PASS` — caller no recibe resultado de existencia |
| `G5BR2-REC-09` | `PASS` — normalización mantiene una identidad |
| `G5BR2-REC-10` | `PASS` — email verificado no prueba `Q-106` |

La suite ejecutó `30/30` tests: los 20 `G5BR-ID` existentes y los 10 casos nuevos.

### Boundary HTTP real Nest/PostgreSQL

`apps/api/src/account-registration.http.integration.spec.ts` contiene:

| ID | Resultado |
| --- | --- |
| `G5BR2-HTTP-REC-01` | `PASS` — cuenta verificada, challenge posterior y cookie nueva |
| `G5BR2-HTTP-REC-02` | `PASS` — existente/inexistente: status, keys y mensaje equivalentes |
| `G5BR2-HTTP-REC-03` | `PASS` — expiry controlado y sin nueva sesión |
| `G5BR2-HTTP-REC-04` | `PASS` — replay controlado y sin segunda sesión |

La suite HTTP ejecutó `12/12` tests: los 8 `G5BR-HTTP` existentes y los 4 casos nuevos.

`FR-ID-002 = DIRECTLY_COVERED_BY_PASSWORDLESS_RECOVERY` queda propuesto sólo para
revisión humana, con el residual de revocación arriba indicado.

## Migración 16 y CI

No hubo cambio de schema en G5-BR2. La migration
`20260815090000_g5br_account_verification` permanece intacta; no existe Migration 17.

Se agregó en `.github/workflows/e4-foundation.yml`, después de E5-I y de su check de
no-integración externa, antes del cleanup:

```yaml
- name: Prove G5-BR fresh and incremental migration upgrade
  run: pnpm g5br:migration:smoke
```

El smoke debe producir en el run CI del HEAD final:

```text
FRESH_0_TO_16=PASS
INCREMENTAL_15_TO_16=PASS
G5BR_IDENTITY_SEALS=PASS
```

La prueba local focalizada ya conserva esos tres seals; la confirmación CI se registra
únicamente después de que el workflow se ejecute sobre el SHA final y todos sus steps
concluyan `success`.

## Límites preservados

- `EMAIL_ACCOUNT_VERIFIED != GUARDIAN_RELATIONSHIP_VERIFIED`.
- `Q-106 = DEFERRED / PILOT PRECONDITION`.
- `C-013 = LEGAL_VALIDATION_PENDING`.
- No se selecciona proveedor productivo ni se reclama operación productiva.
- No se crea membresía ni autorización institucional con recovery.
- `E2E-001` queda cubierto hasta el functional boundary ya aprobado; no se inventa matrícula.
- `G5 = NO APROBADA / NOT REQUESTED`.

## Clasificación propuesta

| Elemento | Propuesta |
| --- | --- |
| `G5-EXIT-01` | `PASS_WITH_RESIDUAL` — AC-001 directo; Q-106/configuración/operación/legal permanecen abiertos |
| `G5-EXIT-02` | `PASS_WITH_RESIDUAL` — E2E-001 hasta functional boundary |
| `FR-ID-002` | `DIRECTLY_COVERED_BY_PASSWORDLESS_RECOVERY`, pendiente de revisión humana |
| `Q-106` | `DEFERRED / PILOT PRECONDITION` |
| `C-013` | `LEGAL_VALIDATION_PENDING` |
| `G5` | `NO APROBADA / NOT REQUESTED` |
| PR #8 | `OPEN / DRAFT / NO MERGE` |

