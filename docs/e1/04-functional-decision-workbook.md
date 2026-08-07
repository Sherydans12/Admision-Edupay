# Functional decision workbook

## Uso y autoridad

Este es el artefacto principal de revisión humana de E1-A y su consolidación E1-B. Las opciones A/B/C que siguen se conservan como análisis histórico; la posición canónica aprobada está en el registro y el addendum institucional al final. Las decisiones D-001 a D-024 se heredan aprobadas; las opciones incompatibles con ellas se muestran sólo para explicar el límite y no reabrir G0.

Estados del workbook:

- `PROPOSED`: estado histórico de una recomendación antes de la aprobación consolidada.
- `APPROVED_PRODUCT`: decisión funcional aprobada por Nicolás Sena el `2026-08-06T22:09:00-04:00`.
- `NEEDS_DECISION`: no hay resolución institucional y la elección bloquea detalle posterior.
- `PARTIAL`: existe una decisión heredada o evidencia parcial, pero faltan reglas operativas.
- `INSTITUTIONALLY_VALIDATED`: posición institucional/funcional confirmada para el piloto; no elimina pendientes operativos o legales.
- `OPERATIONAL_DETAIL_PENDING`: faltan personas, cantidades, plazos, pautas, catálogos o procedimientos.
- `LEGAL_VALIDATION_PENDING`: falta validación normativa antes de datos reales.

La columna mental “impacto multiempresa” siempre exige configuración por tenant/versión y nunca una regla por nombre del colegio. Las fechas límite se expresan por compuerta porque no existen fechas calendario aprobadas.

## Registro de aprobación consolidada

La aprobación está formalizada en [`E1-A-functional-decisions-2026-08-06.md`](../approvals/E1-A-functional-decisions-2026-08-06.md). Las 33 preguntas objetivo tienen ahora estado `APPROVED_PRODUCT`; los pendientes indicados no reabren la decisión de producto.

| Bloque | Preguntas | Decisión canónica aprobada |
| --- | --- | --- |
| Oferta, familia y formulario | Q-101–Q-108 | Una postulación por institución/año/curso; duplicados por estudiante+institución+año+curso; disponibilidad categórica; captura mínima; un adulto responsable; verificación inicial; portal oficial con asistencia; español/móvil/WCAG AA. |
| Documentos, entrevistas y evaluación | Q-120–Q-145 | Catálogo versionado por curso/periodo/condición; personalidad condicional; revisión/exención por roles; corrección; archivos seguros/multipágina; versiones; actividades obligatorias/configurables; citas asignadas; pautas restringidas y corregibles por versión. |
| Decisión, cupos y espera | Q-160–Q-167 | Pauta de Admisión y decisión humana separadas; cupos de admisión separados; reserva junto a oferta; espera versionada y promoción humana; sin posición exacta; elección dentro del colegio; reaperturas autorizadas. |
| Comunicaciones, reportes y handoff | Q-180–Q-184, Q-310 | Correo automático único y portal oficial; plantillas/estados; historial familiar seguro; reportes mínimos/auditados; objetivos por etapa; handoff posterior a aceptación expresa. |

Las validaciones institucionales pendientes de C-009, C-011, C-013 y C-014, los detalles operativos y Q-301 a Q-309 permanecen visibles.

## Oferta, formulario y familia

### Q-101 — ¿Puede una familia postular al mismo estudiante a varias sedes, cursos o instituciones?

- **Contexto/fuentes/condicionantes:** SRC-001, D-002, D-013, FR-APP-001/003/004; una cuenta maneja varios hijos y los snapshots se aíslan por tenant. **Situación:** abierta.
- **Opciones:** A) una postulación total; simple, pero bloquea elección legítima y mezcla tenants. B) permitir una por oferta (tenant+sede+año+curso); flexible y trazable, con riesgo de múltiples ofertas. C) permitir sólo combinaciones habilitadas por cada tenant; flexible, pero más compleja.
- **Impactos:** familia: B reduce fricción; operación: exige gestionar duplicados/ofertas; multiempresa: cada caso aislado; seguridad: no revelar postulaciones de otro tenant.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: permitir postulaciones independientes entre instituciones; dentro de una misma institución, año académico y curso/nivel sólo una activa; en el piloto de una sede, una por estudiante/año/curso. Conserva aislamiento y evita duplicados activos sin bloquear postulaciones entre instituciones.
- **Aprobación/límite/documentos:** Nicolás Sena + representante institucional; antes de E1-B. Afecta journeys J-FAM-001/002, UC-APP-001 y política de ofertas.
- **Pregunta al colegio:** “¿Una familia puede postular al mismo estudiante a más de un curso u otra sede durante el mismo proceso?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

### Q-102 — ¿Qué identifica un duplicado y qué excepciones existen?

- **Contexto/fuentes/condicionantes:** FR-APP-004, D-002/D-003; identidad no debe emparejarse débilmente. **Situación:** abierta.
- **Opciones:** A) mismo estudiante+oferta+ciclo; clara y segura. B) mismo estudiante+curso+año dentro del tenant; evita competencia interna, pero puede impedir sedes. C) coincidencia por RUT/nombre; fácil, pero insegura y con falsos positivos.
- **Impactos:** familia: A permite recuperar borrador; operación: excepciones explícitas; tenant: comparación sólo dentro del tenant salvo perfil familiar propio; privacidad: no confirmar coincidencias ajenas.
- **Recomendación/razón:** **A**, con reapertura o excepción autorizada y auditada; nunca deduplicar automáticamente por nombre/correo/RUT.
- **Aprobación/límite/documentos:** Nicolás Sena + Admisión; antes de E1-B. Afecta UC-APP-001/003 y J-ADM-001.
- **Pregunta al colegio:** “¿Cuándo consideran que dos postulaciones son la misma y quién puede autorizar una excepción?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

### Q-103 — ¿Disponibilidad exacta, categórica o sólo convocatoria?

- **Contexto/fuentes/condicionantes:** C-005, A-006, FR-APP-002. **Situación:** abierta.
- **Opciones:** A) número exacto; transparente, pero cambia rápido y puede crear expectativas. B) categorías (“disponible”, “limitada”, “lista de espera”); orienta con menor precisión engañosa. C) sólo convocatoria abierta; simple, pero no informa escasez.
- **Impactos:** familia: B ayuda a decidir sin promesa; operación: requiere regla de actualización; tenant: señal configurable; seguridad: no exponer capacidad interna ni datos de terceros.
- **Recomendación/razón:** **B**, acompañada de texto “sujeto a revisión y cupos”; permite evolución y reduce interpretación de garantía.
- **Aprobación/límite/documentos:** responsable de cupos + Dirección + Nicolás Sena; antes de E1-B. Afecta UC-ADM-001/UC-CAP-001 y proyección familiar.
- **Pregunta al colegio:** “¿Qué información de disponibilidad quieren mostrar: cantidad exacta, una señal general o sólo que la convocatoria está abierta?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

