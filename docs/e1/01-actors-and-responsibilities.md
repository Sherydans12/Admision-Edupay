# Actores y responsabilidades

## Estado y reglas de lectura

Este documento es `PROPOSED`. Describe capacidades funcionales, no cargos, contratos ni permisos implementables. Una persona puede representar varios actores, pero cada acción conserva el rol utilizado, el tenant, el propósito y los conflictos aplicables. D-004, D-005 y D-016 son decisiones aprobadas heredadas; la asignación concreta de personas y delegaciones requiere validación institucional.

Sensibilidad: `PUBLIC`, `INTERNAL`, `PERSONAL`, `RESTRICTED` y `HIGHLY_RESTRICTED`, según `docs/06-multitenancy-security.md`.

## Límite funcional aprobado para el MVP familiar

Existe un único adulto responsable con cuenta. Ese adulto puede editar, enviar, desistir y aceptar la vacante. Madre, padre, apoderado titular y apoderado financiero pueden registrarse como información relacionada, pero no tienen cuentas colaborativas en el MVP. Invitaciones, coadministración y resolución de conflictos quedan para una evolución posterior. Esta regla no elimina el análisis de facultades institucionales ni convierte un identificador en autorización.

## Actores externos

| Actor | Objetivo | Responsabilidades | Acciones tentativamente permitidas | Acciones prohibidas | Datos mínimos y sensibilidad | Alcance institucional |
| --- | --- | --- | --- | --- | --- | --- |
| Apoderado postulante | Iniciar y seguir postulaciones familiares | Declarar relación, aportar información veraz, revisar condiciones y atender acciones | Crear cuenta; gestionar estudiantes autorizados; guardar/enviar; corregir; consultar; confirmar/solicitar cambio; desistir o responder oferta si se aprueba | Ver otros grupos; acceder a notas, pautas, recomendación, posición ajena o datos internos; decidir cupos | Identidad/contacto `PERSONAL`; relación y datos del menor `RESTRICTED`; campos sensibles sólo si se aprueban | Sólo sus perfiles globales controlados y postulaciones autorizadas; cada envío crea snapshot del tenant |
| Madre | Aportar antecedentes y, si está autorizada, actuar por el estudiante | Mantener sus datos y respetar facultades declaradas | Ser informada o editar/enviar sólo según Q-105 | Presumir autorización por parentesco declarado; ver datos de otro adulto sin propósito | Identidad/contacto `PERSONAL/RESTRICTED`; facultad declarada | Relación familiar; acceso institucional sólo a través de la postulación |
| Padre | Igual objetivo funcional que madre, sin jerarquía automática | Mantener sus datos y respetar facultades declaradas | Ser informado o editar/enviar sólo según Q-105 | Presumir autorización; cambiar apoderado titular/financiero sin control | Identidad/contacto `PERSONAL/RESTRICTED`; facultad declarada | Relación familiar; no concede membresía institucional |
| Apoderado titular | Representar operacionalmente al estudiante si la institución lo reconoce | Atender comunicaciones y acciones asignadas; mantener evidencia de representación | Editar, enviar, confirmar o desistir sólo en facultades aprobadas | Acceder a deliberación; reemplazar responsables sin evidencia | Identidad, contacto y relación `RESTRICTED` | Postulaciones donde la facultad esté registrada y vigente |
| Apoderado financiero | Recibir o asumir acciones financieras externas cuando corresponda | Mantener datos mínimos para futuro handoff aprobado | Revisar/confirmar sus datos; recibir indicación de formalización si se autoriza | Ver salud/NEE o decisión interna; alterar obligaciones de EduPay desde Admisión | Identidad/contacto `RESTRICTED`; finanzas `HIGHLY_RESTRICTED` | Caso autorizado; EduPay conserva autoridad financiera |
| Estudiante postulante | Participar en evaluación y aportar antecedentes adecuados a su edad | Asistir a actividades y, cuando corresponda, comprender el uso de sus datos | Participar en entrevista/evaluación; no se presume cuenta propia | Ver deliberaciones, datos financieros del hogar o expedientes ajenos; decidir institucionalmente | Identidad/educación `RESTRICTED`; salud/evaluación `HIGHLY_RESTRICTED` | Sólo su postulación; el adulto autorizado gestiona el portal en el piloto propuesto |

### Gobernanza y trazabilidad de actores externos

