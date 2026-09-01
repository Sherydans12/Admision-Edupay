# G5-BR3 — Sesión visible y recorrido de acceso

## Resultado

Se corrigió la fricción observada en preproducción sintética: el portal no
mostraba si existía una sesión, no ofrecía cierre de sesión y cargaba endpoints
protegidos antes de resolver el estado de autenticación.

El cambio no crea una migración ni cambia el modelo de seguridad. La sesión
continúa siendo un token opaco en cookie `HttpOnly`, persistido sólo como hash,
con expiración idle/absoluta, CSRF en mutaciones y revocación server-side.

## Cambios

### API

- `GET /auth/session` devuelve un resumen del propio usuario, expiraciones,
  perfil familiar y membresías activas; una visita anónima recibe
  `{ "authenticated": false }`.
- `POST /auth/logout` exige CSRF cuando existe una sesión válida, revoca la
  sesión server-side y expira la cookie. Una cookie ausente o ya inválida se
  limpia sin revelar información.
- La cookie recibida al verificar usa `Max-Age` alineado con la expiración
  absoluta server-side (8 horas por defecto); sobrevive a una recarga o cierre
  del navegador, pero no extiende ni evita el TTL de la sesión.
- El resumen nunca devuelve el token crudo, hashes, challenges ni credenciales.
- El perfil y listado de estudiantes pueden consultarse sin perfil creado y
  devuelven un estado vacío/not-found controlado; la creación sigue requiriendo
  sesión y permisos.

### Web

- La barra superior muestra `Sesión activa` con el correo propio y botón
  `Cerrar sesión`, o `Sin sesión iniciada` con acceso visible a registro/login.
- El portal espera la comprobación de sesión antes de consultar datos protegidos
  y presenta una guía clara a usuarios anónimos.
- Registro y verificación conservan el correo pendiente en `sessionStorage`,
  permiten solicitar otro código sin cambiar de pantalla y ofrecen continuar
  al portal después de verificar.
- El control de sesión sigue siendo una ayuda de interfaz: cada endpoint
  mantiene autorización tenant/capability independiente.

### Corrección post-despliegue

- La cookie de sesión se emitía con el TTL calculado en segundos, aunque
  Express recibe `maxAge` en milisegundos. La cabecera resultante expiraba en
  aproximadamente 28,8 segundos y hacía parecer que la sesión se cerraba sola.
- Se corrigió la conversión a milisegundos y se agregó una aserción HTTP que
  protege el TTL de horas configurado. Las sesiones persistidas no estaban
  siendo revocadas; el problema estaba limitado a la expiración de la cookie.

## Validación

- `apps/api/src/account-registration.http.integration.spec.ts`
  - `G5BR-SESSION-01`: descubrimiento anónimo sin datos sensibles.
  - `G5BR-SESSION-02`: resumen autenticado sin token.
  - `G5BR-SESSION-03`: CSRF, revocación y expiración de cookie.
- Suite focal HTTP: `15/15 PASS`.
- Typecheck API y Web: `PASS`.
- `git diff --check`: `PASS`.

## Límites y siguiente compuerta

- Sólo se usaron cuentas y correos sintéticos.
- No se implementó MFA, SSO ni importación desde EduPay.
- No se habilitó ningún permiso nuevo de tenant; el rol revisor sintético sigue
  limitado a `application.authority.read` y `application.authority.review`.
- Antes de producción deben definirse política de sesión, MFA/step-up,
  recuperación, retención y revocación operativa conforme a la revisión legal y
  de privacidad.
