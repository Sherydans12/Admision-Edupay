# Especificación funcional canónica para G1

## Control y propósito

| Campo | Valor |
| --- | --- |
| Etapa | E1-C — Consolidación funcional |
| Estado | `IN PROGRESS / READY FOR G1 REVIEW` |
| Naturaleza | Especificación funcional canónica; no es diseño técnico |
| Piloto | Colegio Particular Conquistadores — Admisión 2027 |
| Compuerta | G1 `NO APROBADA` |
| Implementación y datos reales | No autorizados |

Este documento consolida el comportamiento funcional aprobado en E1-A y E1-B. Ante una diferencia de redacción con un artefacto exploratorio anterior, esta especificación gobierna la revisión de G1 sin borrar la trazabilidad histórica. Los valores clasificados como configuración, legal, seguridad/operación o integración futura se mantienen en [`15-deferred-and-out-of-scope.md`](15-deferred-and-out-of-scope.md).

## 1. Producto y alcance

Admisión es un SaaS multiempresa. Cada institución opera como tenant aislado y configura su proceso dentro de capacidades comunes. Colegio Conquistadores es el piloto 2027, no un tenant especial ni una excepción en el núcleo.

El piloto cubre de 1º básico a 4º medio y opera inicialmente una sede. La configuración inicial de una sede no elimina el soporte funcional multi-sede: cada oferta se identifica por institución, sede, proceso/año y curso/nivel.

El portal es la fuente oficial de postulaciones, antecedentes, estados, solicitudes y respuestas familiares. Correo, llamadas y papel son canales de comunicación o fuentes excepcionales de documentos; no crean expedientes paralelos.

## 2. Actores

| Actor | Responsabilidad principal | Límite esencial |
| --- | --- | --- |
| Familia/apoderado responsable | Crear cuenta, administrar hijos, postular, corregir, solicitar cambios, aceptar oferta o desistir | Sólo sus estudiantes y postulaciones autorizadas |
| Secretaría | Asistir postulaciones, recibir/digitalizar/cargar documentos y gestionar citas | No recomienda, decide, modifica cupos, promueve espera ni exporta masivamente por defecto |
| Responsable de Admisión | Revisar, coordinar, recomendar, administrar cupos/espera y confirmar comunicaciones | No decide el mismo caso que recomendó |
| Entrevistador configurable | Realizar entrevista y registrar estado, resultado y comentario autorizado | No decide admisión ni accede a datos sin propósito |
| Evaluador configurable | Realizar evaluación, registrar intentos y conclusión | No decide admisión ni reemplaza intentos previos |
| Dirección | Emitir disposición final o devolver a revisión | No altera silenciosamente recomendación ni evidencia |
| Administrador Institucional Máximo | Administrar y supervisar su tenant, incluida información restringida cuando su función lo requiera | Nunca actúa sobre otro tenant; requiere permiso, propósito y auditoría |
| Superadministrador Global | Operar la plataforma y acceder excepcionalmente mediante elevación | No tiene lectura implícita ni permanente de contenido institucional |
| EduPay | Gestionar asociación académica, obligaciones y pago en su dominio | No es dueño del proceso de Admisión ni comparte tablas |

Las suplencias de roles institucionales son configurables. La identidad concreta de una suplencia no cambia el comportamiento y se completa antes de operar el piloto.

## 3. Responsabilidades y separación de funciones

- Secretaría presta apoyo operativo; nunca recomienda ni decide.
- Responsable de Admisión emite una recomendación interna.
- Dirección adopta la disposición institucional.
- La persona que recomienda no puede decidir el mismo caso.
- Los roles y suplencias se asignan por tenant y alcance.
- Toda capacidad aplica mínimo privilegio, denegación por defecto y acceso por propósito.
- Un administrador institucional normal no equivale al Administrador Institucional Máximo.

## 4. Oferta y disponibilidad

Una oferta pertenece a una institución, sede, proceso/año y curso/nivel. Sólo ofertas publicadas y vigentes pueden recibir postulaciones.

La familia ve una categoría, no cantidades exactas por defecto:

- `Postulaciones abiertas`;
- `Cupos limitados`;
- `Lista de espera`;
- `Proceso cerrado`.

