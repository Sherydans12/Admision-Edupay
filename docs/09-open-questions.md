# Preguntas, supuestos, contradicciones y decisiones

## Convenciones

- Estados: `ABIERTA`, `PARCIAL`, `PROPOSED`, `APPROVED_PRODUCT`, `INSTITUTIONALLY_VALIDATED`, `INSTITUTIONAL_VALIDATION_PENDING`, `LEGAL_VALIDATION_PENDING`, `OPERATIONAL_DETAIL_PENDING`, `RESUELTA`, `APROBADA`, `DIFERIDA`. `APPROVED_PRODUCT` indica una decisión funcional aprobada por Nicolás Sena; `INSTITUTIONALLY_VALIDATED` registra la posición institucional/funcional confirmada para el piloto; ninguno sustituye validación legal ni contractual.
- Resolver una pregunta no elimina su ID: conserva respuesta, fecha, responsable y evidencia.
- Una decisión del propietario funcional puede requerir además validación institucional, legal o arquitectónica.

## Responsables y aprobaciones

| Ámbito | Responsable | Estado |
| --- | --- | --- |
| Propiedad funcional y técnica | Nicolás Sena | CONFIRMADO 2026-08-06 |
| Integración EduPay | Nicolás Sena | CONFIRMADO 2026-08-06 |
| Seguridad y privacidad técnica durante diseño | Nicolás Sena | CONFIRMADO 2026-08-06 |
| Representación formal institucional | Arturo Javier Galleguillos Trigo, Sostenedor de Colegio Particular Conquistadores | CONFIRMADO 2026-08-06 |
| Reglas institucionales | Arturo Javier Galleguillos Trigo, con participación de Admisión y/o Dirección | CONFIRMADO; asuntos diferidos conservan hitos |
| Validación legal/normativa | Por designar | PENDIENTE antes del piloto |

## Preguntas G0 conservadas y resueltas

| ID | Respuesta registrada | Responsable | Fecha | Estado |
| --- | --- | --- | --- | --- |
| Q-001 | Las fuentes autorizadas son `SRC-001` a `SRC-005`. Nicolás Sena es propietario funcional. | Nicolás Sena | 2026-08-06 | RESUELTA |
| Q-002 | Multitenancy se implementa desde el primer incremento; la etapa posterior es onboarding y hardening operacional. | Nicolás Sena | 2026-08-06 | RESUELTA |
| Q-003 | Se aprueba separar etapas, estados, actividades, eventos y resultados. | Nicolás Sena | 2026-08-06 | RESUELTA |
| Q-004 | Se distinguen decisión institucional, reserva, comunicación, aceptación, handoff y matrícula. La aceptación familiar expresa precede al handoff del piloto. | Nicolás Sena | 2026-08-06 | RESUELTA; Q-310 funcionalmente resuelta |
| Q-005 | Producto/técnica, integración y seguridad técnica: Nicolás Sena. Representante formal institucional: Arturo Javier Galleguillos Trigo, Sostenedor. Legal/normativo sigue pendiente antes del piloto y no bloquea E1. | Nicolás Sena | 2026-08-06T14:16:00-04:00 | RESUELTA |

## Decisiones G0 aprobadas

Todas fueron aprobadas por Nicolás Sena el 2026-08-06.

| ID | Decisión | Estado |
| --- | --- | --- |
| D-001 | Semántica común con estados canónicos y ciclos separados | APROBADA |
| D-002 | Perfil familiar global más instantánea versionada por postulación/tenant | APROBADA |
| D-003 | Versiones publicadas inmutables y configuración versionada | APROBADA |
| D-004 | Autorización con RBAC, scopes y sensibilidad/propósito | APROBADA |
| D-005 | Superadministrador sin acceso implícito; elevación temporal auditada | APROBADA |
| D-006 | Archivos privados, cuarentena y escaneo antimalware como requisito | APROBADA |
| D-007 | Integración idempotente con EduPay sin tablas compartidas | APROBADA |
| D-008 | Lista de espera inicialmente gestionada con confirmación humana | APROBADA |
| D-009 | WCAG 2.2 AA como objetivo | APROBADA |
| D-010 | Uso de ADR para decisiones relevantes | APROBADA |