| Actor | Conflictos y separación de funciones | Delegaciones posibles | Preguntas pendientes | Requisitos | Casos de uso |
| --- | --- | --- | --- | --- | --- |
| Apoderado postulante | Conflicto entre adultos sobre facultad, respuesta o desistimiento; una identidad no basta como autorización | A otro adulto autorizado, con invitación/revocación futura | Q-101, Q-102, Q-105 a Q-108, Q-166 | FR-ID-001 a 006; FR-APP-003 a 009; FR-COM-001/006 | UC-FAM-001 a 013; UC-APP-001 a 004 |
| Madre | Puede coincidir con titular/financiero; cambios sensibles requieren trazabilidad | Facultades acotadas según Q-105 | Q-104 a Q-106 | FR-ID-003 a 006; FR-FRM-005/006 | UC-FAM-003/004; UC-APP-001/003 |
| Padre | Igual tratamiento funcional que madre | Facultades acotadas según Q-105 | Q-104 a Q-106 | FR-ID-003 a 006; FR-FRM-005/006 | UC-FAM-003/004; UC-APP-001/003 |
| Apoderado titular | No debe conferir por sí mismo acceso financiero o sensible | Suplencia registrada y revocable | Q-105, Q-106 | FR-ID-003/005/006; FR-COM-001 | UC-FAM-003; UC-APP-003 |
| Apoderado financiero | Separar su propósito financiero de evaluación/admisión | Sustitución sólo con evidencia y autorización | Q-104, Q-105, Q-310 | FR-FRM-005/006; FR-INT-005/006 | UC-FAM-003; UC-INT-001 |
| Estudiante postulante | Proteger interés y privacidad del menor; no usar evaluación como acceso general a salud | Acompañamiento por adulto/profesional según regla | Q-104, Q-140, Q-143, Q-144 | FR-ACT-001/004/005; NFR-PRV-003 | UC-ACT-004/005 |

## Actores institucionales

| Actor | Objetivo | Responsabilidades | Acciones tentativamente permitidas | Acciones prohibidas | Datos mínimos y sensibilidad | Alcance institucional |
| --- | --- | --- | --- | --- | --- | --- |
| Encargado de admisión | Coordinar el proceso y emitir recomendación | Clasificar casos, coordinar revisión/agenda, consolidar y recomendar | Ver casos de su alcance; asignar; observar; coordinar; recomendar; preparar comunicaciones autorizadas | Tomar decisión final; revelar notas; autoasignarse permisos | Identidad/postulación `RESTRICTED`; sensibles sólo por permiso específico; deliberación `HIGHLY_RESTRICTED` | Tenant, sede, año, curso o casos asignados |
| Revisor documental | Resolver requisitos documentales asignados | Revisar versión segura; aceptar, observar, rechazar o proponer exención | Ver metadatos/archivo necesario; registrar dictamen y motivo | Ver datos no requeridos; borrar historia; eximir sin autoridad | Documentos `RESTRICTED`; algunos `HIGHLY_RESTRICTED` | Requisitos/casos asignados dentro del tenant |
| Entrevistador del apoderado | Realizar y concluir entrevista | Preparar actividad, registrar asistencia y conclusión restringida | Ver agenda y datos mínimos; registrar pauta/conclusión | Decidir admisión; ver evaluación o finanzas sin propósito; comunicar resultado | Contacto `PERSONAL`; pauta/deliberación `HIGHLY_RESTRICTED` | Actividades asignadas |
| Evaluador del estudiante | Aplicar evaluación diagnóstica | Registrar asistencia, aplicación y conclusión bajo pauta | Ver datos mínimos y apoyos expresamente autorizados | Usar datos de salud fuera del propósito; decidir o publicar resultado | Menor/evaluación/salud `RESTRICTED/HIGHLY_RESTRICTED` | Evaluaciones asignadas |
| Dirección | Adoptar decisión final o devolver recomendación | Revisar antecedentes permitidos, justificar decisión/devolución | Aprobar, rechazar o devolver; consultar evidencia necesaria | Alterar evidencia/recomendación histórica; comunicar por cambio intermedio; administrar su permiso | Resumen, recomendación y evidencia `RESTRICTED/HIGHLY_RESTRICTED` | Tenant y oferta bajo autoridad delegada |
| Administrador institucional | Configurar operación y membresías delegadas | Mantener oferta, formularios, requisitos, plantillas y accesos | Crear/editar configuración; publicar si tiene permiso separado; delegar dentro de límite | Autoelevarse; leer contenido sensible por ser administrador; cambiar versiones publicadas | Configuración `INTERNAL`; membresías `RESTRICTED`; contenido sólo por permiso adicional | Un tenant y scopes delegados |
| Operador de postulación asistida | Ayudar a una familia si C-014 se aprueba | Identificar canal, explicar autoría, transcribir y dejar evidencia | Crear borrador asistido; cargar lo entregado; entregar control o enviar sólo según autorización aprobada | Inventar respuestas; actuar sin autorización; ver otros casos; decidir/revisar | Datos aportados `RESTRICTED/HIGHLY_RESTRICTED`; evidencia de asistencia | Caso puntual y ventana temporal |
| Encargado de comunicaciones | Preparar mensajes correctos y autorizados | Mantener plantillas, audiencia, horario y seguimiento de fallos | Preparar/aprobar/enviar según separación configurada | Comunicar resultado sin decisión; incluir datos innecesarios; cambiar estado de negocio | Contacto `PERSONAL`; resultado mínimo `RESTRICTED`; plantillas `INTERNAL` | Tenant, propósito y campañas operativas autorizadas |
| Responsable de cupos | Mantener capacidad, reservas y espera | Registrar ajustes justificados, verificar disponibilidad y promover con control | Definir/ajustar cupos; reservar/liberar; proponer o ejecutar promoción autorizada | Cambiar decisión; sobreofertar; alterar orden sin evidencia | Oferta/capacidad `INTERNAL`; postulante mínimo `RESTRICTED` | Oferta, sede, año y curso asignados |