La institución puede mantener abierta una convocatoria sin cupo inmediato. Postular nunca garantiza vacante. Los cupos numéricos son información operacional interna.

## 5. Cuenta, familia y estudiante

El MVP usa una cuenta de adulto responsable. Esa cuenta puede administrar varios hijos y varias postulaciones autorizadas. Las cuentas familiares colaborativas quedan como evolución posterior.

La duplicidad se determina por estudiante, institución, proceso/año y curso/oferta; RUT o fecha de nacimiento pueden apoyar la coincidencia, pero no constituyen por sí solos autorización ni deben permitir enumeración. Una excepción o reapertura requiere actor autorizado, motivo y auditoría.

Los datos reutilizables del perfil se separan de la instantánea versionada enviada a cada postulación. Una modificación posterior del perfil no sobrescribe la instantánea institucional. Toda postulación y su expediente quedan aislados por tenant.

## 6. Formulario

Cada institución configura y versiona formularios mediante un constructor controlado. El constructor ofrece tipos y reglas permitidos; no ejecuta JavaScript, HTML activo ni código arbitrario. Publicar una versión no altera postulaciones históricas.

La captura es progresiva y minimizada:

- PIE/NEE es opcional y progresivo, sólo para preparar apoyos o adecuaciones justificadas;
- salud o tratamientos se solicitan únicamente por una necesidad funcional concreta de seguridad, adaptación o actividad, con mínimo detalle;
- no se solicita historia clínica general por defecto;
- el ingreso familiar queda fuera del formulario y análisis académico del MVP de Admisión.

## 7. Documentos

El catálogo documental se configura y versiona por tenant, proceso/año, curso/nivel, oferta y condición. Cada requisito puede ser obligatorio u opcional, aceptar equivalentes, definir vigencia y permitir exención autorizada.

Cuando corresponda informe de personalidad, se acepta el último disponible/vigente conforme a la regla configurada o un documento equivalente del establecimiento anterior. No se exige rígidamente un par de años específico.

Estados funcionales:

- `PENDIENTE`;
- `CARGADO`;
- `EN_REVISION`;
- `ACEPTADO`;
- `OBSERVADO`;
- `REEMPLAZADO`;
- `EXENTO`.

Secretaría puede recibir, digitalizar, cargar y marcar recepción. La validación definitiva corresponde a Responsable de Admisión o revisor autorizado. Una observación identifica el requisito afectado y habilita una corrección con plazo inicial de 3 días hábiles, configurable. El vencimiento no rechaza automáticamente la postulación: requiere revisión humana.

Los reemplazos crean una nueva versión y conservan la anterior, su estado, actor, fecha y relación. Nada se sobrescribe o elimina silenciosamente.

## 8. Postulación asistida

La asistencia ocurre siempre dentro del portal con el apoderado responsable presente. Personal autorizado de Admisión o Secretaría puede completar, cargar y enviar conforme a la autorización registrada.

La evidencia incluye tenant, operador, rol, fecha/hora, origen asistido, adulto presente, autorización o consentimiento aplicable y acciones realizadas. El operador no inventa respuestas ni adquiere capacidad de revisar o decidir por haber asistido.

Los documentos físicos se aceptan excepcionalmente: un funcionario autorizado los digitaliza, carga al requisito correcto y registra origen funcional `PHYSICAL_DOCUMENT`, operador y fecha. El archivo digital pasa al expediente oficial; correo o papel no crean un expediente paralelo.

## 9. Actividades

Entrevista del apoderado y evaluación diagnóstica son obligatorias para todos los postulantes del piloto de 1º básico a 4º medio. En el núcleo, obligatoriedad, ejecutor, modalidad, duración y reglas se configuran por tenant, proceso, oferta, curso y tipo de actividad.

El MVP es presencial; modalidad remota queda diferida. El colegio asigna horario. La familia no selecciona directamente otro horario: solicita cambio en el portal, informa motivo y Admisión o Secretaría reprograma.

Valores iniciales configurables:

- 2 reprogramaciones normales;
- 15 minutos de tolerancia;
- duración según tipo de actividad, sin valor concreto fijado en esta etapa.

La primera inasistencia no cierra ni rechaza automáticamente; debe revisarse o reprogramarse. Ante una segunda inasistencia injustificada, Responsable de Admisión o Dirección puede cerrar manualmente con motivo y auditoría. Nunca se cierra sólo por contador.

