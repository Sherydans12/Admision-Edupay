# Preguntas, supuestos, contradicciones y decisiones

## Convenciones

- Estados: `ABIERTA`, `PARCIAL`, `RESUELTA`, `APROBADA`, `DIFERIDA`.
- Resolver una pregunta no elimina su ID: conserva respuesta, fecha, responsable y evidencia.
- Una decisión del propietario funcional puede requerir además validación institucional, legal o arquitectónica.

## Responsables y aprobaciones

| Ámbito | Responsable | Estado |
| --- | --- | --- |
| Propiedad funcional y técnica | Nicolás Sena | CONFIRMADO 2026-08-06 |
| Integración EduPay | Nicolás Sena | CONFIRMADO 2026-08-06 |
| Seguridad y privacidad técnica durante diseño | Nicolás Sena | CONFIRMADO 2026-08-06 |
| Reglas institucionales | Admisión y/o Dirección de Colegio Conquistadores | ROL CONFIRMADO; representante formal pendiente |
| Validación legal/normativa | Por designar | PENDIENTE antes del piloto |

## Preguntas G0 conservadas y resueltas

| ID | Respuesta registrada | Responsable | Fecha | Estado |
| --- | --- | --- | --- | --- |
| Q-001 | Las fuentes autorizadas son `SRC-001` a `SRC-005`. Nicolás Sena es propietario funcional. | Nicolás Sena | 2026-08-06 | RESUELTA |
| Q-002 | Multitenancy se implementa desde el primer incremento; la etapa posterior es onboarding y hardening operacional. | Nicolás Sena | 2026-08-06 | RESUELTA |
| Q-003 | Se aprueba separar etapas, estados, actividades, eventos y resultados. | Nicolás Sena | 2026-08-06 | RESUELTA |
| Q-004 | Se distinguen decisión institucional, reserva, comunicación, aceptación cuando aplique, handoff y matrícula. No se decide aún si el piloto tendrá botón independiente de aceptación. | Nicolás Sena | 2026-08-06 | RESUELTA con detalle G1 abierto en Q-310 |
| Q-005 | Producto/técnica, integración y seguridad técnica: Nicolás Sena. Reglas institucionales: Admisión/Dirección. Faltan representante formal del colegio y responsable legal/normativo. | Nicolás Sena | 2026-08-06 | PARCIAL |

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

## Decisiones funcionales confirmadas

Derivadas de `SRC-004`, aprobadas por Nicolás Sena el 2026-08-06.

| ID | Decisión | Estado/observación |
| --- | --- | --- |
| D-011 | Piloto desde primero básico hasta cuarto medio | APROBADA; validación institucional pendiente |
| D-012 | Colegio Conquistadores opera una sede para el piloto | APROBADA; no elimina soporte multi-sede del núcleo |
| D-013 | Una cuenta familiar administra varios hijos | APROBADA |
| D-014 | Colegio asigna directamente horarios de entrevista | APROBADA |
| D-015 | Evaluación diagnóstica obligatoria para todos los postulantes del piloto | APROBADA por producto; C-009 pendiente de colegio |
| D-016 | Admisión revisa/recomienda y Dirección toma decisión final | APROBADA |
| D-017 | Resultado y acciones se notifican inicialmente sólo por correo | APROBADA |
| D-018 | WhatsApp queda diferido para costo y arquitectura futura | APROBADA/DIFERIDA |
| D-019 | Cada institución puede crear y modificar sus formularios | APROBADA |
| D-020 | Formularios mediante constructor controlado; sin código arbitrario | APROBADA |
| D-021 | Pago de matrícula externo a Admisión | APROBADA |
| D-022 | EduPay gestiona información de pago; el portal existente la consulta | APROBADA |
| D-023 | Estudiante debe existir y estar asociado/matriculado en curso de EduPay antes de generar deuda y matrícula | APROBADA; estado exacto pendiente Q-309 |
| D-024 | Admisión hace handoff controlado después de decisión favorable según contrato | APROBADA; momento exacto pendiente Q-310 |

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
| C-002 | `ACCEPTED` ambiguo | Dimensiones separadas; aceptación del piloto en Q-310 | RESUELTA EN NÚCLEO |
| C-003 | Multitenancy obligatoria vs etapa tardía | Q-002: primer incremento; etapa tardía = hardening | RESUELTA |
| C-004 | Configuración libre vs estructura común | Versiones y constructor controlado D-003/D-020 | RESUELTA EN PRINCIPIO |
| C-005 | Disponibilidad visible vs confidencialidad de cupos | Definir señal institucional | ABIERTA G1 |
| C-006 | Admisión menciona obligación que pertenece a EduPay | D-021/D-022 fijan propiedad; contrato sigue abierto | RESUELTA EN PROPIEDAD |
| C-007 | Historial inmutable vs eliminación | Matriz de retención/legal pendiente | ABIERTA G2/G5 |
| C-008 | Perfil reutilizable vs aislamiento tenant | D-002 | RESUELTA |
| C-009 | SRC-002 permite evaluación según nivel; D-015 la exige para todos | Producto aprobado; colegio debe validar/actualizar documento | PENDIENTE INSTITUCIONAL |
| C-010 | SRC-003 salta de etapa 3 a 5 | No inferir etapa 4; solicitar corrección | PENDIENTE INSTITUCIONAL |
| C-011 | SRC-002 dice informe “cuando corresponda”; SRC-003 pide 2025 y 2026 | Definir condición, años y cursos | PENDIENTE INSTITUCIONAL |
| C-012 | SRC-002 permite antecedentes adicionales | Catálogo configurable/versionado; definir contenido | RESUELTA EN DISEÑO, catálogo pendiente |
| C-013 | SRC-003 pide salud, NEE e ingreso familiar | Clasificación alta; justificar acceso, obligatoriedad y retención | PENDIENTE INSTITUCIONAL/LEGAL |
| C-014 | Fuentes contemplan correo/presencial frente al portal | Resolver reemplazo total o postulación asistida | ABIERTA G1 |