La precisión operativa E1-B mantiene D-005: el Superadministrador Global sólo accede a contenido de tenant mediante elevación explícita, temporal, específica de tenant y alcance, justificada y auditada. Para el MVP se admite `SELF-ELEVATION`; no es acceso silencioso ni permanente.

## Decisiones funcionales confirmadas

Derivadas de `SRC-004`, aprobadas por Nicolás Sena el 2026-08-06.

| ID | Decisión | Estado/observación |
| --- | --- | --- |
| D-011 | Piloto desde primero básico hasta cuarto medio | APROBADA dentro del alcance G0 |
| D-012 | Colegio Conquistadores opera una sede para el piloto | APROBADA; no elimina soporte multi-sede del núcleo |
| D-013 | Una cuenta familiar administra varios hijos | APROBADA |
| D-014 | Colegio asigna directamente horarios de entrevista | APROBADA |
| D-015 | Evaluación diagnóstica obligatoria para todos los postulantes del piloto | APROBADA por producto; C-009 validada institucionalmente con detalles operativos pendientes |
| D-016 | Admisión revisa/recomienda y Dirección toma decisión final | APROBADA |
| D-017 | Resultado y acciones se notifican inicialmente sólo por correo | APROBADA |
| D-018 | WhatsApp queda diferido para costo y arquitectura futura | APROBADA/DIFERIDA |
| D-019 | Cada institución puede crear y modificar sus formularios | APROBADA |
| D-020 | Formularios mediante constructor controlado; sin código arbitrario | APROBADA |
| D-021 | Pago de matrícula externo a Admisión | APROBADA |
| D-022 | EduPay gestiona información de pago; el portal existente la consulta | APROBADA |
| D-023 | Estudiante debe existir y estar asociado/matriculado en curso de EduPay antes de generar deuda y matrícula | APROBADA; estado exacto pendiente Q-309 |
| D-024 | Admisión hace handoff controlado después de decisión favorable según contrato | APROBADA; Q-310 resuelta: aceptación familiar expresa después de oferta |

## Supuestos de trabajo

| ID | Supuesto/actualización | Evidencia | Estado |
| --- | --- | --- | --- |
| A-001 | Conquistadores es piloto, no tenant especial en código/modelo | SRC-001, D-019/D-020 | CONFIRMADO |
| A-002 | Oferta se identifica por institución, sede, año y curso/nivel | SRC-001 | VALIDAR EN G1 |
| A-003 | Originalmente se asumió aplicabilidad variable de entrevista/evaluación | SRC-001/SRC-002 | REEMPLAZADO para piloto por D-015; conservar por C-009 |
| A-004 | Una familia gestiona varios estudiantes/postulaciones | SRC-001, D-013 | CONFIRMADO |
| A-005 | Datos enviados no cambian al editar perfil | D-002/D-003 | CONFIRMADO |
| A-006 | Institución configura señal de disponibilidad | SRC-001 | VALIDAR EN G1 |
| A-007 | Elegibilidad, cupo, oferta y matrícula son hechos distintos | Q-004 | CONFIRMADO |
| A-008 | Actividades pueden reprogramarse | Requisito base | VALIDAR REGLAS EN G1 |
| A-009 | EduPay es dominio separado | SRC-001/SRC-004 | CONFIRMADO |
| A-010 | Zona horaria configurable y UTC conceptual | Requisito SaaS | VALIDAR EN G2 |
| A-011 | Sólo datos sintéticos en documentación/pruebas | AGENTS.md | CONFIRMADO |
| A-012 | Main requirió commit inicial vacío | Evidencia Git 2026-08-06 | CONFIRMADO |

## Contradicciones y tensiones