Una evaluación puede repetirse por acción autorizada del evaluador o Responsable de Admisión. Cada intento conserva secuencia, fecha, responsable, estado, motivo, resultado/conclusión y relación con el intento anterior.

## 10. Estado y resultado de actividad

El estado operacional se separa del resultado interno. Estados operacionales conceptuales incluyen `PENDIENTE`, `PROGRAMADA`, `REALIZADA`, `REPROGRAMADA`, `INASISTENCIA`, `EXENTA`, `NO_COMPLETADA` y `CERRADA`.

Resultados internos:

- `FAVORABLE`;
- `NO_FAVORABLE`;
- `INCONCLUSO`.

El comentario interno es opcional. La familia no ve resultado interno, comentario, puntajes, conclusión, deliberaciones ni recomendación; sólo ve estado operativo y próximos pasos comunicables.

## 11. Entrevistas y formularios de actividades

La pauta de entrevista puede configurarse con el mismo constructor controlado: tipos permitidos, validación, sensibilidad, permisos y versión, sin código arbitrario. Las preguntas pueden variar por tenant, proceso, curso, oferta y versión.

La pauta diagnóstica avanzada queda como evolución. Para el MVP, la evaluación puede registrar resultado simple y comentario interno opcional.

## 12. Recomendación de Admisión

Opciones internas:

- `RECOMENDAR_ADMISION`;
- `NO_RECOMENDAR_ADMISION`;
- `DEVOLVER_A_REVISION`.

Las tres exigen fundamento. La recomendación es interna, versionada y auditable; no constituye decisión final ni se muestra a la familia.

## 13. Disposición de Dirección

Dirección puede registrar:

- `APROBADO`: decisión favorable que crea reserva, oferta, comunicación preparada y plazo de aceptación de 3 días hábiles;
- `LISTA_DE_ESPERA`: postulante admisible sin oferta inmediata, plazo de aceptación ni handoff;
- `RECHAZADO`: decisión negativa con fundamento obligatorio;
- `DEVUELTO_A_REVISION`: no es decisión definitiva; exige motivo y devuelve el caso a Admisión.

Disposición, actor, rol, tenant, instante, fundamento/motivo, versión de antecedentes y relación con una decisión anterior quedan auditados. `APROBADO` y `LISTA_DE_ESPERA` no son equivalentes.

## 14. Cupos

La institución define cupos manuales por curso y año. El cupo de Admisión es distinto de capacidad académica, matrícula y obligaciones de EduPay.

Responsable de Admisión y Administrador Institucional Máximo pueden modificar cupos. Cada cambio conserva actor, instante, valor anterior, valor nuevo y motivo/comentario cuando corresponda. La operación debe impedir sobreoferta y mantener separadas reserva, oferta, aceptación y matrícula.

## 15. Lista de espera

Sin una prioridad configurada, el orden por defecto es el ingreso. Las prioridades futuras deben ser explícitas, versionadas y auditables, con desempate definido. La posición es interna y la familia no ve número ni reglas internas.

La promoción nunca es automática en el MVP. Sólo Responsable de Admisión o Administrador Institucional Máximo puede promover/ofrecer una vacante. Si Dirección ya determinó admisibilidad, no se requiere una nueva decisión: la promoción crea reserva y oferta por 3 días hábiles. Al vencer, libera el cupo y conserva historial.

## 16. Oferta y aceptación

La oferta normal y la originada en lista de espera muestran estado, origen y fecha/hora exacta de vencimiento. El plazo inicial es 3 días hábiles, configurable por institución/proceso/oferta.

Sin respuesta dentro del plazo, la oferta expira automáticamente, libera la reserva, conserva historia y no inicia handoff. Una reapertura es excepcional, manual, autorizada, justificada y auditada.

La aceptación familiar debe ser expresa, corresponder a una oferta vigente y quedar trazada. Aceptación no equivale a matrícula.

## 17. Comunicación

El portal es la fuente oficial. El correo es el único canal automático del MVP; las llamadas manuales están permitidas y pueden registrarse como contacto. WhatsApp queda diferido.

La comunicación de resultado sigue: disposición de Dirección → mensaje `PREPARED` → confirmación de Responsable de Admisión → envío.

