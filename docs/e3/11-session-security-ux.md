# E3 — UX de sesión y seguridad

## Base aprobada

G2 aprobó una sesión web **opaque server-side**: cookie `HttpOnly`, `Secure` en HTTPS, `SameSite` apropiado, identificador aleatorio sin datos de negocio, expiración por inactividad/absoluta, revocación y rotación después de login, cambios sensibles o elevación. La sesión identifica; no autoriza. Cada operación vuelve a resolver tenant, membership, permiso, scope, sensibilidad, propósito y separación de funciones.

**Trazabilidad:** BL-001, BL-002, BL-019, BL-020; AC-001, AC-002, AC-050..AC-054; E2E-018..E2E-022; E2-04, E2-10, G2.

## Clasificación

- **Hecho/decisión aprobada:** sesión opaca server-side, deny-by-default, tenant context server-side y `SELF-ELEVATION` explícita.
- **Supuesto UX:** los diálogos y etiquetas de este documento son el patrón recomendado para G3.
- **Pregunta abierta:** política exacta de MFA Q-204, procedimiento de soporte/notificación Q-205 y step-up futuro quedan diferidos.

## Login

```text
+--------------------------------------------------+
| Acceder a Admisión                                |
| Correo [________________]                         |
| Contraseña [_____________]                        |
| [Iniciar sesión]                                  |
| ¿Olvidaste tu acceso?  [Recuperar]                |
|                                                   |
| Los mensajes de acceso protegen la privacidad.    |
+--------------------------------------------------+
```

- El tenant no se toma de un campo confiado por el usuario.
- El usuario de personal selecciona sólo contextos permitidos después de autenticarse; la selección no crea permisos.
- Error de credenciales, cuenta no verificada o cuenta inexistente usan respuesta no enumerable.
- Rate limit/retraso progresivo puede mostrarse como espera de seguridad sin revelar regla interna.

## Registro y recuperación

- Registro de familia solicita y verifica un canal con token de un uso y expiración.
- Recuperación muestra respuesta uniforme tanto si existe como si no existe la cuenta.
- Cambio de credencial confirma éxito y requiere login de nuevo.
- Recuperación o cambio revoca sesiones aplicables.
- No se incluyen tokens en la UI, URL visible, logs ni ejemplos del repositorio.

## Sesión expirada

### Familia

```text
+--------------------------------------------------+
| Tu sesión terminó por seguridad                   |
| Guarda tus cambios confirmados; vuelve a iniciar  |
| sesión para continuar.                            |
| [Iniciar sesión] [Volver al inicio]               |
+--------------------------------------------------+
```

### Personal

- El diálogo identifica que la acción no se completó si no hubo confirmación durable.
- No repite estudiante, documento, decisión, tenant o contenido sensible.
- El foco entra al título y vuelve al disparador al cerrar.
- Una mutación crítica no se reenvía automáticamente tras login.

## Logout y múltiples sesiones

- `Cerrar sesión` revoca la sesión actual y devuelve a acceso.
- `Cerrar todas las sesiones` es una capacidad conceptual para perfil/seguridad; exige confirmación y comunica impacto.
- Cambio de credencial y recuperación invalidan las sesiones aplicables.
- Una sesión revocada muestra el mismo patrón de expiración, sin diferenciar a terceros.
- El MVP no promete una consola exhaustiva de dispositivos; sólo la capacidad mínima futura de revocar sesiones.

## Operación prohibida

El patrón uniforme es:

> “No tienes permiso para realizar esta acción.”

- No muestra si el caso existe, a qué tenant pertenece, qué rol falta ni cuál es el scope interno.
- Ofrece volver, cambiar de contexto permitido o canal de soporte según audiencia.
- La decisión efectiva ocurre server-side; un botón oculto es sólo una ayuda de uso.

## Reautenticación / step-up futuro

- Para cambios sensibles, exportaciones o elevación futura puede requerirse reautenticación/step-up.
- E3 reserva el espacio de UX: motivo, acción, seguridad, cancelación y resultado.
- No fija método, proveedor, MFA ni política legal; Q-204 permanece abierta.

## Superadmin Global y SELF-ELEVATION

### Sin elevación

1. Superadmin inicia sesión como operador de plataforma.
2. Intenta abrir contenido tenant.
3. La UI muestra operación de plataforma sin casos, conteos, archivos, estudiantes ni recursos.
4. La lectura se deniega y se audita sin revelar existencia.

### Solicitud explícita

```text
+--------------------------------------------------+
| Elevar acceso de soporte                          |
| Tenant: [selección explícita]                     |
| Purpose: [motivo de soporte]                      |
| Scope: [campus/proceso/curso/caso]                |
| Categorías: [selección explícita]                 |
| Duración / expiración: [visible]                  |
| Motivo: [obligatorio]                             |
| [Cancelar] [Iniciar elevación]                   |
+--------------------------------------------------+
```

### Mientras está elevada

- Banner/indicador persistente: `Acceso elevado · tenant sintético · propósito · scope · categorías · vence [fecha/hora]`.
- El indicador no se oculta al navegar por el workspace.
- Cada lectura/acción usa effective actor y queda auditada.
- No se extiende ni amplía categorías silenciosamente.
- `Salir de elevación` cierra el contexto; expiración automática lo cierra aunque la sesión siga activa.

### AC/E2E

- Sin elevación: AC-053, E2E-020.
- Con elevación: AC-054, E2E-020.
- Cross-tenant y acceso ajeno: AC-050..AC-052, E2E-018..E2E-019.

## Feedback técnico y de negocio

| Situación | UX | No debe implicar |
| --- | --- | --- |
| Sesión expiró | Reautenticar | Que el caso fue eliminado |
| Prohibido | Denegación uniforme | Que el recurso existe |
| Correo falló | Tarea técnica; portal oficial | Rechazo o vencimiento de oferta |
| Cookie inválida/revocada | Login uniforme | Cuenta distinta o tenant |
| Elevación expirada | Salir del contenido y mostrar estado | Elevación renovada |

## Decisión para G3

Se recomienda aprobar el patrón de sesión expirada, denegación uniforme y elevación visible. La implementación de sesión, rate limiting, CSRF, MFA, secretos y RLS pertenece a etapas autorizadas posteriores; E3 no crea código ni infraestructura.