| ID | Tema | Resolución/seguimiento | Estado |
| --- | --- | --- | --- |
| C-001 | Lista mezcla estados, etapas, hitos y resultados | Separada por D-001/Q-003 | RESUELTA |
| C-002 | `ACCEPTED` ambiguo | Dimensiones separadas; aceptación expresa del piloto antes del handoff conforme a Q-310 | RESUELTA EN NÚCLEO |
| C-003 | Multitenancy obligatoria vs etapa tardía | Q-002: primer incremento; etapa tardía = hardening | RESUELTA |
| C-004 | Configuración libre vs estructura común | Versiones y constructor controlado D-003/D-020 | RESUELTA EN PRINCIPIO |
| C-005 | Disponibilidad visible vs confidencialidad de cupos | Definir señal institucional | ABIERTA G1 |
| C-006 | Admisión menciona obligación que pertenece a EduPay | D-021/D-022 fijan propiedad; contrato sigue abierto | RESUELTA EN PROPIEDAD |
| C-007 | Historial inmutable vs eliminación | Matriz de retención/legal pendiente | ABIERTA G2/G5 |
| C-008 | Perfil reutilizable vs aislamiento tenant | D-002 | RESUELTA |
| C-009 | SRC-002 permite evaluación según nivel; D-015 la exige para todos | Entrevista y evaluación son obligatorias para todos los postulantes del piloto; la regla sigue versionada por tenant/proceso/oferta/curso/tipo de actividad, con excepciones, reprogramación, repetición y cierre auditados | INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING |
| C-010 | SRC-003 salta de etapa 3 a 5 | Inconsistencia de numeración; etapa 4 = “Revisión de antecedentes”; no altera flujo | RESUELTA |
| C-011 | SRC-002 dice informe “cuando corresponda”; SRC-003 pide 2025 y 2026 | Requisito configurable; último informe vigente/disponible o equivalente; exención autorizada; no exigir 2025 y 2026 rígidamente | INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING |
| C-012 | SRC-002 permite antecedentes adicionales | Catálogo configurable/versionado; definir contenido | RESUELTA EN DISEÑO, catálogo pendiente |
| C-013 | SRC-003 pide salud, NEE e ingreso familiar | PIE/NEE opcionales y progresivos para apoyos; salud mínima sólo por necesidad funcional; ingreso familiar fuera del formulario MVP; acceso restringido y auditable; legalidad/retención antes de datos reales/piloto productivo, sin bloquear E1-B ni G1 | INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING |
| C-014 | Fuentes contemplan correo/presencial frente al portal | Portal como fuente oficial; asistencia presencial por Admisión/Secretaría con evidencia; papel sólo como origen físico digitalizado en expediente oficial | INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING |

## Resoluciones de cierre G0

Registradas por la aprobación de Nicolás Sena del `2026-08-06T14:16:00-04:00`, con Arturo Javier Galleguillos Trigo como representante formal institucional.

### C-009 — Evaluación diagnóstica

- **Estado:** `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING`.
- Entrevista y evaluación diagnóstica son obligatorias para todos los postulantes del piloto de 1º básico a 4º medio.
- La obligatoriedad se configura por tenant, proceso/año, oferta, curso/nivel y tipo de actividad; no se hardcodea.
- Exenciones, cierres, reprogramaciones y repeticiones requieren autoridad aún no catalogada, motivo e historia auditable.
- **Registro:** [`e1/07-institutional-validation-baseline.md`](e1/07-institutional-validation-baseline.md).

### C-010 — Numeración de etapas

- **Estado:** RESUELTA.
- Se reconoce una inconsistencia de numeración en la ficha.
- La etapa 4 corresponde a “Revisión de antecedentes”, según el reglamento completo.
- No altera el flujo aprobado.
- **Responsables:** Nicolás Sena (registro) y Arturo Javier Galleguillos Trigo (validación institucional).

### C-011 — Informes de personalidad