Estados de comunicación:

- `PREPARED`;
- `SENT`;
- `DELIVERED`, sólo con evidencia;
- `FAILED`.

La oferta genera correo y recordatorio antes del vencimiento; la anticipación concreta es configurable. Un fallo de correo crea una tarea interna y no cambia la disposición, oferta ni estado de negocio.

## 18. Dashboard

El dashboard institucional muestra, dentro del tenant y alcance autorizados:

- Nuevas;
- Por revisar;
- Correcciones venciendo;
- Citas próximas;
- Esperando decisión;
- Ofertas por vencer;
- Lista de espera.

También permite comprender etapas completadas, estado actual y próxima acción. No se define una interfaz visual concreta en G1.

## 19. Reportes y exportaciones

El catálogo funcional contempla postulaciones por curso/estado, documentos pendientes, actividades, decisiones, espera, cupos/reservas y ofertas. Responsable de Admisión y Administrador Institucional Máximo pueden exportar dentro de su tenant con propósito, columnas mínimas y auditoría.

Secretaría no tiene exportación masiva por defecto. Los reportes no adjuntan automáticamente archivos sensibles ni categorías altamente restringidas. La exportación conserva solicitante, tenant, propósito, alcance, columnas y descarga.

## 20. Borde funcional con EduPay

Flujo canónico:

```mermaid
flowchart LR
    A["Dirección favorable"] --> B["Reserva"]
    B --> C["Oferta"]
    C --> D["Comunicación"]
    D --> E["Aceptación familiar expresa"]
    E --> F["Handoff a EduPay"]
```

Admisión y EduPay son dominios separados y no comparten tablas. Admisión es dueña de postulación, disposición, cupo, oferta y aceptación. EduPay es dueño de asociación académica, obligaciones y pago. El portal de pagos consulta EduPay.

Q-310 está `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED`: la aceptación expresa precede al handoff. Q-301 a Q-309 quedan `FUTURE_INTEGRATION_PENDING`; G1 no define payload, protocolo, autenticación, mecanismo ni evento contractual. Handoff, estado técnico, pago y matrícula son hechos distintos.

## 21. Privacidad, tenant y auditoría

- Denegación por defecto y mínimo privilegio.
- Aislamiento por tenant para expedientes, archivos, búsquedas, conteos, auditoría y exportaciones.
- Autorización conceptual mediante RBAC, scopes, propósito y sensibilidad.
- PIE/NEE, salud, evaluaciones, comentarios y deliberaciones requieren permisos específicos.
- Las lecturas y modificaciones restringidas son auditables.
- El Administrador Institucional Máximo sólo actúa dentro de su tenant.
- El Superadministrador Global no obtiene lectura implícita. Acceder a contenido requiere elevación explícita, temporal, tenant-specific, scope-specific, justificada y auditada.
- Para el MVP se permite `SELF-ELEVATION`, pero sigue requiriendo una acción explícita con actor, tenant, motivo, alcance, categorías, inicio, expiración y resultado.

## 22. Proyección familiar y límites internos

| La familia puede ver | Permanece interno |
| --- | --- |
| Sus estudiantes y postulaciones autorizadas | Expedientes de otras familias o tenants |
| Oferta publicada y disponibilidad categórica | Cupos numéricos, posición y prioridades de espera |
| Requisitos aplicables, documentos propios, observaciones y plazos | Dictámenes internos, notas y deliberaciones |
| Estado operacional de actividades, citas y próximos pasos | Resultado interno, comentario, puntaje y conclusión |
| Estado general de espera, sin número | Orden interno y criterios no publicados |
| Disposición comunicada y oferta vigente cuando corresponda | Recomendación de Admisión y devoluciones internas no comunicables |
| Estado, origen y vencimiento de su oferta | Datos técnicos de sincronización e integración |
| Confirmación de aceptación y próximos pasos | Handoff como matrícula o pago confirmado sin evidencia de EduPay |

## 23. Límites de G1

Esta especificación no autoriza arquitectura, schemas, endpoints, API, base de datos, Prisma, stack, deployment, colas, contrato técnico con EduPay, implementación ni datos reales. C-013 conserva validación legal pendiente antes de datos reales/piloto productivo. G1 sólo puede cambiar de estado por aprobación humana explícita.
