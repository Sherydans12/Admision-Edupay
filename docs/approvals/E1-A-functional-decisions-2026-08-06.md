# Aprobación consolidada E1-A — Decisiones funcionales de producto

## Registro de aprobación

| Campo | Valor |
| --- | --- |
| Etapa | E1-A — Base funcional y paquete de decisiones |
| Estado | `PRODUCT DECISIONS APPROVED / INSTITUTIONAL VALIDATION PENDING` |
| Aprobador funcional y de producto | Nicolás Sena |
| Representante institucional | Arturo Javier Galleguillos Trigo, Sostenedor |
| Fecha consolidada | `2026-08-06T22:09:00-04:00` |
| Rama | `docs/e1-functional-baseline` |
| PR | #2 — E1-A: Define functional baseline and decision pack (borrador, abierto) |
| Commit base de las propuestas | `2264a38c2e0b575cb713d4bc6f7fdb7a7e57b102` |
| Estado de E1-B | No iniciada |
| Estado de G1 | `NO APROBADA` |

## Textos de aprobación registrados

La aprobación consolidada quedó completada el `2026-08-06T22:09:00-04:00`, mediante estos cuatro textos:

1. “Apruebo Q-101 a Q-108”.
2. “Apruebo Q-120 a Q-145”.
3. “Apruebo Q-160 a Q-167”.
4. “Apruebo Q-180 a Q-184 y Q-310”.

Estos textos fijan la posición funcional del producto. No sustituyen validaciones institucionales pendientes, conclusiones legales, contratos EduPay ni decisiones arquitectónicas.

## Leyenda de estados

- `APPROVED_PRODUCT`: decisión funcional aprobada por Nicolás Sena.
- `INSTITUTIONAL_VALIDATION_PENDING`: falta confirmar una regla o detalle del colegio.
- `LEGAL_VALIDATION_PENDING`: falta validación legal/normativa antes de datos reales.
- `OPERATIONAL_DETAIL_PENDING`: faltan responsables, cifras, plazos, plantillas o pautas.

Una pregunta puede tener simultáneamente `APPROVED_PRODUCT` y uno o más pendientes. No se usa `RESUELTA` cuando permanece validación institucional o legal.

## Decisiones canónicas aprobadas