### Q-104 — Campos conocidos por SRC-003; falta obligatoriedad por curso, propósito y momento

- **Contexto/fuentes/condicionantes:** C-013, FR-FRM-002 a 010, NFR-PRV-002/003. La ficha histórica no justifica obligatoriedad. **Situación:** parcial y requiere validación institucional; no se emiten conclusiones legales.
- **Opciones generales:** A) pedir todo al inicio; completo, pero invasivo y con alto abandono/riesgo. B) captura progresiva por finalidad y etapa; minimiza y mejora claridad, con configuración adicional. C) excluir todos los datos sensibles; reduce riesgo, pero puede impedir apoyos legítimos si se justifican.
- **Análisis por dato propuesto:**

| Dato | Finalidad propuesta | Obligatorio | Quién lo ve | Etapa | Riesgo de no capturar | Riesgo de capturar |
| --- | --- | --- | --- | --- | --- | --- |
| PIE | Identificar apoyos educativos sólo si influyen en preparación autorizada | Opcional/condicional hasta validación | Evaluador o rol de apoyo asignado; no revisor general | Antes de evaluación, no al crear cuenta | No preparar apoyos necesarios | Estigma, uso discriminatorio, exposición de dato altamente restringido |
| NEE | Preparar apoyos y accesibilidad con propósito explícito | Opcional/condicional | Evaluador/rol especializado; Dirección sólo resumen necesario | Antes de actividad pertinente | Barreras o evaluación no adaptada | Discriminación, sobreexposición y datos del menor |
| Tratamientos | Sólo ajustes de seguridad/actividad si el colegio justifica necesidad | Opcional; no preguntar detalle clínico por defecto | Profesional/rol mínimo autorizado | Lo más tarde posible antes de actividad | No anticipar una necesidad concreta | Captura excesiva de salud y responsabilidad operativa |
| Salud | Gestionar una necesidad concreta y urgente, no historia general | Opcional/condicional, granular | Rol designado por propósito; nunca exportación general | Antes de actividad cuando aplique | Riesgo de no disponer de adaptación/alerta necesaria | Alto impacto de privacidad y uso impropio |
| Ingreso familiar | Sólo finalidad institucional expresa y separada de decisión académica | Recomendado no obligatorio para admisión hasta justificación | Rol financiero específico; no entrevistador/evaluador por defecto | Después de resultado o en trámite separado si basta | No ejecutar beneficio/segmentación autorizada | Sesgo, discriminación, exposición financiera y abandono |

- **Impactos:** familia: B reduce preguntas invasivas; operación: exige propósito/audiencia por campo; tenant: cada institución configura sin bajar controles; privacidad: acceso por campo, auditoría y retención futura.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: captura progresiva y mínima; PIE/NEE opcionales o condicionales para apoyos; no historia clínica general; tratamientos/salud sólo ante necesidad funcional, adaptación o seguridad concreta; ingreso familiar fuera del formulario de admisión MVP y, si corresponde, en trámite financiero separado.
- **Aprobación/límite/documentos:** representante institucional + Nicolás Sena antes de G1; responsable legal/normativo antes de datos reales. Afecta formulario, permisos, journeys y UC-FRM-001/002.
- **Pregunta al colegio:** “Para cada dato, ¿qué decisión o apoyo concreto permite, quién necesita verlo y en qué momento? Si no hay una finalidad clara, proponemos no pedirlo.”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `INSTITUTIONAL_VALIDATION_PENDING` y `LEGAL_VALIDATION_PENDING` por C-013.

### Q-105 — ¿Qué adulto puede editar, enviar, aceptar o desistir?

- **Contexto/fuentes/condicionantes:** FR-ID-003/006, C-002, D-013. Ser madre/padre/titular no otorga automáticamente todas las facultades. **Situación:** abierta.
- **Opciones:** A) sólo creador de cuenta; simple, frágil y excluyente. B) apoderado principal con adultos invitados y facultades por acción; claro y revocable. C) cualquier adulto declarado; simple, pero alto riesgo de conflicto.
- **Impactos:** familia: B permite colaboración; operación: requiere resolver disputas; tenant: facultad ligada al caso; seguridad: invitación, revocación y auditoría.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: un único adulto responsable con cuenta en el MVP puede editar, enviar, desistir y aceptar; madre, padre, titular y financiero quedan como información relacionada sin cuentas colaborativas. Invitaciones y coadministración quedan para evolución.
- **Aprobación/límite/documentos:** representante institucional + Nicolás Sena; antes de E1-B. Afecta UC-FAM-003, UC-APP-003/006/007.
- **Pregunta al colegio:** “¿Quién puede enviar, aceptar una vacante o desistir, y qué hacemos si dos adultos no están de acuerdo?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

### Q-106 — ¿Cómo se verifican RUT, nacimiento y relación con estudiante?

- **Contexto/fuentes/condicionantes:** FR-ID-004, NFR-SEC-006/007; no usar identificadores como autorización. **Situación:** abierta; mecanismos técnicos quedan fuera de E1.
- **Opciones:** A) declaración familiar más revisión documental posterior; simple, con riesgo de fraude/error. B) validación externa automática; fuerte, pero proveedor/legal/arquitectura no decididos. C) declaración inicial y escalamiento documental sólo por riesgo/conflicto; equilibrada.
- **Impactos:** familia: C evita barrera universal; operación: cola de excepciones; tenant: revisión dentro del caso; privacidad: mínima consulta y no enumeración.
- **Recomendación/razón:** **C ajustada por aprobación de producto**: correo confirmado, formato formal de RUT, declaración de relación y revisión del certificado de nacimiento; escalar manualmente antes de acciones críticas ante duda/conflicto. No se aprueban registros externos en E1.
- **Aprobación/límite/documentos:** Nicolás Sena + institución; legal/arquitectura después según mecanismo. Afecta UC-FAM-004 y autorización familiar.
- **Pregunta al colegio:** “¿Qué evidencia necesitan para confirmar quién puede postular por un estudiante y en qué momento del proceso?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

### Q-107 — ¿El portal reemplaza correo/presencial o habrá postulaciones asistidas?

