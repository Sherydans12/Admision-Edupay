# G5-P2 — Evidencia de Dirección sintética

## Alcance

Se provisionó una cuenta de Dirección independiente para la preproducción sintética.
No se usaron datos reales, correo real, EduPay ni almacenamiento documental.

## Resultado confirmado

- Cuenta: `admissions-director@resend.dev`.
- Tenant: `synthetic-school` (`cd565ac0-362d-5ea1-a1f5-42aa111a63a3`).
- Cuenta activa y correo verificado antes de provisionar.
- Membership: `fb6fc66d-fc50-5c97-a194-6665ec8b9eae`.
- Role assignment: `ff0308ce-45e2-524b-83f3-53796564c59d`.
- Audit event: `014d6b00-6cfc-53a3-b1e7-87834b855b29`.
- Primer alta: `created.membership=true`, `created.roleAssignment=true`,
  `created.auditEvent=true`.
- Segunda ejecución idempotente: los tres flags `created=false`.

## Permisos efectivos

El rol determinista `synthetic.admissions.director` concede únicamente:

- `application.read`;
- `application.decide`;
- `application.handoff.request`;
- `restricted.read`;
- `capacity.read` y `capacity.manage`;
- `offer.read`;
- `waitlist.read` y `waitlist.promote`.

No concede `application.recommend`, `role_assignment.manage` ni permisos de
configuración institucional. La separación de funciones con
`admissions-operator@resend.dev` queda preservada.

## Validación técnica

- Provisioner unitario: 3/3 PASS.
- Typecheck y build de `@admission/database`: PASS.
- Lint y `git diff --check`: PASS.
- Despliegue sintético Coolify run `33517068327`: PASS.
- Recurso en VPS: API, web y worker healthy; migrator exit 0.

## Siguiente operación manual

Con una sesión iniciada como Dirección, abrir **Atención → Recomendación interna**,
cargar la postulación sintética existente y aplicar una decisión de Dirección. La
decisión debe ser ejecutada por esta cuenta y no por el operador que creó la
recomendación. Cualquier operación de matrícula real, integración EduPay, documentos
reales o producción permanece fuera de esta evidencia.
