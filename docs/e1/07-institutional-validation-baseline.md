# E1-B — Línea base de validación institucional y reglas operativas

## Control del documento

| Campo | Valor |
| --- | --- |
| Etapa | E1-B — Especificación funcional institucional |
| Estado de la etapa | `IN PROGRESS` |
| Fecha de registro | `2026-08-06` |
| Fuente | Respuestas confirmadas por Nicolás Sena como posición institucional/funcional para el piloto |
| Autoridad de la confirmación | Nicolás Sena |
| Piloto | Colegio Particular Conquistadores, Admisión 2027 |
| Base | `main` en `8a7f12bb1bf1f7ca09ff29363ad040c693cc143d` |
| Naturaleza | Especificación funcional; no autoriza código, arquitectura, dependencias ni datos reales |

## Cómo leer esta validación

Esta línea base separa hechos confirmados, decisiones registradas y detalles todavía abiertos. La validación institucional permite iniciar E1-B y deja de tratar C-009, C-011, C-013 y C-014 como contradicciones conceptuales bloqueantes para esta etapa. No cierra G1 ni convierte una regla funcional en autorización legal o técnica.

Los términos como `PHYSICAL_DOCUMENT`, `SELF-ELEVATION` y los nombres de permisos son lenguaje funcional de análisis; no son enums, endpoints, tablas ni contratos de API.

## Estados de las contradicciones

| ID | Estado | Pendiente que permanece |
| --- | --- | --- |
| C-009 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Catálogo de actividades, responsables, suplencias, pautas, modalidades, tolerancias y reglas concretas |
| C-011 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Catálogo del piloto por curso/nivel, condición, vigencia y reglas de equivalencia |
| C-013 | `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING` | Fundamento normativo, textos aplicables, retención, eliminación/anonimización, solicitudes de titulares y matriz legal final |
| C-014 | `INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING` | Personal, suplencias, procedimiento, evidencias y reglas de conservación/devolución física |

Estas cuatro contradicciones ya no bloquean conceptualmente el inicio de E1-B. Los pendientes indicados sí deben permanecer visibles para completar la especificación y preparar G1.

## C-009 — Entrevista y evaluación diagnóstica

### Regla validada

- La entrevista de apoderado y la evaluación diagnóstica son obligatorias para todos los postulantes del piloto desde 1º básico a 4º medio.
- La obligatoriedad no se hardcodea en el núcleo. Se representa mediante configuración versionada por `tenant`, proceso/año, oferta, curso/nivel y tipo de actividad.
- La configuración inicial de Conquistadores 2027 marca ambas actividades como obligatorias para todos los cursos.

### Excepciones y ciclo de vida

- Una excepción requiere actor autorizado, motivo y registro de auditoría.
- La excepción no elimina el historial y queda distinguida de una actividad completada.
- Si una evaluación no puede completarse, el comportamiento normal es registrar que no pudo completarse y reprogramar.
- Un actor institucional autorizado puede, excepcionalmente, eximir, cerrar la actividad o cerrar el proceso/caso cuando corresponda, siempre con motivo y auditoría.
- No se fija todavía qué rol exacto puede cerrar cada caso.
- Una evaluación puede repetirse. Cada intento conserva conceptualmente secuencia, fecha, responsable, estado, motivo de repetición, resultado/conclusión y relación con el intento anterior.
- Nunca se reemplaza silenciosamente una evaluación anterior.

### Pendientes operativos

Pautas, modalidad, responsables y suplencias, número de reprogramaciones, tolerancias, plazos, criterios de cierre y criterios de acceso detallados quedan para E1-B. No se inventan cifras ni nombres.

## C-011 — Informe de personalidad

### Regla validada

- El requisito es configurable por institución, año/proceso, curso/nivel, oferta y condición.
- Cada colegio decide para qué cursos lo exige.
- Cuando se exige, basta el último informe disponible o vigente según las reglas configuradas.
- Se acepta un documento equivalente emitido por el establecimiento anterior.
- Si la familia no dispone del documento, puede existir una exención autorizada.
- La exención registra requisito, actor, motivo, fecha, alcance y auditoría.
- No se exige rígidamente “2025 y 2026” para todos.

### Pendiente operativo

El catálogo concreto del piloto permanece abierto por curso/nivel, condición, vigencia y equivalencias aceptadas.

## C-013 — PIE, NEE, salud e ingreso familiar

### Regla validada

- PIE/NEE son opcionales y de captura progresiva, con finalidad exclusiva de preparar apoyos, adecuaciones o necesidades justificadas.
- PIE/NEE no son un requisito general de elegibilidad y no se muestran por defecto a todos los usuarios de Admisión.
- Salud o tratamientos sólo se capturan ante una necesidad funcional concreta de seguridad, adaptación o actividad, solicitando el mínimo detalle necesario. No se pide historia clínica general por defecto.
- El ingreso familiar queda fuera del formulario de admisión MVP y no integra el análisis académico de admisión. Si otro proceso financiero lo requiere, se trata separadamente.
- El acceso ordinario a PIE/NEE/salud se limita a evaluador, profesional o rol expresamente autorizado y Administrador Institucional Máximo cuando su función lo requiera.
- Entrevistadores, revisores generales y personal completo de Admisión no obtienen acceso automático.
- Todo acceso a categorías altamente restringidas es auditable.

