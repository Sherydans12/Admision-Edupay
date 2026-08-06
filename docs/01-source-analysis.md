# Análisis de fuentes

## Estado y criterio

- **Actualizado:** 2026-08-06.
- **Propietario funcional y técnico:** Nicolás Sena.
- **Representante formal institucional:** Arturo Javier Galleguillos Trigo, Sostenedor de Colegio Particular Conquistadores.
- **Reglas institucionales:** validadas por el representante formal dentro de las resoluciones o diferimientos registrados; los pendientes de G1 conservan sus hitos.
- **Legal/normativo:** responsable pendiente antes del piloto.

El repositorio público conserva metadatos y requisitos extraídos. Los PDF originales y cualquier dato personal real permanecen fuera del repositorio.

## Inventario de fuentes autorizadas

| ID | Fuente | Fecha/periodo | Autoridad y alcance | Presencia en repositorio |
| --- | --- | --- | --- | --- |
| SRC-001 | Encargo inicial “Admisión EduPay” | 2026-08-06 | Visión, alcance, seguridad, multitenancy y modo de trabajo | Sólo extracción documental |
| SRC-002 | “PROCESO ADMISION 2027”, Colegio Particular Conquistadores | Admisión 2027 | Proceso y reglas institucionales declaradas | PDF no almacenado; sólo metadatos y extracción |
| SRC-003 | “FICHA DE INSCRIPCIÓN COLEGIO CONQUISTADORES” | Vigente para la fuente entregada | Campos y documentos de la ficha institucional | PDF no almacenado; sólo metadatos y extracción |
| SRC-004 | Decisiones del propietario funcional Nicolás Sena | 2026-08-06 | Decisiones funcionales y responsabilidades del producto | Registradas como decisiones aprobadas |
| SRC-005 | Stack vigente de EduPay | Informado 2026-08-06 | Contexto tecnológico y operacional; no selección automática de stack | Registrado como evidencia para ADR-0001 |

La precedencia funcional es: una decisión explícita de `SRC-004` gobierna el diseño de producto, pero una diferencia con documentos institucionales no se elimina; se registra y se solicita validación o actualización formal al colegio.

## Requisitos extraídos

### SRC-001 — Producto y controles transversales

- SaaS multiempresa, con aislamiento desde el primer incremento.
- Familias capaces de gestionar varios estudiantes y postulaciones.
- Operación por institución, sede, año académico y curso.
- Formularios, documentos, observaciones, entrevistas, evaluaciones, resultados y futura matrícula.
- Cupos, lista de espera, responsables, comunicaciones, reportes y auditoría.
- Datos sensibles protegidos por tenant, propósito, rol y mínimo privilegio.
- Admisión y EduPay desacoplados, sin tablas compartidas.
- Trabajo por etapas con trazabilidad y aprobación humana.

### SRC-002 — Proceso institucional 2027

- Principios de transparencia, objetividad, equidad, igualdad de oportunidades y no discriminación arbitraria.
- Adhesión de las familias al Proyecto Educativo Institucional (PEI) y reglamentos.
- Publicación de PEI, Reglamento Interno, protocolos e información de aranceles 2027.
- Certificado de nacimiento.
- Certificado anual de estudios o informe de notas vigente.
- Informe de personalidad o desarrollo personal cuando corresponda.
- Ficha de postulación y eventuales antecedentes adicionales.
- Documentación completa no garantiza vacante; la admisión depende de requisitos y cupos.
- Recepción y validación, entrevista del apoderado, entrevista y/o evaluación del estudiante, revisión de antecedentes y cupos, comunicación y formalización.
- Falta de formalización dentro del plazo implica desistimiento salvo autorización.
- Según el documento, el pago de matrícula asegura el cupo.

### SRC-003 — Ficha institucional

- Estudiante: nombre completo, curso, RUT, nacimiento, domicilio y colegio de procedencia.
- Hogar: personas con quienes vive y cantidad de integrantes.
- Trayectoria/apoyos: PIE actual o anterior, repitencia, especialistas y necesidades educativas especiales.
- Madre, padre, apoderado titular y apoderado financiero: identificación, nacionalidad, educación, ocupación y contacto.
- Trabajo, cargo, ingreso mensual del hogar y motivo de postulación.
- Documentos: nacimiento, certificado anual o notas, informes de personalidad 2025 y 2026, notas parciales y ficha completa.
- Aranceles e información adicional.

