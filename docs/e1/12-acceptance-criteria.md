# Criterios de aceptación funcionales

## Uso

Estos criterios verifican comportamiento, autorización y excepciones sin prescribir pruebas técnicas, interfaz, API ni arquitectura. Los IDs `AC-xxx` son estables para trazabilidad.

## Identidad y familia

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-001 | Un adulto responsable no tiene cuenta | Registra y verifica su canal | Obtiene una cuenta sin que el proceso revele si terceros ya existen |
| AC-002 | Una cuenta intenta consultar o modificar un grupo familiar | Solicita una acción | Sólo se permite sobre integrantes y facultades autorizadas; cualquier otro acceso se deniega |
| AC-003 | Un adulto administra varios hijos y ya envió una postulación | Cambia datos reutilizables del perfil | Puede iniciar postulaciones autorizadas para varios hijos y la instantánea enviada anteriormente conserva su versión |

## Oferta y disponibilidad

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-004 | Existen ofertas publicadas por tenant, sede, año y curso | La familia consulta convocatoria | Sólo ve ofertas vigentes de la institución seleccionada con una categoría aprobada |
| AC-005 | Una oferta tiene cupo numérico interno | La familia consulta disponibilidad | Ve `Postulaciones abiertas`, `Cupos limitados`, `Lista de espera` o `Proceso cerrado`, nunca el número exacto por defecto |
| AC-006 | Una convocatoria está configurada abierta sin cupo inmediato | La familia inicia postulación | Puede postular y recibe una advertencia inequívoca de que postular no garantiza vacante |

## Formulario

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-007 | Un formulario publicado tiene una versión vigente | La familia guarda, continúa y envía | Se aplican campos y reglas de esa versión y una publicación posterior no altera la postulación histórica |
| AC-008 | No existe finalidad concreta para salud o apoyos | La familia completa el formulario | No se exige historia clínica general; PIE/NEE permanece opcional/progresivo e ingreso familiar no aparece en el MVP de Admisión |
| AC-009 | Un configurador intenta publicar código o contenido activo | Usa el constructor | La acción se rechaza; sólo se aceptan tipos, reglas y expresiones controladas por una identidad con permiso de publicación |

## Documentos

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-010 | Una postulación tiene requisitos aplicables | La familia carga un documento | El requisito pasa por `CARGADO` y `EN_REVISION` antes de `ACEPTADO`, `OBSERVADO` o `EXENTO` por actor autorizado |
| AC-011 | Secretaría recibe o carga un documento | Intenta validarlo definitivamente | Puede registrar recepción/carga, pero la aceptación, observación o exención sólo la ejecuta Admisión o revisor autorizado |
| AC-012 | Un requisito fue observado con plazo configurable de 3 días hábiles | El plazo vence sin corrección | El caso queda pendiente de revisión humana y no se rechaza automáticamente |
| AC-013 | La familia reemplaza un documento o se acepta un equivalente/exención | Se registra la resolución | La versión anterior queda `REEMPLAZADO` y se conserva historia, relación, actor, fecha, motivo y alcance aplicable |

## Postulación asistida

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-014 | El apoderado está presente y requiere asistencia | Admisión o Secretaría completa o envía en el portal | Se registra tenant, operador, rol, fecha/hora, adulto, autorización y acciones realizadas |
| AC-015 | La familia entrega excepcionalmente un documento físico | Personal autorizado lo digitaliza | Se carga al requisito correcto con origen `PHYSICAL_DOCUMENT`; el archivo digital integra el expediente oficial sin expediente paralelo |
| AC-016 | Un operador asistió una postulación | Intenta revisar, recomendar o decidir por esa sola condición | La acción se deniega salvo que posea una capacidad independiente y compatible; la asistencia no eleva privilegios |