### Pendientes legales

No se emiten conclusiones legales. Antes de datos reales deben definirse fundamento normativo, textos aplicables, retención, eliminación/anonimización, solicitudes de titulares y validación legal de la matriz final.

## C-014 — Portal y postulación asistida

### Regla validada

- El portal es la fuente oficial de todas las postulaciones.
- No existen expedientes paralelos oficiales por correo, planillas, documentos sueltos o papel.
- Una familia con dificultades puede acudir presencialmente al colegio y recibir asistencia de personal de Admisión o Secretaría.
- El funcionario autorizado puede completar, cargar antecedentes y enviar la postulación cuando el apoderado responsable está presente.
- La postulación asistida conserva tenant, operador, rol, fecha/hora, origen asistido, adulto presente, autorización/consentimiento correspondiente y acciones realizadas.
- No se definen todavía mecanismos criptográficos ni de firma.

### Documentación física excepcional

- La documentación física puede aceptarse excepcionalmente.
- Un funcionario autorizado la digitaliza y la carga al requisito documental correspondiente.
- Se registra origen físico, operador y fecha; conceptualmente el origen puede expresarse como `PHYSICAL_DOCUMENT`.
- El documento digital pasa a formar parte del expediente oficial.
- El papel no crea un expediente paralelo dentro del sistema.
- Conservación o devolución del papel queda pendiente de detalle institucional y legal.

## Modelo de administradores

### Administrador Institucional Máximo

Es una capacidad/rol diferenciado y la autoridad administrativa máxima dentro de un único tenant. Puede acceder explícitamente a todas las categorías funcionales de información de su institución, incluidas las restringidas o altamente restringidas, sólo sujeto a tenant, autenticación, permiso, auditoría, propósito y futuras políticas legales. Puede administrar o supervisar configuración, membresías, operación, documentos, decisiones, auditoría, permisos y datos restringidos según la matriz final.

No tiene autoridad sobre otros tenants. Un administrador institucional normal no se considera automáticamente Administrador Institucional Máximo.

### Superadministrador Global de Plataforma

BaseLogic tiene un Superadministrador global; para el MVP, Nicolás Sena ejerce esa función. Su autoridad potencial abarca la plataforma y cualquier tenant, pero ser Superadministrador no otorga lectura implícita ni permanente del contenido institucional.

Para consultar contenido de un tenant debe existir una elevación explícita, temporal, específica de tenant y alcance, justificada y auditable. La elevación registra como mínimo actor, tenant, motivo, alcance, categorías solicitadas, inicio, expiración, resultado y auditoría.

Para el MVP se aprueba conceptualmente `SELF-ELEVATION`: el Superadministrador global puede autorizar su propia elevación. Esto exige una acción explícita y auditable antes de acceder; no permite acceso silencioso. El acceso ordinario a métricas, disponibilidad, configuración técnica y salud del servicio debe diseñarse sin leer contenido personal cuando no sea necesario.

Para evolución multioperador queda como control futuro propuesto que algunas categorías altamente restringidas puedan requerir aprobación independiente o doble control. No se aprueba todavía ese mecanismo.

## Impacto en E1-B

E1-B debe completar, sin inventar valores, catálogos concretos, personas y suplencias, cantidades, plazos, modalidades, pautas, criterios de espera, plantillas, reportes y reglas de excepción. El modelo funcional debe conservar historial, distinguir completado/exento/no completado/cerrado, vincular intentos y registrar origen documental.

El modelo de permisos debe separar Administrador Institucional Máximo de administrador institucional normal, aplicar acceso por tenant y propósito, limitar datos C-013 por categoría y auditar elevaciones, accesos restringidos, excepciones, postulaciones asistidas y documentos físicos.

## Asuntos que continúan pendientes

- Nombres, suplencias y delegaciones del personal.
- Cupos, duración de reservas, cantidades de reprogramaciones y tolerancias.
- Pautas de entrevista, evaluación y recomendación.
- Criterios de lista de espera, textos de comunicación, reportes y SLA.
- Catálogo concreto de personalidad del piloto.
- Reglas legales de retención, eliminación, anonimización y solicitudes de titulares.
- Contrato Q-301 a Q-309 con EduPay.
- Arquitectura, API, base de datos, dependencias, código y datos reales.

## Límites de la validación

Esta validación no cierra G1, no autoriza E2/G2, no aprueba ADR-0001, no autoriza código, scaffolding, arquitectura, dependencias, integración ejecutable ni datos reales. Tampoco define cargos nominados, cifras, políticas legales, mecanismos criptográficos, firma, retención física o una matriz final de permisos.
