# Cierre de compuerta G0 — Fundación documental

## Registro

| Campo | Valor |
| --- | --- |
| Compuerta | G0 — aprobación de fundación |
| Estado | `APPROVED / CLOSED` |
| Fecha y hora | `2026-08-06T14:16:00-04:00` |
| Commit de contenido aprobado | `1d33191d7b0bb9e4d6f2c99dfa9a8baed701a379` |
| Aprobador de producto/técnica | Nicolás Sena |
| Representante formal institucional | Arturo Javier Galleguillos Trigo, Sostenedor de Colegio Particular Conquistadores |
| Etapa autorizada | E1 — Diseño funcional |
| Estado de G1 | No aprobada |

## Texto de aprobación

> “Apruebo el cierre de la compuerta G0 de Admisión EduPay sobre el commit 1d33191, incorporando a Arturo Javier Galleguillos Trigo, Sostenedor del Colegio Particular Conquistadores, como representante formal institucional y aplicando las resoluciones y diferimientos documentados para C-009, C-010, C-011, C-013 y C-014.”

Aprobación otorgada explícitamente por Nicolás Sena en la fecha y hora registradas.

## Alcance revisado

- Fuentes autorizadas `SRC-001` a `SRC-005`.
- Decisiones `D-001` a `D-024` incluidas en el contenido aprobado.
- Visión, alcance, requisitos, flujo, modelo conceptual, multitenancy, seguridad, privacidad, roles, integración EduPay, piloto 2027 y roadmap documentados en el commit aprobado.
- `ADR-0000` aceptado como proceso de decisiones.
- `ADR-0001` conservado en estado `PROPOSED`.

La aprobación se refiere al contenido sustantivo exacto de `1d33191d7b0bb9e4d6f2c99dfa9a8baed701a379`. Este registro de cierre no agrega requisitos, decisiones funcionales ni decisiones arquitectónicas.

## Resoluciones y diferimientos

### C-009 — Evaluación diagnóstica

- **Estado:** DIFERIDA A G1.
- D-015 continúa aprobada: la evaluación diagnóstica es obligatoria para todos los postulantes del piloto.
- La diferencia con el documento institucional debe validarse antes de cerrar G1.
- La regla se representará mediante configuración del proceso y no se hardcodeará.
- **Responsables:** Arturo Javier Galleguillos Trigo (institucional) y Nicolás Sena (producto).
- **Fecha límite:** antes de aprobar G1.

### C-010 — Numeración de etapas

- **Estado:** RESUELTA.
- Se reconoce como inconsistencia de numeración en la ficha.
- La etapa 4 corresponde a “Revisión de antecedentes”, según el reglamento completo.
- No altera el flujo aprobado.
- **Responsables:** Nicolás Sena (registro documental) y Arturo Javier Galleguillos Trigo (validación institucional).

### C-011 — Informes de personalidad

- **Estado:** DIFERIDA A G1.
- Se debe definir si el informe aplica a todos los cursos o sólo cuando corresponda.
- Se debe aclarar si se requieren ambos años 2025 y 2026 o antecedentes equivalentes.
- La decisión debe resolverse antes de publicar el formulario y catálogo documental 2027.
- **Responsables:** Arturo Javier Galleguillos Trigo (institucional) y Nicolás Sena (producto).
- **Fecha límite:** antes de aprobar G1.

### C-013 — Datos sensibles

- **Estado:** DIFERIDA CON HITOS.
- Antes de aprobar G1 se justificará necesidad, obligatoriedad, visibilidad y propósito de antecedentes PIE/NEE, tratamientos con especialistas, información de salud e ingreso mensual familiar.
- Antes de autorizar datos reales para el piloto se aprobarán fundamento de tratamiento, matriz de acceso, retención, eliminación o anonimización y atención de solicitudes de titulares.
- La aparición de un campo en la ficha histórica no lo convierte automáticamente en obligatorio.
- **Responsables:** Arturo Javier Galleguillos Trigo (institucional), Nicolás Sena (producto y seguridad técnica) y responsable legal/normativo pendiente de designación antes del piloto.

### C-014 — Canales actuales y portal

- **Estado:** DIFERIDA A G1.
- En G1 se decidirá si el portal reemplaza completamente el correo y la entrega presencial.
- Se evaluará una modalidad de postulación asistida por personal autorizado del colegio.
- Toda postulación asistida registrará operador, consentimiento o autorización, origen, fecha, institución, evidencia y auditoría.
- Correo seguirá siendo el canal inicial de notificación, independientemente de la recepción de postulaciones.
- **Responsables:** Arturo Javier Galleguillos Trigo (institucional) y Nicolás Sena (producto).
- **Fecha límite:** antes de aprobar G1.

## Riesgos y asuntos diferidos

### Antes de cerrar G1

- Resolver C-009, C-011 y C-014.
- Completar el primer hito funcional de C-013.
- Resolver las preguntas funcionales y criterios de G1, incluido el momento del handoff.
- Validar formulario, catálogo documental, casos de excepción y proyección familiar.

### Antes de G5 o de autorizar datos reales

- Designar responsable legal/normativo.
- Aprobar fundamento de tratamiento y consentimientos aplicables.
- Aprobar matriz de acceso, retención, eliminación/anonimización y atención de solicitudes.
- Completar revisiones de seguridad, privacidad y autorización operacional del piloto.

### Antes de integración ejecutable o arquitectura

- Resolver contratos, estados e idempotencia detallada con EduPay.
- Evaluar y decidir `ADR-0001`; su recomendación no está aprobada.
- Adoptar mediante ADR las decisiones de stack, despliegue y arquitectura que correspondan.

## Exclusiones expresas

El cierre de G0:

- no autoriza scaffolding;
- no autoriza código de producción;
- no aprueba todavía el stack;
- no autoriza uso de datos reales;
- no autoriza integración ejecutable con EduPay;
- no aprueba G1;
- no autoriza iniciar etapas técnicas posteriores.

## Regla de integridad

- El commit de cierre contiene únicamente este registro, actualizaciones de estado, resoluciones/diferimientos autorizados y administración del PR.
- No modifica el contenido sustantivo aprobado en `1d33191d7b0bb9e4d6f2c99dfa9a8baed701a379`.
- Cualquier cambio sustantivo posterior requiere nueva revisión y aprobación humana explícita.
- La fusión de este registro cierra G0 y autoriza E1 sólo en los términos indicados.