## Actividades y asistencia

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-017 | Entrevista y evaluación aplican al postulante del piloto | El colegio programa actividades presenciales | La familia ve tipo, fecha, hora, lugar y acción `SOLICITAR CAMBIO`, sin obligación de confirmar asistencia |
| AC-018 | La familia necesita otro horario | Solicita cambio con motivo | Admisión o Secretaría asigna el nuevo horario, conserva cita anterior y registra actor/motivo; la familia no selecciona directamente |
| AC-019 | Ocurre la primera inasistencia | Personal registra el no-show | La postulación no se rechaza ni cierra automáticamente y puede revisarse o reprogramarse |
| AC-020 | Ocurre una segunda inasistencia injustificada | El caso requiere cierre | Sólo Responsable de Admisión o Dirección puede cerrarlo manualmente con motivo y auditoría; el contador por sí solo no cierra |
| AC-021 | Una evaluación no se completa o requiere repetición | Evaluador o Admisión inicia otro intento | Se conserva cada intento y relación; el resultado puede ser `INCONCLUSO`; la familia no ve resultado, comentario, puntaje ni conclusión internos |

## Recomendación de Admisión

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-022 | El expediente tiene antecedentes suficientes | Responsable de Admisión recomienda | Selecciona `RECOMENDAR_ADMISION`, `NO_RECOMENDAR_ADMISION` o `DEVOLVER_A_REVISION` y registra fundamento obligatorio |
| AC-023 | Secretaría u otro actor sin capacidad de recomendación abre el caso | Intenta recomendar | La acción se deniega y no se crea una recomendación válida |
| AC-024 | Existe una recomendación previa | Admisión corrige o vuelve a enviar | Se crea una versión relacionada, sin sobrescribir la anterior, con actor, instante y fundamento auditables |

## Disposición de Dirección

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-025 | Dirección recibe una recomendación y existe cupo | Registra `APROBADO` | Se crea reserva, oferta, comunicación `PREPARED` y plazo de 3 días hábiles, sin handoff inmediato |
| AC-026 | Dirección considera admisible a un postulante sin oferta inmediata | Registra `LISTA_DE_ESPERA` | No se crea oferta, plazo de aceptación ni handoff; la familia sólo ve el estado general de espera |
| AC-027 | Dirección registra `RECHAZADO` o `DEVUELTO_A_REVISION` | Confirma la acción | Rechazo exige fundamento; devolución exige motivo y regresa a Admisión sin constituir decisión definitiva |
| AC-028 | La misma persona recomendó el caso o Secretaría intenta decidir | Intenta registrar disposición | La acción se deniega; recomendador y decisor del mismo caso deben ser personas distintas y Dirección es la capacidad autorizada |

## Cupos

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-029 | Un curso/año no tiene cupo de Admisión configurado | Actor autorizado define el valor | El cupo queda separado de capacidad/matrícula EduPay y disponible sólo como dato operacional interno |
| AC-030 | Existe un cupo configurado | Responsable de Admisión o Administrador Máximo lo modifica | Se conserva valor anterior/nuevo, actor, instante y motivo/comentario; Secretaría no puede modificarlo |
| AC-031 | Dos acciones intentan reservar la misma unidad disponible | Se procesan concurrentemente | Sólo una reserva válida consume el cupo y no se produce sobreoferta |

## Lista de espera

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-032 | Varios postulantes admisibles ingresan a espera y no hay prioridad publicada | Se consulta el orden | Se usa ingreso como orden por defecto; la posición queda interna y la familia no ve número |
| AC-033 | Se libera un cupo y existe postulante admisible en espera | Responsable de Admisión o Administrador Máximo promueve manualmente | Se crea reserva y oferta por 3 días hábiles sin nueva decisión de Dirección cuando la admisibilidad ya existe |
| AC-034 | Secretaría o un proceso automático intenta promover | Solicita la promoción | La acción se deniega y no se crea oferta ni reserva |
| AC-035 | Una oferta originada en espera vence | No hubo aceptación | La oferta expira, libera cupo, conserva origen/historia y no inicia handoff |

## Oferta y aceptación

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-036 | Una oferta normal o de espera está vigente | Familia o personal autorizado la consulta | Se muestra estado, origen y fecha/hora exacta de vencimiento |
| AC-037 | Llega el vencimiento sin respuesta familiar | Se evalúa la oferta | Expira automáticamente, libera reserva, conserva historia y no inicia handoff |
| AC-038 | La familia responsable tiene una oferta vigente | Acepta expresamente | La aceptación queda vinculada a oferta, versión, actor e instante y habilita el borde funcional de handoff |
| AC-039 | Una oferta expiró | Actor autorizado la reabre excepcionalmente | Registra motivo y auditoría, crea el nuevo estado/plazo aplicable y no sobrescribe la expiración anterior |
| AC-058 | Una familia tiene una postulación u oferta activa | Desiste voluntariamente | El desistimiento queda confirmado y auditado, libera cualquier reserva aplicable, conserva historia y no inicia handoff |