## Preguntas funcionales para G1

### Oferta, formulario y familia

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-101 | ¿Puede una familia postular al mismo estudiante a varias sedes, cursos o instituciones? | ABIERTA |
| Q-102 | ¿Qué identifica un duplicado y qué excepciones existen? | ABIERTA |
| Q-103 | ¿Disponibilidad exacta, categórica o sólo convocatoria? | ABIERTA |
| Q-104 | Campos conocidos por SRC-003; falta obligatoriedad por curso, propósito y momento | PARCIAL |
| Q-105 | ¿Qué adulto puede editar, enviar, aceptar o desistir? | ABIERTA |
| Q-106 | ¿Cómo se verifican RUT, nacimiento y relación con estudiante? | ABIERTA |
| Q-107 | ¿El portal reemplaza correo/presencial o habrá postulaciones asistidas? | ABIERTA; vinculada C-014 |
| Q-108 | ¿Idiomas y necesidades adicionales de accesibilidad? | ABIERTA; WCAG AA aprobado |

### Documentos

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-120 | Catálogo base extraído; faltan formatos, tamaños, vigencias y condiciones por curso | PARCIAL |
| Q-121 | ¿Quién revisa cada tipo y quién puede eximir? | ABIERTA |
| Q-122 | ¿Cuántas correcciones y qué plazos? | ABIERTA |
| Q-123 | ¿Cómo tratar archivos con contraseña, multipágina o firmas? | ABIERTA |
| Q-124 | ¿Puede la familia eliminar un archivo antes/después de enviar? | ABIERTA |

### Entrevistas y evaluaciones

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-140 | Piloto exige entrevista y evaluación para todos; falta repetición/excepciones y validación C-009 | PARCIAL |
| Q-141 | Colegio asigna horarios directamente | RESUELTA por D-014 |
| Q-142 | ¿Reprogramación, cancelación, inasistencia y tolerancia? | ABIERTA |
| Q-143 | ¿Presencial, remota o híbrida; ubicación/enlace? | ABIERTA |
| Q-144 | ¿Pauta, resultado y confidencialidad detallada? | ABIERTA |
| Q-145 | ¿Puede corregirse una conclusión y por quién? | ABIERTA |

### Decisión, cupos y espera

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-160 | Admisión recomienda y Dirección decide; criterios/fundamentos siguen abiertos | PARCIAL |
| Q-161 | Separación recomendador/aprobador confirmada para piloto | RESUELTA por D-016 |
| Q-162 | ¿Capacidad total, cupo de admisión o vacante disponible? | ABIERTA |
| Q-163 | ¿Cuándo se reserva y cuánto dura reserva/oferta? | ABIERTA |
| Q-164 | ¿Orden, prioridades y desempates de espera? | ABIERTA |
| Q-165 | ¿La familia ve posición exacta? | ABIERTA |
| Q-166 | ¿Qué ocurre si acepta varias ofertas? | ABIERTA |
| Q-167 | ¿Quién puede reabrir rechazo, desistimiento o expiración? | ABIERTA |

### Comunicaciones y reportes

| ID | Pregunta/Respuesta parcial | Estado |
| --- | --- | --- |
| Q-180 | Correo es único canal inicial; WhatsApp diferido | RESUELTA por D-017/D-018 |
| Q-181 | ¿Plantillas, remitente, horarios y escalamiento por fallo de correo? | ABIERTA |
| Q-182 | ¿Qué historial se muestra a familia? | ABIERTA |
| Q-183 | ¿Reportes/exportaciones, periodicidad y audiencia? | ABIERTA |
| Q-184 | ¿SLA operativos por etapa? | ABIERTA |

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
| Q-302 | ¿Qué evento/condición inicia el handoff? | ABIERTA; ampliada por Q-310 |
| Q-303 | EduPay es dueño de obligaciones; falta definir si recibe comando o las deriva | PARCIAL |
| Q-304 | ¿Definición de matrícula iniciada, pendiente, confirmada, cancelada y revertida? | ABIERTA; ampliada por Q-309 |
| Q-305 | ¿Payload mínimo y fundamento de transferencia? | ABIERTA |
| Q-306 | ¿Interfaz, autenticación, versionado y límites? | ABIERTA |
| Q-307 | ¿SLA, reintentos, reconciliación y soporte? | ABIERTA |
| Q-308 | ¿Oferta expirada o desistimiento durante handoff? | ABIERTA |
| Q-309 | ¿Qué estado usa EduPay antes del pago y qué evento confirma matrícula? | BLOQUEANTE INTEGRACIÓN |
| Q-310 | ¿Handoff tras aprobación de Dirección o tras aceptación familiar explícita? | BLOQUEANTE G1 |

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

**G0 sigue bloqueada al 2026-08-06.** D-001 a D-010 y Q-001 a Q-004 están cerradas, pero falta:

1. designar al representante formal del colegio para Q-005;
2. validar o diferir formalmente C-009, C-010, C-011, C-013 y C-014 con Admisión/Dirección;
3. registrar aprobación humana del alcance/fuera de alcance y del commit documental final.

El responsable legal puede designarse después de G0, pero obligatoriamente antes del piloto y antes de cerrar políticas que dependan de Q-201/Q-202.