### Gobernanza y trazabilidad de actores institucionales

| Actor | Conflictos y separación de funciones | Delegaciones posibles | Preguntas pendientes | Requisitos | Casos de uso |
| --- | --- | --- | --- | --- | --- |
| Encargado de admisión | Recomienda, no decide por D-016; comunicar requiere decisión autorizada | Coordinación a revisores/agenda; suplencia formal | Q-121, Q-142, Q-160, Q-181, Q-184 | FR-DEC-001 a 007; FR-ADM-001/002 | UC-DEC-001/002; UC-COM-001 |
| Revisor documental | Exención puede requerir autoridad distinta; no revisar propia carga asistida | Reasignación por tipo documental | Q-121 a Q-124 | FR-DOC-003 a 008 | UC-DOC-001/002 |
| Entrevistador del apoderado | No decide; corrección de conclusión requiere control | Suplente calificado para actividad | Q-142 a Q-145 | FR-ACT-002 a 005 | UC-ACT-001 a 005 |
| Evaluador del estudiante | No decide; acceso sensible sólo por asignación/propósito | Suplente calificado | Q-140, Q-142 a Q-145 | FR-ACT-001 a 005 | UC-ACT-002/004/005 |
| Dirección | No modifica recomendación; devolución no publica resultado | Aprobador suplente formal, nunca recomendador del mismo caso salvo excepción aprobada | Q-160, Q-161, Q-167 | FR-DEC-004 a 007 | UC-DEC-003/004 |
| Administrador institucional | Edición y publicación separables; no autoelevación | Administradores acotados por función | Q-121, Q-183 | FR-FRM-001/008 a 012; FR-ADM-003 a 008 | UC-ADM-001 a 006 |
| Operador de postulación asistida | No revisar/decidir el caso creado; autoría familiar e institucional diferenciada | Operadores temporales formados | Q-107/C-014 | FR-APP-003/008; FR-AUD-001/004 | UC-ADM-007 |
| Encargado de comunicaciones | Preparación, aprobación y envío pueden separarse | Suplente por tenant y propósito | Q-180 a Q-182 | FR-COM-002 a 007 | UC-COM-001 |
| Responsable de cupos | Ajuste y promoción pueden exigir doble control; no alterar criterios | Suplente por oferta | Q-162 a Q-167 | FR-CAP-001 a 005 | UC-CAP-001 a 004 |

## Actores de plataforma y sistemas externos

| Actor | Objetivo | Responsabilidades | Acciones tentativamente permitidas | Acciones prohibidas | Datos mínimos y sensibilidad | Alcance institucional |
| --- | --- | --- | --- | --- | --- | --- |
| Superadministrador | Operar tenants y salud de plataforma | Alta/suspensión administrativa, soporte sin contenido y auditoría de plataforma | Gestionar metadatos; iniciar flujo de soporte | Leer contenido institucional por defecto; suplantar; resolver reglas del colegio | Metadatos `INTERNAL`; sin contenido por defecto | Plataforma; tenant explícito para cualquier acción excepcional |
| Soporte técnico con elevación temporal | Diagnosticar incidente autorizado | Usar ticket, propósito, tiempo y alcance mínimo; dejar auditoría | Acceso puntual aprobado; lectura o corrección mínima si el procedimiento lo permite | Acceso permanente, exploratorio o transversal; exportar; ocultar su intervención | Sólo datos indispensables; puede alcanzar `RESTRICTED` bajo control reforzado | Tenant/recurso/ventana exactos de la elevación |
| Sistema de correo | Entregar notificaciones operativas | Recibir mensaje minimizado, devolver estado técnico | Procesar destinatario, plantilla renderizada y correlación mínima | Decidir resultado; recibir expediente, salud o notas; afirmar entrega sin evidencia | Contacto y contenido mínimo `PERSONAL/RESTRICTED` | Comunicación de un tenant; proveedor aún no seleccionado |
| EduPay | Gestionar registro académico/financiero y confirmar resultados propios | Crear/vincular partes, asociación académica y obligaciones según contrato futuro | Recibir handoff mínimo; responder estado técnico/de negocio | Acceder a documentos, salud, evaluación o notas; escribir datos de Admisión; inferir autorización por identificador | Identidad y relación académica mínima `RESTRICTED`; payload pendiente Q-305 | Mapeo contractual de tenant; dominio separado por D-007 |
| Portal de pagos | Permitir consulta/pago sobre EduPay | Consultar obligaciones a EduPay y procesar experiencia externa | Mostrar y procesar información financiera de EduPay | Consultar Admisión como fuente de saldos; cambiar decisión/cupo | Datos financieros en EduPay; Admisión sólo proyecta confirmación | Fuera del dominio Admisión |