| ID | Decisión funcional consolidada | Pendientes conservados |
| --- | --- | --- |
| Q-101 | Postulación independiente entre instituciones; una postulación activa por estudiante, institución, año y curso/nivel; en el piloto, una por estudiante/año/curso con una sede. | Política detallada de combinaciones |
| Q-102 | Duplicado = estudiante + institución + año + curso/oferta; RUT/fecha de nacimiento sólo apoyan coincidencia; no enumerar; excepción/reapertura con autoridad, motivo y auditoría. | Procedimiento operativo |
| Q-103 | Disponibilidad categórica: postulaciones abiertas, cupos limitados, lista de espera, proceso cerrado; sin cantidades exactas por defecto y sin promesa de vacante. | Texto y actualización operativa |
| Q-104 | Captura progresiva/mínima; PIE/NEE opcionales o condicionales; no historia clínica general; salud/tratamientos sólo por necesidad concreta; ingreso familiar fuera del formulario MVP y separado para fines financieros. | Validación C-013 institucional, de acceso y legal |
| Q-105 | Un adulto responsable con cuenta en MVP puede editar, enviar, desistir y aceptar; otros adultos sólo quedan como información relacionada; sin cuentas colaborativas. | Invitaciones y conflictos para evolución |
| Q-106 | Verificación inicial por correo confirmado, formato RUT, declaración de relación y certificado de nacimiento; escalamiento manual ante duda; sin registros externos en E1. | Procedimiento de escalamiento |
| Q-107 | Portal como fuente oficial; postulación asistida por personal autorizado usando el mismo formulario versionado; registrar operador, institución, origen, autorización/consentimiento, fecha y acciones; correo no es repositorio y sigue como canal de notificación. | Validación C-014 del procedimiento |
| Q-108 | MVP en español, móvil prioritario, objetivo WCAG 2.2 AA, teclado/lector/lenguaje claro; sin sistema multilingüe completo; contenido preparado para traducción futura. | Necesidades institucionales específicas |
| Q-120 | Catálogo por curso, periodo, condición y versión; nacimiento y antecedentes académicos base cuando corresponda; personalidad condicional; informe vigente o equivalente, no 2025/2026 rígidos. | Validación C-011 |
| Q-121 | Admisión revisa documentación general; datos de salud/PIE/NEE/especialistas sólo por roles autorizados; exención con motivo/autoridad; Dirección o delegado formal aprueba exenciones de política. | Personas y delegaciones concretas |
| Q-122 | Al menos una corrección; intentos/plazo configurables; no rechazo automático de antecedente corregible sin revisión humana. | Cifras del colegio |
| Q-123 | Catálogo de formatos seguros y multipágina; contraseña/daño/ilegibilidad se rechazan con instrucciones; firma visible como contenido, sin validación criptográfica en MVP. | Catálogo operativo de formatos |
| Q-124 | Antes de enviar se puede retirar/reemplazar; después se entrega nueva versión; anterior queda sustituida y no se elimina silenciosamente. | Retención/eliminación Q-202 |
| Q-140 | Entrevista de apoderado y evaluación diagnóstica obligatorias para todos los cursos del piloto; configurables por oferta en el núcleo; exenciones con regla, autoridad, motivo y auditoría. | Validación C-009 |
| Q-141 | Colegio asigna horario; familia recibe/acusa y puede solicitar cambio según política; no elige espacios en MVP. | Detalle de confirmación/cambio |
| Q-142 | Reprogramación, cancelación, atraso e inasistencia usan reglas versionadas; primera inasistencia no rechaza automáticamente; tarea y revisión humana. | Límites/tolerancias del colegio |
| Q-143 | Modalidad configurable presencial/remota; piloto define predeterminada; excepciones autorizadas; sin integración de videollamada/calendario. | Modalidad concreta del piloto |
| Q-144 | Pautas estructuradas/versionadas; separar asistencia, evidencia, conclusión y recomendación; notas restringidas; familia sólo ve próximos pasos/resultados comunicables. | Pautas y audiencias concretas |
| Q-145 | Sin edición silenciosa; autor/supervisor crea nueva versión con motivo; tras decisión final devuelve a revisión; nunca cambia automáticamente resultado comunicado. | Autoridades y procedimiento |
| Q-160 | Admisión usa pauta estructurada/versionada y antecedentes autorizados; Dirección aprueba/rechaza/devuelve con fundamento; no puntuación automática decisoria. | Pauta y criterios institucionales |
| Q-161 | Recomendador no decide; suplentes formales; excepción con autorización reforzada, motivo, auditoría y revisión; sin autoaprobación silenciosa. | Nombres/suplencias |
| Q-162 | Admisión administra cupos del proceso, separados de capacidad académica, matrícula vigente y EduPay; configuración por tenant/sede/año/curso. | Valores y responsables |
| Q-163 | Reserva inmediatamente antes o junto a comunicación de oferta favorable; duración configurable; vencimiento/rechazo/desistimiento liberan de forma auditable. | Duración del colegio |
| Q-164 | Lista de espera con criterios explícitos/versionados/auditables, desempate obligatorio y sin discreción manual infundada; promoción humana en piloto. | Criterios concretos |
| Q-165 | Familia ve espera activa, fecha de actualización y próximos pasos; no posición numérica exacta en MVP ni datos de terceros. | Texto institucional |
| Q-166 | Dentro del mismo colegio/proceso puede exigirse elección entre ofertas y liberar las restantes; tenants distintos no comparten ni coordinan ofertas. | Política de elección |
| Q-167 | Reapertura sólo por autoridades definidas, con motivo, evidencia, auditoría y revisión de cupos/comunicaciones/integración; conserva estado histórico. | Autoridades concretas |
| Q-180 | Correo único canal automático MVP; portal fuente oficial de estado/acciones/plazos; fallo genera tarea interna; WhatsApp diferido. | Procedimiento de fallos |
| Q-181 | Plantillas versionadas por propósito; estados `PREPARED`, `SENT`, `DELIVERED` sólo con evidencia y `FAILED`; resultado sólo después de decisión final. | Remitente, horarios, escalamiento |
| Q-182 | Historial familiar: recepción, correcciones, citas, comunicaciones, espera, oferta, aceptación, desistimiento y cierre; excluye recomendación, puntajes, notas, revisores, deliberaciones y errores técnicos. | Textos y proyección final |
| Q-183 | Reportes por propósito/audiencia, métricas agregadas prioritarias; exportación identificable con rol, propósito, columnas mínimas, tenant y auditoría; salud/PIE/NEE/finanzas fuera por defecto. | Catálogo y periodicidad |
| Q-184 | Objetivos por etapa con responsable y escalamiento; mínimo revisión, correcciones, citas, recomendación, decisión y comunicación. | Valores concretos del colegio |
| Q-310 | Handoff después de aceptación familiar expresa: decisión favorable → reserva/oferta → comunicación/plazo → aceptación → handoff → EduPay vincula estudiante/adulto/asociación → obligaciones → pago externo → estados posteriores. Rechazo/desistimiento/vencimiento libera y no inicia handoff. | Q-301 a Q-309 y contrato EduPay |

## Validaciones institucionales pendientes

- C-009: confirmar que entrevista y evaluación diagnóstica aplican a todos los cursos del piloto y acordar excepciones.
- C-011: confirmar cursos, periodos y equivalentes del informe de personalidad.
- C-013: confirmar finalidad, audiencia, obligatoriedad y etapa; la validación legal, retención y eliminación sigue pendiente antes de datos reales.
- C-014: confirmar procedimiento, personal, autorización y evidencia de postulación asistida.
- Confirmar modalidad concreta de actividades, responsables, suplencias, criterios de espera, plazos, plantillas, reportes y cifras operativas.

## Detalles operativos pendientes

Q-122, Q-142, Q-163 y Q-184 requieren cantidades, tolerancias, duración y objetivos entregados por el colegio. Q-121, Q-141, Q-143, Q-144, Q-145, Q-161, Q-164, Q-167, Q-181 y Q-183 requieren responsables, suplencias o detalle operativo. No se inventan nombres, días, cupos, horarios, criterios ni pautas.

## Dependencias legales y de integración

- La responsabilidad legal/normativa debe designarse antes de datos reales. Q-201 a Q-210 siguen en sus compuertas.
- Q-202 conserva la definición de retención/eliminación, especialmente para C-013 y documentos sustituidos.
- Q-301 a Q-309 siguen abiertas: sistema maestro, identificadores, evento de inicio, payload, autenticación, estados, SLA, reconciliación y confirmación de matrícula.
- No se define API, payload, autenticación, arquitectura, proveedor ni integración ejecutable en esta aprobación.

## Límites de la aprobación

Esta aprobación no:

- cierra G1;
- autoriza E2 ni arquitectura;
- aprueba o modifica ADR-0001, que permanece `PROPOSED`;
- autoriza código, scaffolding, dependencias, datos reales o integración ejecutable;
- sustituye validación institucional, legal o contractual.

E1-A queda en `PRODUCT DECISIONS APPROVED / INSTITUTIONAL VALIDATION PENDING`. E1-B no se inicia todavía. El PR #2 permanece abierto, en borrador y sin fusionar.