- **Contexto/fuentes/condicionantes:** C-014; correo continúa como notificación D-017, no necesariamente como ingreso. **Situación:** abierta.
- **Opciones:** A) portal exclusivo; operación ordenada, pero excluye familias con barreras. B) portal principal con postulación asistida auditada; una fuente de verdad y apoyo controlado, con capacitación. C) coexistencia portal/correo/presencial; accesible, pero duplica trabajo, evidencia y riesgo de pérdida.
- **Impactos:** familia: B mantiene apoyo; operación: B evita transcripción informal; tenant: operadores por institución; privacidad: registrar operador, autorización, origen y autoría.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: portal como fuente oficial y postulación asistida con el mismo formulario versionado; registrar operador, institución, origen, autorización/consentimiento, fecha y acciones. Correo sólo notifica y no es repositorio paralelo.
- **Aprobación/límite/documentos:** representante institucional + Nicolás Sena; antes de E1-B/C-014. Afecta J-OPS-001 y UC-ADM-002.
- **Pregunta al colegio:** “¿Qué familias necesitarán ayuda y qué personal puede ingresar datos con ellas, dejando registro de quién hizo cada acción?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `INSTITUTIONAL_VALIDATION_PENDING` por C-014.

### Q-108 — ¿Idiomas y necesidades adicionales de accesibilidad?

- **Contexto/fuentes/condicionantes:** D-009, FR-FRM, NFR-UX-001/002. WCAG 2.2 AA está aprobada; idiomas/dispositivos no. **Situación:** abierta.
- **Opciones:** A) español y accesibilidad AA desde el piloto; foco claro. B) multilingüe completo desde piloto; inclusivo, mayor esfuerzo/contenido. C) español AA más mecanismo de asistencia y arquitectura de contenido traducible; evolutivo.
- **Impactos:** familia: C cubre base y excepciones; operación: requiere canal de apoyo; tenant: idioma futuro configurable; privacidad: asistencia no debe compartir credenciales.
- **Recomendación/razón:** **C ajustada por aprobación de producto**: MVP en español, móvil prioritario, WCAG 2.2 AA, teclado/lector y lenguaje claro; contenido preparado conceptualmente para traducción futura, sin sistema multilingüe completo.
- **Aprobación/límite/documentos:** Nicolás Sena + institución y usuarios de validación; antes de cerrar G1 para alcance del piloto.
- **Pregunta al colegio:** “¿Qué barreras de idioma, lectura, visión, movilidad, dispositivo o conectividad enfrentan hoy las familias?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

## Documentos

### Q-120 — Catálogo base extraído; faltan formatos, tamaños, vigencias y condiciones por curso

- **Contexto/fuentes/condicionantes:** C-011, FR-DOC-001/007/008, SRC-002/SRC-003. **Situación:** parcial.
- **Opciones sobre personalidad:** A) exigir 2025 y 2026 a todos; clara, pero contradice “cuando corresponda” y excluye trayectorias distintas. B) un informe vigente o equivalente según curso/periodo/condición; flexible y trazable. C) no exigirlo; simple, pero puede perder antecedente que el colegio justifique.
- **Impactos:** familia: B admite equivalentes y evita documentos imposibles; operación: reglas por curso/periodo; tenant: catálogo versionado; privacidad: pedir sólo lo necesario.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: catálogo por curso/periodo/condición/versión; nacimiento y antecedentes académicos base cuando correspondan; personalidad condicional; informe vigente o equivalente; no exigir rígidamente 2025 y 2026. Formatos/tamaños se decidirán funcionalmente sin seleccionar almacenamiento.
- **Aprobación/límite/documentos:** representante institucional + Admisión + Nicolás Sena; antes de E1-B y publicación 2027.
- **Pregunta al colegio:** “¿Para qué cursos se pide informe de personalidad, de qué periodo y qué documento equivalente aceptan si la familia no tiene 2025 y 2026?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `INSTITUTIONAL_VALIDATION_PENDING` por C-011.

### Q-121 — ¿Quién revisa cada tipo y quién puede eximir?

- **Contexto/fuentes/condicionantes:** FR-DOC-004, D-004; exención requiere motivo/auditoría. **Situación:** abierta.
- **Opciones:** A) todo Admisión; simple, rol amplio. B) revisores por tipo y exención por responsable distinto; mínimo privilegio, más coordinación. C) cualquier revisor puede eximir; rápido, débil control.
- **Impactos:** familia: decisiones consistentes; operación: B requiere suplencias; tenant: matriz por institución; privacidad: acceso sólo al tipo asignado.
- **Recomendación/razón:** **B**, con exenciones de bajo riesgo delegables por regla y sensibles bajo aprobación reforzada.
- **Aprobación/límite/documentos:** Admisión + Dirección/administrador; antes de E1-B. Afecta RACI, UC-DOC-002/003.
- **Pregunta al colegio:** “¿Quién revisa cada documento y quién puede aceptar que un requisito no se presente?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-122 — ¿Cuántas correcciones y qué plazos?

- **Contexto/fuentes/condicionantes:** FR-DOC-005, FR-COM-001; plazos no confirmados. **Situación:** abierta.
- **Opciones:** A) una corrección fija; simple, inflexible. B) número/plazo configurables y excepción autorizada; justo y trazable. C) ilimitadas hasta cierre; amable, pero bloquea operación.
- **Impactos:** familia: B anticipa reglas; operación: cola y SLA claros; tenant: configuración versionada; privacidad: recordatorios mínimos.
- **Recomendación/razón:** **B**, con al menos una oportunidad y escalamiento humano antes de cerrar por una causa corregible; cifras deben darlas el colegio.
- **Aprobación/límite/documentos:** Admisión + Dirección; antes de E1-B.
- **Pregunta al colegio:** “¿Cuánto tiempo tendrá una familia para corregir y cuántos intentos permiten antes de escalar o cerrar?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-123 — ¿Cómo tratar archivos con contraseña, multipágina o firmas?

- **Contexto/fuentes/condicionantes:** FR-DOC-002/003, NFR-FIL-003 a 005. Proveedor/antivirus fuera de alcance. **Situación:** abierta.
- **Opciones:** A) aceptar todo y revisar manualmente; alto riesgo. B) catálogo de formatos seguros, multipágina permitido, archivos cifrados rechazados con instrucción; claro. C) desbloqueo/transformación institucional; complejo y riesgoso.
- **Impactos:** familia: B da reglas accionables; operación: menos excepciones; tenant: catálogo configurable dentro de límites globales; seguridad: cierre seguro.
- **Recomendación/razón:** **B**; firma visible se trata como contenido, no se valida criptográficamente sin decisión posterior.
- **Aprobación/límite/documentos:** Nicolás Sena + Admisión; regla funcional antes de E1-B, mecanismo en arquitectura.
- **Pregunta al colegio:** “¿Qué formatos reciben hoy, aceptan documentos de varias páginas y qué hacen cuando vienen protegidos con contraseña?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

