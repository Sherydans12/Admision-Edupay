# Visión y alcance

## Estado del documento

- **Fuente:** encargo inicial del proyecto, recibido el 6 de agosto de 2026.
- **Estado:** propuesta para revisión; no constituye aprobación funcional ni arquitectónica.
- **Compuerta:** G0 — fundación documental.

## Visión

Admisión EduPay será un portal SaaS multiempresa que permita a instituciones educacionales configurar y administrar procesos de admisión trazables, y a las familias completar postulaciones de manera clara y segura.

El producto debe sostener dos necesidades simultáneas:

1. Una experiencia sencilla para familias que pueden postular a uno o más estudiantes.
2. Una operación institucional configurable por institución, sede, año académico y curso, con controles de capacidad, privacidad y auditoría.

Colegio Particular Conquistadores será el primer piloto, no el modelo de datos ni el límite permanente del producto.

## Resultados buscados

- Reducir fricción y falta de visibilidad durante una postulación.
- Ordenar el trabajo de admisión y sus responsabilidades.
- Asegurar que documentos, decisiones y comunicaciones sean trazables.
- Evitar sobreasignación de cupos y hacer explícita la gestión de lista de espera.
- Proteger datos personales y sensibles mediante acceso por propósito.
- Preparar una entrega controlada al dominio EduPay sin acoplar bases de datos.
- Permitir evolución hacia nuevas instituciones sin reconstruir el núcleo.

## Actores principales

- Apoderado postulante y, cuando corresponda, otros miembros autorizados de la familia.
- Administrador institucional.
- Encargado de admisión.
- Entrevistador o evaluador.
- Dirección o aprobador final.
- Superadministrador de plataforma.
- Sistemas externos, inicialmente EduPay como dominio separado.

## Alcance funcional inicial

### Para familias

- Cuenta, recuperación de acceso y administración de datos familiares.
- Registro de estudiantes y creación de postulaciones por oferta académica habilitada.
- Formulario por pasos, borrador y carga privada de documentos.
- Respuesta a observaciones, agenda o confirmación de entrevistas y seguimiento.
- Comunicaciones, resultado, aceptación o desistimiento y futura derivación a matrícula.

### Para instituciones

- Configuración por institución, sede, año, nivel y curso.
- Gestión de oferta, requisitos, formularios, flujo, cupos y lista de espera.
- Revisión documental, entrevistas, evaluaciones, notas, responsables y decisión final.
- Comunicaciones, auditoría, reportes y exportación según permisos.

### Capacidades transversales

- Identidad, membresías, roles y permisos.
- Aislamiento multiempresa.
- Auditoría de acciones y accesos sensibles.
- Configuración versionada y trazable.
- Límite de integración con EduPay basado en contratos.

## Fuera de alcance de esta fundación documental

- Código de aplicación o prototipo funcional.
- Selección definitiva de frontend, backend, base de datos, nube o proveedor de identidad.
- Esquema SQL, migraciones y modelo físico.
- Contenedores, CI/CD, infraestructura y observabilidad implementada.
- Implementación de pagos, matrícula o contabilidad de EduPay.
- Reglas legales definitivas, política de retención o textos de consentimiento sin validación especializada.
- Automatización definitiva de decisiones de admisión.
- Configuración final de Colegio Conquistadores sin validación con sus responsables.

## Límites de dominio

### Admisión

Es responsable de la oferta de admisión, postulaciones, requisitos, revisión, entrevistas, evaluaciones, decisión, oferta de vacante, lista de espera, comunicaciones y evidencia de entrega a matrícula.

### EduPay

Será responsable de capacidades financieras y de matrícula que se definan en su propio dominio. Admisión no debe escribir sus tablas ni asumir éxito por haber emitido una solicitud.

### Identidad y archivos

Son capacidades transversales potenciales. Su ubicación técnica y propiedad de datos requieren una decisión posterior. Conceptualmente deben respetar tenant, propósito, auditoría y ciclo de vida de la postulación.

## Principios de producto

- Configuración con límites: flexibilidad institucional sin perder semántica común.
- Historia antes que sobreescritura: conservar hechos relevantes y sus autores.
- Vistas apropiadas: el estado operativo interno no se expone literalmente a la familia.
- Acceso por propósito: tener acceso a una postulación no implica ver todos sus datos.
- Capacidad explícita: elegibilidad académica, oferta de vacante y matrícula son hechos diferentes.
- Integración resiliente: contratos versionados, idempotencia y estado de sincronización.

## Indicadores de éxito por definir

No existen todavía metas aprobadas. En diseño funcional se deben acordar al menos:

- Tasa de postulaciones iniciadas que llegan a envío.
- Tiempo de ciclo y tiempo por etapa.
- Porcentaje de casos devueltos por documentos incompletos.
- Cumplimiento de tiempos de respuesta institucionales.
- Ocupación, reservas, aceptación y liberación de cupos.
- Incidentes de acceso indebido o aislamiento entre tenants, cuya tolerancia debe ser cero.

Las fórmulas, ventanas, metas y responsables de estos indicadores son preguntas abiertas.