### SRC-004 — Decisiones funcionales confirmadas

- Piloto desde primero básico hasta cuarto medio y una sola sede.
- Una cuenta familiar administra varios hijos.
- Colegio asigna directamente horarios de entrevista.
- Evaluación diagnóstica obligatoria para todos los postulantes.
- Admisión revisa y recomienda; Dirección decide.
- Correo es el único canal inicial; WhatsApp queda diferido.
- Cada institución crea y modifica formularios mediante constructor controlado, nunca código arbitrario.
- Pago de matrícula ocurre fuera de Admisión.
- EduPay gestiona información de pago y el portal de pagos existente la consulta.
- Antes de generar deuda anual y concepto de matrícula, el estudiante debe existir en EduPay y estar asociado o matriculado en un curso.
- Admisión realiza un handoff controlado después de una decisión favorable, sujeto al contrato y al momento exacto aún por definir.

### SRC-005 — Stack vigente de EduPay

| Área | Tecnología vigente |
| --- | --- |
| Backend | NestJS 11, TypeScript, Prisma 7, Passport JWT |
| Frontend | Next.js 16 App Router, React 19, Tailwind CSS, Zod 4, React Hook Form |
| Datos | PostgreSQL 15 |
| Contratos/documentación | Swagger / OpenAPI 3.0 en `/api/docs` |
| Despliegue | cPanel / Passenger como Node.js App |
| Desarrollo local | Docker Compose para PostgreSQL |

Esto crea una fuerte preferencia de alineación, no una adopción definitiva. `ADR-0001` evalúa la recomendación; despliegue, repositorios, archivos, correo, colas, integración y arquitectura física multiempresa siguen abiertos.

## Diferencias, tensiones e inconsistencias

### Contradicciones fundacionales conservadas

- **C-001 — Estados mezclados:** `SRC-001` mezcla etapas, estados, actividades, hitos y resultados. Resuelta para el núcleo mediante `D-001` y `Q-003`; se separan las dimensiones.
- **C-002 — Aceptación ambigua:** decisión favorable, reserva, comunicación, respuesta familiar, handoff y matrícula no son equivalentes. Resuelta conceptualmente mediante `Q-004`; el botón de aceptación del piloto sigue abierto.
- **C-003 — Multiinstitución tardía:** el roadmap parecía postergar multitenancy. Resuelta mediante `Q-002`: existe desde el primer incremento; la etapa tardía es onboarding y hardening.
- **C-004 — Libertad versus estructura:** las instituciones configuran formularios y procesos sin alterar el núcleo. Resuelta en principio mediante versiones, constructor controlado y `D-003`.
- **C-005 — Disponibilidad visible:** sigue abierto si se mostrarán cantidades, categorías o sólo convocatoria.
- **C-006 — Obligación de pago:** resuelta en propiedad: EduPay gestiona obligaciones y pagos; queda abierto el contrato y disparador.
- **C-007 — Auditoría versus eliminación:** sigue pendiente de política legal de retención, minimización y seudonimización.
- **C-008 — Perfil familiar versus tenant:** resuelta mediante `D-002`: perfil familiar global controlado e instantánea institucional versionada.

### Contradicciones institucionales nuevas

#### C-009 — Aplicabilidad de evaluación diagnóstica

`SRC-002` permite que entrevista y/o evaluación dependa del nivel, mientras `SRC-004` establece evaluación diagnóstica obligatoria para todos los cursos del piloto. Estado: **DIFERIDA A G1**. D-015 continúa aprobada; la diferencia debe validarse antes de cerrar G1 y la regla debe representarse mediante configuración, nunca hardcodearse. Responsables: Arturo Javier Galleguillos Trigo (institucional) y Nicolás Sena (producto).

#### C-010 — Numeración de etapas en la ficha