- **Estado:** `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING`.
- Cada institución configura aplicabilidad por año/proceso, curso/nivel, oferta y condición.
- Se acepta el último informe vigente/disponible o equivalente del establecimiento anterior; una exención autorizada conserva actor, motivo, fecha, alcance y auditoría.
- No se exige rígidamente “2025 y 2026”. El catálogo concreto del piloto continúa pendiente.

### C-013 — Datos sensibles

- **Estado:** `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- PIE/NEE quedan opcionales y progresivos para preparar apoyos; salud/tratamientos sólo se capturan por necesidad funcional concreta y con mínimo detalle.
- Ingreso familiar queda fuera del formulario MVP y del análisis académico; cualquier proceso financiero será separado.
- Acceso ordinario limitado por rol expresamente autorizado y Administrador Institucional Máximo cuando corresponda; no es acceso automático de Admisión.
- Antes de datos reales se mantienen pendientes fundamento normativo, textos, retención, eliminación/anonimización, solicitudes de titulares y validación legal de la matriz final.

### C-014 — Canales actuales y portal

- **Estado:** `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING`.
- El portal es la fuente oficial; Admisión y Secretaría pueden asistir presencialmente con el apoderado presente.
- Se registra operador, rol, tenant, fecha/hora, origen asistido, adulto presente, autorización/consentimiento y acciones.
- El documento físico, si se acepta excepcionalmente, se digitaliza al requisito correspondiente con origen `PHYSICAL_DOCUMENT`; no crea expediente paralelo.
- Personal, suplencias y conservación/devolución física continúan pendientes.

## Preguntas funcionales para G1

Las opciones históricas, decisiones canónicas, impactos y pendientes de Q-101 a Q-184 están en [`e1/04-functional-decision-workbook.md`](e1/04-functional-decision-workbook.md). La aprobación consolidada de Nicolás Sena se registra en [`approvals/E1-A-functional-decisions-2026-08-06.md`](approvals/E1-A-functional-decisions-2026-08-06.md). `APPROVED_PRODUCT` no significa `RESUELTA` cuando queda validación institucional, legal u operativa.

### Oferta, formulario y familia

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-101 | ¿Puede una familia postular al mismo estudiante a varias sedes, cursos o instituciones? | APPROVED_PRODUCT; detalle operativo pendiente |
| Q-102 | ¿Qué identifica un duplicado y qué excepciones existen? | APPROVED_PRODUCT; procedimiento de excepción pendiente |
| Q-103 | ¿Disponibilidad exacta, categórica o sólo convocatoria? | APPROVED_PRODUCT; texto/actualización operativa pendiente |
| Q-104 | PIE/NEE opcionales/progresivos; salud mínima por necesidad concreta; ingreso familiar fuera del formulario MVP | APPROVED_PRODUCT; INSTITUTIONALLY_VALIDATED por C-013; LEGAL_VALIDATION_PENDING antes de datos reales |
| Q-105 | ¿Qué adulto puede editar, enviar, aceptar o desistir? | APPROVED_PRODUCT; evolución colaborativa pendiente |
| Q-106 | ¿Cómo se verifican RUT, nacimiento y relación con estudiante? | APPROVED_PRODUCT; escalamiento operativo pendiente |
| Q-107 | Portal como fuente oficial; postulación asistida presencial por Admisión/Secretaría con evidencia | APPROVED_PRODUCT; INSTITUTIONALLY_VALIDATED por C-014; OPERATIONAL_DETAIL_PENDING |
| Q-108 | ¿Idiomas y necesidades adicionales de accesibilidad? | APPROVED_PRODUCT; detalle institucional pendiente |

### Documentos

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-120 | Catálogo por curso/proceso/oferta/condición; informe vigente/disponible o equivalente; no 2025/2026 rígidos | APPROVED_PRODUCT; INSTITUTIONALLY_VALIDATED por C-011; OPERATIONAL_DETAIL_PENDING |
| Q-121 | ¿Quién revisa cada tipo y quién puede eximir? | APPROVED_PRODUCT; OPERATIONAL_DETAIL_PENDING |
| Q-122 | ¿Cuántas correcciones y qué plazos? | APPROVED_PRODUCT; `DEFINED_FOR_PILOT` para plazo de 3 días hábiles; cantidad de correcciones y escalamiento pendientes |
| Q-123 | ¿Cómo tratar archivos con contraseña, multipágina o firmas? | APPROVED_PRODUCT; catálogo operativo pendiente |
| Q-124 | ¿Puede la familia eliminar un archivo antes/después de enviar? | APPROVED_PRODUCT; Q-202 pendiente |

### Entrevistas y evaluaciones

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-140 | Entrevista y evaluación obligatorias para todos; configuración versionada, excepciones/repetición/cierre auditados | APPROVED_PRODUCT; INSTITUTIONALLY_VALIDATED por C-009; `DEFINED_FOR_PILOT`; ejecutores, duración y pauta pendientes |
| Q-141 | Colegio asigna horarios directamente | APPROVED_PRODUCT; `DEFINED_FOR_PILOT` para asignación; ejecutores, duración y suplencias pendientes |
| Q-142 | No completada → registrar y reprogramar; eximir/cerrar sólo excepcionalmente con motivo y auditoría | APPROVED_PRODUCT; INSTITUTIONALLY_VALIDATED por C-009; `DEFINED_FOR_PILOT` para 2 reprogramaciones y 15 minutos; autoridad concreta de cierre pendiente |
| Q-143 | ¿Presencial, remota o híbrida; ubicación/enlace? | APPROVED_PRODUCT; `DEFINED_FOR_PILOT` presencial en MVP; ubicación, duración y modalidad futura pendientes |
| Q-144 | Pauta y conclusión quedan restringidas; acceso por rol/propósito; excepciones y cierres auditados | APPROVED_PRODUCT; INSTITUTIONALLY_VALIDATED por C-009/C-013; OPERATIONAL_DETAIL_PENDING; LEGAL_VALIDATION_PENDING para datos reales |
| Q-145 | ¿Puede corregirse una conclusión y por quién? | APPROVED_PRODUCT; OPERATIONAL_DETAIL_PENDING |

### Decisión, cupos y espera

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-160 | Admisión recomienda y Dirección decide; criterios/fundamentos siguen abiertos | APPROVED_PRODUCT; pauta y criterios institucionales pendientes |
| Q-161 | Separación recomendador/aprobador confirmada para piloto | APPROVED_PRODUCT; OPERATIONAL_DETAIL_PENDING |
| Q-162 | ¿Capacidad total, cupo de admisión o vacante disponible? | APPROVED_PRODUCT; valores y responsables pendientes |
| Q-163 | ¿Cuándo se reserva y cuánto dura reserva/oferta? | APPROVED_PRODUCT; `DEFINED_FOR_PILOT` para reserva/oferta y plazo de 3 días hábiles; calendario institucional pendiente |
| Q-164 | ¿Orden, prioridades y desempates de espera? | APPROVED_PRODUCT; `DEFINED_FOR_PILOT` para orden de ingreso; prioridades y desempates pendientes |
| Q-165 | ¿La familia ve posición exacta? | APPROVED_PRODUCT; `DEFINED_FOR_PILOT` no muestra posición exacta; texto institucional pendiente |
| Q-166 | ¿Qué ocurre si acepta varias ofertas? | APPROVED_PRODUCT; política de elección pendiente |
| Q-167 | ¿Quién puede reabrir rechazo, desistimiento o expiración? | APPROVED_PRODUCT; autoridades concretas pendientes |

### Comunicaciones y reportes

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-180 | Correo es único canal inicial; WhatsApp diferido | APPROVED_PRODUCT; procedimiento de fallos pendiente |
| Q-181 | ¿Plantillas, remitente, horarios y escalamiento por fallo de correo? | APPROVED_PRODUCT; OPERATIONAL_DETAIL_PENDING |
| Q-182 | ¿Qué historial se muestra a familia? | APPROVED_PRODUCT; textos/proyección pendiente |
| Q-183 | ¿Reportes/exportaciones, periodicidad y audiencia? | APPROVED_PRODUCT; OPERATIONAL_DETAIL_PENDING |
| Q-184 | ¿SLA operativos por etapa? | APPROVED_PRODUCT; OPERATIONAL_DETAIL_PENDING; valores del colegio |

## Addendum E1-B — Detalle operativo definido para el piloto

`DEFINED_FOR_PILOT` identifica una regla inicial del piloto sin convertirla en un valor fijo del núcleo ni cerrar G1. Las definiciones completas están en [`e1/08-pilot-operational-rules.md`](e1/08-pilot-operational-rules.md) y [`e1/09-pilot-configuration-matrix.md`](e1/09-pilot-configuration-matrix.md).

| ID/tema | Estado E1-B | Definición del piloto |
| --- | --- | --- |
| Responsables | `DEFINED_FOR_PILOT` | Administrador Institucional Máximo: Arturo Javier Galleguillos Trigo, Sostenedor; Responsable de Admisión: Roxana Henríquez; Secretaría como apoyo operativo |
| Q-121 | `DEFINED_FOR_PILOT`; OPERATIONAL_DETAIL_PENDING | Validación definitiva por Responsable de Admisión o revisor autorizado; Secretaría sólo recepción/carga por defecto |
| Q-122 | `DEFINED_FOR_PILOT` | Corrección documental: 3 días hábiles, configurable; requisito, portal, correo y límite visible |
| Q-140/Q-141/Q-143 | `DEFINED_FOR_PILOT`; OPERATIONAL_DETAIL_PENDING | Entrevista/evaluación obligatorias y presenciales en MVP; horario asignado; ejecutores y duración pendientes |
| Q-142 | `DEFINED_FOR_PILOT`; OPERATIONAL_DETAIL_PENDING | 2 reprogramaciones normales y 15 minutos de tolerancia; familia solicita con motivo; Admisión/Secretaría asignan |
| Q-144/Q-145 | `DEFINED_FOR_PILOT`; OPERATIONAL_DETAIL_PENDING | Resultado simple interno y comentario opcional; no visible a familia; repetición y corrección versionadas |
| Q-160/Q-161 | `DEFINED_FOR_PILOT`; OPERATIONAL_DETAIL_PENDING | Recomendación con opciones internas y fundamento obligatorio; recomendador no decide; suplencias pendientes |
| Q-162/Q-163 | `DEFINED_FOR_PILOT`; OPERATIONAL_DETAIL_PENDING | Cupos manuales configurables; `APROBADO` crea reserva/oferta; aceptación 3 días hábiles; ajustes auditados |
| Q-164/Q-165/Q-166 | `DEFINED_FOR_PILOT`; OPERATIONAL_DETAIL_PENDING | Orden de ingreso por defecto; no posición familiar; prioridades concretas pendientes; ofertas del mismo colegio según política |
| Q-167 | `OPERATIONAL_DETAIL_PENDING` | Reapertura manual excepcional con actor, motivo y auditoría; autoridad concreta pendiente |
| Q-181/Q-183/Q-184 | `DEFINED_FOR_PILOT`; OPERATIONAL_DETAIL_PENDING | Correos de cita/oferta/corrección/resultado; dashboard y catálogo de reportes; textos, recordatorio y SLA adicionales pendientes |

Q-201 a Q-210, Q-301 a Q-309 y las decisiones arquitectónicas continúan en sus compuertas originales. Q-201/Q-202 no son trabajo obligatorio de E1-B; C-013 legal permanece como condición pre-datos-reales/piloto productivo.

## Preguntas de seguridad, legalidad y operación para G2/G5

- **Q-201:** jurisdicción, bases de tratamiento y textos de consentimiento.
- **Q-202:** matriz de retención por dato y resultado, especialmente C-013.
- **Q-203:** residencia de datos y proveedores permitidos.
- **Q-204:** MFA por rol y acciones reforzadas.
- **Q-205:** soporte con datos, incidentes y notificación.
- **Q-206:** RPO, RTO, disponibilidad y mantenimiento.
- **Q-207:** volúmenes y picos de convocatoria.
- **Q-208:** auditoría, exportación legal y solicitudes de titulares.
- **Q-209:** dispositivos y redes del personal.
- **Q-210:** amenazas y pruebas externas antes del piloto.

Todas permanecen `ABIERTA`. Q-201/Q-202 requieren responsable legal aún no designado.

## Preguntas para el contrato EduPay

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-301 | ¿Sistema maestro e ID externo de institución, sede, año, curso, persona y estudiante? | ABIERTA |
| Q-302 | ¿Qué evento/condición contractual inicia el handoff? | ABIERTA; el borde funcional ya exige aceptación por Q-310 |
| Q-303 | EduPay es dueño de obligaciones; falta definir si recibe comando o las deriva | ABIERTA / PARCIAL |
| Q-304 | ¿Definición de matrícula iniciada, pendiente, confirmada, cancelada y revertida? | ABIERTA; ampliada por Q-309 |
| Q-305 | ¿Payload mínimo y fundamento de transferencia? | ABIERTA |
| Q-306 | ¿Interfaz, autenticación, versionado y límites? | ABIERTA |
| Q-307 | ¿SLA, reintentos, reconciliación y soporte? | ABIERTA |
| Q-308 | ¿Oferta expirada o desistimiento durante handoff? | ABIERTA |
| Q-309 | ¿Qué estado usa EduPay antes del pago y qué evento confirma matrícula? | ABIERTA; condición futura para G7 |
| Q-310 | ¿Cuál es el momento funcional del handoff? | `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED`; aceptación familiar expresa después de oferta |

Q-310 tuvo comparación y alternativas históricas en [`e1/04-functional-decision-workbook.md`](e1/04-functional-decision-workbook.md#q-310--momento-funcional-del-handoff). Su resolución funcional actual es decisión favorable → reserva → oferta → comunicación → aceptación familiar expresa → handoff. Q-301 a Q-309, incluida Q-309, siguen abiertas como contrato futuro y no fueron resueltas por esta entrega.

La validación institucional de C-009, C-011, C-013 y C-014 quedó registrada en [`e1/07-institutional-validation-baseline.md`](e1/07-institutional-validation-baseline.md). Q-301 a Q-309 siguen abiertas y no fueron resueltas por esa validación.

## Decisiones arquitectónicas diferidas

- **Q-401:** aprobar o rechazar `ADR-0001` para alineación del stack con EduPay.
- **Q-402:** monorepo o multirepo.
- **Q-403:** proveedor y arquitectura de archivos.
- **Q-404:** proveedor de correo.
- **Q-405:** sistema de colas.
- **Q-406:** mecanismo definitivo de integración.
- **Q-407:** estrategia de despliegue.
- **Q-408:** arquitectura física multiempresa.

Estas preguntas no bloquean G0; deben resolverse en G2 antes de scaffolding o cuando su decisión sea necesaria.

## Estado de la compuerta G0

**G0: APROBADA / CERRADA** el `2026-08-06T14:16:00-04:00` sobre el commit sustantivo `1d33191d7b0bb9e4d6f2c99dfa9a8baed701a379`.

- Aprobador de producto/técnica: Nicolás Sena.
- Representante formal institucional: Arturo Javier Galleguillos Trigo, Sostenedor.
- D-001 a D-024 incluidas en el alcance.
- C-009, C-011 y C-014: `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING`; C-010 resuelta; C-013: `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- E1 — Diseño funcional autorizada.
- G1 no aprobada.
- `ADR-0001` permanece `PROPOSED`.
- Responsable legal/normativo pendiente antes del piloto; no bloquea el inicio de E1.

El registro formal está en `docs/approvals/G0-foundation-closure-2026-08-06.md`. Cambios sustantivos posteriores al commit aprobado requieren nueva revisión.