## Comunicación

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-040 | Dirección emitió una disposición comunicable | Se prepara el mensaje | Queda `PREPARED` y sólo se envía después de confirmación de Responsable de Admisión |
| AC-041 | Se intenta comunicar por email | Cambia el estado técnico | Se distingue `SENT`, `DELIVERED` con evidencia o `FAILED`; enviado no se presenta como entregado |
| AC-042 | El correo falla | Se recibe el fallo | Se crea tarea interna y no cambian disposición, oferta, aceptación ni cualquier otro estado de negocio |
| AC-043 | Una oferta se aproxima a vencimiento o el colegio llama | Se ejecuta contacto | El recordatorio usa la anticipación configurada; la llamada queda como contacto manual y no como canal automático |

## Dashboard

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-044 | Personal autorizado entra al dashboard | Consulta el proceso | Ve nuevas, por revisar, correcciones venciendo, citas próximas, esperando decisión, ofertas por vencer y lista de espera |
| AC-045 | Un usuario posee alcance limitado | Consulta conteos, búsqueda o flujo | Sólo obtiene casos y agregados de su tenant y scope, sin inferir existencia en otros tenants |
| AC-046 | Un caso avanza o retrocede por una acción válida | Se consulta su flujo | Se muestran etapa completada, estado actual y próxima acción sin confundir recomendación, decisión, oferta, aceptación o matrícula |

## Reporting y exportaciones

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-047 | Responsable de Admisión o Administrador Máximo requiere un reporte | Exporta dentro de su tenant | Se aplican propósito y columnas mínimas y se auditan solicitante, alcance y descarga |
| AC-048 | Secretaría intenta una exportación masiva | Solicita el archivo | Se deniega por defecto y no se genera ni entrega el reporte |
| AC-049 | Un reporte autorizado incluye casos con datos sensibles | Se genera la exportación | No adjunta archivos ni categorías altamente restringidas por defecto y sólo incluye columnas expresamente autorizadas |

## Seguridad y multitenancy

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-050 | Una identidad de tenant A manipula un identificador de tenant B | Solicita expediente, archivo, búsqueda, conteo o exportación | El acceso se deniega sin revelar existencia y queda evidencia de seguridad apropiada |
| AC-051 | Una familia conoce o adivina el identificador de otra postulación | Intenta consultarla o modificarla | La acción se deniega; sólo accede a postulaciones vinculadas a su facultad autorizada |
| AC-052 | Un usuario general de Admisión no posee permiso sensible | Intenta consultar PIE/NEE, salud, evaluación o comentario interno | La lectura se deniega aunque pueda ver el resto del caso; accesos autorizados quedan auditados |
| AC-053 | El Superadministrador Global no tiene elevación activa | Intenta leer contenido de un tenant | La lectura se deniega; su rol de plataforma no concede acceso implícito |
| AC-054 | El Superadministrador necesita soporte excepcional | Ejecuta `SELF-ELEVATION` del MVP | Debe declarar tenant, motivo, alcance, categorías, inicio y expiración; el acceso queda temporal y auditado |

## Handoff funcional

| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-055 | Existe disposición favorable y oferta emitida, pero no aceptación expresa | Se intenta iniciar handoff | La acción no está funcionalmente habilitada |
| AC-056 | Existe aceptación expresa de oferta vigente | Se solicita el handoff | Admisión entrega el caso al borde funcional sin compartir tablas; EduPay conserva propiedad de asociación, obligaciones y pago |
| AC-057 | El handoff está solicitado, entregado, fallido o aceptado técnicamente | Se proyecta estado | Ningún estado técnico equivale por sí solo a matrícula; Q-301 a Q-309 permanecen diferidas y Q-310 resuelta |

## Cobertura

Los 58 criterios cubren casos felices, autorización y excepciones críticas del MVP. Su implementación técnica y diseño de pruebas corresponden a etapas posteriores a G1.