`SRC-003` salta visualmente desde la etapa 3 a la etapa 5 y omite la etapa 4. Estado: **RESUELTA**. Se reconoce como inconsistencia de numeración; la etapa 4 corresponde a “Revisión de antecedentes” según el reglamento completo y no altera el flujo aprobado. Registro: Nicolás Sena. Validación institucional: Arturo Javier Galleguillos Trigo.

#### C-011 — Informes de personalidad

`SRC-002` solicita informe de personalidad o desarrollo personal “cuando corresponda”; `SRC-003` solicita específicamente informes de personalidad 2025 y 2026. Estado: **DIFERIDA A G1**. Antes de publicar el formulario y catálogo 2027 se debe definir aplicabilidad por curso y si se exigen ambos años o antecedentes equivalentes. Responsables: Arturo Javier Galleguillos Trigo y Nicolás Sena.

#### C-012 — Antecedentes adicionales

`SRC-002` permite antecedentes adicionales definidos por el establecimiento. Esto no se implementará como campos hardcodeados: requiere catálogo configurable y versionado por institución, año, curso y versión de proceso.

#### C-013 — Sensibilidad de la ficha

`SRC-003` captura salud, PIE/NEE, tratamientos e ingreso familiar. Estado: **DIFERIDA CON HITOS**. Antes de G1 se justifican necesidad, obligatoriedad, visibilidad y propósito. Antes de usar datos reales se aprueban fundamento de tratamiento, matriz de acceso, retención, eliminación/anonimización y atención de solicitudes. La ficha histórica no vuelve obligatorio un campo. Responsables: Arturo Javier Galleguillos Trigo; Nicolás Sena en producto/seguridad técnica; legal/normativo pendiente antes del piloto.

#### C-014 — Canal de ingreso

La ficha y el proceso existentes contemplan correo o entrega presencial. Estado: **DIFERIDA A G1**. Se decidirá si el portal reemplaza esos canales y se evaluará postulación asistida. Si se autoriza, registrará operador, consentimiento/autorización, origen, fecha, institución, evidencia y auditoría. Correo sigue siendo el canal inicial de notificación. Responsables: Arturo Javier Galleguillos Trigo y Nicolás Sena.

## Datos faltantes

- Copias institucionales aprobadas y control de versión de PEI, reglamentos, protocolos y aranceles a publicar.
- Responsable legal/normativo antes del piloto.
- Cupos, calendario, plazos de formalización, excepciones y reglas de desistimiento.
- Política de lista de espera, prioridades, desempates y visibilidad.
- Cierre en G1 de C-009, C-011 y C-014, y primer hito de C-013.
- Obligatoriedad, propósito, visibilidad y retención de cada campo/documento.
- Pautas de entrevista, evaluación y recomendación.
- Plantillas, remitente, entrega y manejo de fallos de correo.
- Volúmenes, SLA, accesibilidad/idiomas y soporte asistido.
- Contrato vigente o futuro de EduPay, estados pre-pago y evento que confirma matrícula.

## Validaciones requeridas con Colegio Conquistadores

1. Validar antes de cerrar G1 la obligatoriedad diagnóstica para todo el piloto.
2. Resolver “cuando corresponda” frente a informes 2025/2026 antes de publicar el catálogo 2027.
3. Justificar antes de G1 los campos sensibles detallados en C-013.
4. Resolver canal exclusivo o postulación asistida, con evidencia y auditoría.
5. Aprobar catálogo de documentos y antecedentes adicionales por curso.
6. Aprobar acceso, retención y fundamento legal antes de datos reales.
7. Validar cupos, reservas, plazos, desistimiento, espera y reapertura.
8. Aprobar estados y mensajes familiares, incluido correo.
9. Confirmar responsables, pautas y autoridad de recomendación/decisión.

## Criterio de evidencia futuro

Cada requisito nuevo debe registrar fuente, fecha, propietario y estado. Una pregunta resuelta conserva su ID, respuesta, fecha y responsable. Si una decisión de producto difiere de un documento institucional, ambas evidencias permanecen visibles hasta que el colegio valide o actualice formalmente su fuente.