### Q-124 — ¿Puede la familia eliminar un archivo antes/después de enviar?

- **Contexto/fuentes/condicionantes:** FR-DOC-005/006, FR-AUD-004, C-007. **Situación:** abierta.
- **Opciones:** A) borrar siempre; simple para familia, rompe evidencia. B) antes de enviar retirar; después reemplazar/superseder sin borrar historia; equilibrada. C) nunca retirar; trazable, mala experiencia en borrador.
- **Impactos:** familia: B permite corregir; operación: conserva revisión; tenant: ciclo de vida por caso; privacidad: retención/eliminación final queda Q-202.
- **Recomendación/razón:** **B**; ocultar versión sustituida a la familia cuando corresponda, pero conservar según política pendiente.
- **Aprobación/límite/documentos:** Nicolás Sena + institución; antes de E1-B; retención legal posterior.
- **Pregunta al colegio:** “¿Una familia puede reemplazar un documento ya enviado y qué evidencia necesitan conservar?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`; Q-202 pendiente.

## Entrevistas y evaluaciones

### Q-140 — Piloto exige entrevista y evaluación para todos; falta repetición/excepciones y validación C-009

- **Contexto/fuentes/condicionantes:** D-015 aprobada por producto; C-009 diferencia SRC-002 y requiere validación institucional; FR-ACT-001. **Situación:** parcial.
- **Opciones:** A) evaluación obligatoria universal y fija; coincide con D-015, pero no evoluciona. B) obligatoria para todos en configuración del piloto y configurable por oferta/curso en el núcleo; trazable y multiempresa. C) decisión manual por caso; flexible, inconsistente y riesgosa.
- **Impactos:** familia: B comunica regla previa; operación: excepciones explícitas; tenant: regla versionada; privacidad: resultado altamente restringido.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: entrevista del apoderado y evaluación diagnóstica obligatorias para todos los cursos del piloto; configurables por oferta en el núcleo; repetición/exención sólo por regla, autoridad, motivo y auditoría. C-009 conserva validación institucional.
- **Aprobación/límite/documentos:** Arturo/representante institucional + Nicolás Sena; antes de G1. Afecta J-ADM-003, UC-ACT-003 y C-009.
- **Pregunta al colegio:** “¿Confirman entrevista del apoderado y evaluación diagnóstica para todos los cursos? ¿Cuándo se repite o se permite una excepción?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `INSTITUTIONAL_VALIDATION_PENDING` por C-009.

### Q-141 — Colegio asigna horarios directamente

- **Contexto/fuentes/condicionantes:** D-014 aprobada, FR-ACT-007. **Situación:** regla base resuelta; falta detalle operativo.
- **Opciones:** A) familia elige; contradice D-014. B) colegio asigna y familia confirma; claro, requiere política de confirmación. C) colegio asigna y sólo permite solicitud de cambio; control operativo y flexibilidad acotada.
- **Impactos:** familia: C evita agenda abierta; operación: cola de cambios; tenant: origen de horario configurable; privacidad: no exponer agenda.
- **Recomendación/razón:** **C**, conservando D-014; la confirmación puede ser acuse, no selección.
- **Aprobación/límite/documentos:** Admisión + institución; antes de E1-B para detalle.
- **Pregunta al colegio:** “Al asignar un horario, ¿la familia sólo recibe la cita o debe confirmarla? ¿Puede pedir cambio?”
- **Estado histórico:** `PARTIAL`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-142 — ¿Reprogramación, cancelación, inasistencia y tolerancia?

- **Contexto/fuentes/condicionantes:** A-008, FR-ACT-002/004. No hay cifras aprobadas. **Situación:** abierta.
- **Opciones:** A) reglas rígidas sin excepción; simples, poco equitativas. B) reglas configurables con solicitud, motivos codificados y excepción humana; trazables. C) manejo libre por correo; flexible, no auditable.
- **Impactos:** familia: B explica consecuencias; operación: tareas y SLA; tenant: política por proceso; privacidad: motivo mínimo.
- **Recomendación/razón:** **B**, con al menos solicitud registrada, historial de horarios y revisión humana antes de efecto terminal; cantidades/plazos quedan al colegio.
- **Aprobación/límite/documentos:** Admisión + Dirección; antes de E1-B.
- **Pregunta al colegio:** “¿Cuántos cambios se permiten, con cuánta anticipación y qué ocurre ante atraso o inasistencia?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-143 — ¿Presencial, remota o híbrida; ubicación/enlace?

- **Contexto/fuentes/condicionantes:** FR-ACT-006 diferida para integraciones de calendario/videollamada. **Situación:** abierta.
- **Opciones:** A) sólo presencial; simple, menos accesible. B) modalidad configurable por actividad con ubicación o enlace minimizado; flexible. C) híbrida siempre; compleja e innecesaria.
- **Impactos:** familia: B acomoda casos; operación: plantillas/modos; tenant: modalidad configurada; seguridad: enlaces no públicos y sin datos en URLs.
- **Recomendación/razón:** **B** a nivel funcional, sin integrar proveedor; el piloto puede seleccionar presencial si el colegio lo confirma.
- **Aprobación/límite/documentos:** Admisión + entrevistadores/evaluadores; antes de E1-B.
- **Pregunta al colegio:** “¿Las actividades serán presenciales, remotas o dependerán del caso? ¿Qué información de ubicación debe recibir la familia?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`; modalidad concreta pendiente.

### Q-144 — ¿Pauta, resultado y confidencialidad detallada?

- **Contexto/fuentes/condicionantes:** FR-ACT-005, D-004, C-013. **Situación:** abierta.
- **Opciones:** A) nota libre visible a Admisión/Dirección; simple, excesiva. B) pauta estructurada, conclusión separada y visibilidad por función; consistente. C) sólo completada/no completada; mínima, puede ser insuficiente.
- **Impactos:** familia: no ve deliberación, recibe sólo próximos pasos; operación: B mejora consistencia; tenant: pauta versionada; privacidad: campo/sección y acceso auditado.
- **Recomendación/razón:** **B**, minimizando texto libre y separando asistencia, pauta, conclusión y recomendación.
- **Aprobación/límite/documentos:** entrevistadores/evaluadores + Admisión + Dirección; antes de E1-B.
- **Pregunta al colegio:** “¿Qué debe registrar quien entrevista o evalúa, quién necesita verlo y qué parte, si alguna, se comunica a la familia?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-145 — ¿Puede corregirse una conclusión y por quién?