### Gobernanza y trazabilidad de plataforma

| Actor | Conflictos y separación de funciones | Delegaciones posibles | Preguntas pendientes | Requisitos | Casos de uso |
| --- | --- | --- | --- | --- | --- |
| Superadministrador | Administración global no implica acceso; elevación separada | A operadores de plataforma dentro de alcance | Q-205 diferida | FR-ADM-007; NFR-TEN-003 | UC-AUD-001 |
| Soporte temporal | Solicitante, aprobador y ejecutor deberían separarse cuando el riesgo lo exija | No transferible durante sesión | Q-205 diferida | FR-ADM-007; NFR-SEC-012 | UC-AUD-001 |
| Sistema de correo | Estado técnico no cambia negocio | Proveedor futuro sujeto a decisión arquitectónica | Q-181; Q-404 diferida | FR-COM-002 a 007 | UC-COM-001 |
| EduPay | Autoridad académica/financiera, no sobre admisión | Operadores propios fuera de esta matriz | Q-301 a Q-310; sólo Q-310 en E1 | FR-INT-001 a 008 | UC-INT-001 a 005 |
| Portal de pagos | Pago no equivale a decisión de admisión | Según dominio EduPay | Q-309 diferida | FR-INT-006/007 | UC-INT-005 |

## Matriz RACI provisional

**Estado: `PROPOSED`.** No sustituye la matriz definitiva de permisos. `R` ejecuta, `A` responde por el resultado, `C` participa, `I` recibe información. Abreviaturas: `AI` administrador institucional, `AD` Admisión, `RD` revisor documental, `EA` entrevistador/evaluador, `DI` Dirección, `CO` comunicaciones, `CU` cupos, `OP` operador asistido, `FA` familia, `ST` soporte temporal, `EP` EduPay.

| Actividad | AI | AD | RD | EA | DI | CO | CU | OP | FA | ST | EP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Publicar convocatoria | A/R | C | I | I | C | C | C | — | I | — | — |
| Configurar formulario | A/R | C | C | C | I | — | — | — | — | — | — |
| Publicar formulario | A/R | C | I | I | C | — | — | — | — | — | — |
| Administrar requisitos documentales | A | R | C | C | I | — | — | — | — | — | — |
| Revisar documentos | I | A | R | C | I | — | — | — | C | — | — |
| Agendar entrevista | I | A/R | — | C | I | C | — | — | C | — | — |
| Realizar entrevista | I | A | — | R | I | — | — | — | C | — | — |
| Agendar evaluación | I | A/R | — | C | I | C | — | — | C | — | — |
| Realizar evaluación | I | A | — | R | I | — | — | — | C | — | — |
| Emitir recomendación | I | A/R | C | C | I | — | C | — | — | — | — |
| Aprobar decisión | I | C | I | I | A/R | — | C | — | — | — | — |
| Comunicar resultado | I | A | — | — | C | R | C | — | I | — | — |
| Administrar cupos | C | C | — | — | I | — | A/R | — | I | — | — |
| Promover lista de espera | I | C | — | — | C | I | A/R | — | I | — | — |
| Crear postulación asistida | A | C | — | — | — | — | — | R | C | — | — |
| Realizar handoff a EduPay | I | A/R | — | — | I | I | C | — | I | C | R/C |
| Reintentar integración | I | A | — | — | I | — | — | — | I | R/C | C |
| Exportar información | A | R/C | — | — | C | — | — | — | I si propia | C excepcional | — |

## Validaciones pendientes

- Confirmar quién ocupa y reemplaza cada actor institucional.
- Confirmar si entrevista y evaluación son funciones distintas.
- Aprobar quién puede eximir, ajustar cupos, publicar, exportar y reabrir.
- Resolver los conflictos cuando una persona acumula roles.
- Validar el acceso a PIE/NEE, salud, evaluaciones e ingreso familiar por propósito.
- Definir la modalidad de postulación asistida antes de asignar `OP`.