- **Contexto/fuentes/condicionantes:** FR-ACT-004/005, FR-AUD-004. **Situación:** abierta.
- **Opciones:** A) edición silenciosa por autor; rápida, sin trazabilidad. B) nueva versión por autor o supervisor autorizado, con motivo; trazable. C) inmutable absoluta; segura, impide corregir error.
- **Impactos:** familia: evita decisiones basadas en error; operación: flujo de corrección; tenant: autoridad por rol/scope; privacidad: acceso reforzado.
- **Recomendación/razón:** **B**; después de decisión final, corrección debe escalar y no cambiar resultado automáticamente.
- **Aprobación/límite/documentos:** Admisión + Dirección + responsables de actividad; antes de E1-B.
- **Pregunta al colegio:** “Si una conclusión tiene un error, ¿quién puede corregirla y quién debe aprobar el cambio?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

## Decisión, cupos y espera

### Q-160 — Admisión recomienda y Dirección decide; criterios/fundamentos siguen abiertos

- **Contexto/fuentes/condicionantes:** D-016, FR-DEC-003 a 007. **Situación:** parcial.
- **Opciones:** A) notas libres sin pauta; flexible, inconsistente. B) criterios/pauta versionados, evidencia permitida y fundamento obligatorio; trazable. C) puntuación automática decisoria; eficiente, peligrosa/no autorizada.
- **Impactos:** familia: B favorece coherencia sin exponer deliberación; operación: pauta y devoluciones claras; tenant: criterios por proceso dentro de límites; privacidad: sólo datos necesarios.
- **Recomendación/razón:** **B**; excluir automatización decisoria en piloto y conservar juicio humano separado.
- **Aprobación/límite/documentos:** Admisión + Dirección + representante institucional; antes de E1-B.
- **Pregunta al colegio:** “¿Qué antecedentes puede considerar Admisión, cómo fundamenta su recomendación y qué debe revisar Dirección?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; pauta y criterios institucionales pendientes.

### Q-161 — Separación recomendador/aprobador confirmada para piloto

- **Contexto/fuentes/condicionantes:** D-016 aprobada. **Situación:** base resuelta; suplencias/conflictos pendientes.
- **Opciones:** A) misma persona puede ambos siempre; contradice D-016. B) separación estricta por caso, con suplentes formales; clara. C) excepción documentada cuando dotación lo exige; operable, mayor riesgo.
- **Impactos:** familia: decisión más controlada; operación: requiere cobertura; tenant: regla por membresía/asignación; seguridad: evita autoaprobación.
- **Recomendación/razón:** **B** para piloto; si se necesita C, requiere aprobación reforzada, motivo y revisión posterior sin alterar D-016 silenciosamente.
- **Aprobación/límite/documentos:** Dirección + Nicolás Sena; suplencias antes de E1-B.
- **Pregunta al colegio:** “¿Quién reemplaza a Admisión o Dirección y cómo evitamos que una persona recomiende y decida el mismo caso?”
- **Estado histórico:** `PARTIAL`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-162 — ¿Capacidad total, cupo de admisión o vacante disponible?

- **Contexto/fuentes/condicionantes:** FR-CAP-001/002, C-005. **Situación:** abierta.
- **Opciones:** A) capacidad total del curso; estable, no refleja ocupación. B) cupos asignados al proceso de admisión; operativo y controlable. C) vacante calculada dinámicamente con matrícula EduPay; precisa a futuro, acopla etapa actual.
- **Impactos:** familia: no debe interpretarlo como garantía; operación: B permite planificación; tenant: por oferta; seguridad: capacidad interna restringida.
- **Recomendación/razón:** **B** para Admisión, manteniendo separado el total académico y cualquier confirmación de EduPay.
- **Aprobación/límite/documentos:** responsable de cupos + Dirección; antes de E1-B.
- **Pregunta al colegio:** “Cuando hablan de cupos, ¿se refieren a capacidad total del curso o a vacantes reservadas para este proceso?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; valores y responsables pendientes.

### Q-163 — ¿Cuándo se reserva y cuánto dura reserva/oferta?

- **Contexto/fuentes/condicionantes:** FR-CAP-002/003, Q-310. No hay plazos aprobados. **Situación:** abierta.
- **Opciones:** A) reservar al decidir favorable; protege oferta, puede inmovilizar cupos. B) reservar al comunicar; alinea experiencia, exige coordinación. C) reservar al aceptar/pagar; maximiza disponibilidad, permite sobreexpectativa.
- **Impactos:** familia: B reduce resultado favorable sin cupo; operación: vencimiento/liberación claros; tenant: política versionada; seguridad: concurrencia e idempotencia.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: crear la reserva inmediatamente antes o junto a comunicar la oferta favorable; duración configurable; vencimiento, rechazo o desistimiento libera de forma auditable. La duración concreta queda al colegio.
- **Aprobación/límite/documentos:** cupos + Dirección + Admisión; antes de E1-B.
- **Pregunta al colegio:** “¿En qué momento apartan la vacante y cuánto tiempo la mantienen mientras la familia responde o formaliza?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-164 — ¿Orden, prioridades y desempates de espera?

- **Contexto/fuentes/condicionantes:** D-008, FR-CAP-004. **Situación:** abierta; no se inventan prioridades.
- **Opciones:** A) orden de llegada; simple, puede no reflejar política. B) criterios institucionales explícitos y versionados con desempate final; trazable. C) discreción manual; flexible, no reproducible.
- **Impactos:** familia: B permite explicación general; operación: requiere datos/autoridad; tenant: política propia; privacidad: evitar datos sensibles injustificados.
- **Recomendación/razón:** **B**, usando sólo criterios aprobados, objetivos y auditables; promoción humana D-008.
- **Aprobación/límite/documentos:** Dirección + responsable de cupos + representante institucional; antes de E1-B.
- **Pregunta al colegio:** “¿Cómo ordenan la lista de espera y qué regla usan cuando dos casos quedan en la misma situación?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; criterios institucionales pendientes.

### Q-165 — ¿La familia ve posición exacta?

- **Contexto/fuentes/condicionantes:** FR-CAP-005, FR-COM-001. **Situación:** abierta.
- **Opciones:** A) posición exacta; transparente, cambia y puede revelar dinámica. B) categoría/estado sin número; estable, menos detalle. C) sin información de espera; baja transparencia.
- **Impactos:** familia: B confirma vigencia sin prometer; operación: menos consultas si texto claro; tenant: visibilidad configurable; privacidad: no inferir terceros.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: la familia ve espera activa, fecha de actualización y próximos pasos; no posición numérica exacta en MVP ni datos/dinámica de otros postulantes.
- **Aprobación/límite/documentos:** Dirección + comunicaciones; antes de E1-B.
- **Pregunta al colegio:** “¿Quieren mostrar un número exacto o sólo informar que la postulación sigue activa en lista de espera?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

### Q-166 — ¿Qué ocurre si acepta varias ofertas?

- **Contexto/fuentes/condicionantes:** Q-101, FR-COM-006, FR-CAP-002. **Situación:** abierta.
- **Opciones:** A) permitir y resolver en formalización; flexible, bloquea cupos. B) avisar y exigir elección dentro del mismo tenant, sin afectar otros tenants; reduce reservas. C) impedir globalmente; invade autonomía entre instituciones.
- **Impactos:** familia: B hace efectos claros; operación: libera cupos; tenant: no compartir decisiones entre instituciones; privacidad: no revelar otra postulación.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: dentro del mismo colegio/proceso puede exigirse elegir y liberar ofertas restantes; entre tenants no se comparten ni coordinan ofertas/postulaciones.
- **Aprobación/límite/documentos:** Dirección/cupos + Nicolás Sena; antes de E1-B.
- **Pregunta al colegio:** “Si una familia recibe más de una opción dentro del colegio, ¿debe elegir una y cuándo se libera la otra?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`; política de elección pendiente.

### Q-167 — ¿Quién puede reabrir rechazo, desistimiento o expiración?

- **Contexto/fuentes/condicionantes:** FR-AUD-004, flujo conceptual; reapertura no es normal. **Situación:** abierta.
- **Opciones:** A) nunca; simple, injusto ante error. B) autoridad reforzada por tipo, motivo y nueva versión/efectos; controlado. C) cualquier administrador; rápido, alto riesgo.
- **Impactos:** familia: B permite corregir excepción legítima; operación: requiere reconciliar cupo/comunicación/integración; tenant: scope estricto; seguridad: doble control y auditoría.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: sólo autoridades definidas reabren, con motivo, evidencia, auditoría y revisión de cupos, comunicaciones e integración; nunca se borra el estado histórico.
- **Aprobación/límite/documentos:** Dirección + Admisión + cupos; antes de E1-B.
- **Pregunta al colegio:** “¿Quién puede reabrir un caso cerrado, por qué motivos y qué aprobaciones necesita?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; autoridades concretas pendientes.

## Comunicaciones y reportes

### Q-180 — Correo es único canal inicial; WhatsApp diferido

- **Contexto/fuentes/condicionantes:** D-017/D-018 aprobadas, FR-COM-007/008. **Situación:** canal resuelto; usos/fallback pendientes.
- **Opciones:** A) correo único para todos los mensajes del piloto; coherente. B) correo más avisos manuales fuera del sistema; cubre fallos, pierde trazabilidad. C) WhatsApp desde inicio; contradice diferimiento.
- **Impactos:** familia: A necesita correo vigente y portal como fuente de estado; operación: seguimiento de fallos; tenant: plantillas propias; privacidad: contenido mínimo.
- **Recomendación/razón:** **A ajustada por aprobación de producto**: correo es el único canal automático MVP; portal es fuente oficial de estado/acciones/plazos; fallo genera tarea interna; WhatsApp y canales automáticos alternativos siguen diferidos.
- **Aprobación/límite/documentos:** decisión heredada; Admisión/comunicaciones valida procedimiento antes de E1-B.
- **Pregunta al colegio:** “Confirmado el correo como canal inicial, ¿qué hace el personal cuando un mensaje rebota o la familia indica que no lo recibió?”
- **Estado histórico:** `PARTIAL`.
- **Estado consolidado:** `APPROVED_PRODUCT`; procedimiento de fallos pendiente.

### Q-181 — ¿Plantillas, remitente, horarios y escalamiento por fallo de correo?

- **Contexto/fuentes/condicionantes:** FR-COM-002/003/005/007; proveedor Q-404 fuera de alcance. **Situación:** abierta.
- **Opciones:** A) texto libre por operador; rápido, inconsistente. B) plantillas versionadas por propósito con aprobación, ventana y cola de fallos; trazable. C) una plantilla genérica; simple, poco accionable.
- **Impactos:** familia: B entrega instrucciones claras; operación: responsables por fallo; tenant: contenido/remitente configurado; privacidad: variables permitidas.
- **Recomendación/razón:** **B ajustada por aprobación de producto**: plantillas por recepción, corrección, cita, reprogramación, resultado, oferta, vencimiento y cierre; estados `PREPARED`, `SENT`, `DELIVERED` sólo con evidencia y `FAILED`; resultado sólo después de decisión final.
- **Aprobación/límite/documentos:** comunicaciones + Admisión + Dirección para resultados; antes de E1-B.
- **Pregunta al colegio:** “¿Quién redacta y aprueba cada mensaje, desde qué nombre se envía, en qué horarios y quién atiende los rebotes?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-182 — ¿Qué historial se muestra a familia?

- **Contexto/fuentes/condicionantes:** FR-COM-001, FR-AUD-003, flujo de estados familiares. **Situación:** abierta.
- **Opciones:** A) todo evento interno; transparente, expone deliberación. B) hitos y comunicaciones familiares con acciones/plazos; útil y seguro. C) sólo estado actual; simple, genera dudas.
- **Impactos:** familia: B permite reconstruir; operación: reduce consultas; tenant: textos configurables dentro de estados canónicos; privacidad: excluir actores/notas/puntajes.
- **Recomendación/razón:** **B**, con recepción, acciones, respuestas, citas, comunicaciones, oferta/espera y cierre; nunca recomendación o errores técnicos.
- **Aprobación/límite/documentos:** Admisión + comunicaciones + Dirección; antes de E1-B.
- **Pregunta al colegio:** “¿Qué hitos necesita recordar una familia y qué información interna nunca debería aparecer?”
- **Estado histórico:** `PROPOSED`.
- **Estado consolidado:** `APPROVED_PRODUCT`.

### Q-183 — ¿Reportes/exportaciones, periodicidad y audiencia?

- **Contexto/fuentes/condicionantes:** FR-ADM-006, NFR-PRV-008. Retención Q-202 diferida. **Situación:** abierta.
- **Opciones:** A) exportación libre de tabla completa; flexible, alto riesgo. B) catálogo de reportes por propósito, columnas mínimas y descarga temporal auditada; seguro. C) sólo métricas agregadas; segura, puede no cubrir operación.
- **Impactos:** familia: menor exposición con B; operación: catálogo requiere definición; tenant: filtro obligatorio; privacidad: separar identificables/agregados y restringir salud/finanzas.
- **Recomendación/razón:** **B**, privilegiando vistas agregadas y habilitando identificables sólo con propósito/rol/aprobación.
- **Aprobación/límite/documentos:** Admisión + Dirección + Nicolás Sena/privacidad; alcance funcional antes de E1-B, retención antes de datos reales.
- **Pregunta al colegio:** “¿Qué decisiones toman con reportes, quién los recibe, con qué frecuencia y qué columnas realmente necesita?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

### Q-184 — ¿SLA operativos por etapa?

- **Contexto/fuentes/condicionantes:** NFR métricas aún sin umbral; plazos institucionales faltantes. **Situación:** abierta.
- **Opciones:** A) un plazo total; simple, no identifica cuello. B) tiempos objetivo por etapa/acción con dueño y escalamiento; accionable. C) sin SLA piloto; flexible, baja previsibilidad.
- **Impactos:** familia: B permite expectativas; operación: medición/alertas futuras; tenant: calendario/horario configurable; privacidad: métricas sin datos sensibles.
- **Recomendación/razón:** **B**, iniciando con objetivos operativos, no compromisos técnicos; el colegio debe aportar valores y calendario.
- **Aprobación/límite/documentos:** Admisión + Dirección + responsables de cada etapa; antes de E1-C/G1.
- **Pregunta al colegio:** “¿En cuánto tiempo esperan revisar, pedir correcciones, asignar citas, decidir y responder, y quién actúa cuando se supera?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; `OPERATIONAL_DETAIL_PENDING`.

## Momento funcional del handoff

### Q-310 — ¿Handoff tras aprobación de Dirección o tras aceptación familiar explícita?

- **Contexto/fuentes/condicionantes:** D-021 a D-024, FR-INT-005/006/008, C-002. EduPay necesita estudiante y asociación académica antes de obligaciones. El mecanismo/API y Q-301 a Q-309 quedan fuera de E1-A. **Situación:** bloqueante G1.
- **Opciones:** A) inmediatamente después de decisión favorable; adelanta preparación y reduce espera, pero transfiere casos que podrían rechazar/no formalizar y exige compensación. B) después de aceptación expresa de oferta; prueba intención, reduce trabajo/transferencia, agrega una acción/plazo. C) después del pago o formalización; máxima certeza, pero puede ser circular porque EduPay necesita crear/vincular estudiante/asociación para generar obligaciones y permitir pago.
- **Impactos:** familia: B explica un paso claro antes de matrícula; operación: requiere seguimiento de oferta/vencimiento; tenant: regla contractual/configurable, no global por colegio; privacidad: B minimiza transferencias innecesarias; seguridad: evento idempotente y separado de matrícula.
- **Recomendación/razón:** **B aprobada por producto**. Secuencia: Admisión recomienda; Dirección decide favorable; se reserva/emite oferta; se comunica plazo; el adulto único facultado acepta; Admisión crea handoff; EduPay crea/vincula estudiante, adulto y asociación; EduPay genera obligaciones; familia paga fuera de Admisión; EduPay comunica estados posteriores. Si se rechaza/desiste/vence, se libera reserva y no se inicia handoff. C no es disparador porque puede impedir la preparación necesaria para el pago; Q-301 a Q-309 siguen abiertas.
- **Riesgos:** aceptación duplicada/vencida, reserva inmovilizada, desistimiento durante handoff, divergencia y significado futuro de matrícula. Mitigar funcionalmente con hitos separados, confirmación humana, plazos, idempotencia y estado técnico distinto del negocio.
- **Aprobación/límite/documentos:** Nicolás Sena + representante institucional + Admisión/Dirección; antes de E1-B para fijar journey. Propietarios de ambos dominios resolverán contrato/Q-301 a Q-309 antes de integración.
- **Pregunta al colegio:** “Después de un resultado favorable, ¿la familia debe aceptar la vacante antes de que preparemos sus datos en EduPay, o el colegio necesita iniciar esa preparación inmediatamente?”
- **Estado histórico:** `NEEDS_DECISION`.
- **Estado consolidado:** `APPROVED_PRODUCT`; Q-301 a Q-309 y contrato EduPay pendientes.

## Addendum E1-B — Validación institucional incorporada

La respuesta institucional/funcional confirmada por Nicolás Sena el `2026-08-06` se registra como fuente posterior a las recomendaciones históricas del workbook. Este addendum prevalece sobre los textos que todavía describan C-009, C-011, C-013 o C-014 como validación institucional pendiente.

| Contradicción | Estado consolidado | Regla incorporada | Pendiente que permanece |
| --- | --- | --- | --- |
| C-009 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Entrevista de apoderado y evaluación diagnóstica obligatorias para todos los cursos del piloto; configuración versionada por tenant/proceso/año/oferta/curso/tipo; excepciones, reprogramación, repetición y cierre con motivo e historia auditable | Personas, suplencias, pautas, modalidades, cantidades, tolerancias y autoridad concreta de cierre |
| C-011 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Requisito configurable; último informe vigente/disponible o equivalente del establecimiento anterior; exención autorizada con requisito, actor, motivo, fecha, alcance y auditoría; no 2025/2026 rígidos | Catálogo concreto del piloto |
| C-013 | `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING` | PIE/NEE opcionales y progresivos para apoyos; salud/tratamientos sólo por necesidad funcional concreta; ingreso familiar fuera del formulario MVP; acceso restringido por propósito y auditable | Fundamento normativo, textos, retención, eliminación/anonimización, titulares y matriz legal |
| C-014 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Portal como fuente oficial; asistencia presencial de Admisión/Secretaría con adulto presente y evidencia; documento físico digitalizado al requisito con origen conceptual `PHYSICAL_DOCUMENT` | Personal, suplencias, evidencias detalladas y conservación/devolución física |

### Reglas funcionales derivadas

- Una actividad no completada se registra y normalmente se reprograma. Exenta, cerrada, no completada y completada son estados distintos.
- Cada intento de evaluación conserva secuencia, fecha, responsable, estado, motivo de repetición, resultado/conclusión y relación con el intento anterior. No hay reemplazo silencioso.
- La obligación de entrevista/evaluación se configura por tenant, proceso/año, oferta, curso/nivel y tipo de actividad; no se hardcodea.
- El Administrador Institucional Máximo es distinto del administrador institucional normal y sólo actúa dentro de su tenant. El Superadministrador Global requiere elevación explícita para contenido institucional; `SELF-ELEVATION` está aprobada conceptualmente para el MVP y siempre es auditable.

### Preguntas actualizadas por la validación

| Pregunta | Estado E1-B | Actualización funcional |
| --- | --- | --- |
| Q-104 | `APPROVED_PRODUCT`; `INSTITUTIONALLY_VALIDATED` por C-013; `LEGAL_VALIDATION_PENDING` | PIE/NEE progresivos y opcionales; salud mínima por necesidad; ingreso familiar fuera del formulario MVP |
| Q-107 | `APPROVED_PRODUCT`; `INSTITUTIONALLY_VALIDATED` por C-014; `OPERATIONAL_DETAIL_PENDING` | Portal oficial y postulación asistida con adulto presente, operador, origen, consentimiento y acciones |
| Q-120 | `APPROVED_PRODUCT`; `INSTITUTIONALLY_VALIDATED` por C-011; `OPERATIONAL_DETAIL_PENDING` | Informe vigente/disponible o equivalente; aplicabilidad configurable; no años rígidos |
| Q-140 | `APPROVED_PRODUCT`; `INSTITUTIONALLY_VALIDATED` por C-009; `OPERATIONAL_DETAIL_PENDING` | Actividades obligatorias en piloto; excepciones, repetición, reprogramación y cierre auditados |
| Q-142 | `APPROVED_PRODUCT`; `INSTITUTIONALLY_VALIDATED` por C-009; `OPERATIONAL_DETAIL_PENDING` | No completada → registrar y reprogramar; eximir/cerrar sólo excepcionalmente con motivo y auditoría |
| Q-144 | `APPROVED_PRODUCT`; `INSTITUTIONALLY_VALIDATED` por C-009/C-013; pendientes operativos y legales | Resultados y datos sensibles por rol/propósito; no acceso automático de Admisión general |

## Documentos afectados por pregunta

Esta tabla completa el campo **documentos afectados** de cada ficha. `A/R/J/UC/T/V` abrevia actores y RACI (`01`), journeys (`02`), casos de uso (`03`), trazabilidad (`05`) y guía de validación (`06`). Los documentos G0 sólo se referencian; no se reescriben.

| Pregunta | Documentos afectados en E1 | Documento base a actualizar en E1-B/E1-C |
| --- | --- | --- |
| Q-101 | A/R/J/UC/T/V | Oferta y política de duplicados |
| Q-102 | J/UC/T/V | Reglas de postulación y excepciones |
| Q-103 | J/UC/T/V | Oferta, cupos y estados familiares |
| Q-104 | A/R/J/UC/T/V | Catálogo de campos, sensibilidad y permisos |
| Q-105 | A/R/J/UC/T/V | Facultades familiares y aceptación/desistimiento |
| Q-106 | A/R/J/UC/T/V | Verificación y excepciones familiares |
| Q-107 | A/R/J/UC/T/V | Protocolo de postulación asistida |
| Q-108 | J/UC/T/V | Alcance funcional de accesibilidad/idiomas |
| Q-120 | A/R/J/UC/T/V | Catálogo documental del piloto |
| Q-121 | A/R/J/UC/T/V | Matriz de revisión y exención |
| Q-122 | J/UC/T/V | Reglas de corrección y vencimiento |
| Q-123 | J/UC/T/V | Política funcional de archivos admitidos |
| Q-124 | J/UC/T/V | Ciclo de versiones y dependencia de retención |
| Q-140 | A/R/J/UC/T/V | Aplicabilidad y excepciones de actividades |
| Q-141 | A/R/J/UC/T/V | Agenda, confirmación y reprogramación |
| Q-142 | A/R/J/UC/T/V | Reprogramación, inasistencia y tolerancia |
| Q-143 | J/UC/T/V | Modalidad y datos de la cita |
| Q-144 | A/R/J/UC/T/V | Pautas, conclusiones y visibilidad |
| Q-145 | A/R/J/UC/T/V | Corrección versionada de conclusiones |
| Q-160 | A/R/J/UC/T/V | Pauta de recomendación y decisión |
| Q-161 | A/R/J/UC/T/V | Separación, suplencias y conflictos |
| Q-162 | A/R/J/UC/T/V | Concepto de cupo de admisión |
| Q-163 | A/R/J/UC/T/V | Reserva, oferta, plazo y liberación |
| Q-164 | A/R/J/UC/T/V | Política de orden y desempate |
| Q-165 | J/UC/T/V | Proyección familiar de espera |
| Q-166 | A/R/J/UC/T/V | Ofertas múltiples y respuesta familiar |
| Q-167 | A/R/J/UC/T/V | Excepciones y reaperturas |
| Q-180 | A/R/J/UC/T/V | Procedimiento de comunicación inicial |
| Q-181 | A/R/J/UC/T/V | Plantillas, responsabilidades y fallos |
| Q-182 | J/UC/T/V | Historial y estados familiares |
| Q-183 | A/R/J/UC/T/V | Catálogo de reportes/exportaciones |
| Q-184 | A/R/J/UC/T/V | SLA funcionales y escalamiento |
| Q-310 | A/R/J/UC/T/V | Secuencia oferta-aceptación-handoff |

## Dependencias expresamente no resueltas

- Q-201 a Q-210: legalidad, privacidad, seguridad y operación; C-013 sólo recibe justificación funcional en G1.
- Q-301 a Q-309: contrato, identidad, payload, interfaz, SLA, reversión y evento de matrícula; se citan, no se deciden.
- Q-401 a Q-408 y ADR-0001: arquitectura fuera de alcance.

## Resumen de recomendaciones principales

1. Una postulación por oferta, con política de duplicados explícita.
2. Disponibilidad categórica, sin prometer cupo.
3. Captura progresiva y mínima; sensibles opcionales/condicionales hasta justificación.
4. Portal principal con postulación asistida auditada.
5. Requisitos documentales por curso, periodo y condición; aceptar equivalentes definidos.
6. Actividades configurables, obligatorias en el piloto sólo con validación C-009; agenda asignada por colegio.
7. Pautas estructuradas, versiones y separación estricta Admisión/Dirección.
8. Cupo de admisión separado, reserva al emitir oferta y promoción de espera con confirmación humana.
9. Historial familiar de hitos seguros y correo con plantillas versionadas.
10. Handoff después de aceptación expresa, sujeto a aprobación humana de Q-310.
